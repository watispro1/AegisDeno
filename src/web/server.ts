import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import express, { type NextFunction, type Request, type Response } from "express";
import { Client } from "discord.js";
import { logger } from "../utils/logger";
import { styles } from "./theme";
import { clientScript } from "./client";
import { faviconSvg, ogImageSvg, ogImagePng, manifest, themeInitScript } from "./assets";
import { botPermissionBitfield, buildCatalog, catalogStats, getCommand } from "./catalog";
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
  SiteConfig,
  Stats,
} from "./pages";
import { atomFeed } from "./changelog";
import { buildInviteUrl, guildInviteUrl } from "./invite";
import { suggestPages } from "./notFound";
import { securityTxt } from "./wellKnown";
import { commands } from "../commands/loader";
import { VERSION } from "../version";
import { createDashboardRouter } from "./dashboard/router";
import { readDashboardConfig, missingDashboardSettings } from "./dashboard/config";
import { discordBotView } from "./dashboard/botView";
import { mongoDashboardData } from "./dashboard/data";
import { mongoModuleData } from "./dashboard/moduleData";
import { mongoSessionStore } from "./dashboard/sessions";
import { mongoRateLimitStore } from "./dashboard/rateLimitStore";
import { mongoAuditStore } from "./dashboard/audit";
import { dashboardScript } from "./dashboard/client";
import { clientIp, secretMatches, securityHeaders } from "./securityHeaders";

/** Largest request body the site accepts at all; route parsers set tighter limits. */
const MAX_REQUEST_BYTES = 600 * 1024;

/**
 * Final Express error handler: logs the error server-side and answers with a
 * generic message (JSON under /api, plain text elsewhere). Never echoes the
 * error, its message or a stack trace.
 */
export function siteErrorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const status = typeof (err as { status?: unknown })?.status === "number" ? (err as { status: number }).status : 500;
  const code = status >= 400 && status < 600 ? status : 500;
  if (code >= 500) logger.error(`Web error on ${req.method} ${req.path}:`, err instanceof Error ? err.message : err);
  if (res.headersSent) return;
  res.setHeader("Cache-Control", "no-store");
  if (req.path.startsWith("/api/")) {
    res.status(code).json({ error: code === 413 ? "payload_too_large" : code === 400 ? "bad_request" : "server_error" });
    return;
  }
  res.status(code).type("text/plain").send(code === 413 ? "Request too large" : code === 400 ? "Bad request" : "Something went wrong");
}

const SITE_VERSION = VERSION;
const STARTED_AT = Date.now();

/** Cache-busting token derived from asset contents, so deploys invalidate caches. */
const ASSET_VERSION = createHash("sha256")
  .update(styles)
  .update(clientScript)
  .update(themeInitScript)
  .update(dashboardScript)
  .digest("hex")
  .slice(0, 8);

const COMPRESSIBLE = /^(text\/|application\/(json|xml|manifest\+json|atom\+xml|rss\+xml)|image\/svg)/;
const RATE_WINDOW_MS = 60_000;
const API_REQUESTS_PER_WINDOW = 120;
const requestCounts = new Map<string, { count: number; windowStartedAt: number }>();

function apiRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  // Behind Fly's proxy req.ip is the proxy, so every visitor shared one bucket.
  const key = clientIp(req);
  const current = requestCounts.get(key);
  const entry = !current || now - current.windowStartedAt >= RATE_WINDOW_MS
    ? { count: 0, windowStartedAt: now }
    : current;
  entry.count++;
  requestCounts.set(key, entry);
  if (requestCounts.size > 10_000) {
    for (const [address, value] of requestCounts) {
      if (now - value.windowStartedAt >= RATE_WINDOW_MS) requestCounts.delete(address);
    }
  }
  if (entry.count > API_REQUESTS_PER_WINDOW) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({ error: "rate_limited" });
    return;
  }
  next();
}

function siteConfig(): SiteConfig {
  const appId = process.env.DISCORD_APPLICATION_ID?.trim();
  const permissions = botPermissionBitfield().toString();
  const inviteUrl = buildInviteUrl({ appId, permissions, configured: process.env.BOT_INVITE_URL });

  return {
    inviteUrl,
    supportUrl: process.env.SUPPORT_SERVER_URL || "",
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

/** Gzip text responses. Fly terminates TLS and does not compress upstream. */
function compression(req: Request, res: Response, next: NextFunction): void {
  const accepted = String(req.headers["accept-encoding"] ?? "");
  res.setHeader("Vary", "Accept-Encoding");

  if (!accepted.includes("gzip")) {
    next();
    return;
  }

  const original = res.send.bind(res) as (body?: unknown) => Response;

  res.send = function send(this: Response, body?: unknown): Response {
    if (this.headersSent || typeof body !== "string" || this.getHeader("Content-Encoding")) {
      return original(body);
    }
    if (!COMPRESSIBLE.test(String(this.getHeader("Content-Type") ?? ""))) {
      return original(body);
    }

    const packed = gzipSync(Buffer.from(body, "utf8"), { level: 6 });
    this.setHeader("Content-Encoding", "gzip");
    this.setHeader("Content-Length", String(packed.byteLength));
    return original(packed);
  };

  next();
}

interface RouteDef {
  path: string;
  render: (cfg: SiteConfig, ctx: RenderContext) => string;
  priority: string;
  /** Pages that embed live metrics must never be served stale. */
  live?: boolean;
}

interface RenderContext {
  stats: Stats;
  online: boolean;
  startedAt: number;
}

const ROUTES: RouteDef[] = [
  { path: "/", render: (c, x) => renderHome(c, x.stats, x.online), priority: "1.0", live: true },
  { path: "/features", render: c => renderFeatures(c), priority: "0.9" },
  { path: "/commands", render: c => renderCommands(c), priority: "0.9" },
  { path: "/docs", render: c => renderDocs(c), priority: "0.8" },
  { path: "/troubleshooting", render: c => renderTroubleshooting(c), priority: "0.7" },
  { path: "/changelog", render: c => renderChangelog(c), priority: "0.6" },
  // Public and static, so it is served (and indexed) even when the dashboard is off.
  // Registered before the /dashboard router, which would otherwise treat it as a server ID.
  { path: "/dashboard/changelog", render: c => renderDashboardChangelog(c), priority: "0.4" },
  { path: "/status", render: (c, x) => renderStatus(c, x.stats, x.online, x.startedAt), priority: "0.6", live: true },
  { path: "/privacy", render: c => renderPrivacy(c), priority: "0.4" },
  { path: "/terms", render: c => renderTerms(c), priority: "0.4" },
  { path: "/security", render: c => renderSecurity(c), priority: "0.3" },
];

/** Pages offered on the 404 page when an address is a typo away from one. */
const SUGGESTABLE = [
  { href: "/features", label: "Features" },
  { href: "/commands", label: "Commands" },
  { href: "/docs", label: "Docs" },
  { href: "/troubleshooting", label: "Troubleshooting" },
  { href: "/changelog", label: "Changelog" },
  { href: "/status", label: "Status" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/security", label: "Security" },
  { href: "/dashboard", label: "Dashboard" },
];


function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function startWebServer(client: Client) {
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
  const isOnline = (): boolean => online();

  const asset = (res: Response, type: string, body: string | Buffer, maxAge = 3600) => {
    res.setHeader("Cache-Control", `public, max-age=${maxAge}, immutable`);
    res.type(type).send(body);
  };

  app.get("/assets/site.css", (_req, res) => asset(res, "text/css", styles, 31536000));
  app.get("/assets/site.js", (_req, res) => asset(res, "text/javascript", clientScript, 31536000));
  app.get("/assets/dashboard.js", (_req, res) => asset(res, "text/javascript", dashboardScript, 31536000));
  app.get("/assets/theme-init.js", (_req, res) => asset(res, "text/javascript", themeInitScript, 31536000));
  app.get("/assets/favicon.svg", (_req, res) => asset(res, "image/svg+xml", faviconSvg, 31536000));
  app.get("/assets/og.svg", (_req, res) => asset(res, "image/svg+xml", ogImageSvg, 31536000));
  app.get("/assets/og.png", (_req, res) => asset(res, "image/png", ogImagePng, 31536000));
  app.get("/manifest.webmanifest", (_req, res) => asset(res, "application/manifest+json", manifest, 3600));

  app.get("/health", (_req, res) => {
    const stats = collectStats(client);
    res.setHeader("Cache-Control", "no-store");
    res.json({
      status: isOnline() ? "ok" : "degraded",
      version: SITE_VERSION,
      uptime: Math.floor(stats.uptime / 1000),
      guilds: stats.guilds,
      users: stats.users,
      commands: stats.commands,
      gatewayPing: stats.ping,
    });
  });

  app.get("/api/stats", (_req, res) => {
    const stats = collectStats(client);
    const cs = catalogStats();
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Robots-Tag", "noindex");
    res.json({
      online: isOnline(),
      version: SITE_VERSION,
      ping: stats.ping,
      uptime: Math.floor(stats.uptime / 1000),
      guilds: stats.guilds,
      users: stats.users,
      commands: stats.commands,
      catalog: cs,
    });
  });

  app.get("/api/commands", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Robots-Tag", "noindex");
    res.json({ commands: buildCatalog() });
  });

  // Top.gg sends a small JSON object; bound parsing prevents unauthenticated
  // requests from consuming unbounded memory before the shared-secret check.
  app.post("/api/topgg/webhook", express.json({ limit: "16kb" }), (req, res) => {
    const auth = process.env.TOPGG_WEBHOOK_AUTH;
    if (!auth) {
      logger.warn("Rejected Top.gg webhook because TOPGG_WEBHOOK_AUTH is not configured.");
      res.status(503).json({ error: "webhook_not_configured" });
      return;
    }
    if (!secretMatches(req.headers.authorization, auth)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
    const field = (v: unknown) => (typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? String(v).slice(0, 40).replace(/[^\w.-]/g, "") : "?");
    logger.info(`👍 Top.gg Vote Received: User ${field(body.user)} (Type: ${field(body.type)}, Weekend: ${field(body.isWeekend)}, Guild: ${body.guild ? field(body.guild) : "N/A"})`);
    res.json({ status: "ok" });
  });

  app.get("/api/commands/:name", (req, res) => {
    const name = String(req.params.name ?? "").replace(/^\//, "").slice(0, 64);
    const found = getCommand(name);

    if (!found) {
      res.setHeader("Cache-Control", "no-store");
      res.status(404).json({ error: "unknown_command", name: name.replace(/[^a-z0-9_-]/gi, "") });
      return;
    }

    res.setHeader("Cache-Control", "public, max-age=600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Robots-Tag", "noindex");
    res.json({
      name: found.name,
      description: found.description,
      category: found.category,
      guildOnly: found.guildOnly,
      permissions: {
        declared: found.declaredPermissions,
        enforced: found.enforcedPermissions,
        bot: found.botPermissions,
      },
      options: found.options,
      subcommands: found.subcommands,
    });
  });

  app.get("/robots.txt", (_req, res) => {
    const lines = [
      "User-agent: *",
      "Allow: /",
      "Disallow: /api/",
      "Disallow: /health",
      // Longest match wins, so the public dashboard changelog stays crawlable
      // while every per-user dashboard page is blocked.
      "Allow: /dashboard/changelog",
      "Disallow: /dashboard",
      origin ? `Sitemap: ${origin}/sitemap.xml` : "Sitemap: /sitemap.xml",
      "",
    ];
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.type("text/plain").send(lines.join("\n"));
  });

  app.get("/sitemap.xml", (_req, res) => {
    const base = origin || "";
    const lastmod = new Date(STARTED_AT).toISOString().slice(0, 10);
    const urls = ROUTES.map(
      r =>
        `  <url><loc>${xmlEscape(base + r.path)}</loc><lastmod>${lastmod}</lastmod>` +
        `<changefreq>weekly</changefreq><priority>${r.priority}</priority></url>`
    ).join("\n");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res
      .type("application/xml")
      .send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
      );
  });

  app.get("/.well-known/security.txt", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.type("text/plain").send(securityTxt(origin));
  });
  app.get("/security.txt", (_req, res) => res.redirect(301, "/.well-known/security.txt"));

  app.get("/changelog.xml", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.type("application/atom+xml").send(atomFeed(origin || ""));
  });

  // Stable, shareable invite link: /invite or /invite?guild_id=<server id>.
  // A plain 302 to Discord's https authorize page; no app deep link.
  app.get("/invite", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (cfg.inviteUrl === "#") return res.redirect(302, "/docs#quickstart");
    const guildId = typeof req.query.guild_id === "string" ? req.query.guild_id : "";
    res.redirect(302, (guildId && guildInviteUrl(cfg.inviteUrl, guildId)) || cfg.inviteUrl);
  });
  app.get("/add", (_req, res) => res.redirect(301, "/invite"));
  app.get("/command", (_req, res) => res.redirect(302, "/commands"));
  app.get("/commands/:name", (req, res) => {
    const name = String(req.params.name ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
    res.redirect(301, name ? `/commands#cmd-${name}` : "/commands");
  });
  app.get("/playground", (_req, res) => res.redirect(301, "/features"));
  app.get("/privacy-policy", (_req, res) => res.redirect(301, "/privacy"));
  app.get("/terms-of-service", (_req, res) => res.redirect(301, "/terms"));
  app.get("/guide", (_req, res) => res.redirect(301, "/docs"));
  app.get("/help", (_req, res) => res.redirect(301, "/troubleshooting"));
  app.get("/status.json", (_req, res) => res.redirect(301, "/health"));

  const send = (res: Response, html: string, code = 200, cacheControl?: string) => {
    res.setHeader(
      "Cache-Control",
      cacheControl ?? "public, max-age=300, stale-while-revalidate=86400"
    );
    res.status(code).type("html").send(html);
  };

  for (const route of ROUTES) {
    app.get(route.path, (_req, res) => {
      const ctx: RenderContext = {
        stats: collectStats(client),
        online: online(),
        startedAt: STARTED_AT,
      };
      send(res, route.render(cfg, ctx), 200, route.live ? "no-cache" : undefined);
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
    bot: discordBotView(client),
    data: mongoDashboardData(client),
    modules: mongoModuleData(client),
    sessions: mongoSessionStore(),
    rateLimits: mongoRateLimitStore(),
    audit: mongoAuditStore(),
  }));

  app.use((req: Request, res: Response) => {
    const suggestions = suggestPages(req.path, SUGGESTABLE, Array.from(commands.keys()));
    send(res, renderNotFound(cfg, suggestions), 404, "no-store");
  });

  // Last resort: never send a stack trace or error message to the client.
  app.use(siteErrorHandler);

  app.listen(PORT, () => {
    logger.info(`Website listening on port ${PORT} (${ROUTES.length} pages, build ${ASSET_VERSION})`);
  });
}
