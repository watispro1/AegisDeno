import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import express, { type NextFunction, type Request, type Response } from "express";
import { Client } from "discord.js";
import { logger } from "../utils/logger";
import { styles } from "./theme";
import { clientScript } from "./client";
import { faviconSvg, ogImageSvg, manifest, themeInitScript } from "./assets";
import { botPermissionBitfield, buildCatalog, catalogStats, getCommand } from "./catalog";
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
  RELEASES,
  SiteConfig,
  Stats,
} from "./pages";
import { commands } from "../commands/loader";
import { VERSION } from "../version";

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

function siteConfig(): SiteConfig {
  const appId = process.env.DISCORD_APPLICATION_ID;
  const permissions = botPermissionBitfield().toString();
  const configuredInviteUrl = process.env.BOT_INVITE_URL;
  let inviteUrl = configuredInviteUrl || "#";

  if (appId) {
    let invite: URL;
    try {
      invite = new URL(configuredInviteUrl || "https://discord.com/oauth2/authorize");
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
    contactEmail: process.env.CONTACT_EMAIL || "support@aegisbot.dev",
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

  const online = (): boolean => Boolean(client?.isReady?.());
  const isOnline = (): boolean => online();

  const asset = (res: Response, type: string, body: string, maxAge = 3600) => {
    res.setHeader("Cache-Control", `public, max-age=${maxAge}, immutable`);
    res.type(type).send(body);
  };

  app.get("/assets/site.css", (_req, res) => asset(res, "text/css", styles, 31536000));
  app.get("/assets/site.js", (_req, res) => asset(res, "text/javascript", clientScript, 31536000));
  app.get("/assets/theme-init.js", (_req, res) => asset(res, "text/javascript", themeInitScript, 31536000));
  app.get("/assets/favicon.svg", (_req, res) => asset(res, "image/svg+xml", faviconSvg, 31536000));
  app.get("/assets/og.svg", (_req, res) => asset(res, "image/svg+xml", ogImageSvg, 31536000));
  app.get("/manifest.webmanifest", (_req, res) => asset(res, "application/manifest+json", manifest, 3600));

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
    res.setHeader("X-Robots-Tag", "noindex");
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
    res.setHeader("X-Robots-Tag", "noindex");
    res.json({ commands: buildCatalog() });
  });

  app.post("/api/topgg/webhook", express.json(), (req, res) => {
    const auth = process.env.TOPGG_WEBHOOK_AUTH;
    if (auth && req.headers.authorization !== auth) {
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
    const base = origin || "";
    const updated = RELEASES[0]?.date ?? new Date(STARTED_AT).toISOString().slice(0, 10);
    const entries = RELEASES.map(r => {
      const link = `${base}/changelog#${r.version}`;
      const content = r.highlights.map(h => `<li>${xmlEscape(h)}</li>`).join("");
      return `  <entry>
    <title>Aegis ${xmlEscape(r.version)}</title>
    <id>${xmlEscape(link)}</id>
    <link rel="alternate" type="text/html" href="${xmlEscape(link)}"/>
    <updated>${xmlEscape(r.date)}T00:00:00Z</updated>
    <content type="html"><![CDATA[<ul>${content}</ul>]]></content>
  </entry>`;
    }).join("\n");

    res.setHeader("Cache-Control", "public, max-age=3600");
    res
      .type("application/atom+xml")
      .send(
        `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Aegis changelog</title>
  <subtitle>Release history for the Aegis Discord bot</subtitle>
  <id>${xmlEscape(base + "/changelog.xml")}</id>
  <link rel="self" type="application/atom+xml" href="${xmlEscape(base + "/changelog.xml")}"/>
  <link rel="alternate" type="text/html" href="${xmlEscape(base + "/changelog")}"/>
  <updated>${xmlEscape(updated)}T00:00:00Z</updated>
${entries}
</feed>
`
      );
  });

  app.get("/command", (_req, res) => res.redirect(302, "/commands"));
  app.get("/commands/:name", (req, res) => res.redirect(301, `/commands#cmd-${String(req.params.name ?? "")}`));
  app.get("/privacy-policy", (_req, res) => res.redirect(301, "/privacy"));
  app.get("/terms-of-service", (_req, res) => res.redirect(301, "/terms"));
  app.get("/guide", (_req, res) => res.redirect(301, "/docs"));
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
