/**
 * The redesigned public pages (home, commands, docs, troubleshooting, 404):
 * real numbers only, links that resolve, filters that work without
 * JavaScript, everything escaped, and the strict CSP kept (no inline styles,
 * scripts or handlers).
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { loadCommands } from "../src/commands/loader";
import { buildCatalog, catalogStats, clearCatalogCache, getCommand } from "../src/web/catalog";
import { getReleases } from "../src/web/changelog";
import { features } from "../src/web/content";
import { renderCommands, renderDocs, renderHome, renderNotFound, renderTroubleshooting, type SiteConfig } from "../src/web/pages";
import { commandAccess, matchesFilter, parseCommandFilter } from "../src/web/pages/commands";
import { renderFeatures } from "../src/web/pages/features";
import { HOME_FEATURE_LINKS } from "../src/web/pages/home";
import { cmdBlock } from "../src/web/pages/shared";
import { issueAnchor, troubleshootingIssues } from "../src/web/pages/troubleshooting";
import { clientScript } from "../src/web/client";
import { styles } from "../src/web/theme";
import { VERSION } from "../src/version";

const cfg: SiteConfig = { inviteUrl: "https://discord.com/oauth2/authorize?client_id=1", supportUrl: "", version: VERSION, contactEmail: "", assetVersion: "t" };
const stats = { guilds: 1234, users: 50000, commands: 0, ping: 42, uptime: 90_000_000 };

before(async () => {
  await loadCommands();
  clearCatalogCache();
});

function ids(html: string): string[] {
  return [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
}

function assertCspClean(html: string, label: string): void {
  assert.ok(!/<script(?![^>]*type="application\/ld\+json")[^>]*>[^<]+<\/script>/.test(html), `${label}: no inline executable script`);
  assert.ok(!/\sstyle="/.test(html), `${label}: no inline styles`);
  assert.ok(!/\son[a-z]+="/.test(html), `${label}: no inline handlers`);
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `${label}: one h1`);
  const all = ids(html);
  assert.equal(new Set(all).size, all.length, `${label}: ids unique`);
  for (const m of html.matchAll(/href="#([^"]+)"/g)) assert.ok(all.includes(m[1]), `${label}: #${m[1]} has a target`);
}

test("home: CSP-clean, real numbers from the catalog, live stats and the latest release", () => {
  const html = renderHome(cfg, stats, true);
  assertCspClean(html, "home");
  const cs = catalogStats();
  assert.ok(html.includes(`Browse ${cs.commands} commands`), "command count from the catalog");
  assert.ok(html.includes(`<a href="/commands">${cs.commands}</a>`), "stat strip command count");
  assert.ok(html.includes(`in ${cs.categories} categories`));
  assert.ok(html.includes(`<span data-live="guilds">1,234</span>`), "server count is live and formatted");
  assert.ok(html.includes(`data-uptime-from="90000000"`), "uptime ticker has a start point");
  assert.ok(html.includes(`data-status-dot`) && html.includes(`data-status-state>Operational`));
  const latest = getReleases()[0];
  assert.ok(latest, "CHANGELOG.md has a release");
  assert.ok(html.includes(`href="/changelog#${latest.id}"`), "links the newest release");
  assert.ok(html.includes(`v${latest.version}`));
  assert.ok(html.includes(`class="dot danger"`) === false, "healthy dot when operational");
  assert.ok(renderHome(cfg, { ...stats, ping: 0 }, false).includes(`class="dot danger"`), "offline dot");
});

test("home: every feature card points at a real /features anchor and the copy buttons are JS-only", () => {
  const html = renderHome(cfg, stats, true);
  const featuresHtml = renderFeatures(cfg);
  const featureIds = new Set(ids(featuresHtml));
  for (const f of features) {
    const link = HOME_FEATURE_LINKS[f.id];
    assert.ok(link, `home has a link for "${f.id}"`);
    assert.ok(featureIds.has(link.anchor), `/features#${link.anchor} exists`);
  }
  for (const m of html.matchAll(/href="\/features#([^"]+)"/g)) assert.ok(featureIds.has(m[1]), `/features#${m[1]}`);
  for (const m of html.matchAll(/<button[^>]*data-copy=[^>]*>/g)) assert.match(m[0], /data-js-only/, "copy buttons hide without JS");
  assert.ok(!html.includes('class="status-pill'), "does not reuse the dashboard's status-pill class");
});

test("commands: filters parse safely and match like the client script", () => {
  const cats = [...new Set(buildCatalog().map(c => c.category))];
  assert.deepEqual(parseCommandFilter(undefined, cats), { q: "", cat: "all", access: "all", subs: false, auto: false });
  const f = parseCommandFilter({ q: ["  ban ", "x"], cat: "nope", access: "root", subs: "1", auto: "0" }, cats);
  assert.equal(f.q, "ban");
  assert.equal(f.cat, "all", "unknown category falls back to all");
  assert.equal(f.access, "all", "unknown access level falls back to all");
  assert.equal(f.subs, true);
  assert.equal(f.auto, false);
  assert.equal(parseCommandFilter({ q: "a".repeat(500) }, cats).q.length, 100, "query capped");

  const ban = getCommand("ban")!;
  assert.equal(commandAccess(ban), "moderator");
  assert.ok(matchesFilter(ban, { ...f, q: "/BAN", subs: false }), "leading slash and case ignored");
  assert.ok(!matchesFilter(ban, { q: "", cat: "all", access: "admin", subs: false, auto: false }));
  const config = getCommand("config");
  if (config) assert.equal(commandAccess(config), "admin");
});

test("commands: the query string filters the page server-side, so it works without JavaScript", () => {
  const all = buildCatalog();
  const html = renderCommands(cfg, { q: "ban", access: "moderator" });
  assertCspClean(html, "commands filtered");
  const expected = all.filter(c => matchesFilter(c, { q: "ban", cat: "all", access: "moderator", subs: false, auto: false }));
  assert.ok(expected.length > 0);
  const visible = [...html.matchAll(/<details class="cmd-card"[^>]*>/g)].filter(m => !/\shidden>/.test(m[0]));
  assert.equal(visible.length, expected.length, "only matching cards are visible");
  assert.ok(html.includes(`id="cmd-count" role="status" aria-live="polite">${expected.length === 1 ? "1 command" : `${expected.length} commands`}`));
  assert.match(html, /<form class="cmd-toolbar" id="cmd-form" role="search" action="\/commands" method="get">/);
  assert.match(html, /<input id="cmd-search" name="q" type="search" value="ban"/);
  assert.match(html, /<input type="hidden" name="access" value="moderator">/, "active filter carried by the search form");
  assert.match(html, /<a class="tab access-moderator" href="\/commands\?q=ban&amp;access=moderator" data-access="moderator" aria-current="true"/);
  assert.match(html, /<a class="tab" href="\/commands\?q=ban&amp;cat=moderation&amp;access=moderator" data-cat="moderation"/, "chips keep the other filters");
  assert.match(html, /content="noindex/, "filtered views are not indexed");
  assert.ok(!/content="noindex/.test(renderCommands(cfg)), "the full reference is indexed");

  const none = renderCommands(cfg, { q: "zzzz-no-such-thing" });
  assert.match(none, /id="cmd-empty" class="empty-state">/, "empty state shown when nothing matches");
  assert.match(none, /<a class="copy-btn" href="\/commands" data-cmd-clear>/, "clear works as a plain link");
});

test("commands: the search text is escaped everywhere it is echoed", () => {
  const evil = `"><script>alert(1)</script><img src=x onerror=alert(2)>`;
  const html = renderCommands(cfg, { q: evil });
  assert.ok(!html.includes("<script>alert(1)"), "no raw script");
  assert.ok(!html.includes("<img src=x"), "no raw tag");
  assert.ok(html.includes("value=\"&quot;&gt;&lt;script&gt;"), "input value escaped");
});

test("commands: permission badges, copyable usage and anchors on every card", () => {
  const html = renderCommands(cfg);
  for (const cmd of buildCatalog()) {
    const card = html.slice(html.indexOf(`id="cmd-${cmd.name}"`));
    const body = card.slice(0, card.indexOf("</details>"));
    assert.match(body, new RegExp(`class="perm-badge perm-${commandAccess(cmd)}"`), `/${cmd.name} badge`);
    assert.match(body, /class="copy-btn usage-copy" type="button" data-js-only data-copy="\//, `/${cmd.name} usage copy`);
    assert.match(body, new RegExp(`class="cmd-anchor" href="#cmd-${cmd.name}"`), `/${cmd.name} anchor`);
  }
  assert.match(html, /data-copy="\/ban user:"/, "usage copy fills required options");
  assert.ok(/\.cmd-side a \{/.test(styles) && /\.toc \{[^}]*position: sticky/.test(styles), "category sidebar is sticky");
});

test("docs: sticky TOC with a filter, start-here links that resolve, readable stats and copyable blocks", () => {
  const html = renderDocs(cfg);
  assertCspClean(html, "docs");
  assert.match(html, /<aside class="toc docs-toc" aria-label="On this page">/);
  assert.match(html, /<div class="toc-filter" data-js-only>/, "TOC filter only with JS");
  assert.match(html, /<ul class="doc-start" aria-label="Start here">/);
  assert.match(html, /Reading time<\/dt><dd><strong>\d+ min<\/strong>/);
  assert.match(html, /<div class="code-block"><pre class="block"><code>\/logging channel/);
  assert.match(html, /class="copy-btn code-copy" type="button" data-js-only data-copy="\/logging channel channel:#mod-log/);
  assert.ok(!/<pre class="block"><code><a class="cmd-link"/.test(html), "command blocks are not turned into links");
  assert.ok(html.includes("/issues/new?title=Docs%3A%20"), "feedback link");
  assert.ok(clientScript.includes("toc-filter") && clientScript.includes("docs-toc-list"), "TOC filter script");
  assert.ok(/\.docs-prose \{[^}]*line-height: 1\.72/.test(styles), "docs typography");
});

test("cmdBlock: copy button carries the exact text, escaped", () => {
  const out = cmdBlock(`/say text:"<b>"\n/ping`);
  assert.ok(out.includes(`data-copy="/say text:&quot;&lt;b&gt;&quot;\n/ping"`));
  assert.ok(out.includes(`aria-label="Copy 2 commands"`));
  assert.ok(clientScript.includes("data-copy-label"), "custom toast label");
});

test("troubleshooting: every fix has its own link, groups are in a sticky sidebar", () => {
  const html = renderTroubleshooting(cfg);
  assertCspClean(html, "troubleshooting");
  for (const g of troubleshootingIssues()) {
    g.items.forEach((_item, i) => {
      const id = issueAnchor(g.id, i);
      assert.ok(html.includes(`<details class="issue" id="${id}">`), id);
      assert.ok(html.includes(`href="#${id}"`), `${id} link`);
    });
  }
  assert.match(html, /<aside class="toc" aria-label="Problem groups">/);
  assert.match(html, /<div class="help-toolbar" data-js-only>/, "filter box hidden without JS");
  assert.ok(clientScript.includes("openIssueFromHash"), "a #fix link opens that fix");
});

test("404: escapes the requested path, offers search that works without JS and real links", () => {
  const html = renderNotFound(cfg, [{ href: "/docs", label: "Docs" }], `/x"><script>alert(1)</script>`);
  assertCspClean(html, "404");
  assert.ok(!html.includes("<script>alert(1)"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.match(html, /<form class="notfound-search" role="search" action="\/commands" method="get">/);
  for (const m of html.matchAll(/href="\/commands#cmd-([\w-]+)"/g)) assert.ok(getCommand(m[1]), `/${m[1]} exists`);
  for (const href of ["/commands", "/docs", "/troubleshooting", "/features", "/changelog", "/status"]) {
    assert.ok(html.includes(`href="${href}"`), href);
  }
  assert.ok(renderNotFound(cfg).includes("nf-head"), "works with no suggestions or path");
  assert.ok(!renderNotFound(cfg).includes("nf-path"), "no path line without a path");
});

test("styles and script: no-JS fallbacks, reduced motion and a script that parses", () => {
  assert.ok(styles.includes("html.js .nojs-only { display: none; }"));
  assert.ok(styles.includes('html:not(.js) [data-js-only] { display: none; }'));
  assert.ok(/@media \(prefers-reduced-motion: reduce\) \{[^}]*\.home-highlight a/.test(styles));
  assert.ok(styles.includes('.tab[aria-current="true"]'), "link chips show their state");
  assert.doesNotThrow(() => new Function(clientScript));
  assert.ok(clientScript.includes("setCurrent"), "chips toggle aria-current");
});
