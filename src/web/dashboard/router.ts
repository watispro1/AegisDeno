/**
 * Express router for /dashboard. Mounted by server.ts; all dependencies are
 * injected so tests can run it with a fake bot, in-memory sessions and a
 * mocked Discord API.
 */
import express, { type NextFunction, type Request, type Response, type Router } from "express";
import { logger } from "../../utils/logger";
import type { SiteConfig } from "../pages";
import type { BotView } from "./botView";
import type { DashboardConfig } from "./config";
import type { DashboardData, SettingsValue } from "./data";
import { authorizeUrl, exchangeCode, fetchUser, fetchUserGuilds, revokeToken, type FetchLike } from "./discordOAuth";
import { guildInviteUrl, isSnowflake, partitionGuilds } from "./permissions";
import {
  RateLimiter,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  STATE_COOKIE,
  STATE_TTL_MS,
  createOAuthState,
  csrfToken,
  originAllowed,
  parseCookies,
  randomToken,
  serializeCookie,
  signSessionId,
  verifyCsrf,
  verifyOAuthState,
  verifySessionCookie,
} from "./security";
import type { SessionData, SessionStore } from "./sessions";
import {
  isSettingsSection,
  parseAutomod,
  parseCaseFilter,
  parseCaseReason,
  parseEscalation,
  parseLogging,
  parseStarboard,
  parseTickets,
  parseVerification,
  parseWelcome,
  type FormBody,
  type Parsed,
  type SettingsSection,
  type ValidationContext,
} from "./validation";
import {
  renderCase,
  renderCases,
  renderError,
  renderLanding,
  renderNotConfigured,
  renderOverview,
  renderPicker,
  renderSettings,
  settingsValues,
  submittedValues,
  type GuildContext,
  type Viewer,
} from "./views";

export const CASES_PER_PAGE = 25;
/** Re-fetch the user's guild list on the picker when it is older than this. */
const GUILD_LIST_MAX_AGE_MS = 10 * 60 * 1000;

export interface DashboardDeps {
  site: SiteConfig;
  config: DashboardConfig | null;
  bot: BotView;
  data: DashboardData;
  sessions: SessionStore;
  fetchImpl?: FetchLike;
  now?: () => number;
  /** Requests per minute per client. Defaults: auth 20, POST 30, pages 240. */
  limits?: { auth?: number; post?: number; page?: number };
}

interface Authed {
  sessionId: string;
  session: SessionData;
  viewer: Viewer;
}

interface GuildLocals extends Authed {
  ctx: GuildContext;
}

/** Fly sets Fly-Client-IP on every request it proxies; fall back to the socket address. */
function clientKey(req: Request): string {
  const fly = req.headers["fly-client-ip"];
  return (typeof fly === "string" && fly) || req.ip || req.socket.remoteAddress || "unknown";
}

function limit(limiter: RateLimiter, deps: DashboardDeps) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = limiter.hit(clientKey(req), deps.now?.());
    if (result.allowed) return next();
    res.setHeader("Retry-After", String(result.retryAfterSeconds));
    res.status(429).type("html").send(renderError(deps.site, {
      status: 429,
      title: "Too many requests",
      message: `Wait ${result.retryAfterSeconds} seconds and try again.`,
    }));
  };
}

export function createDashboardRouter(deps: DashboardDeps): Router {
  const router = express.Router();
  const now = () => deps.now?.() ?? Date.now();
  const fetchImpl = deps.fetchImpl ?? fetch;

  // Nothing under /dashboard may be cached or indexed: pages carry per-user data.
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("Vary", "Cookie, Accept-Encoding");
    next();
  });

  const cfg = deps.config;
  if (!cfg) {
    router.get(/.*/, (_req, res) => {
      res.status(200).type("html").send(renderNotConfigured(deps.site));
    });
    router.post(/.*/, (_req, res) => {
      res.status(503).type("html").send(renderNotConfigured(deps.site));
    });
    return router;
  }

  const secret = cfg.sessionSecret;
  const authLimiter = new RateLimiter(deps.limits?.auth ?? 20, 60_000);
  const postLimiter = new RateLimiter(deps.limits?.post ?? 30, 60_000);
  const pageLimiter = new RateLimiter(deps.limits?.page ?? 240, 60_000);
  const form = express.urlencoded({ extended: false, limit: "32kb", parameterLimit: 200 });

  const send = (res: Response, html: string, status = 200) => res.status(status).type("html").send(html);
  const fail = (res: Response, status: number, title: string, message: string, viewer?: Viewer) =>
    send(res, renderError(deps.site, { status, title, message, viewer }), status);

  const cookie = (name: string, value: string, maxAgeMs: number) =>
    serializeCookie(name, value, { maxAgeSeconds: maxAgeMs / 1000, secure: cfg.secureCookies });

  async function loadSession(req: Request): Promise<Authed | null> {
    const sessionId = verifySessionCookie(secret, parseCookies(req.headers.cookie)[SESSION_COOKIE]);
    if (!sessionId) return null;
    const session = await deps.sessions.get(sessionId, now()).catch((err) => {
      logger.error("Dashboard: session lookup failed", err);
      return null;
    });
    if (!session) return null;
    return {
      sessionId,
      session,
      viewer: { userId: session.userId, username: session.username, globalName: session.globalName, csrf: csrfToken(secret, sessionId) },
    };
  }

  /** Session required. GETs without one go to the landing page. */
  const requireSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authed = await loadSession(req);
      if (!authed) {
        if (req.method === "GET") return res.redirect(302, "/dashboard");
        return fail(res, 401, "Signed out", "Your session ended. Log in again.");
      }
      res.locals.dash = authed;
      next();
    } catch (err) {
      next(err);
    }
  };

  /** POST guard: same-origin Origin header (when sent) and a valid CSRF token for this session. */
  const requireCsrf = (req: Request, res: Response, next: NextFunction) => {
    const authed = res.locals.dash as Authed;
    const origin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
    const body = (req.body ?? {}) as FormBody;
    if (!originAllowed(origin, cfg.origin) || !verifyCsrf(secret, authed.sessionId, body._csrf)) {
      return fail(res, 403, "Form expired", "That form was opened in another session or has expired. Reload the page and try again.", authed.viewer);
    }
    next();
  };

  /**
   * Guild guard. The bot must be in the server, and the live bot client must
   * confirm the user is the owner or has Administrator / Manage Server now.
   */
  const requireGuild = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authed = res.locals.dash as Authed;
      const guildId = String(req.params.guildId ?? "");
      if (!isSnowflake(guildId)) return fail(res, 404, "Server not found", "That is not a server ID.", authed.viewer);
      const guild = deps.bot.guild(guildId);
      if (!guild) {
        return fail(res, 404, "Aegis is not in that server", "Add Aegis to the server first, or pick another server from your list.", authed.viewer);
      }
      const allowed = await deps.bot.memberCanManage(guildId, authed.session.userId);
      if (!allowed) {
        logger.info(`Dashboard: refused guild ${guildId} for user ${authed.session.userId}`);
        return fail(res, 403, "No access to this server", "You need Manage Server or Administrator in this server. If you were just given it, wait a minute and reload.", authed.viewer);
      }
      const ctx: GuildContext = { guild, viewer: authed.viewer, nameOf: (id) => deps.bot.userName(id) };
      res.locals.dash = { ...authed, ctx } satisfies GuildLocals;
      next();
    } catch (err) {
      next(err);
    }
  };

  const noticeParam = (req: Request): string | null => (typeof req.query.notice === "string" ? req.query.notice.slice(0, 40) : null);

  /* ── Auth ─────────────────────────────────────────────────────────── */

  router.get("/login", limit(authLimiter, deps), (_req, res) => {
    const { state, cookie: stateCookie } = createOAuthState(secret, now());
    res.setHeader("Set-Cookie", cookie(STATE_COOKIE, stateCookie, STATE_TTL_MS));
    res.redirect(302, authorizeUrl(cfg, state));
  });

  router.get("/callback", limit(authLimiter, deps), async (req, res, next) => {
    const clearState = cookie(STATE_COOKIE, "", 0);
    try {
      const cookies = parseCookies(req.headers.cookie);
      if (typeof req.query.error === "string") {
        res.setHeader("Set-Cookie", clearState);
        return send(res, renderLanding(deps.site, "denied"), 400);
      }
      if (!verifyOAuthState(secret, cookies[STATE_COOKIE], req.query.state, now())) {
        res.setHeader("Set-Cookie", clearState);
        return send(res, renderLanding(deps.site, "state"), 400);
      }
      const code = typeof req.query.code === "string" ? req.query.code : "";
      if (!code || code.length > 200) {
        res.setHeader("Set-Cookie", clearState);
        return send(res, renderLanding(deps.site, "discord"), 400);
      }

      let token, user, guilds;
      try {
        token = await exchangeCode(cfg, code, fetchImpl);
        [user, guilds] = await Promise.all([fetchUser(token.accessToken, fetchImpl), fetchUserGuilds(token.accessToken, fetchImpl)]);
      } catch (err) {
        logger.warn(`Dashboard login failed: ${(err as Error)?.message ?? "unknown error"}`);
        res.setHeader("Set-Cookie", clearState);
        return send(res, renderLanding(deps.site, "discord"), 502);
      }

      const sessionId = randomToken(32);
      const at = now();
      await deps.sessions.create(sessionId, {
        userId: user.id,
        username: user.username,
        globalName: user.globalName,
        accessToken: token.accessToken,
        tokenExpiresAt: new Date(at + token.expiresInSeconds * 1000),
        guilds,
        guildsFetchedAt: new Date(at),
        createdAt: new Date(at),
        expiresAt: new Date(at + SESSION_TTL_MS),
      });
      logger.info(`Dashboard: user ${user.id} signed in`);
      res.setHeader("Set-Cookie", [clearState, cookie(SESSION_COOKIE, signSessionId(secret, sessionId), SESSION_TTL_MS)]);
      res.redirect(302, "/dashboard");
    } catch (err) {
      next(err);
    }
  });

  router.post("/logout", limit(postLimiter, deps), form, async (req, res, next) => {
    try {
      const authed = await loadSession(req);
      if (authed) {
        res.locals.dash = authed;
        let csrfOk = false;
        requireCsrf(req, res, () => { csrfOk = true; });
        if (!csrfOk) return;
        await deps.sessions.destroy(authed.sessionId);
        void revokeToken(cfg, authed.session.accessToken, fetchImpl);
      }
      res.setHeader("Set-Cookie", cookie(SESSION_COOKIE, "", 0));
      res.redirect(303, "/dashboard");
    } catch (err) {
      next(err);
    }
  });

  /* ── Server picker ───────────────────────────────────────────────── */

  async function refreshGuilds(authed: Authed): Promise<boolean> {
    if (authed.session.tokenExpiresAt.getTime() <= now()) return false;
    try {
      const guilds = await fetchUserGuilds(authed.session.accessToken, fetchImpl);
      await deps.sessions.updateGuilds(authed.sessionId, guilds, new Date(now()));
      authed.session.guilds = guilds;
      authed.session.guildsFetchedAt = new Date(now());
      return true;
    } catch (err) {
      logger.warn(`Dashboard: guild list refresh failed: ${(err as Error)?.message ?? "unknown error"}`);
      return false;
    }
  }

  router.get("/", limit(pageLimiter, deps), async (req, res, next) => {
    try {
      const authed = await loadSession(req);
      if (!authed) return send(res, renderLanding(deps.site, null));
      if (now() - authed.session.guildsFetchedAt.getTime() > GUILD_LIST_MAX_AGE_MS) await refreshGuilds(authed);
      const { manageable, invitable } = partitionGuilds(authed.session.guilds, (id) => deps.bot.hasGuild(id));
      send(res, renderPicker(
        deps.site,
        authed.viewer,
        manageable,
        invitable.map(guild => ({ guild, inviteUrl: guildInviteUrl(deps.site.inviteUrl, guild.id) })),
        noticeParam(req),
      ));
    } catch (err) {
      next(err);
    }
  });

  router.post("/refresh", limit(postLimiter, deps), form, requireSession, requireCsrf, async (_req, res, next) => {
    try {
      const ok = await refreshGuilds(res.locals.dash as Authed);
      res.redirect(303, `/dashboard?notice=${ok ? "refreshed" : "refresh-failed"}`);
    } catch (err) {
      next(err);
    }
  });

  /* ── Guild pages ─────────────────────────────────────────────────── */

  const guildGet = [limit(pageLimiter, deps), requireSession, requireGuild];
  const guildPost = [limit(postLimiter, deps), form, requireSession, requireCsrf, requireGuild];

  router.get("/:guildId", ...guildGet, async (_req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      send(res, renderOverview(deps.site, ctx, await deps.data.overview(ctx.guild.id)));
    } catch (err) {
      next(err);
    }
  });

  router.get("/:guildId/cases", ...guildGet, async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const filter = parseCaseFilter(req.query as Record<string, unknown>);
      const result = await deps.data.listCases(ctx.guild.id, filter, CASES_PER_PAGE);
      send(res, renderCases(deps.site, ctx, filter, result, CASES_PER_PAGE));
    } catch (err) {
      next(err);
    }
  });

  router.get("/:guildId/cases/:caseId", ...guildGet, async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const record = await deps.data.getCase(ctx.guild.id, String(req.params.caseId));
      if (!record) return fail(res, 404, "Case not found", "No case or warning with that ID exists in this server.", ctx.viewer);
      send(res, renderCase(deps.site, ctx, record, { noticeCode: noticeParam(req) }));
    } catch (err) {
      next(err);
    }
  });

  router.post("/:guildId/cases/:caseId/reason", ...guildPost, async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const caseId = String(req.params.caseId);
      const record = await deps.data.getCase(ctx.guild.id, caseId);
      if (!record) return fail(res, 404, "Case not found", "No case or warning with that ID exists in this server.", ctx.viewer);
      const parsed = parseCaseReason(req.body as FormBody);
      if (!parsed.ok) {
        return send(res, renderCase(deps.site, ctx, record, { reasonError: parsed.errors.reason, reasonValue: String((req.body as FormBody).reason ?? "") }), 400);
      }
      await deps.data.editCaseReason(ctx.guild.id, caseId, parsed.value, { userId: ctx.viewer.userId, username: ctx.viewer.username });
      res.redirect(303, `/dashboard/${ctx.guild.id}/cases/${encodeURIComponent(caseId)}?notice=reason`);
    } catch (err) {
      next(err);
    }
  });

  router.post("/:guildId/cases/:caseId/revoke", ...guildPost, async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const caseId = String(req.params.caseId);
      const ok = await deps.data.revokeCase(ctx.guild.id, caseId, { userId: ctx.viewer.userId, username: ctx.viewer.username });
      res.redirect(303, `/dashboard/${ctx.guild.id}/cases/${encodeURIComponent(caseId)}?notice=${ok ? "revoked" : "already-revoked"}`);
    } catch (err) {
      next(err);
    }
  });

  /* ── Settings ────────────────────────────────────────────────────── */

  router.get("/:guildId/settings", ...guildGet, (_req, res) => {
    const { ctx } = res.locals.dash as GuildLocals;
    res.redirect(302, `/dashboard/${ctx.guild.id}/settings/logging`);
  });

  function validationContext(guildId: string): ValidationContext {
    return {
      textChannelIds: new Set(deps.bot.textChannels(guildId).map(c => c.id)),
      roles: new Map(deps.bot.roles(guildId).map(r => [r.id, { assignable: r.assignable }])),
    };
  }

  function parseSection(section: SettingsSection, body: FormBody, vctx: ValidationContext): Parsed<SettingsValue> {
    const wrap = <T>(p: Parsed<T>, make: (v: T) => SettingsValue): Parsed<SettingsValue> => (p.ok ? { ok: true, value: make(p.value) } : p);
    switch (section) {
      case "logging": return wrap(parseLogging(body, vctx), value => ({ section, value }));
      case "escalation": return wrap(parseEscalation(body), value => ({ section, value }));
      case "automod": return wrap(parseAutomod(body), value => ({ section, value }));
      case "welcome": return wrap(parseWelcome(body, vctx), value => ({ section, value }));
      case "tickets": return wrap(parseTickets(body, vctx), value => ({ section, value }));
      case "verification": return wrap(parseVerification(body, vctx), value => ({ section, value }));
      case "starboard": return wrap(parseStarboard(body, vctx), value => ({ section, value }));
    }
  }

  router.get("/:guildId/settings/:section", ...guildGet, async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const section = req.params.section;
      if (!isSettingsSection(section)) return fail(res, 404, "No such settings page", "Pick a section from the settings menu.", ctx.viewer);
      const snapshot = await deps.data.loadSettings(ctx.guild.id);
      send(res, renderSettings(
        deps.site, ctx, section, snapshot,
        { values: settingsValues(section, snapshot), errors: {} },
        deps.bot.textChannels(ctx.guild.id), deps.bot.roles(ctx.guild.id), noticeParam(req),
      ));
    } catch (err) {
      next(err);
    }
  });

  router.post("/:guildId/settings/:section", ...guildPost, async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const section = req.params.section;
      if (!isSettingsSection(section)) return fail(res, 404, "No such settings page", "Pick a section from the settings menu.", ctx.viewer);
      const body = (req.body ?? {}) as FormBody;
      const parsed = parseSection(section, body, validationContext(ctx.guild.id));
      if (!parsed.ok) {
        const snapshot = await deps.data.loadSettings(ctx.guild.id);
        // Keep display-only values (word count, emoji) that are not form fields.
        const values = { ...settingsValues(section, snapshot), ...submittedValues(body) };
        for (const [key, v] of Object.entries(settingsValues(section, snapshot))) {
          if (typeof v === "boolean" && !(key in body)) values[key] = false;
        }
        return send(res, renderSettings(
          deps.site, ctx, section, snapshot, { values, errors: parsed.errors },
          deps.bot.textChannels(ctx.guild.id), deps.bot.roles(ctx.guild.id), null,
        ), 400);
      }
      const saved = await deps.data.saveSettings(ctx.guild.id, parsed.value, { userId: ctx.viewer.userId, username: ctx.viewer.username });
      res.redirect(303, `/dashboard/${ctx.guild.id}/settings/${section}?notice=${saved ? "saved" : "verification-missing"}`);
    } catch (err) {
      next(err);
    }
  });

  // Errors inside the dashboard get a plain page; details stay in the server log.
  router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = typeof (err as { status?: unknown })?.status === "number" ? (err as { status: number }).status : 500;
    if (status === 413) return fail(res, 413, "Form too large", "That form was larger than the dashboard accepts.");
    if (status === 400) return fail(res, 400, "Bad request", "The form could not be read. Reload the page and try again.");
    logger.error("Dashboard error:", err instanceof Error ? err.message : err);
    fail(res, 500, "Something went wrong", "The dashboard hit an error. Nothing was changed if you were saving. Try again in a moment.");
  });

  return router;
}
