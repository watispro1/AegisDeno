/**
 * Express router for /dashboard. Mounted by server.ts; all dependencies are
 * injected so tests can run it with a fake bot, in-memory sessions and a
 * mocked Discord API.
 */
import express, { type NextFunction, type Request, type Response, type Router } from "express";
import { logger } from "../../utils/logger";
import type { SiteConfig } from "../pages";
import { DASHBOARD_PERMISSION_LABELS, type BotView, type DashboardPermission } from "./botView";
import { describeChanges, memoryAuditStore, type AuditStore } from "./audit";
import { memoryRateLimitStore, type RateLimitStore } from "./rateLimitStore";
import type { PanelResult } from "./data";
import type { DashboardConfig } from "./config";
import type { DashboardData, SettingsSnapshot, SettingsValue } from "./data";
import { authorizeUrl, exchangeCode, fetchUser, fetchUserGuilds, revokeToken, type FetchLike } from "./discordOAuth";
import { guildInviteUrl, isSnowflake, partitionGuilds } from "./permissions";
import {
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
  parseAppealFilter,
  parseAppealReview,
  parseAutomod,
  parseRevoke,
  parseRolePanelRepost,
  parseTicketPanel,
  parseVerificationPanel,
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
  MULTI_FIELDS,
  renderActivity,
  renderAppeal,
  renderAppeals,
  renderCase,
  renderCases,
  renderPanels,
  renderError,
  renderLanding,
  renderNotConfigured,
  renderOverview,
  renderPicker,
  renderSettings,
  settingsValues,
  submittedValues,
  type GuildContext,
  type PanelsState,
  type Viewer,
} from "./views";

export const CASES_PER_PAGE = 25;
export const APPEALS_PER_PAGE = 25;
export const AUDIT_PER_PAGE = 50;
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
  /** Where rate-limit counters live. Defaults to in-memory; production passes the Mongo store. */
  rateLimits?: RateLimitStore;
  /** Dashboard change log. Defaults to in-memory; production passes the Mongo store. */
  audit?: AuditStore;
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

const RATE_WINDOW_MS = 60_000;

function limit(store: RateLimitStore, bucket: string, max: number, deps: DashboardDeps) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await store.hit(bucket, clientKey(req), max, RATE_WINDOW_MS, deps.now?.() ?? Date.now());
      if (result.allowed) return next();
      res.setHeader("Retry-After", String(result.retryAfterSeconds));
      res.status(429).type("html").send(renderError(deps.site, {
        status: 429,
        title: "Too many requests",
        message: `Wait ${result.retryAfterSeconds} seconds and try again.`,
      }));
    } catch (err) {
      next(err);
    }
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
  const store = deps.rateLimits ?? memoryRateLimitStore();
  const audit = deps.audit ?? memoryAuditStore();
  const authLimit = limit(store, "auth", deps.limits?.auth ?? 20, deps);
  const postLimit = limit(store, "post", deps.limits?.post ?? 30, deps);
  const pageLimit = limit(store, "page", deps.limits?.page ?? 240, deps);
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

  /** Whether the viewer lacks an extra permission an action needs; returns its label, or null when they have it. */
  async function missingPermission(ctx: GuildContext, permission: DashboardPermission): Promise<string | null> {
    const ok = await deps.bot.memberHasPermission(ctx.guild.id, ctx.viewer.userId, permission).catch(() => false);
    return ok ? null : DASHBOARD_PERMISSION_LABELS[permission];
  }

  /** POST guard for actions whose slash command needs more than Manage Server. */
  const requirePermission = (permission: DashboardPermission) => async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const missing = await missingPermission(ctx, permission);
      if (missing) {
        logger.info(`Dashboard: ${permission} refused in guild ${ctx.guild.id} for user ${ctx.viewer.userId}`);
        return fail(res, 403, "Missing permission", `This needs ${missing} in this server, the same as the slash command.`, ctx.viewer);
      }
      next();
    } catch (err) {
      next(err);
    }
  };

  const actorOf = (ctx: GuildContext) => ({ userId: ctx.viewer.userId, username: ctx.viewer.username });
  const logAudit = (ctx: GuildContext, action: string, target: string | null, summary: string) =>
    audit.record({ guildId: ctx.guild.id, userId: ctx.viewer.userId, username: ctx.viewer.username, action, target, summary }).catch(() => undefined);

  const noticeParam = (req: Request): string | null => (typeof req.query.notice === "string" ? req.query.notice.slice(0, 40) : null);

  /* ── Auth ─────────────────────────────────────────────────────────── */

  router.get("/login", authLimit, (_req, res) => {
    const { state, cookie: stateCookie } = createOAuthState(secret, now());
    res.setHeader("Set-Cookie", cookie(STATE_COOKIE, stateCookie, STATE_TTL_MS));
    res.redirect(302, authorizeUrl(cfg, state));
  });

  router.get("/callback", authLimit, async (req, res, next) => {
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

  router.post("/logout", postLimit, form, async (req, res, next) => {
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

  router.get("/", pageLimit, async (req, res, next) => {
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

  router.post("/refresh", postLimit, form, requireSession, requireCsrf, async (_req, res, next) => {
    try {
      const ok = await refreshGuilds(res.locals.dash as Authed);
      res.redirect(303, `/dashboard?notice=${ok ? "refreshed" : "refresh-failed"}`);
    } catch (err) {
      next(err);
    }
  });

  /* ── Guild pages ─────────────────────────────────────────────────── */

  const guildGet = [pageLimit, requireSession, requireGuild];
  const guildPost = [postLimit, form, requireSession, requireCsrf, requireGuild];

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
      const edited = await deps.data.editCaseReason(ctx.guild.id, caseId, parsed.value, actorOf(ctx));
      if (edited) await logAudit(ctx, "case.reason", caseId, describeChanges({ reason: record.reason }, { reason: parsed.value }));
      res.redirect(303, `/dashboard/${ctx.guild.id}/cases/${encodeURIComponent(caseId)}?notice=reason`);
    } catch (err) {
      next(err);
    }
  });

  router.post("/:guildId/cases/:caseId/revoke", ...guildPost, async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const caseId = String(req.params.caseId);
      const caseUrl = `/dashboard/${ctx.guild.id}/cases/${encodeURIComponent(caseId)}`;
      const record = await deps.data.getCase(ctx.guild.id, caseId);
      if (!record) return fail(res, 404, "Case not found", "No case or warning with that ID exists in this server.", ctx.viewer);
      const wantsUnban = parseRevoke(req.body as FormBody).unban && record.kind === "case" && record.action === "ban";
      // Unbanning is checked before anything changes, so a refusal leaves the case as it was.
      if (wantsUnban) {
        const missing = await missingPermission(ctx, "BanMembers");
        if (missing) return fail(res, 403, "Missing permission", `Unbanning needs ${missing} in this server, the same as /unban. Nothing was changed.`, ctx.viewer);
      }
      const ok = await deps.data.revokeCase(ctx.guild.id, caseId, actorOf(ctx));
      if (!ok) return res.redirect(303, `${caseUrl}?notice=already-revoked`);
      if (!wantsUnban) {
        await logAudit(ctx, "case.revoke", caseId, `${record.action} for member ${record.userId}`);
        return res.redirect(303, `${caseUrl}?notice=revoked`);
      }
      const outcome = await deps.data.unbanCaseMember(ctx.guild.id, record, actorOf(ctx));
      await logAudit(ctx, "case.revoke+unban", caseId, `ban for member ${record.userId}; unban: ${outcome}`);
      const code = outcome === "done" ? "revoked-unbanned" : outcome === "not-banned" ? "revoked-not-banned" : "revoked-unban-failed";
      res.redirect(303, `${caseUrl}?notice=${code}`);
    } catch (err) {
      next(err);
    }
  });

  /* ── Appeals ─────────────────────────────────────────────────────── */

  router.get("/:guildId/appeals", ...guildGet, async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const filter = parseAppealFilter(req.query as Record<string, unknown>);
      const [result, missing] = await Promise.all([
        deps.data.listAppeals(ctx.guild.id, filter.status, filter.page, APPEALS_PER_PAGE),
        missingPermission(ctx, "BanMembers"),
      ]);
      send(res, renderAppeals(deps.site, ctx, filter, result, APPEALS_PER_PAGE, { missingPermission: missing, noticeCode: noticeParam(req) }));
    } catch (err) {
      next(err);
    }
  });

  router.get("/:guildId/appeals/:code", ...guildGet, async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const appeal = await deps.data.getAppeal(ctx.guild.id, String(req.params.code));
      if (!appeal) return fail(res, 404, "Appeal not found", "No appeal with that code exists in this server.", ctx.viewer);
      const missing = await missingPermission(ctx, "BanMembers");
      send(res, renderAppeal(deps.site, ctx, appeal, { missingPermission: missing, noticeCode: noticeParam(req) }));
    } catch (err) {
      next(err);
    }
  });

  router.post("/:guildId/appeals/:code/review", ...guildPost, requirePermission("BanMembers"), async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const appeal = await deps.data.getAppeal(ctx.guild.id, String(req.params.code));
      if (!appeal) return fail(res, 404, "Appeal not found", "No appeal with that code exists in this server.", ctx.viewer);
      const url = `/dashboard/${ctx.guild.id}/appeals/${encodeURIComponent(appeal.code)}`;
      const body = (req.body ?? {}) as FormBody;
      const parsed = parseAppealReview(body);
      if (!parsed.ok) {
        return send(res, renderAppeal(deps.site, ctx, appeal, { errors: parsed.errors, noteValue: typeof body.note === "string" ? body.note : "" }), 400);
      }
      const outcome = await deps.data.reviewAppeal(ctx.guild.id, appeal.code, parsed.value.decision, parsed.value.note, actorOf(ctx));
      if (!outcome.ok) {
        if (outcome.reason === "not_found") return fail(res, 404, "Appeal not found", "No appeal with that code exists in this server.", ctx.viewer);
        return res.redirect(303, `${url}?notice=appeal-reviewed`);
      }
      await logAudit(ctx, `appeal.${parsed.value.decision}`, appeal.code,
        `member ${appeal.userId}${outcome.unban ? `; unban: ${outcome.unban}` : ""}${parsed.value.note ? `; note: ${parsed.value.note}` : ""}`);
      const code = parsed.value.decision === "denied" ? "appeal-denied" : outcome.unban === "failed" ? "appeal-approved-unban-failed" : "appeal-approved";
      res.redirect(303, `${url}?notice=${code}`);
    } catch (err) {
      next(err);
    }
  });

  /* ── Panels ──────────────────────────────────────────────────────── */

  async function panelsPage(ctx: GuildContext, noticeCode: string | null, state?: PanelsState): Promise<string> {
    const [rolePanels, snapshot, ticketsMissing, rolesMissing] = await Promise.all([
      deps.data.listRolePanels(ctx.guild.id),
      deps.data.loadSettings(ctx.guild.id),
      missingPermission(ctx, "ManageChannels"),
      missingPermission(ctx, "ManageRoles"),
    ]);
    return renderPanels(deps.site, ctx, {
      channels: deps.bot.textChannels(ctx.guild.id),
      roles: deps.bot.roles(ctx.guild.id),
      rolePanels,
      verificationSetUp: snapshot.verification !== null,
      state,
      noticeCode,
      missing: { tickets: ticketsMissing, roles: rolesMissing },
    });
  }

  const panelNotice = (result: PanelResult, okCode: string) =>
    result === "posted" ? okCode : result === "channel-missing" ? "panel-channel-missing" : result === "not-found" ? "panel-not-found" : "panel-failed";

  router.get("/:guildId/panels", ...guildGet, async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      send(res, await panelsPage(ctx, noticeParam(req)));
    } catch (err) {
      next(err);
    }
  });

  router.post("/:guildId/panels/tickets", ...guildPost, requirePermission("ManageChannels"), async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const body = (req.body ?? {}) as FormBody;
      const parsed = parseTicketPanel(body, validationContext(ctx.guild.id));
      if (!parsed.ok) return send(res, await panelsPage(ctx, null, { form: "ticket", values: submittedValues(body), errors: parsed.errors }), 400);
      const result = await deps.data.postTicketPanel(ctx.guild.id, parsed.value, actorOf(ctx));
      if (result === "posted") await logAudit(ctx, "panel.ticket", parsed.value.channelId, `in channel ${parsed.value.channelId}${parsed.value.staffRoleId ? `, staff role ${parsed.value.staffRoleId}` : ""}`);
      res.redirect(303, `/dashboard/${ctx.guild.id}/panels?notice=${panelNotice(result, "panel-posted")}#tickets`);
    } catch (err) {
      next(err);
    }
  });

  router.post("/:guildId/panels/verification", ...guildPost, requirePermission("ManageRoles"), async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const body = (req.body ?? {}) as FormBody;
      const parsed = parseVerificationPanel(body, validationContext(ctx.guild.id));
      if (!parsed.ok) return send(res, await panelsPage(ctx, null, { form: "verification", values: submittedValues(body), errors: parsed.errors }), 400);
      const result = await deps.data.setupVerificationPanel(ctx.guild.id, parsed.value, actorOf(ctx));
      if (result === "posted") {
        await logAudit(ctx, "panel.verification", parsed.value.channelId,
          `in channel ${parsed.value.channelId}, role ${parsed.value.verifiedRoleId}, ${parsed.value.type}, auto-kick ${parsed.value.kickUnverifiedMinutes} min`);
        return res.redirect(303, `/dashboard/${ctx.guild.id}/settings/verification?notice=verification-posted`);
      }
      res.redirect(303, `/dashboard/${ctx.guild.id}/panels?notice=${panelNotice(result, "panel-posted")}#verification`);
    } catch (err) {
      next(err);
    }
  });

  router.post("/:guildId/panels/roles/:panelId", ...guildPost, requirePermission("ManageRoles"), async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const panelId = String(req.params.panelId);
      if (!/^panel-[\w-]{1,64}$/.test(panelId)) return fail(res, 404, "Panel not found", "That role panel does not exist.", ctx.viewer);
      const parsed = parseRolePanelRepost((req.body ?? {}) as FormBody, validationContext(ctx.guild.id));
      if (!parsed.ok) return res.redirect(303, `/dashboard/${ctx.guild.id}/panels?notice=panel-channel-missing#roles`);
      const result = await deps.data.repostRolePanel(ctx.guild.id, panelId, parsed.value.channelId, actorOf(ctx));
      if (result === "posted") await logAudit(ctx, "panel.role", panelId, `to channel ${parsed.value.channelId}`);
      res.redirect(303, `/dashboard/${ctx.guild.id}/panels?notice=${panelNotice(result, "rolepanel-posted")}#roles`);
    } catch (err) {
      next(err);
    }
  });

  /* ── Activity ────────────────────────────────────────────────────── */

  router.get("/:guildId/activity", ...guildGet, async (req, res, next) => {
    try {
      const { ctx } = res.locals.dash as GuildLocals;
      const raw = Number(typeof req.query.page === "string" ? req.query.page : "");
      const page = Number.isInteger(raw) && raw >= 1 && raw <= 10_000 ? raw : 1;
      const result = await audit.list(ctx.guild.id, { page, perPage: AUDIT_PER_PAGE });
      send(res, renderActivity(deps.site, ctx, page, result, AUDIT_PER_PAGE));
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

  function parseSection(section: SettingsSection, body: FormBody, vctx: ValidationContext, current: SettingsSnapshot): Parsed<SettingsValue> {
    const wrap = <T>(p: Parsed<T>, make: (v: T) => SettingsValue): Parsed<SettingsValue> => (p.ok ? { ok: true, value: make(p.value) } : p);
    switch (section) {
      case "logging": return wrap(parseLogging(body, vctx), value => ({ section, value }));
      case "escalation": return wrap(parseEscalation(body), value => ({ section, value }));
      case "automod": return wrap(parseAutomod(body, vctx, current.automod), value => ({ section, value }));
      case "welcome": return wrap(parseWelcome(body, vctx), value => ({ section, value }));
      case "tickets": return wrap(parseTickets(body, vctx), value => ({ section, value }));
      case "verification": return wrap(parseVerification(body, vctx), value => ({ section, value }));
      case "starboard": return wrap(parseStarboard(body, vctx, current.starboard), value => ({ section, value }));
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
      const before = await deps.data.loadSettings(ctx.guild.id);
      const parsed = parseSection(section, body, validationContext(ctx.guild.id), before);
      if (!parsed.ok) {
        // Keep display-only values that are not form fields.
        const values = { ...settingsValues(section, before), ...submittedValues(body) };
        for (const [key, v] of Object.entries(settingsValues(section, before))) {
          if (typeof v === "boolean" && !(key in body)) values[key] = false;
        }
        for (const key of MULTI_FIELDS[section] ?? []) if (!(key in body)) values[key] = "";
        return send(res, renderSettings(
          deps.site, ctx, section, before, { values, errors: parsed.errors },
          deps.bot.textChannels(ctx.guild.id), deps.bot.roles(ctx.guild.id), null,
        ), 400);
      }
      const saved = await deps.data.saveSettings(ctx.guild.id, parsed.value, actorOf(ctx));
      if (saved) {
        const after = await deps.data.loadSettings(ctx.guild.id).catch(() => before);
        await logAudit(ctx, `settings.${section}`, null, describeChanges(settingsValues(section, before), settingsValues(section, after)));
      }
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
