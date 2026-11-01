/**
 * Shared context for the /dashboard route modules (see ../router.ts).
 */
import express, { type NextFunction, type Request, type Response } from "express";
import { logger } from "../../../utils/logger";
import type { SiteConfig } from "../../pages";
import { DASHBOARD_PERMISSION_LABELS, markRolesForViewer, type BotView, type DashboardPermission, type RoleOption } from "../botView";
import { memoryAuditStore, type AuditStore } from "../audit";
import { memoryRateLimitStore, type RateLimitStore } from "../rateLimitStore";
import type { DashboardConfig } from "../config";
import type { DashboardData } from "../data";
import { type FetchLike } from "../discordOAuth";
import { guildInviteUrl, isSnowflake, partitionGuilds } from "../permissions";
import type { ModuleData } from "../moduleData";
import { memoryModuleData } from "../moduleDataMemory";
import { memoryDashboardExtras, type DashboardExtras } from "../extras";
import { SESSION_COOKIE, SESSION_TTL_MS, cookieNames, csrfToken, originAllowed, parseCookies, serializeCookie, verifyCsrf, verifySessionCookie } from "../security";
import { hasOperatorKeys } from "../../../utils/mongoSafe";
import { guildIconUrl, userAvatarUrl } from "../cdn";
import type { SessionData, SessionStore } from "../sessions";
import { type FormBody, type ValidationContext } from "../validation";
import { renderError, type GuildContext, type Viewer } from "../views";

export const CASES_PER_PAGE = 25;
/** Cookie holding the last server opened (an ID only; access is re-checked on every request). */
export const LAST_GUILD_COOKIE = "aegis_last_guild";
export const APPEALS_PER_PAGE = 25;
export const AUDIT_PER_PAGE = 50;
/** Body limit for ordinary dashboard forms. */
export const DASHBOARD_FORM_LIMIT = "32kb";
/**
 * Body limit for the automod settings form. A full blocked word list (500 × 100
 * characters) URL-encodes to at most about 450 KB when every character is
 * multi-byte; ASCII lists are around 55 KB. Still bounded.
 */
export const AUTOMOD_FORM_LIMIT = "512kb";
/**
 * Body limit for forms that carry the embed builder (announcements, welcome,
 * goodbye). A full embed is 6000 characters plus 2000 of message text; at the
 * worst case of nine URL-encoded bytes per character that is about 72 KB.
 */
export const EMBED_FORM_LIMIT = "128kb";

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
  /** Module pages' data (autoresponders, giveaways, …). Defaults to in-memory; production passes the Mongo version. */
  modules?: ModuleData;
  /** Members, search, analytics, Incident Mode and settings transfer. Defaults to in-memory; production passes the Mongo version. */
  extras?: DashboardExtras;
}

export interface Authed {
  sessionId: string;
  session: SessionData;
  viewer: Viewer;
}

export interface GuildLocals extends Authed {
  ctx: GuildContext;
}

/** Fly sets Fly-Client-IP on every request it proxies; fall back to the socket address. */
function clientKey(req: Request): string {
  const fly = req.headers["fly-client-ip"];
  return (typeof fly === "string" && fly) || req.ip || req.socket.remoteAddress || "unknown";
}

const RATE_WINDOW_MS = 60_000;

/**
 * What a rate-limited request is told. A refused form post says plainly that
 * nothing was saved, so nobody assumes the change went through.
 */
export function rateLimitMessage(method: string, retryAfterSeconds: number): string {
  const wait = `${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"}`;
  return method === "POST"
    ? `Nothing was saved. Wait ${wait}, then go back and send the form again (your browser usually keeps what you typed).`
    : `Wait ${wait}, then reload the page.`;
}

/**
 * Whether an error means the database could not be reached (server selection,
 * network, buffering timeouts), as opposed to a bug. Those get a 503 with
 * Retry-After instead of a generic 500.
 */
export function isDatabaseUnavailable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = String((err as { name?: unknown }).name ?? "");
  const message = String((err as { message?: unknown }).message ?? "");
  if (/^Mongo(ose)?(ServerSelection|Network|NetworkTimeout|Timeout|NotConnected|TopologyClosed)Error$/.test(name)) return true;
  // Mongoose's own wording when the connection is down or never came up.
  return /buffering timed out after|Client must be connected before running operations|Topology is closed/i.test(message);
}

/** Seconds a client should wait after a database outage before retrying. */
export const DATABASE_RETRY_AFTER_SECONDS = 30;

function limit(store: RateLimitStore, bucket: string, max: number, deps: DashboardDeps) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await store.hit(bucket, clientKey(req), max, RATE_WINDOW_MS, deps.now?.() ?? Date.now());
      if (result.allowed) return next();
      res.setHeader("Retry-After", String(result.retryAfterSeconds));
      res.status(429).type("html").send(renderError(deps.site, {
        status: 429,
        title: "Too many requests",
        message: rateLimitMessage(req.method, result.retryAfterSeconds),
      }));
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Everything the route modules share: the injected deps, the rate limiters and
 * body parsers, session/CSRF/guild guards, and small response helpers. Built
 * once per router by createDashboardRouter.
 */
export function createRouteKit(deps: DashboardDeps, cfg: DashboardConfig) {
  const now = () => deps.now?.() ?? Date.now();
  const fetchImpl = deps.fetchImpl ?? fetch;

  const secret = cfg.sessionSecret;
  const store = deps.rateLimits ?? memoryRateLimitStore();
  const audit = deps.audit ?? memoryAuditStore();
  const modules = deps.modules ?? memoryModuleData();
  const extras = deps.extras ?? memoryDashboardExtras();
  const authLimit = limit(store, "auth", deps.limits?.auth ?? 20, deps);
  const postLimit = limit(store, "post", deps.limits?.post ?? 30, deps);
  const pageLimit = limit(store, "page", deps.limits?.page ?? 240, deps);
  const form = express.urlencoded({ extended: false, limit: DASHBOARD_FORM_LIMIT, parameterLimit: 200 });
  // The automod page carries the blocked word list, which may be up to 500 × 100 characters.
  const automodForm = express.urlencoded({ extended: false, limit: AUTOMOD_FORM_LIMIT, parameterLimit: 200 });
  const embedForm = express.urlencoded({ extended: false, limit: EMBED_FORM_LIMIT, parameterLimit: 200 });
  const settingsForm = (req: Request, res: Response, next: NextFunction) =>
    (req.params.section === "automod" ? automodForm : req.params.section === "welcome" || req.params.section === "goodbye" ? embedForm : form)(req, res, next);

  const send = (res: Response, html: string, status = 200) => res.status(status).type("html").send(html);
  const fail = (res: Response, status: number, title: string, message: string, viewer?: Viewer) =>
    send(res, renderError(deps.site, { status, title, message, viewer }), status);

  const names = cookieNames(cfg.secureCookies);
  const cookie = (name: string, value: string, maxAgeMs: number) =>
    serializeCookie(name, value, { maxAgeSeconds: maxAgeMs / 1000, secure: cfg.secureCookies, path: names.path });
  /** Expire the pre-__Host- session cookie (Path=/dashboard). Only meaningful on https. */
  const clearLegacySession = () =>
    serializeCookie(SESSION_COOKIE, "", { maxAgeSeconds: 0, secure: cfg.secureCookies, path: "/dashboard" });

  /**
   * One-time move of a signed-in browser from the old `aegis_dash` cookie to
   * `__Host-aegis_dash`, so the rename does not sign anybody out. The value is
   * the same signed session ID; a bad signature just clears the old cookie.
   */
  const migrateLegacyCookie = (req: Request, res: Response, next: NextFunction) => {
    if (!cfg.secureCookies) return next();
    const jar = parseCookies(req.headers.cookie);
    const legacy = jar[SESSION_COOKIE];
    if (legacy === undefined) return next();
    res.append("Set-Cookie", clearLegacySession());
    if (!jar[names.session] && verifySessionCookie(secret, legacy)) {
      res.append("Set-Cookie", cookie(names.session, legacy, SESSION_TTL_MS));
      req.headers.cookie = `${req.headers.cookie ?? ""}; ${names.session}=${encodeURIComponent(legacy)}`;
    }
    next();
  };

  /**
   * Refuse query strings or form bodies with Mongo-operator keys ("$ne",
   * "a.b") outright. Dashboard parsers only produce strings, so this is
   * defence in depth against a parser change turning a value into an operator.
   */
  const rejectOperatorInput = (req: Request, res: Response, next: NextFunction) => {
    if (hasOperatorKeys(req.query) || hasOperatorKeys(req.body)) {
      logger.warn(`Dashboard: refused operator-looking input on ${req.method} ${req.path}`);
      return fail(res, 400, "Bad request", "That request contained characters the dashboard does not accept.");
    }
    next();
  };

  async function loadSession(req: Request): Promise<Authed | null> {
    const sessionId = verifySessionCookie(secret, parseCookies(req.headers.cookie)[names.session]);
    if (!sessionId) return null;
    const session = await deps.sessions.get(sessionId, now()).catch((err) => {
      // A database outage is not a sign-out: surface it (503) rather than
      // bouncing the user to the landing page or losing their form as "signed out".
      if (isDatabaseUnavailable(err)) throw err;
      logger.error("Dashboard: session lookup failed", err);
      return null;
    });
    if (!session) return null;
    return {
      sessionId,
      session,
      viewer: { userId: session.userId, username: session.username, globalName: session.globalName, csrf: csrfToken(secret, sessionId), avatarUrl: userAvatarUrl(session.userId, session.avatar) },
    };
  }

  /** Session required. GETs without one go to the landing page. */
  const requireSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authed = await loadSession(req);
      if (!authed) {
        if (req.method === "GET") return res.redirect(302, "/dashboard");
        return send(res, renderError(deps.site, {
          status: 401,
          title: "Signed out",
          message: "Your session ended, so nothing was saved. Log in again, then send the form again.",
          action: { label: "Log in with Discord", href: "/dashboard/login" },
        }), 401);
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
    if (hasOperatorKeys(req.body)) {
      return fail(res, 400, "Bad request", "That form contained characters the dashboard does not accept.", authed.viewer);
    }
    if (!originAllowed(origin, cfg.origin) || !verifyCsrf(secret, authed.sessionId, body._csrf)) {
      logger.warn(`Dashboard: CSRF/origin check failed for ${req.method} ${req.path} (user ${authed.session.userId})`);
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
        const invite = guildInviteUrl(deps.site.inviteUrl, guildId);
        return send(res, renderError(deps.site, {
          status: 404,
          title: "Aegis is not in that server",
          message: "Aegis was removed from this server, or was never added. Add it, then refresh your server list; or pick another server.",
          viewer: authed.viewer,
          ...(invite ? { action: { label: "Add Aegis to this server", href: invite, external: true } } : {}),
        }), 404);
      }
      const allowed = await deps.bot.memberCanManage(guildId, authed.session.userId);
      if (!allowed) {
        logger.info(`Dashboard: refused guild ${guildId} for user ${authed.session.userId}`);
        return fail(res, 403, "No access to this server", "You need Manage Server or Administrator in this server. If you were just given it, wait a minute and reload.", authed.viewer);
      }
      // The viewer's highest role bounds which roles they may hand out (see rolesFor).
      const roleLimit = await deps.bot.viewerRoleLimit(guildId, authed.session.userId).catch(() => ({ ownerId: null, topPosition: null }));
      // The switcher lists servers from the login's list that Aegis is in and the viewer may manage (each is re-checked on open).
      const servers = partitionGuilds(authed.session.guilds ?? [], (id) => deps.bot.hasGuild(id)).manageable.map(s => ({ id: s.id, name: s.name, iconUrl: guildIconUrl(s.id, s.icon) }));
      const ctx: GuildContext = { guild, viewer: authed.viewer, nameOf: (id) => deps.bot.userName(id), roleLimit, servers };
      res.locals.dash = { ...authed, ctx } satisfies GuildLocals;
      // Remember the last server opened, so the picker can offer it first. Only an ID, never trusted for access.
      if (req.method === "GET") res.append("Set-Cookie", serializeCookie(LAST_GUILD_COOKIE, guildId, { maxAgeSeconds: 30 * 86_400, secure: cfg.secureCookies, path: "/dashboard" }));
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

  /**
   * The server's roles for this viewer: each is marked aboveViewer when it is
   * at or above the viewer's highest role (owner exempt), on top of the bot's
   * own assignable check. Pickers and validation both read this list.
   */
  function rolesFor(ctx: GuildContext): RoleOption[] {
    return markRolesForViewer(deps.bot.roles(ctx.guild.id), ctx.viewer.userId, ctx.roleLimit);
  }

  function validationContext(ctx: GuildContext): ValidationContext {
    const guildId = ctx.guild.id;
    return {
      textChannelIds: new Set(deps.bot.textChannels(guildId).map(c => c.id)),
      hiddenChannelIds: deps.bot.hiddenChannelIds(guildId),
      roles: new Map(rolesFor(ctx).map(r => [r.id, { assignable: r.assignable, aboveViewer: r.aboveViewer === true }])),
    };
  }

  const guildGet = [pageLimit, requireSession, requireGuild];
  const guildPost = [postLimit, form, requireSession, requireCsrf, requireGuild];
  const settingsPost = [postLimit, settingsForm, requireSession, requireCsrf, requireGuild];
  const embedPost = [postLimit, embedForm, requireSession, requireCsrf, requireGuild];

  return {
    deps, cfg, now, fetchImpl, secret, audit, modules, extras,
    authLimit, postLimit, pageLimit, form, settingsForm,
    send, fail, cookie, names, clearLegacySession, migrateLegacyCookie, rejectOperatorInput, loadSession,
    requireSession, requireCsrf, requireGuild, missingPermission, requirePermission,
    actorOf, logAudit, noticeParam, validationContext, rolesFor,
    guildGet, guildPost, settingsPost, embedPost,
  };
}

export type RouteKit = ReturnType<typeof createRouteKit>;
