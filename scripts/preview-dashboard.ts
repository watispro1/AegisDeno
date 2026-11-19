/**
 * Writes static renders of the dashboard fixtures (scripts/dashboard-fixtures.ts)
 * to dist/dashboard-preview/ with the real stylesheet and scripts, so the
 * pages can be opened in a browser or screenshotted in every theme:
 *
 *   npx tsx scripts/preview-dashboard.ts
 *   npx http-server dist/dashboard-preview   (or any static server)
 *
 * Each page is written to <slug>.html and listed in index.html. Links point
 * at the live routes, so they will 404 here; this is for looking, not using.
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { SiteConfig } from "../src/web/pages";
import { styles } from "../src/web/theme";
import { clientScript } from "../src/web/client";
import { dashboardScript } from "../src/web/dashboard/client";
import { faviconSvg, markSvg, themeInitScript } from "../src/web/assets";
import { loadCommands } from "../src/commands/loader";
import { dashboardAuditPages } from "./dashboard-fixtures";

const cfg: SiteConfig = {
  inviteUrl: "https://discord.com/oauth2/authorize?client_id=123",
  supportUrl: "https://discord.gg/support",
  version: "1.0.0",
  contactEmail: "support@example.com",
  assetVersion: "preview",
};

/** "/dashboard/:id/cases (empty)" -> "dashboard-id-cases-empty" */
export function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "index";
}

async function main() {
  await loadCommands();
  const out = join(__dirname, "..", "dist", "dashboard-preview");
  mkdirSync(join(out, "assets"), { recursive: true });
  const pages = dashboardAuditPages(cfg);
  const assets: [string, string][] = [
    ["assets/site.css", styles],
    ["assets/site.js", clientScript],
    ["assets/dashboard.js", dashboardScript],
    ["assets/theme-init.js", themeInitScript],
    ["assets/favicon.svg", faviconSvg],
    ["assets/mark.svg", markSvg],
  ];
  for (const [file, body] of assets) writeFileSync(join(out, file), body, "utf8");
  const links: string[] = [];
  for (const [name, html] of pages) {
    const file = `${slug(name)}.html`;
    writeFileSync(join(out, file), html, "utf8");
    links.push(`<li><a href="${file}">${name.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</a></li>`);
  }
  writeFileSync(join(out, "index.html"), `<!DOCTYPE html><meta charset="utf-8"><title>Dashboard preview</title><ul>${links.join("")}</ul>`, "utf8");
  console.log(`${pages.length} dashboard pages written to ${out}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
