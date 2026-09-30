import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
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
  type SiteConfig,
} from "../src/web/pages";
import { styles } from "../src/web/theme";
import { clientScript } from "../src/web/client";
import { faviconSvg, ogImageSvg, manifest, themeInitScript } from "../src/web/assets";
import { loadCommands } from "../src/commands/loader";
import { botPermissionBitfield, buildCatalog, catalogStats, getCommand } from "../src/web/catalog";

const cfg: SiteConfig = {
  inviteUrl: "https://discord.com/oauth2/authorize?client_id=123",
  supportUrl: "https://discord.gg/support",
  version: "1.0.0",
  contactEmail: "support@example.com",
  assetVersion: "preview",
};
const stats = { guilds: 0, users: 0, commands: 0, ping: 0, uptime: 3_723_000 };
const startedAt = Date.parse("2026-01-01T00:00:00Z");

function atomFeed(): string {
  const entries = RELEASES.map(r => {
    const content = r.highlights.map(h => `<li>${h}</li>`).join("");
    return `  <entry>
    <title>Aegis ${r.version}</title>
    <id>urn:aegis:changelog:${r.version}</id>
    <updated>${r.date}T00:00:00Z</updated>
    <content type="html"><![CDATA[<ul>${content}</ul>]]></content>
  </entry>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Aegis changelog</title>
  <id>urn:aegis:changelog</id>
  <updated>${RELEASES[0]?.date ?? "2026-01-01"}T00:00:00Z</updated>
${entries}
</feed>
`;
}

async function main() {
  await loadCommands();
  const outDir = join(__dirname, "..", "dist", "site");
  mkdirSync(join(outDir, "assets"), { recursive: true });
  mkdirSync(join(outDir, "api", "commands"), { recursive: true });

  const pages: [string, string][] = [
    ["index.html", renderHome(cfg, stats, false)],
    ["features.html", renderFeatures(cfg)],
    ["commands.html", renderCommands(cfg)],
    ["docs.html", renderDocs(cfg)],
    ["changelog.html", renderChangelog(cfg)],
    ["status.html", renderStatus(cfg, stats, false, startedAt)],
    ["privacy.html", renderPrivacy(cfg)],
    ["terms.html", renderTerms(cfg)],
    ["404.html", renderNotFound(cfg)],
  ];

  const files: [string, string][] = [
    ...pages,
    ["assets/site.css", styles],
    ["assets/site.js", clientScript],
    ["assets/theme-init.js", themeInitScript],
    ["assets/favicon.svg", faviconSvg],
    ["assets/og.svg", ogImageSvg],
    ["manifest.webmanifest", manifest],
    ["changelog.xml", atomFeed()],
    ["robots.txt", "User-agent: *\nAllow: /\nDisallow: /api/\n\n"],
    ["sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n`],
    ["api/stats.json", JSON.stringify({ online: false, ...stats, ...catalogStats() }, null, 2)],
    ["api/commands.json", JSON.stringify({ commands: buildCatalog() }, null, 2)],
  ];

  for (const cmd of buildCatalog()) {
    files.push([`api/commands/${cmd.name}.json`, JSON.stringify(getCommand(cmd.name), null, 2)]);
  }

  for (const [name, html] of files) {
    writeFileSync(join(outDir, name), html, "utf8");
    console.log(`${name}  ${html.length} bytes`);
  }

  console.log(`\nInvite permission bitfield: ${botPermissionBitfield().toString()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});