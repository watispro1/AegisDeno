/** The redesigned /changelog, /dashboard/changelog and /status pages: data helpers, markup hooks and CSP-safe output. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  changelogJson,
  getChangelog,
  getDashboardChangelog,
  parseChangelog,
  plainText,
  releaseCounts,
  sectionKind,
  versionBump,
} from "../src/web/changelog";
import { OPEN_RELEASES, releaseBlock, renderChangelog, renderDashboardChangelog } from "../src/web/pages/changelog";
import { COMPONENT_ABOUT, componentSummary, latencyChart, pingLevel, renderStatus } from "../src/web/pages/status";
import { buildStatusPayload, pingSeries, type StatusInput } from "../src/web/statusData";
import type { HeartbeatSample } from "../src/services/statusMonitor";
import { clientScript } from "../src/web/client";
import { jsChangelog } from "../src/web/client/changelog";
import { statusScript } from "../src/web/client/status";
import { styles } from "../src/web/theme";
import type { SiteConfig } from "../src/web/pages";
import { DASHBOARD_VERSION, VERSION } from "../src/version";

const cfg: SiteConfig = { inviteUrl: "#", supportUrl: "", version: VERSION, contactEmail: "", assetVersion: "t" };

test("sectionKind maps Keep a Changelog headings to change types", () => {
  assert.equal(sectionKind("Added"), "added");
  assert.equal(sectionKind(" fixed "), "fixed");
  assert.equal(sectionKind("Security"), "security");
  assert.equal(sectionKind("Known limitations"), "known");
  assert.equal(sectionKind("Misc"), "other");
});

test("versionBump compares with the previous release", () => {
  assert.equal(versionBump("3.0.0", "2.1.0"), "major");
  assert.equal(versionBump("3.8.0", "3.7.3"), "minor");
  assert.equal(versionBump("3.7.3", "3.7.2"), "patch");
  assert.equal(versionBump("1.0.0", null), "initial");
  assert.equal(versionBump("weird", "1.0.0"), "patch");
});

test("releaseCounts and plainText", () => {
  const [r] = parseChangelog("## [1.0.0] - 2026-01-01\n\n### Added\n- a\n- b\n\n### Fixed\n- `c` &\n").releases;
  assert.deepEqual(releaseCounts(r), { total: 3, byKind: { added: 2, fixed: 1 } });
  assert.equal(plainText(r.sections[1].items[0]), "c &");
  assert.equal(plainText('<a href="x">x</a> &lt;b&gt;'), "x <b>");
});

test("changelogJson: both changelogs, released versions, plain text and kinds", () => {
  const json = changelogJson("https://example.test");
  const bot = json.bot as Array<{ version: string; url: string; sections: Array<{ kind: string; items: Array<{ text: string; html: string }> }> }>;
  assert.equal(json.version, 1);
  assert.equal(bot[0].version, VERSION);
  assert.equal(bot[0].url, `https://example.test/changelog#v${VERSION}`);
  assert.equal((json.dashboard[0] as { version: string }).version, DASHBOARD_VERSION);
  for (const s of bot.flatMap(r => r.sections)) {
    assert.notEqual(s.kind, "other", "every bot section has a known kind");
    for (const i of s.items) assert.doesNotMatch(i.text, /<\/?(code|a|strong|ul|li)\b/, "text has no tags");
  }
});

test("/changelog: product switch, stats, type filter, grouped version list and timeline", () => {
  const html = renderChangelog(cfg);
  const log = getChangelog();
  assert.match(html, /<a class="cl-product-tab" href="\/changelog" aria-current="page">Bot/);
  assert.match(html, /<a class="cl-product-tab" href="\/dashboard\/changelog">Dashboard/);
  assert.ok(html.includes('class="cl-stats"'), "stats strip");
  assert.ok(html.includes('href="/changelog.json"'), "JSON feed link");
  for (const k of ["all", "added", "changed", "fixed", "security"]) assert.ok(html.includes(`data-cl-kind="${k}"`), `filter ${k}`);
  assert.ok(html.includes('class="cl-toolbar" data-js-only'), "toolbar hidden without JavaScript");
  assert.ok(html.includes('<p class="side-title toc-group-title">3.x</p>'), "versions grouped by major");
  // First releases open, older collapsed; every release keeps its anchor.
  const opens = [...html.matchAll(/<details class="release-body"( open)? data-default-open="([01])">/g)];
  assert.equal(opens.length, log.releases.length);
  opens.forEach((m, i) => assert.equal(Boolean(m[1]), i < OPEN_RELEASES, `release ${i} open state`));
  for (const r of log.releases) assert.ok(html.includes(`id="${r.id}"`), r.id);
  assert.ok(html.includes(`class="release is-latest" id="v${VERSION}"`), "newest release is marked latest");
  assert.ok(html.includes('<span class="vbadge vb-major">Major</span>'), "major bump badge (3.0.0)");
  assert.ok(html.includes('<span class="vbadge vb-initial">First release</span>'), "first release badge");
  assert.match(html, /<section class="change-group" data-kind="security">/);
  assert.match(html, /<span class="kchip kc-added">Added<\/span>/);
  assert.doesNotMatch(html, /\sstyle=|\son[a-z]+=/i, "no inline styles or handlers");
  assert.doesNotMatch(html, /Unreleased|undefined|NaN/);
});

test("/dashboard/changelog uses the same timeline with Dashboard selected", () => {
  const html = renderDashboardChangelog(cfg);
  assert.match(html, /<a class="cl-product-tab" href="\/dashboard\/changelog" aria-current="page">Dashboard/);
  assert.ok(html.includes('data-cl-kind="known"'), "known limitations filter");
  assert.equal((html.match(/<article class="release/g) ?? []).length, getDashboardChangelog().releases.length);
  assert.ok(html.includes('href="/dashboard"'), "link to the dashboard");
  assert.doesNotMatch(html, /\sstyle=|\son[a-z]+=/i);
});

test("releaseBlock escapes the version and never emits raw markup from it", () => {
  const html = releaseBlock({ version: '9"><x>', date: "2026-01-01", id: 'v9"><x>', notes: [], sections: [], compareUrl: "javascript:alert(1)" }, { previous: "8.0.0" });
  assert.doesNotMatch(html, /<x>/);
  assert.doesNotMatch(html, /javascript:/);
});

test("changelog client: parses, CSP-safe, and its styles exist", () => {
  assert.doesNotThrow(() => new Function(clientScript));
  assert.doesNotMatch(jsChangelog, /innerHTML|\.style\b|eval\(/);
  for (const hook of ["data-cl-kind", "data-cl-expand", "data-toc-group", "replaceState", "hashchange"]) assert.ok(jsChangelog.includes(hook), hook);
  for (const rule of ['html:not(.js) [data-js-only]', ".release-body", ".kc-security", ".changes li[hidden]", ".toc-group[hidden]"]) assert.ok(styles.includes(rule), rule);
});

const NOW = Date.parse("2026-11-01T14:00:00Z");
const HOUR = 3_600_000;
function samples(hours: number, ping: (i: number) => number): HeartbeatSample[] {
  return Array.from({ length: hours * 60 }, (_, i) => ({ at: NOW - i * 60_000, gateway: true, db: true, ping: ping(i) }));
}
function input(over: Partial<StatusInput> = {}): StatusInput {
  return {
    nowMs: NOW, online: true, ping: 42, guilds: 12, shards: 1, memoryRss: 200 * 1048576, version: "9.9.9", startedAt: NOW - 2 * HOUR,
    commands: 50, dbConnected: true, dbLatency: 8, registration: { ok: true, count: 50, at: NOW - HOUR }, samples: samples(30, () => 40), notices: [], ...over,
  };
}

test("pingSeries: hourly averages of connected samples, null where there is none", () => {
  const s = [...samples(2, i => (i < 60 ? 100 : 50)), { at: NOW - 5 * 60_000, gateway: false, db: true, ping: 9999 }];
  const series = pingSeries(s, NOW, 24 * HOUR, 24);
  assert.equal(series.length, 24);
  assert.equal(series[0], null);
  assert.ok(series[23]! >= 95 && series[23]! <= 100, `disconnected sample ignored (${series[23]})`);
  assert.ok(series[22]! >= 50 && series[22]! < 60, `older hour (${series[22]})`);
  const p = buildStatusPayload(input());
  assert.equal(p.history.day.pingMs, 40);
  assert.equal(p.history.day.buckets[23].pingMs, 40);
  assert.equal(buildStatusPayload(input({ samples: [] })).history.week.pingMs, null);
});

test("status helpers: summary line and latency levels", () => {
  assert.equal(componentSummary([{ state: "operational" }, { state: "operational" }]), "All 2 components operational");
  assert.equal(componentSummary([{ state: "operational" }, { state: "outage" }, { state: "degraded" }, { state: "unknown" }]), "1 of 4 operational, 1 down, 1 degraded");
  assert.equal(pingLevel(null), "none");
  assert.equal(pingLevel(120), "ok");
  assert.equal(pingLevel(600), "warn");
  assert.equal(pingLevel(1500), "bad");
});

test("/status: hero, component cards, latency chart, legend, countdown, active incidents", () => {
  const payload = buildStatusPayload(input({
    online: false, ping: 0,
    notices: [{ title: "Gateway down", body: "", kind: "incident", severity: "major", startsAt: new Date(NOW - HOUR), endsAt: null, resolvedAt: null }],
  }));
  const html = renderStatus(cfg, payload);
  assert.match(html, /class="status-banner bad"/);
  assert.ok(html.includes("Active incidents &amp; maintenance"), "open notices on top");
  assert.ok(html.includes("data-status-countdown") && html.includes("data-status-pause"), "auto-refresh controls");
  assert.match(html, /class="component is-outage" data-component="gateway"/);
  for (const c of payload.components) assert.ok(COMPONENT_ABOUT[c.id], `about text for ${c.id}`);
  assert.equal((html.match(/<p class="comp-about">/g) ?? []).length, payload.components.length);
  assert.equal((html.match(/<rect class="lb lb-/g) ?? []).length, 24, "24 hourly latency bars");
  assert.ok(html.includes("No reading"), "no current ping while offline");
  assert.doesNotMatch(html, /\sstyle=|\son[a-z]+=/i, "no inline styles or handlers");
  assert.doesNotMatch(html, /undefined|NaN/);
  const healthy = renderStatus(cfg, buildStatusPayload(input()));
  assert.doesNotMatch(healthy, /Active incidents/, "no active section when nothing is open");
  assert.ok(healthy.includes("All 5 components operational"));
});

test("latencyChart escapes labels and keeps heights inside the box", () => {
  const svg = latencyChart({ label: "<x>", uptime: 1, pingMs: 5000, buckets: [{ start: "2026-11-01T00:00:00.000Z", end: "2026-11-01T01:00:00.000Z", uptime: 1, pingMs: 5000 }, { start: "2026-11-01T01:00:00.000Z", end: "2026-11-01T02:00:00.000Z", uptime: null, pingMs: null }] }, "day");
  assert.doesNotMatch(svg, /<x>/);
  const heights = [...svg.matchAll(/height="(\d+)"/g)].map(m => Number(m[1]));
  assert.ok(heights.every(h => h >= 2 && h <= 48));
});

test("status client: parses, CSP-safe, countdown and pause", () => {
  assert.doesNotThrow(() => new Function(statusScript));
  assert.doesNotMatch(statusScript, /innerHTML|\.style\b|eval\(/);
  for (const hook of ["data-status-countdown", "data-status-pause", "data-status-stale", "createElementNS", "data-local-time"]) assert.ok(statusScript.includes(hook), hook);
  assert.ok(styles.includes("prefers-reduced-motion: no-preference"), "pulse only without reduced motion");
});
