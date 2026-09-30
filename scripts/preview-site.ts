import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  renderHome,
  renderFeatures,
  renderCommands,
  renderDocs,
  renderTerms,
  renderPrivacy,
  renderNotFound,
} from "../src/web/pages";
import { loadCommands } from "../src/commands/loader";

const cfg = {
  inviteUrl: "https://discord.com/oauth2/authorize?client_id=123",
  supportUrl: "https://discord.gg/support",
  version: "1.0.0",
};
const stats = { guilds: 12, users: 34567, commands: 34, ping: 42, uptime: 3_723_000 };

async function main() {
  await loadCommands();
  const outDir = join(__dirname, "..", "dist", "site");
  mkdirSync(outDir, { recursive: true });

  const pages: [string, string][] = [
    ["index.html", renderHome(cfg, stats)],
    ["features.html", renderFeatures(cfg)],
    ["commands.html", renderCommands(cfg)],
    ["docs.html", renderDocs(cfg)],
    ["privacy.html", renderPrivacy(cfg)],
    ["terms.html", renderTerms(cfg)],
    ["404.html", renderNotFound(cfg)],
  ];

  for (const [name, html] of pages) {
    writeFileSync(join(outDir, name), html, "utf8");
    console.log(`${name}  ${html.length} bytes`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
