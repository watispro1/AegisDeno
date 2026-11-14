import { createHash } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { Client } from "discord.js";
import { logger } from "../utils/logger";
import { styles } from "./theme";
import { clientScript } from "./client";
import { statusScript } from "./client/status";
import { type StatusPayload } from "./statusData";
import { registerStatusRoutes } from "./statusRoutes";
import { faviconSvg, ogImageSvg, ogImagePng, manifest, themeInitScript } from "./assets";
import { botPermissionBitfield } from "./catalog";
import {
  renderHome,
  renderFeatures,
  renderCommands,
  renderDocs,
  renderTroubleshooting,
  renderChangelog,
  renderDashboardChangelog,
  renderStatus,
  renderTerms,
  renderPrivacy,
  renderSecurity,
  renderNotFound,
  renderWhy,
  renderRoadmap,
  SiteConfig,
  Stats,
} from "./pages";
import { buildInviteUrl } from "./invite";
import { SUPPORT_SERVER_INVITE } from "./layout";
import { suggestPages } from "./notFound";
import { commands } from "../commands/loader";
import { VERSION } from "../version";
import { createDashboardRouter } from "./dashboard/router";
import { readDashboardConfig, missingDashboardSettings } from "./dashboard/config";
import { discordBotView, cachedBotView } from "./dashboard/botView";
import { mongoDashboardData } from "./dashboard/data";
import { mongoModuleData } from "./dashboard/moduleData";
import { mongoSessionStore } from "./dashboard/sessions";
import { mongoRateLimitStore } from "./dashboard/rateLimitStore";
import { mongoAuditStore } from "./dashboard/audit";
import { mongoDashboardExtras } from "./dashboard/extrasMongo";
import { dashboardScript } from "./dashboard/client";
import { securityHeaders } from "./securityHeaders";
import { databaseConnected } from "../services/statusMonitor";
import { registerApiRoutes } from "./apiRoutes";
import { registerSiteRoutes } from "./siteRoutes";
import { apiRateLimit, compression, siteErrorHandler } from "./serverMiddleware";

export { siteErrorHandler };

/** Largest request body the site accepts at all; route parsers set tighter limits. */
const MAX_REQUEST_BYTES = 600 * 1024;

const SITE_VERSION = VERSION;
const STARTED_AT = Date.now();

/** Cache-busting token derived from asset contents, so deploys invalidate caches. */
const ASSET_VERSION = createHash("sha256")
  .update(styles)
  .update(clientScript)
  .update(themeInitScript)
  .update(dashboardScript)
  .update(statusScript)
  .digest("hex")
  .slice(0, 8);

function siteConfig(): SiteConfig {
  const appId = process.env.DISCORD_APPLICATION_ID?.trim();
  const permissions = botPermissionBitfield().toString();
  const inviteUrl = buildInviteUrl({ appId, permissions, configured: process.env.BOT_INVITE_URL });

  return {
    inviteUrl,
    // The public support server unless the deployment points somewhere else.
    supportUrl: process.env.SUPPORT_SERVER_URL?.trim() || SUPPORT_SERVER_INVITE,
    version: SITE_VERSION,
    // Optional. Without it the legal pages point to GitHub instead of an inbox.
    contactEmail: process.env.CONTACT_EMAIL?.trim() || "",
    assetVersion: ASSET_VERSION,
  };
}

function collectStats(client: Client | undefined): Stats {
  const guilds = Array.from(client?.guilds?.cache?.values() ?? []);
  return {
    guilds: guilds.length,
    users: guilds.reduce((acc, g) => acc + (g.memberCount ?? 0), 0),
    commands: commands.size,
    ping: Math.max(0, Math.round(client?.ws?.ping ?? 0)),
    uptime: client?.uptime ?? 0,
  };
}

function applySecurityHeaders(req: Request, res: Response): void {
  for (const [name, value] of Object.entries(securityHeaders(req.path))) res.setHeader(name, value);
}

interface RouteDef {
  path: string;
  render: (cfg: SiteConfig, ctx: RenderContext) => string | Promise<string>;
  priority: string;
  /** Pages that embed live metrics must never be served stale. */
  live?: boolean;
}

interface RenderContext {
  stats: Stats;
  online: boolean;
  startedAt: number;
  status: () => Promise<StatusPayload>;
  /** Parsed query string (flat: strings or lists of strings). */
  query: Record<string, unknown>;
}

const ROUTES: RouteDef[] = [
  { path: "/", render: (c, x) => renderHome(c, x.stats, x.online), priority: "1.0", live: true },
  { path: "/features", render: c => renderFeatures(c), priority: "0.9" },
  { path: "/why", render: c => renderWhy(c), priority: "0.8" },
  { path: "/commands", render: (c, x) => renderCommands(c, x.query), priority: "0.9" },
  { path: "/docs", render: c => renderDocs(c), priority: "0.8" },
  { path: "/troubleshooting", render: c => renderTroubleshooting(c), priority: "0.7" },
  { path: "/changelog", render: c => renderChangelog(c), priority: "0.6" },
  { path: "/roadmap", render: c => renderRoadmap(c), priority: "0.5" },
  // Public and static, so it is served (and indexed) even when the dashboard is off.
  // Registered before the /dashboard router, which would otherwise treat it as a server ID.
  { path: "/dashboard/changelog", render: c => renderDashboardChangelog(c), priority: "0.4" },
  { path: "/status", render: async (c, x) => renderStatus(c, await x.status()), priority: "0.6", live: true },
  { path: "/privacy", render: c => renderPrivacy(c), priority: "0.4" },
  { path: "/terms", render: c => renderTerms(c), priority: "0.4" },
  { path: "/security", render: c => renderSecurity(c), priority: "0.3" },
];

/** Pages offered on the 404 page when an address is a typo away from one. */
const SUGGESTABLE = [
  { href: "/features", label: "Features" },
  { href: "/why", label: "Why Aegis" },
  { href: "/commands", label: "Commands" },
  { href: "/docs", label: "Docs" },
  { href: "/troubleshooting", label: "Troubleshooting" },
  { href: "/changelog", label: "Changelog" },
  { href: "/roadmap", label: "What's next" },
  { href: "/status", label: "Status" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/security", label: "Security" },
  { href: "/dashboard", label: "Dashboard" },
];


export interface WebServerOptions {
  /** Defaults to the mongoose connection state. */
  databaseReady?: () => boolean;
}

export function startWebServer(client: Client, opts: WebServerOptions = {}) {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const cfg = siteConfig();
  const origin = (process.env.SITE_URL || "").replace(/\/$/, "");

  app.disable("x-powered-by");
  // Query strings are parsed flat (no nested objects), so a value is a string or a list of strings.
  app.set("query parser", "simple");
  app.use((req: Request, res: Response, next: NextFunction) => {
    applySecurityHeaders(req, res);
    next();
  });
  // Only GET/HEAD (and the Top.gg webhook and dashboard forms, which bound their own bodies) are served.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const length = Number(req.headers["content-length"] ?? 0);
    if (Number.isFinite(length) && length > MAX_REQUEST_BYTES) {
      res.status(413).type("text/plain").send("Request too large");
      return;
    }
    next();
  });
  app.use(compression);
  app.use("/api", apiRateLimit);

  const online = (): boolean => Boolean(client?.isReady?.());

  // Heartbeat samples, the public status payload and /api/status (statusRoutes.ts).
  const statusPayload = registerStatusRoutes(app, {
    online, stats: () => collectStats(client), client, version: SITE_VERSION, startedAt: STARTED_AT,
  });

  const asset = (res: Response, type: string, body: string | Buffer, maxAge = 3600) => {
    res.setHeader("Cache-Control", `public, max-age=${maxAge}, immutable`);
    res.type(type).send(body);
  };

  app.get("/assets/site.css", (_req, res) => asset(res, "text/css", styles, 31536000));
  app.get("/assets/site.js", (_req, res) => asset(res, "text/javascript", clientScript, 31536000));
  app.get("/assets/dashboard.js", (_req, res) => asset(res, "text/javascript", dashboardScript, 31536000));
  app.get("/assets/status.js", (_req, res) => asset(res, "text/javascript", statusScript, 31536000));
  app.get("/assets/theme-init.js", (_req, res) => asset(res, "text/javascript", themeInitScript, 31536000));
  app.get("/assets/favicon.svg", (_req, res) => asset(res, "image/svg+xml", faviconSvg, 31536000));
  app.get("/assets/og.svg", (_req, res) => asset(res, "image/svg+xml", ogImageSvg, 31536000));
  app.get("/assets/og.png", (_req, res) => asset(res, "image/png", ogImagePng, 31536000));
  app.get("/manifest.webmanifest", (_req, res) => asset(res, "application/manifest+json", manifest, 3600));

  registerApiRoutes(app, {
    online, databaseReady: opts.databaseReady ?? databaseConnected, stats: () => collectStats(client), version: SITE_VERSION, startedAt: STARTED_AT,
  });
  registerSiteRoutes(app, { origin, inviteUrl: cfg.inviteUrl, startedAt: STARTED_AT, sitemap: ROUTES });

  const send = (res: Response, html: string, code = 200, cacheControl?: string) => {
    res.setHeader(
      "Cache-Control",
      cacheControl ?? "public, max-age=300, stale-while-revalidate=86400"
    );
    res.status(code).type("html").send(html);
  };

  for (const route of ROUTES) {
    app.get(route.path, async (req, res, next) => {
      try {
        const ctx: RenderContext = {
          stats: collectStats(client),
          online: online(),
          startedAt: STARTED_AT,
          status: statusPayload,
          query: (req.query ?? {}) as Record<string, unknown>,
        };
        send(res, await route.render(cfg, ctx), 200, route.live ? "no-cache" : undefined);
      } catch (err) {
        next(err);
      }
    });
  }

  // Web dashboard. Without its env vars every /dashboard route shows a
  // "not configured" page and nothing else on the site changes.
  const dashboardConfig = readDashboardConfig();
  if (!dashboardConfig) {
    logger.info(`Web dashboard off; missing: ${missingDashboardSettings().join(", ")}`);
  }
  app.use("/dashboard", createDashboardRouter({
    site: cfg,
    config: dashboardConfig,
    bot: cachedBotView(discordBotView(client)),
    data: mongoDashboardData(client),
    modules: mongoModuleData(client),
    sessions: mongoSessionStore(),
    rateLimits: mongoRateLimitStore(),
    audit: mongoAuditStore(),
    extras: mongoDashboardExtras(client),
  }));

  app.use((req: Request, res: Response) => {
    const suggestions = suggestPages(req.path, SUGGESTABLE, Array.from(commands.keys()));
    send(res, renderNotFound(cfg, suggestions, req.path), 404, "no-store");
  });

  // Last resort: never send a stack trace or error message to the client.
  app.use(siteErrorHandler);

  app.listen(PORT, () => {
    logger.info(`Website listening on port ${PORT} (${ROUTES.length} pages, build ${ASSET_VERSION})`);
  });
}
