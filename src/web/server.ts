import { createHash } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { Client } from "discord.js";
import { logger } from "../utils/logger";
import { styles } from "./theme";
import { clientScript } from "./client";
import { statusScript } from "./client/status";
import { type StatusPayload } from "./statusData";
import { registerStatusRoutes } from "./statusRoutes";
import { faviconSvg, markSvg, ogImageSvg, ogImagePng, manifest, themeInitScript } from "./assets";
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
  renderPremium,
  renderPricing,
  renderRefunds,
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
import { rateLimitStoreFromEnv } from "./dashboard/rateLimitStore";
import { mongoAuditStore } from "./dashboard/audit";
import { mongoDashboardExtras } from "./dashboard/extrasMongo";
import { dashboardScript } from "./dashboard/client";
import { premiumScript } from "./dashboard/clientPremium";
import { securityHeaders } from "./securityHeaders";
import { databaseConnected } from "../services/statusMonitor";
import { backendHealthy, registerApiRoutes, startBackendProbe } from "./apiRoutes";
import { registerStripeWebhook } from "./stripeWebhook";
import { missingStripeSettings, premiumOffered, readStripeConfig } from "../config/stripe";
import { registerSiteRoutes } from "./siteRoutes";
import { apiRateLimit, assetCacheControl, compression, GZIP_MIN_BYTES, gzipAsync, HtmlCache, htmlCacheKey, prepareAsset, sendAsset, siteErrorHandler, type StaticAsset } from "./serverMiddleware";

export { siteErrorHandler };

/** Largest request body the site accepts at all; route parsers set tighter limits. */
const MAX_REQUEST_BYTES = 600 * 1024;

const SITE_VERSION = VERSION;
/** How long a rendered public page is reused (live stats on it may be this stale). */
export const PUBLIC_HTML_TTL_MS = 45_000;
const STARTED_AT = Date.now();

/** Cache-busting token derived from asset contents, so deploys invalidate caches. */
const ASSET_VERSION = createHash("sha256")
  .update(styles)
  .update(clientScript)
  .update(themeInitScript)
  .update(dashboardScript)
  .update(statusScript)
  .update(premiumScript)
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
  { path: "/pricing", render: c => renderPricing(c, premiumOffered()), priority: "0.8" },
  { path: "/premium", render: c => renderPremium(c, premiumOffered()), priority: "0.5" },
  { path: "/refunds", render: c => renderRefunds(c), priority: "0.4" },
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
  { href: "/pricing", label: "Pricing" },
  { href: "/premium", label: "Premium" },
  { href: "/refunds", label: "Refund Policy" },
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
  // main() starts AegisDB before the web server; here we only watch its health.
  startBackendProbe();
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
    online, stats: () => collectStats(client), client, version: SITE_VERSION, startedAt: STARTED_AT, aegisDbHealthy: backendHealthy,
  });

  // Static assets are built from TS strings, so they are gzipped once here at
  // boot (never per request) and served with a content-hash ETag. Year-long
  // immutable caching only for ?v=<current build>; see assetCacheControl.
  const YEAR = 31536000;
  const staticAssets: Array<[string, StaticAsset, number]> = [
    ["/assets/site.css", prepareAsset("text/css", styles), YEAR],
    ["/assets/site.js", prepareAsset("text/javascript", clientScript), YEAR],
    ["/assets/dashboard.js", prepareAsset("text/javascript", dashboardScript), YEAR],
    ["/assets/premium.js", prepareAsset("text/javascript", premiumScript), YEAR],
    ["/assets/status.js", prepareAsset("text/javascript", statusScript), YEAR],
    ["/assets/theme-init.js", prepareAsset("text/javascript", themeInitScript), YEAR],
    ["/assets/favicon.svg", prepareAsset("image/svg+xml", faviconSvg), YEAR],
    ["/assets/mark.svg", prepareAsset("image/svg+xml", markSvg), 86400],
    ["/assets/og.svg", prepareAsset("image/svg+xml", ogImageSvg), YEAR],
    ["/assets/og.png", prepareAsset("image/png", ogImagePng), YEAR],
    ["/manifest.webmanifest", prepareAsset("application/manifest+json", manifest), 3600],
  ];
  for (const [path, prepared, maxAge] of staticAssets) {
    app.get(path, (req, res) => sendAsset(req, res, prepared, assetCacheControl(req.query.v, ASSET_VERSION, maxAge)));
  }

  registerApiRoutes(app, {
    online, databaseReady: opts.databaseReady ?? databaseConnected, stats: () => collectStats(client), version: SITE_VERSION, startedAt: STARTED_AT,
  });
  // Aegis Premium (Stripe Billing). Raw body, verified signature; 503 until STRIPE_WEBHOOK_SECRET is set.
  registerStripeWebhook(app);
  if (!readStripeConfig()) logger.info(`Aegis Premium hidden; Stripe settings missing: ${missingStripeSettings().join(", ")}`);
  registerSiteRoutes(app, { origin, inviteUrl: cfg.inviteUrl, startedAt: STARTED_AT, sitemap: ROUTES });

  const send = (res: Response, html: string, code = 200, cacheControl?: string) => {
    res.setHeader(
      "Cache-Control",
      cacheControl ?? "public, max-age=300, stale-while-revalidate=86400"
    );
    res.status(code).type("html").send(html);
  };

  // Rendered public pages are cached briefly, keyed by everything that changes
  // the markup: path, query string, whether the bot is online and whether
  // Premium is offered. The theme is applied client-side (localStorage), so it
  // is not an input. Live stats on the home page may be up to the TTL stale.
  // /status stays uncached; the dashboard never passes through here.
  const htmlCache = new HtmlCache(PUBLIC_HTML_TTL_MS);
  for (const route of ROUTES) {
    const cacheable = route.path !== "/status";
    app.get(route.path, async (req, res, next) => {
      try {
        const query = (req.query ?? {}) as Record<string, unknown>;
        const isOnline = online();
        const key = cacheable ? htmlCacheKey(route.path, query, [isOnline, premiumOffered()]) : "";
        let html = cacheable ? htmlCache.get(key) : undefined;
        res.setHeader("X-Page-Cache", html !== undefined ? "hit" : cacheable ? "miss" : "bypass");
        if (html === undefined) {
          const ctx: RenderContext = {
            stats: collectStats(client),
            online: isOnline,
            startedAt: STARTED_AT,
            status: statusPayload,
            query,
          };
          html = await route.render(cfg, ctx);
          if (cacheable) htmlCache.set(key, html);
        }
        // A cached page is gzipped once (async) and the bytes reused until it expires.
        if (cacheable && /\bgzip\b/.test(String(req.headers["accept-encoding"] ?? "")) && Buffer.byteLength(html, "utf8") >= GZIP_MIN_BYTES) {
          let gz = htmlCache.getGzip(key);
          if (!gz) {
            gz = await gzipAsync(Buffer.from(html, "utf8"));
            htmlCache.setGzip(key, html, gz);
          }
          res.setHeader("Content-Encoding", "gzip");
          res.setHeader("Cache-Control", route.live ? "no-cache" : "public, max-age=300, stale-while-revalidate=86400");
          res.status(200).type("html").send(gz);
          return;
        }
        send(res, html, 200, route.live ? "no-cache" : undefined);
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
    // In-memory by default; RATE_LIMIT_STORE=mongo shares counts across instances.
    rateLimits: rateLimitStoreFromEnv(),
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
