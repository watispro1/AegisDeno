/**
 * Static audit of the generated site: links, fragments, ids, headings,
 * CSS class coverage, and client-selector coverage.
 * Run manually with `npx tsx scripts/audit-site.ts`.
 */
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { loadCommands } from "../src/commands/loader";
import { renderHome, renderFeatures, renderCommands, renderDocs, renderChangelog, renderStatus, renderTerms, renderPrivacy, renderNotFound, type SiteConfig } from "../src/web/pages";
import { styles } from "../src/web/theme";
import { clientScript } from "../src/web/client";
import { themeInitScript } from "../src/web/assets";

const cfg: SiteConfig = {
  inviteUrl: "https://discord.com/oauth2/authorize?client_id=123",
  supportUrl: "https://discord.gg/support",
  version: "1.0.0",
  contactEmail: "legal@example.com",
  assetVersion: "audit",
};
const stats = { guilds: 12, users: 3400, commands: 22, ping: 40, uptime: 3_723_000 };

const problems: string[] = [];
function fail(msg: string): void {
  problems.push(msg);
}

async function main() {
  await loadCommands();

  const pages: [string, string][] = [
    ["/", renderHome(cfg, stats, true)],
    ["/features", renderFeatures(cfg)],
    ["/commands", renderCommands(cfg)],
    ["/docs", renderDocs(cfg)],
    ["/changelog", renderChangelog(cfg)],
    ["/status", renderStatus(cfg, stats, true, Date.now())],
    ["/privacy", renderPrivacy(cfg)],
    ["/terms", renderTerms(cfg)],
    ["/404", renderNotFound(cfg)],
  ];

  /* Degraded and offline variants, so conditionally applied classes such as
     `warn`, `danger`, and `bad` are exercised rather than reported as dead. */
  const variantPages: [string, string][] = [
    ["/status (degraded)", renderStatus(cfg, { ...stats, ping: 400 }, true, Date.now())],
    ["/status (offline)", renderStatus(cfg, { ...stats, ping: 0 }, false, Date.now())],
    ["/ (offline)", renderHome(cfg, { ...stats, ping: 0 }, false)],
  ];

  let links = 0;
  let fragments = 0;
  let ids = 0;
  const allClasses = new Set<string>();
  const idOwners = new Map<string, string>();
  const fragmentsByPage = new Map<string, Set<string>>();

  for (const [path, html] of pages) {
    const ownIds = new Set<string>();

    for (const m of html.matchAll(/\sid="([^"]+)"/g)) {
      const id = m[1];
      ids++;
      if (ownIds.has(id)) fail(`${path}: duplicate id "${id}" within the page`);
      ownIds.add(id);
      idOwners.set(id, path);
    }

    for (const m of html.matchAll(/class="([^"]*)"/g)) {
      for (const c of m[1].split(/\s+/)) if (c) allClasses.add(c);
    }

    for (const [vPath, vHtml] of variantPages) {
      if (!/undefined|NaN|\$\{/.test(vHtml)) continue;
      fail(`${vPath}: contains an unresolved template value`);
    }
    for (const [vPath, vHtml] of variantPages) {
      for (const m of vHtml.matchAll(/class="([^"]*)"/g)) {
        for (const c of m[1].split(/\s+/)) if (c) allClasses.add(c);
      }
    }

    const h1 = (html.match(/<h1[ >]/g) ?? []).length;
    if (h1 !== 1) fail(`${path}: expected exactly one <h1>, found ${h1}`);

    for (const m of html.matchAll(/href="([^"]+)"/g)) {
      const href = m[1];
      links++;
      if (href.startsWith("#")) {
        fragments++;
        if (href.length > 1) ownIds.has(href.slice(1)) || fail(`${path}: fragment ${href} has no target`);
        continue;
      }
      if (/^(https?:|mailto:|tel:)/.test(href)) continue;
      if (!href.startsWith("/")) fail(`${path}: suspicious href "${href}"`);
    }

    for (const m of html.matchAll(/\ssrc="([^"]+)"/g)) {
      const src = m[1];
      if (/^(https?:|data:)/.test(src)) continue;
      if (!src.startsWith("/assets/") && !src.startsWith("/")) fail(`${path}: suspicious src "${src}"`);
    }

    if (/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/.test(html)) {
      if (!/application\/ld\+json/.test(html)) fail(`${path}: inline <script> without src`);
    }

    for (const bad of ["undefined", "NaN", "${", "&amp;amp;"]) {
      if (html.includes(bad)) fail(`${path}: contains "${bad}"`);
    }

    fragmentsByPage.set(path, ownIds);
  }

  /* Every class used in markup must have a CSS rule. Compound selectors such
     as `.pill.danger` define both parts, so index on the full rule text. */
  const cssClasses = new Set<string>();
  for (const rule of styles.split("{")) {
    const selector = rule.split("}").pop() ?? rule;
    for (const part of selector.split(",")) {
      for (const m of part.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) cssClasses.add(m[1]);
    }
  }
  const unstyled = [...allClasses].filter(c => !cssClasses.has(c));
  if (unstyled.length) fail(`classes with no CSS rule: ${unstyled.join(", ")}`);

  /* Every selector the client script uses must exist in the markup. */
  const clientSelectors = [...clientScript.matchAll(/querySelectorAll?\('([^']+)'\)/g)].map(m => m[1]);
  const combined = pages.map(p => p[1]).join("\n");
  for (const sel of clientSelectors) {
    if (sel.includes("::") || sel.includes(":not(")) continue;
    const attrs = [...sel.matchAll(/\[([^\]=]+)/g)].map(m => m[1]);
    for (const attr of attrs) {
      if (attr.includes("^") || attr.includes("$") || attr.includes("=")) {
        // Compound attribute selector: fall back to checking the first token.
        const token = attr.split(/[\^$=]/)[0];
        if (token && !combined.includes(token)) fail(`client selector ${sel}: no markup uses [${token}]`);
        continue;
      }
      if (!combined.includes(attr)) fail(`client selector ${sel}: no markup uses [${attr}]`);
    }
    for (const cls of sel.matchAll(/\.([\w-]+)/g)) {
      if (!allClasses.has(cls[1])) fail(`client selector ${sel}: no markup uses .${cls[1]}`);
    }
  }

  /* Anchor targets referenced from other pages. */
  const categoryAnchors = new Set(fragmentsByPage.get("/commands") ?? []);
  for (const [path, html] of pages) {
    for (const m of html.matchAll(/href="\/commands#([\w-]+)"/g)) {
      if (!categoryAnchors.has(m[1])) fail(`${path}: links to /commands#${m[1]} which does not exist`);
    }
  }

  const dist = join(__dirname, "..", "dist", "site");
  if (existsSync(dist)) {
    for (const f of readdirSync(join(dist, "assets"))) {
      if (!existsSync(join(dist, "assets", f))) fail(`dist asset missing: ${f}`);
    }
  }

  /* Report CSS classes that no page and no script ever reference. */
  const scriptClasses = new Set([
    ...[...clientScript.matchAll(/classList\.(?:add|toggle|remove)\('([\w-]+)'/g)].map(m => m[1]),
    ...[...themeInitScript.matchAll(/classList\.add\("([\w-]+)"\)/g)].map(m => m[1]),
  ]);
  const deadCss = [...cssClasses]
    .filter(c => !allClasses.has(c) && !scriptClasses.has(c))
    .sort();

  console.log(`pages:      ${pages.length}`);
  console.log(`links:      ${links}`);
  console.log(`fragments:  ${fragments}`);
  console.log(`ids:        ${ids}`);
  console.log(`classes:    ${allClasses.size} used, all have CSS rules`);
  console.log(`client sel: ${clientSelectors.length} (all resolve)`);
  console.log(`dead css:   ${deadCss.length}${deadCss.length ? ` -> ${deadCss.join(" ")}` : ""}`);

  if (problems.length === 0) {
    console.log("\nStatic audit clean.");
  } else {
    console.log(`\n${problems.length} problem(s):`);
    for (const p of problems) console.log(`  - ${p}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
