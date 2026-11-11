/** robots.txt, sitemap, security.txt, the Atom feed, /invite and the old-path redirects. */
import type { Express } from "express";
import { atomFeed, changelogJson } from "./changelog";
import { guildInviteUrl } from "./invite";
import { securityTxt } from "./wellKnown";

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface SiteRouteDeps {
  origin: string;
  inviteUrl: string;
  startedAt: number;
  sitemap: ReadonlyArray<{ path: string; priority: string }>;
}

export function registerSiteRoutes(app: Express, o: SiteRouteDeps): void {
  const origin = o.origin;
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
    const lastmod = new Date(o.startedAt).toISOString().slice(0, 10);
    const urls = o.sitemap.map(
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

  // Both changelogs as JSON (released versions only), for bots and scripts.
  app.get("/changelog.json", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(changelogJson(origin || ""));
  });

  // Stable, shareable invite link: /invite or /invite?guild_id=<server id>.
  // A plain 302 to Discord's https authorize page; no app deep link.
  app.get("/invite", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (o.inviteUrl === "#") return res.redirect(302, "/docs#quickstart");
    const guildId = typeof req.query.guild_id === "string" ? req.query.guild_id : "";
    res.redirect(302, (guildId && guildInviteUrl(o.inviteUrl, guildId)) || o.inviteUrl);
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
}
