import express, { type NextFunction, type Request, type Response } from "express";
import { Client } from "discord.js";
import { logger } from "../utils/logger";
import { styles } from "./theme";
import { clientScript } from "./client";
import { faviconSvg, ogImageSvg, manifest, themeInitScript } from "./assets";
import { buildCatalog, catalogStats } from "./catalog";
import {
  renderHome,
  renderFeatures,
  renderCommands,
  renderDocs,
  renderChangelog,
  renderStatus,
  renderTerms,
  renderPrivacy,
  renderNotFound,
  SiteConfig,
  Stats,
} from "./pages";
import { commands } from "../commands/loader";

const SITE_VERSION = "1.0.0";
const STARTED_AT = Date.now();

function siteConfig(): SiteConfig {
  const appId = process.env.DISCORD_APPLICATION_ID;
  const permissions = "8"; // Manage Server, matching the configured commands
  return {
    inviteUrl:
      process.env.BOT_INVITE_URL ||
      (appId
        ? `https://discord.com/oauth2/authorize?client_id=${appId}&permissions=${permissions}&scope=bot%20applications.commands`
        : "#"),
    supportUrl: process.env.SUPPORT_SERVER_URL || "",
    version: SITE_VERSION,
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
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=(), interest-cohort=()");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
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

interface RouteDef {
  path: string;
  render: (cfg: SiteConfig, ctx: RenderContext) => string;
  priority: string;
}

interface RenderContext {
  stats: Stats;
  online: boolean;
  startedAt: number;
}

const ROUTES: RouteDef[] = [
  { path: "/", render: (c, x) => renderHome(c, x.stats, x.online), priority: "1.0" },
  { path: "/features", render: c => renderFeatures(c), priority: "0.9" },
  { path: "/commands", render: c => renderCommands(c), priority: "0.9" },
  { path: "/docs", render: c => renderDocs(c), priority: "0.8" },
  { path: "/changelog", render: c => renderChangelog(c), priority: "0.6" },
  { path: "/status", render: (c, x) => renderStatus(c, x.stats, x.online, x.startedAt), priority: "0.6" },
  { path: "/privacy", render: c => renderPrivacy(c), priority: "0.4" },
  { path: "/terms", render: c => renderTerms(c), priority: "0.4" },
];

export function startWebServer(client: Client) {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const cfg = siteConfig();
  const origin = (process.env.SITE_URL || "").replace(/\/$/, "");

  app.disable("x-powered-by");
  app.disable("etag");
  app.use((_req: Request, res: Response, next: NextFunction) => {
    applySecurityHeaders(res);
    next();
  });

  const online = (): boolean => Boolean(client?.isReady?.());
  const isOnline = (): boolean => online();

  const asset = (res: Response, type: string, body: string, maxAge = 3600) => {
    res.setHeader("Cache-Control", `public, max-age=${maxAge}`);
    res.type(type).send(body);
  };

  app.get("/assets/site.css", (_req, res) => asset(res, "text/css", styles, 86400));
  app.get("/assets/site.js", (_req, res) => asset(res, "text/javascript", clientScript, 86400));
  app.get("/assets/theme-init.js", (_req, res) => asset(res, "text/javascript", themeInitScript, 31536000));
  app.get("/assets/favicon.svg", (_req, res) => asset(res, "image/svg+xml", faviconSvg, 604800));
  app.get("/assets/og.svg", (_req, res) => asset(res, "image/svg+xml", ogImageSvg, 604800));
  app.get("/manifest.webmanifest", (_req, res) => asset(res, "application/manifest+json", manifest, 86400));

  app.get("/health", (_req, res) => {
    const stats = collectStats(client);
    res.setHeader("Cache-Control", "no-store");
    res.json({
      status: isOnline() ? "ok" : "degraded",
      version: SITE_VERSION,
      startedAt: new Date(STARTED_AT).toISOString(),
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
    res.json({
      online: isOnline(),
      version: SITE_VERSION,
      startedAt: STARTED_AT,
      ping: stats.ping,
      uptime: Math.floor(stats.uptime / 1000),
      guilds: stats.guilds,
      users: stats.users,
      commands: stats.commands,
      subcommands: cs.subcommands,
      options: cs.options,
      categories: cs.categories,
      memoryMb: Number((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)),
      nodeVersion: process.version,
    });
  });

  app.get("/api/commands", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({ commands: buildCatalog() });
  });

  app.get("/robots.txt", (_req, res) => {
    const lines = [
      "User-agent: *",
      "Allow: /",
      "Disallow: /api/",
      origin ? `Sitemap: ${origin}/sitemap.xml` : "Sitemap: /sitemap.xml",
      "",
    ];
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.type("text/plain").send(lines.join("\n"));
  });

  app.get("/sitemap.xml", (_req, res) => {
    const base = origin || "";
    const urls = ROUTES.map(
      r => `  <url><loc>${base}${r.path}</loc><changefreq>weekly</changefreq><priority>${r.priority}</priority></url>`
    ).join("\n");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res
      .type("application/xml")
      .send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
      );
  });

  app.get("/command", (_req, res) => res.redirect(302, "/commands"));
  app.get("/privacy-policy", (_req, res) => res.redirect(301, "/privacy"));
  app.get("/terms-of-service", (_req, res) => res.redirect(301, "/terms"));
  app.get("/guide", (_req, res) => res.redirect(301, "/docs"));
  app.get("/status.json", (_req, res) => res.redirect(301, "/health"));

  const send = (res: Response, html: string, code = 200) => {
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
    res.status(code).type("html").send(html);
  };

  for (const route of ROUTES) {
    app.get(route.path, (_req, res) => {
      const ctx: RenderContext = {
        stats: collectStats(client),
        online: online(),
        startedAt: STARTED_AT,
      };
      send(res, route.render(cfg, ctx));
    });
  }

  app.use((_req: Request, res: Response) => {
    send(res, renderNotFound(cfg), 404);
  });

  app.listen(PORT, () => {
    logger.info(`Website listening on port ${PORT} (${ROUTES.length} pages)`);
  });
}
