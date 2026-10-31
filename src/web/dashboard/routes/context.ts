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
import { isSnowflake } from "../permissions";
import { SESSION_COOKIE, csrfToken, originAllowed, parseCookies, serializeCookie, verifyCsrf, verifySessionCookie } from "../security";
import type { SessionData, SessionStore } from "../sessions";
import { type FormBody, type ValidationContext } from "../validation";
import { renderError, type GuildContext, type Viewer } from "../views";

export const CASES_PER_PAGE = 25;
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
  const authLimit = limit(store, "auth", deps.limits?.auth ?? 20, deps);
  const postLimit = limit(store, "post", deps.limits?.post ?? 30, deps);
  const pageLimit = limit(store, "page", deps.limits?.page ?? 240, deps);
  const form = express.urlencoded({ extended: false, limit: DASHBOARD_FORM_LIMIT, parameterLimit: 200 });
  // The automod page carries the blocked word list, which may be up to 500 × 100 characters.
  const automodForm = express.urlencoded({ extended: false, limit: AUTOMOD_FORM_LIMIT, parameterLimit: 200 });
  const settingsForm = (req: Request, res: Response, next: NextFunction) =>
    (req.params.section === "automod" ? automodForm : form)(req, res, next);

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
      // The viewer's highest role bounds which roles they may hand out (see rolesFor).
      const roleLimit = await deps.bot.viewerRoleLimit(guildId, authed.session.userId).catch(() => ({ ownerId: null, topPosition: null }));
      const ctx: GuildContext = { guild, viewer: authed.viewer, nameOf: (id) => deps.bot.userName(id), roleLimit };
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

  return {
    deps, cfg, now, fetchImpl, secret, audit,
    authLimit, postLimit, pageLimit, form, settingsForm,
    send, fail, cookie, loadSession,
    requireSession, requireCsrf, requireGuild, missingPermission, requirePermission,
    actorOf, logAudit, noticeParam, validationContext, rolesFor,
    guildGet, guildPost, settingsPost,
  };
}

export type RouteKit = ReturnType<typeof createRouteKit>;
