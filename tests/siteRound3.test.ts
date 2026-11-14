/**
 * Site round 3: the recreated bot replies (made-up names, numbers from the
 * real engines, CSP-clean) and where they appear.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { loadCommands } from "../src/commands/loader";
import { clearCatalogCache } from "../src/web/catalog";
import { renderHome, renderFeatures, type SiteConfig } from "../src/web/pages";
import type { Stats } from "../src/web/pages/shared";
import { renderWhy } from "../src/web/pages/why";
import { barHtml, botShowcase, showcaseTrust, showcaseIncidentSummary, SHOWCASE_NAMES } from "../src/web/pages/botReplies";
import { scoreBar } from "../src/services/trustScore";
import { VERSION } from "../src/version";

const cfg: SiteConfig = { inviteUrl: "https://discord.com/oauth2/authorize?client_id=1", supportUrl: "", version: VERSION, contactEmail: "", assetVersion: "t" };
const stats: Stats = { guilds: 3, ping: 40, uptime: 100, users: 0, commands: 0 };

before(async () => { await loadCommands(); clearCatalogCache(); });

test("Trust Score example is computed by the real engine and adds up", () => {
  const r = showcaseTrust();
  assert.equal(r.score, 80);
  assert.equal(r.bandLabel, "Trusted");
  const sum = r.factors.reduce((s, f) => s + f.points, 0);
  assert.equal(Math.round(sum), r.score);
  assert.equal(r.factors[r.factors.length - 1].label, "Starting score");
});

test("Trust Score mock bar matches the bot's scoreBar(): ten band-coloured squares, no code span", () => {
  const html = botShowcase({ id: "x", title: "T", lead: "L" });
  const bar = barHtml(80);
  assert.ok(html.includes(bar), "the showcase renders barHtml(score)");
  assert.equal((bar.match(/<svg class="dcx-sq"/g) ?? []).length, 10);
  assert.ok(bar.includes(`Score bar ${scoreBar(80)}, 80 out of 100`), "emoji text from scoreBar() kept in the label");
  assert.equal((bar.match(/#78b159/g) ?? []).length, 8, "80 → eight green squares");
  assert.equal((bar.match(/#31373d/g) ?? []).length, 2, "and two empty ones");
  assert.doesNotMatch(html, /dcx-code dcx-bar|<code[^>]*>[🟩🟦🟨🟧🟥⬛]/u, "no code span around the bar");
  const low = barHtml(15);
  assert.equal((low.match(/#dd2e44/g) ?? []).length, 2, "15 → two red");
  for (const [score, colour] of [[65, "#55acee"], [45, "#fdcb58"], [25, "#f4900c"]] as const) {
    assert.equal((barHtml(score).match(new RegExp(colour, "g")) ?? []).length, Math.round(score / 10), String(score));
  }
});

test("Incident example summary uses the bot's own wording", () => {
  const lines = showcaseIncidentSummary();
  assert.match(lines[0], /^Duration: /);
  assert.match(lines.join("\n"), /Channels: 4 slowed, 0 locked/);
});

test("showcase is labelled as an example, uses made-up names and stays CSP-clean", () => {
  const html = botShowcase({ id: "x", title: "T", lead: "L" });
  assert.equal((html.match(/Example — names are made up/g) ?? []).length, 2);
  for (const n of Object.values(SHOWCASE_NAMES)) assert.ok(html.includes(n));
  assert.doesNotMatch(html, /watispro1|\btaw\b|\d{17,20}/);
  assert.doesNotMatch(html, /style=|<script|\son[a-z]+=/i);
  assert.match(html, /never message content/);
});

test("showcase appears on home, /features and /why", () => {
  for (const html of [renderHome(cfg, stats, true), renderFeatures(cfg), renderWhy(cfg)]) {
    assert.match(html, /class="showcase"/);
    assert.match(html, /Incident Mode is on/);
    assert.match(html, /80\/100 · Trusted/);
  }
  const home = renderHome(cfg, stats, true);
  assert.ok(home.indexOf('class="showcase"') < home.indexOf("highlights-title"), "showcase sits above Built for the bad days");
});

test("home: differentiators and audience split come before the feature list; cards link to docs; what's new and roadmap", async () => {
  const { getReleases } = await import("../src/web/changelog");
  const { newestWithAdditions, itemHeadline } = await import("../src/web/pages/homeSections");
  const { features } = await import("../src/web/content");
  const { renderDocs } = await import("../src/web/pages");
  const home = renderHome(cfg, stats, true);
  const at = (needle: string) => { const i = home.indexOf(needle); assert.ok(i >= 0, needle); return i; };
  assert.ok(at("diff-title") < at("what-title"));
  assert.ok(at("audience-title") < at("what-title"));
  for (const t of ["Exact restore", "A Trust Score you can read", "No Administrator", "Free, nothing locked"]) assert.ok(home.includes(t), t);
  assert.ok(home.includes('href="/roadmap"'));
  const docIds = new Set([...renderDocs(cfg).matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  for (const f of features) {
    const id = f.docs ?? f.id;
    assert.ok(home.includes(`href="/docs#${id}"`), `home links /docs#${id}`);
    assert.ok(docIds.has(id), `/docs#${id} exists`);
  }
  const r = newestWithAdditions(getReleases());
  assert.ok(r);
  assert.ok(home.includes(`href="/changelog#${r.id}"`));
  assert.equal(itemHeadline("Timed slowmode: <code>/slowmode set</code> takes for."), "Timed slowmode");
  assert.equal(itemHeadline("A &amp; B. More"), "A & B");
});

test("mobile hero: dominant full-width Add to Discord, compact secondary buttons, skip link and focus ring", async () => {
  const { styles } = await import("../src/web/theme");
  const home = renderHome(cfg, stats, true);
  assert.match(home, /class="btn-row">\s*<a class="btn" href="https:\/\/discord/);
  const mobile = styles.slice(styles.indexOf("Mobile hero"));
  assert.match(mobile, /@media \(max-width: 480px\)/);
  assert.match(mobile, /\.home-hero \.btn-row > \.btn:not\(\.ghost\) \{ flex: 1 1 100%; min-height: 52px/);
  assert.match(mobile, /\.home-hero \.live-pill \{ order: 10/);
  assert.match(styles, /:focus-visible \{ outline: 2px solid var\(--accent\)/);
  assert.match(home, /<a class="skip-link" href="#main">/);
});

test("support server is visible on docs (sidebar and block), troubleshooting and status, using the configured URL", async () => {
  const { renderDocs, renderTroubleshooting } = await import("../src/web/pages");
  const { renderStatus } = await import("../src/web/pages/status");
  const { buildStatusPayload } = await import("../src/web/statusData");
  const { SUPPORT_SERVER_INVITE } = await import("../src/web/layout");
  const now = Date.now();
  const payload = buildStatusPayload({ nowMs: now, online: true, ping: 40, guilds: 1, shards: 1, memoryRss: 1, version: "t", startedAt: now - 1000, commands: 1,
    dbConnected: true, dbLatency: 1, registration: { ok: true, count: 1, at: now }, samples: [], notices: [] });
  const custom = { ...cfg, supportUrl: "https://discord.gg/example" };
  for (const [name, html] of [["docs", renderDocs(custom)], ["troubleshooting", renderTroubleshooting(custom)], ["status", renderStatus(custom, payload)]] as const) {
    assert.match(html, /class="help-block"/, `${name} has a Need help block`);
    assert.ok(html.includes('href="https://discord.gg/example"'), `${name} uses the configured URL`);
  }
  assert.match(renderDocs(custom), /class="doc-help"/);
  assert.match(renderTroubleshooting(custom), /class="doc-help"/);
  assert.ok(renderDocs(cfg).includes(`href="${SUPPORT_SERVER_INVITE}"`), "falls back to the default invite");
  assert.equal(SUPPORT_SERVER_INVITE, "https://discord.gg/HwTbCYC4PM");
});

test("self-hosting note repeats the Terms: public for review, own copies need written permission", async () => {
  const { readFileSync } = await import("node:fs");
  const { renderTerms } = await import("../src/web/pages");
  const { faqs } = await import("../src/web/content");
  const terms = renderTerms(cfg);
  assert.match(terms, /id="source"/);
  assert.match(terms, /running your own copy, public or private, needs written permission from the maintainer/);
  const why = renderWhy(cfg);
  assert.match(why, /id="source"/);
  assert.match(why, /running your own copy, public or private, needs written permission from the maintainer/);
  assert.ok(faqs.some(f => /written permission/.test(f.a) && /\/terms#source/.test(f.a)));
  assert.match(readFileSync("README.md", "utf8"), /Self-hosting and the source/);
});

test("structured data: richer featureList, BreadcrumbList on deeper pages, no ratings", async () => {
  const { renderDocs, renderTroubleshooting } = await import("../src/web/pages");
  const ld = (html: string) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
  const home = ld(renderHome(cfg, stats, true));
  const app = home.flatMap(d => d["@graph"] ?? [d]).find(x => x["@type"] === "SoftwareApplication");
  assert.ok(app.featureList.length >= 25, `featureList has ${app.featureList.length}`);
  assert.ok(app.featureList.includes("Incident Mode") && app.featureList.includes("Public status page"));
  assert.equal(new Set(app.featureList).size, app.featureList.length);
  for (const [name, html, label] of [["features", renderFeatures(cfg), "Features"], ["why", renderWhy(cfg), "Why Aegis"], ["docs", renderDocs(cfg), "Docs"], ["troubleshooting", renderTroubleshooting(cfg), "Troubleshooting"]] as const) {
    const crumbs = ld(html).filter(d => d["@type"] === "BreadcrumbList");
    assert.equal(crumbs.length, 1, `${name} has one BreadcrumbList`);
    assert.equal(crumbs[0].itemListElement[1].name, label);
  }
  assert.equal(home.flatMap(d => d["@graph"] ?? [d]).filter(x => x["@type"] === "BreadcrumbList").length, 1, "home keeps just its own");
  for (const html of [renderHome(cfg, stats, true), renderFeatures(cfg), renderWhy(cfg)]) assert.doesNotMatch(html, /aggregateRating|"review"/i);
});

test("Steel & Ink: no leftover teal in steel rules, bot avatars use the palette with AA contrast, Light stays default", async () => {
  const { styles } = await import("../src/web/theme");
  const { THEME_IDS } = await import("../src/web/assets");
  const steelRules = [...styles.matchAll(/\[data-theme="steel"\][^{]*\{([^}]*)\}/g)].map(m => m[1]).join("\n");
  assert.doesNotMatch(steelRules, /#17695a|#5ec2a6|#7dd3bb|#6fcbb1|#7fc8d8/i);
  assert.match(styles, /\[data-theme="steel"\] \.dc-avatar\.bot \{ background: #c5cdc8; color: #0c0d0f; \}/);
  assert.match(styles, /\[data-theme="steel"\] \.dcx \.dcx-av \{ background: #0c0d0f; color: #c5cdc8;/);
  const lum = (hex: string) => {
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  assert.ok(ratio("#0c0d0f", "#c5cdc8") >= 4.5);
  assert.ok(ratio("#f2f0ea", "#0c0d0f") >= 4.5);
  assert.ok(ratio("#8e908c", "#0c0d0f") >= 4.5);
  assert.ok(THEME_IDS.includes("light"));
  assert.match(styles, /:root \{\s*--bg: #fbfaf8;/, "Light is still the :root default");
});
