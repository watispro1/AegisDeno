/**
 * The site and dashboard refresh: Trust Score v2 copy, shared empty states,
 * the overview's Common settings strip, foldable case filters, toasts that
 * clear the unsaved bar, and the redesigned Security, Why Aegis, sign-in and
 * server picker pages. Every page stays CSP-clean.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCommands } from "../src/commands/loader";
import { features } from "../src/web/content";
import { bandFor, TRUST_BASE } from "../src/services/trustEngine";
import { renderDocs, renderSecurity, renderWhy, type SiteConfig } from "../src/web/pages";
import { WHY_REASONS } from "../src/web/pages/why";
import { WHY_ROWS } from "../src/web/pages/featuresData";
import { emptyState } from "../src/web/dashboard/views/layout";
import { renderLanding, renderPicker } from "../src/web/dashboard/views/public";
import { dashboardScript } from "../src/web/dashboard/client";
import { styles } from "../src/web/theme";
import { dashboardAuditPages } from "../scripts/dashboard-fixtures";

const cfg: SiteConfig = { inviteUrl: "https://discord.com/oauth2/authorize?client_id=1", supportUrl: "", version: "3.14.0", contactEmail: "", assetVersion: "t" };
const viewer = { userId: "900000000000000001", username: "aj", globalName: "AJ", csrf: "csrf-token" };

before(async () => { await loadCommands(); });

function cspClean(html: string, label: string): void {
  assert.ok(!/<script(?![^>]*type="application\/ld\+json")[^>]*>[^<]+<\/script>/.test(html), `${label}: no inline script`);
  assert.ok(!/\sstyle="/.test(html), `${label}: no inline styles`);
  assert.ok(!/\son[a-z]+="/.test(html), `${label}: no inline handlers`);
}

function fixture(name: string): string {
  const hit = dashboardAuditPages(cfg).find(([n]) => n === name);
  assert.ok(hit, name);
  return hit[1];
}

test("trust score card: Trust Score v2 band names and starting score", () => {
  const card = features.find(f => f.id === "trustscore");
  assert.ok(card);
  const text = card.points.join(" ");
  for (const score of [80, 60, 40, 20]) assert.ok(text.toLowerCase().includes(`${score}+ ${bandFor(score).label.toLowerCase()}`), `band at ${score}`);
  assert.match(text, new RegExp(`below 20 ${bandFor(0).label.toLowerCase()}`));
  assert.ok(text.includes(`starts at ${TRUST_BASE}`));
  assert.ok(text.includes("never message content"));
  for (const html of [text, renderDocs(cfg)]) assert.doesNotMatch(html, /\bcaution\b|elevated risk/i);
});

test("emptyState: icon, title, text and up to two next steps", () => {
  const one = emptyState("Nothing here.", "Explained.", { label: "Do it", href: "/x" });
  assert.match(one, /class="empty-icon" aria-hidden="true">∅</);
  assert.match(one, /<div class="empty-body"><strong>Nothing here\.<\/strong> Explained\./);
  assert.match(one, /<a class="btn ghost sm empty-action" href="\/x">Do it<\/a>/, "a lone action stays a ghost button");
  const two = emptyState("T", "x", { label: "Main", href: "/a" }, { icon: "▤", secondary: { label: "Other", href: "/b" } });
  assert.match(two, /aria-hidden="true">▤</);
  assert.match(two, /<a class="btn sm empty-action" href="\/a">Main<\/a><a class="btn ghost sm empty-action" href="\/b">Other<\/a>/);
  assert.doesNotMatch(emptyState("T", "x"), /empty-actions/);
  assert.match(emptyState("<b>", "x", { label: "\"q\"", href: "/?a=<" }), /&lt;b&gt;.*href="\/\?a=&lt;">&quot;q&quot;</s, "title, label and href are escaped");
});

test("dashboard empty states all use the icon/body layout", () => {
  for (const name of ["/dashboard/:id/cases (empty)", "/dashboard/:id/activity (empty)", "/dashboard/:id/panels (no role panels)", "/dashboard/:id/settings/verification (not set up)"]) {
    const html = fixture(name);
    cspClean(html, name);
    const blocks = html.match(/<div class="empty-state">[\s\S]*?<\/div><\/div>/g) ?? [];
    assert.ok(blocks.length >= 1, `${name}: has an empty state`);
    for (const b of blocks) assert.match(b, /^<div class="empty-state"><span class="empty-icon"/, `${name}: icon first`);
  }
  const verification = fixture("/dashboard/:id/settings/verification (not set up)");
  assert.match(verification, /Verification is not set up yet\./);
  assert.match(verification, /href="\/dashboard\/800000000000000001\/panels#verification">Post the verification panel</);
  assert.match(verification, /<span class="status-pill off">Not set up<\/span>/);
  assert.doesNotMatch(verification, /Turn it on below, then save/);
});

test("overview: Common settings strip with each module's state, under the stats", () => {
  const html = fixture("/dashboard/:id (full overview)");
  cspClean(html, "overview");
  const strip = html.match(/<section class="panel-card quick-card"[\s\S]*?<\/section>/)?.[0] ?? "";
  assert.match(strip, /<h2 id="quick-actions-h">Common settings<\/h2>/);
  assert.match(strip, /href="\/dashboard\/800000000000000001\/settings">All settings &rarr;<\/a>/);
  for (const label of ["Automod", "Logging", "Moderation", "Welcome", "Verification", "Tickets", "Appeals", "Incident Mode"]) {
    assert.match(strip, new RegExp(`<span class="quick-label">${label}</span>`), label);
  }
  assert.match(strip, /href="\/dashboard\/800000000000000001\/settings\/automod"><span class="quick-label">Automod<\/span><span class="quick-state" data-state="on">/);
  assert.match(strip, /<span class="quick-label">Incident Mode<\/span><span class="quick-state" data-state="ready">/);
  assert.ok(html.indexOf("quick-card") < html.indexOf('id="chart-h"'), "above the chart");
  assert.ok(html.indexOf('class="stat-grid"') < html.indexOf("quick-card"), "below the stats");
});

test("cases: filters sit in a panel that is open by default and counts the active ones", () => {
  const all = fixture("/dashboard/:id/cases");
  assert.match(all, /<details class="filter-panel" data-filter-panel data-active-count="0" open>\s*<summary class="filter-panel-summary">Filters<\/summary>/);
  const filtered = fixture("/dashboard/:id/cases (empty)");
  assert.match(filtered, /data-active-count="1" open>\s*<summary class="filter-panel-summary">Filters <span class="filter-count">1 on<\/span>/);
  assert.match(filtered, /Nothing matches\./);
  assert.match(filtered, /href="\/dashboard\/800000000000000001\/cases">Clear the filter<\/a>/);
});

test("dashboard script: folds case filters on phones and marks the title while unsaved", () => {
  assert.match(dashboardScript, /\[data-filter-panel\]/);
  assert.match(dashboardScript, /data-active-count'\) === '0'/);
  assert.match(dashboardScript, /attributeFilter: \['hidden'\]/);
  assert.match(dashboardScript, /setAttribute\('data-unsaved'/);
});

test("styles: toasts clear the unsaved bar, hidden empty states stay hidden, app tabs don't overflow", () => {
  assert.ok(styles.includes("body:has(.unsaved-bar:not([hidden])) .toast-region { bottom: 5.5rem; }"));
  assert.ok(styles.includes('body[data-unsaved="true"] .toast-region'));
  assert.ok(styles.includes(".empty-state:not([hidden]):not(:has(> .empty-body)) { display: block; }"), "fallback never un-hides a hidden empty state");
  assert.ok(styles.includes(".app-content .tabs { margin-right: 0; padding-right: 0; }"));
  for (const sel of [".quick-tile", ".filter-panel-summary", ".sec-glance-list li", ".why-card", ".landing-steps", ".picker-invite"]) {
    assert.ok(styles.includes(`[data-theme="glass"] ${sel}`), `glass styles ${sel}`);
  }
});

test("security: glance cards, report call to action, CSP directive grid", () => {
  const html = renderSecurity(cfg);
  cspClean(html, "security");
  assert.match(html, /<a class="btn" href="#report">Report a vulnerability<\/a>/);
  assert.match(html, /<ul class="sec-glance-list">(\s*<li>[\s\S]*?<\/li>){4}\s*<\/ul>/);
  assert.match(html, /<section class="sec-report" aria-labelledby="report">/);
  assert.match(html, /<ul class="csp-list" aria-label="Content security policy directives">/);
  assert.match(html, /<ul class="sec-points">/);
});

test("why: jump links to every reason, numbered cards, labelled comparison cells", () => {
  const html = renderWhy(cfg);
  cspClean(html, "why");
  const jump = html.match(/<nav class="why-jump"[\s\S]*?<\/nav>/)?.[0] ?? "";
  for (const r of WHY_REASONS) assert.ok(jump.includes(`href="#${r.id}"`), r.id);
  assert.ok(jump.includes('href="#compare"'));
  assert.equal((html.match(/<p class="faint why-proof"><span class="why-proof-label">Check it<\/span>/g) ?? []).length, WHY_REASONS.length);
  assert.equal((html.match(/<td data-label="Aegis">/g) ?? []).length, WHY_ROWS.length);
  assert.equal((html.match(/<td data-label="Elsewhere">/g) ?? []).length, WHY_ROWS.length);
});

test("dashboard sign-in: three steps, the facts, no mock module list", () => {
  const html = renderLanding(cfg, "state");
  cspClean(html, "landing");
  assert.equal((html.match(/<li class="landing-step">/g) ?? []).length, 3);
  assert.match(html, /<a class="btn" href="\/dashboard\/login">Log in with Discord<\/a>/);
  assert.match(html, /role="alert"/);
  assert.equal((html.match(/<li class="dash-fact">/g) ?? []).length, 4);
  assert.doesNotMatch(html, /dash-landing-preview|6 of 8 rules on/);
  assert.match(html, /href="\/privacy#discord-login"/);
});

test("server picker: refresh in the header, servers and invites in their own sections", () => {
  const guilds = [{ id: "800000000000000001", name: "Test Server", icon: null, owner: false, permissions: "32" }];
  const html = renderPicker(cfg, viewer, guilds as never, [{ guild: { ...guilds[0], id: "800000000000000002", name: "Other" } as never, inviteUrl: "https://discord.com/oauth2/authorize?guild_id=2" }], null);
  cspClean(html, "picker");
  const headEnd = html.indexOf("</header>");
  const refresh = html.indexOf('action="/dashboard/refresh"');
  assert.ok(refresh > 0 && refresh < headEnd, "refresh form is in the page header");
  assert.match(html, /name="_csrf" value="csrf-token"/);
  assert.match(html, /<section class="picker-section" aria-labelledby="picker-manage-h">/);
  assert.match(html, /<section class="picker-section picker-invite" aria-label="Servers without Aegis">/);
  const none = renderPicker(cfg, viewer, [], [], null);
  assert.doesNotMatch(none, /picker-invite/);
  assert.match(none, /No servers to manage yet\./);
});

test("refresh files stay under 400 lines", () => {
  for (const f of ["src/web/theme/siteRefresh.ts", "src/web/theme/dashboardRefresh.ts", "src/web/pages/security.ts", "src/web/pages/why.ts", "src/web/content.ts", "src/web/theme/index.ts"]) {
    assert.ok(readFileSync(f, "utf8").split("\n").length < 400, f);
  }
});
