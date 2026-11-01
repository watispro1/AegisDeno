/** The reworked public status page: heartbeat buckets, component states, notices, payload hygiene and the page markup. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { bucketize, createStatusMonitor, uptimeRatio, type HeartbeatSample } from "../src/services/statusMonitor";
import { buildStatusPayload, databaseState, gatewayState, latencyState, overallState, registrationState, type StatusInput } from "../src/web/statusData";
import { visibleNotices, noticeOpen, type StatusNotice } from "../src/web/statusNotices";
import { renderStatus, barLevel } from "../src/web/pages/status";
import { statusScript } from "../src/web/client/status";
import type { SiteConfig } from "../src/web/pages";

const NOW = Date.parse("Sun 2026-11-01 8:00 AM CST (UTC-06:00)");
const HOUR = 3_600_000;
const cfg: SiteConfig = { inviteUrl: "#", supportUrl: "", version: "9.9.9", contactEmail: "", assetVersion: "t" };

function samples(hours: number, down: (i: number) => boolean = () => false): HeartbeatSample[] {
  return Array.from({ length: hours * 60 }, (_, i) => ({ at: NOW - i * 60_000, gateway: !down(i), db: true, ping: 40 }));
}

function input(over: Partial<StatusInput> = {}): StatusInput {
  return {
    nowMs: NOW, online: true, ping: 42, guilds: 12, shards: 1, memoryRss: 200 * 1048576, version: "9.9.9", startedAt: NOW - 2 * HOUR,
    commands: 50, dbConnected: true, dbLatency: 8, registration: { ok: true, count: 50, at: NOW - HOUR }, samples: samples(48), notices: [], ...over,
  };
}

test("bucketize: equal buckets, share of healthy samples, null where there is no data", () => {
  const s = samples(12, i => i < 30); // last 30 minutes had the gateway down
  const b = bucketize(s, NOW, 24 * HOUR, 24);
  assert.equal(b.length, 24);
  assert.equal(b[0].uptime, null, "no samples 24h ago");
  assert.ok(Math.abs(b[23].uptime! - 31 / 61) < 1e-9, "about half of the last hour was down (61 samples, 30 down)");
  assert.equal(b[20].uptime, 1);
  assert.equal(b.reduce((n, x) => n + x.samples, 0), 12 * 60, "every sample counted exactly once");
  assert.equal(uptimeRatio([], NOW, HOUR), null);
  assert.ok(Math.abs(uptimeRatio(s, NOW, 12 * HOUR)! - (1 - 30 / 720)) < 1e-9);
});

test("monitor: keeps 8 days in memory, records registration, works without a database", async () => {
  let clock = NOW;
  const m = createStatusMonitor({ probe: () => ({ gateway: true, ping: 33.6 }), now: () => clock, persist: false });
  m.add({ at: NOW - 9 * 86_400_000, gateway: true, db: true, ping: 1 });
  const s = await m.tick();
  assert.equal(s.ping, 34);
  assert.equal(s.db, false, "no database connection in tests");
  assert.equal(m.samples().length, 1, "samples older than 8 days are dropped");
  assert.equal(m.registration().ok, null);
  m.setRegistration(true, 49);
  assert.deepEqual(m.registration(), { ok: true, count: 49, at: clock });
  clock += 1;
});

test("component states", () => {
  assert.equal(gatewayState(false, 0).state, "outage");
  assert.equal(gatewayState(true, 0).state, "degraded");
  assert.equal(gatewayState(true, 50).state, "operational");
  assert.equal(latencyState(true, 120).state, "operational");
  assert.equal(latencyState(true, 600).state, "degraded");
  assert.equal(latencyState(true, 1500).state, "outage");
  assert.equal(latencyState(false, 0).state, "unknown");
  assert.equal(databaseState(false, null).state, "outage");
  assert.equal(databaseState(true, null).state, "degraded");
  assert.equal(databaseState(true, 900).state, "degraded");
  assert.equal(databaseState(true, 9).state, "operational");
  assert.equal(registrationState({ ok: null, count: 0, at: null }).state, "unknown");
  assert.equal(registrationState({ ok: false, count: 50, at: 1 }).state, "degraded");
});

const notice = (over: Partial<StatusNotice>): StatusNotice => ({ title: "Gateway hiccup", body: "", kind: "incident", severity: "minor", startsAt: new Date(NOW - HOUR), endsAt: null, resolvedAt: null, ...over });

test("overall state: outages, open incidents, and maintenance", () => {
  const ok = buildStatusPayload(input()).components;
  assert.equal(overallState(ok, [], NOW), "operational");
  assert.equal(buildStatusPayload(input({ online: false })).status, "major_outage");
  assert.equal(buildStatusPayload(input({ dbConnected: false, dbLatency: null })).status, "major_outage");
  assert.equal(buildStatusPayload(input({ ping: 700 })).status, "degraded");
  assert.equal(overallState(ok, [notice({})], NOW), "degraded");
  assert.equal(overallState(ok, [notice({ severity: "major" })], NOW), "major_outage");
  assert.equal(overallState(ok, [notice({ resolvedAt: new Date(NOW - 60_000) })], NOW), "operational");
  assert.equal(overallState(ok, [notice({ kind: "maintenance", endsAt: new Date(NOW + HOUR) })], NOW), "maintenance");
  assert.equal(overallState(ok, [notice({ kind: "maintenance", startsAt: new Date(NOW + HOUR) })], NOW), "operational", "upcoming maintenance is listed, not active");
});

test("notices: resolved ones show for 7 days; malformed ones are dropped", () => {
  const list = visibleNotices([
    notice({ title: "old", resolvedAt: new Date(NOW - 8 * 86_400_000) }),
    notice({ title: "recent", resolvedAt: new Date(NOW - 86_400_000) }),
    notice({ title: "open" }),
    { title: "", startsAt: new Date() } as unknown as StatusNotice,
    { title: "no date" } as unknown as StatusNotice,
  ], NOW);
  assert.deepEqual(list.map(n => n.title).sort(), ["open", "recent"]);
  assert.equal(noticeOpen(list.find(n => n.title === "open")!, NOW), true);
});

test("payload: metrics and history, no secrets, hostnames or environment values", () => {
  process.env.MONGO_URI = "mongodb+srv://user:hunter2@cluster0.internal.example";
  const p = buildStatusPayload(input({ notices: [notice({})] }));
  assert.equal(p.metrics.memoryMb, 200);
  assert.equal(p.metrics.uptimeSeconds, 7200);
  assert.equal(p.metrics.lastDeploy, new Date(NOW - 2 * HOUR).toISOString());
  assert.equal(p.history.day.buckets.length, 24);
  assert.equal(p.history.week.buckets.length, 28);
  assert.equal(p.components.map(c => c.id).join(","), "gateway,web,database,latency,commands");
  const text = JSON.stringify(p);
  assert.doesNotMatch(text, /hunter2|mongodb|internal\.example|fly\.dev|127\.0\.0\.1|token|secret/i);
});

test("page: banner, components, metrics, bars and notices; CSP-safe markup; script parses", () => {
  const html = renderStatus(cfg, buildStatusPayload(input({ samples: samples(30, i => i > 600 && i < 700), notices: [notice({ title: "<b>x</b>" })] })));
  assert.match(html, /class="status-banner warn"/, "an open incident makes the banner amber");
  assert.match(html, /data-component="database"/);
  assert.match(html, /data-status-metric="shards"/);
  assert.equal((html.match(/class="ub ub-/g) ?? []).length, 52);
  assert.match(html, /ub-warn|ub-bad/);
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/, "notice text is escaped");
  assert.doesNotMatch(html, /\sstyle=|\son[a-z]+=/i, "no inline styles or handlers");
  assert.match(html, /<script src="\/assets\/status\.js\?v=t" defer><\/script>/);
  assert.doesNotMatch(html, /Unreleased/);
  assert.equal(barLevel(null), "none");
  assert.equal(barLevel(1), "ok");
  assert.equal(barLevel(0.97), "warn");
  assert.equal(barLevel(0.5), "bad");
  assert.doesNotThrow(() => new Function(statusScript));
  assert.doesNotMatch(statusScript, /innerHTML|\.style\b|eval\(/);
});
