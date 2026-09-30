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
} from "../src/web/pages";
import { styles } from "../src/web/theme";
import { clientScript } from "../src/web/client";
import { faviconSvg, ogImageSvg, manifest, themeInitScript } from "../src/web/assets";
import { loadCommands } from "../src/commands/loader";
import { catalogStats } from "../src/web/catalog";

const cfg = {
  inviteUrl: "https://discord.com/oauth2/authorize?client_id=123",
  supportUrl: "https://discord.gg/support",
  version: "1.0.0",
};
const stats = { guilds: 0, users: 0, commands: 0, ping: 0, uptime: 3_723_000 };
const startedAt = Date.parse("2026-01-01T00:00:00Z");

async function main() {
  await loadCommands();
  const outDir = join(__dirname, "..", "dist", "site");
  mkdirSync(join(outDir, "assets"), { recursive: true });
  mkdirSync(join(outDir, "api"), { recursive: true });

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
    ["api/stats.json", JSON.stringify({ online: false, ...stats, ...catalogStats() }, null, 2)],
  ];

  for (const [name, html] of files) {
    writeFileSync(join(outDir, name), html, "utf8");
    console.log(`${name}  ${html.length} bytes`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});