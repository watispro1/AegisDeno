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
  renderDashboard,
  renderFeatures,
  renderCommands,
  renderDocs,
  renderTroubleshooting,
  renderChangelog,
  renderStatus,
  renderTerms,
  renderPrivacy,
  renderNotFound,
  SiteConfig,
  Stats,
} from "./pages";
import { atomFeed } from "./changelog";
import { commands } from "../commands/loader";
import { VERSION } from "../version";
import { knubManager } from "../knub";
import { registerDefaultPlugins } from "../knub/plugins";

const SITE_VERSION = VERSION;
const STARTED_AT = Date.now();

/** Cache-busting token derived from asset contents, so deploys invalidate caches. */
const ASSET_VERSION = createHash("sha256")
  .update(styles)
  .update(clientScript)
  .update(themeInitScript)
  .digest("hex")
  .slice(0, 8);

const COMPRESSIBLE = /^(text\/|application\/(json|xml|manifest\+json|atom\+xml|rss\+xml)|image\/svg)/;
const RATE_WINDOW_MS = 60_000;
const API_REQUESTS_PER_WINDOW = 120;
const requestCounts = new Map<string, { count: number; windowStartedAt: number }>();

function apiRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
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
  const configuredInviteUrl = process.env.BOT_INVITE_URL?.trim();
  let inviteUrl = configuredInviteUrl || "#";

  if (appId) {
    const baseUrl = configuredInviteUrl && /^https?:\/\//i.test(configuredInviteUrl)
      ? configuredInviteUrl
      : "https://discord.com/oauth2/authorize";

    let invite: URL;
    try {
      invite = new URL(baseUrl);
    } catch {
      invite = new URL("https://discord.com/oauth2/authorize");
    }
    invite.searchParams.set("client_id", appId);
    invite.searchParams.set("permissions", permissions);
    invite.searchParams.set("scope", "bot applications.commands");
    inviteUrl = invite.toString();
  }

  return {
    inviteUrl,
    supportUrl: process.env.SUPPORT_SERVER_URL || "",
    version: SITE_VERSION,
    contactEmail: process.env.CONTACT_EMAIL || "support@aegisdeno.fly.dev",
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

function applySecurityHeaders(res: Response): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=(), interest-cohort=()");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' data:",
      "script-src 'self'",
      "connect-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
    ].join("; ")
  );
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
  { path: "/dashboard", render: (c, x) => renderDashboard(c, x.stats, x.online), priority: "0.95", live: true },
  { path: "/features", render: c => renderFeatures(c), priority: "0.9" },
  { path: "/commands", render: c => renderCommands(c), priority: "0.9" },
  { path: "/docs", render: c => renderDocs(c), priority: "0.8" },
  { path: "/troubleshooting", render: c => renderTroubleshooting(c), priority: "0.7" },
  { path: "/changelog", render: c => renderChangelog(c), priority: "0.6" },
  { path: "/status", render: (c, x) => renderStatus(c, x.stats, x.online, x.startedAt), priority: "0.6", live: true },
  { path: "/privacy", render: c => renderPrivacy(c), priority: "0.4" },
  { path: "/terms", render: c => renderTerms(c), priority: "0.4" },
];

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function startWebServer(client: Client) {
  registerDefaultPlugins();
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const cfg = siteConfig();
  const origin = (process.env.SITE_URL || "").replace(/\/$/, "");

  app.disable("x-powered-by");
  app.use((_req: Request, res: Response, next: NextFunction) => {
    applySecurityHeaders(res);
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

  app.get("/api/plugins", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Robots-Tag", "noindex");
    res.json({
      plugins: knubManager.getAllPlugins().map((p) => ({
        name: p.name,
        description: p.description,
        version: p.version,
        customHandlers: p.customIdHandlers?.length ?? 0,
        events: p.events?.length ?? 0,
      })),
    });
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
    if (req.headers.authorization !== auth) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const { user, type, isWeekend, guild } = req.body ?? {};
    logger.info(`👍 Top.gg Vote Received: User ${user} (Type: ${type}, Weekend: ${isWeekend}, Guild: ${guild ?? "N/A"})`);
    res.json({ status: "ok" });
  });

  app.get("/api/commands/:name", (req, res) => {
    const name = String(req.params.name ?? "").replace(/^\//, "");
    const found = getCommand(name);

    if (!found) {
      res.setHeader("Cache-Control", "no-store");
      res.status(404).json({ error: "unknown_command", name });
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

  app.get("/changelog.xml", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.type("application/atom+xml").send(atomFeed(origin || ""));
  });

  app.get("/command", (_req, res) => res.redirect(302, "/commands"));
  app.get("/commands/:name", (req, res) => res.redirect(301, `/commands#cmd-${String(req.params.name ?? "")}`));
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

  app.use((_req: Request, res: Response) => {
    send(res, renderNotFound(cfg), 404, "no-store");
  });

  app.listen(PORT, () => {
    logger.info(`Website listening on port ${PORT} (${ROUTES.length} pages, build ${ASSET_VERSION})`);
  });
}
