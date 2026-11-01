/**
 * Trust Score v2 (3.7.0): the explainable engine, config normalisation, the
 * opt-in integrations (link filter, Incident join gate, low-trust role), the
 * activity counter update, and the dashboard Trust page. No network, no Mongo.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import {
  computeTrust, normalizeTrustConfig, recencyWeight, trustDistribution, lowTrustRoleDecision, linkFilterApplies,
  formatPoints, DEFAULT_TRUST_CONFIG, type TrustFacts,
} from "../src/services/trustEngine";
import { factsFromRows, isGateCase } from "../src/services/trustService";
import { joinGateDecision } from "../src/services/incidentLogic";
import { activityUpdate } from "../src/services/memberActivity";
import { normalizeGuildConfig, guildConfigSetPaths } from "../src/services/guildConfigNormalize";
import { lowTrustRoleProblem, describeTrustConfig, command as trustCommand } from "../src/commands/moderation/trust";
import { trustHistogram } from "../src/web/dashboard/views/trust";
import { createDashboardRouter } from "../src/web/dashboard/router";
import { readDashboardConfig } from "../src/web/dashboard/config";
import { memorySessionStore } from "../src/web/dashboard/sessions";
import { memoryAuditStore } from "../src/web/dashboard/audit";
import { cookieNames, csrfToken, signSessionId } from "../src/web/dashboard/security";
import type { BotView } from "../src/web/dashboard/botView";
import type { DashboardData, SettingsSnapshot } from "../src/web/dashboard/data";
import { memoryDashboardExtras, type MemberProfile } from "../src/web/dashboard/extras";
import type { SiteConfig } from "../src/web/pages";

const DAY = 86_400_000;
const NOW = Date.parse("2026-11-01T15:00:00Z");
const ago = (d: number) => new Date(NOW - d * DAY);

const base = (over: Partial<TrustFacts> = {}): TrustFacts => ({
  accountCreatedAt: ago(800), joinedAt: ago(400), verified: true, messageCount: 1200, activeDays30: 20,
  lastActiveAt: ago(1), warnings: [], cases: [], automodHits30: 0, gateFlags: 0, ...over,
});

test("engine: a long-standing clean member is trusted, every factor explained", () => {
  const r = computeTrust(base(), "balanced", NOW);
  assert.equal(r.score, 100);
  assert.equal(r.band, "trusted");
  assert.equal(r.factors.at(-1)?.key, "base");
  for (const k of ["account", "tenure", "verification", "activity", "warnings", "cases"]) assert.ok(r.factors.some(f => f.key === k), k);
});

test("engine: brand-new unverified account with automod hits and a gate flag is high risk", () => {
  const r = computeTrust(base({ accountCreatedAt: ago(1), joinedAt: ago(0.1), verified: false, messageCount: 0, activeDays30: 0, lastActiveAt: null, automodHits30: 3, gateFlags: 1 }), "balanced", NOW);
  assert.ok(r.score < 20, String(r.score));
  assert.equal(r.band, "high-risk");
  const acc = r.factors.find(f => f.key === "account")!;
  assert.equal(acc.points, -10);
  assert.match(acc.detail, /Brand-new/);
  assert.equal(r.factors.find(f => f.key === "gate")!.points, -10);
});

test("engine: recent and severe cases weigh more; revoked ones don't count; warn cases aren't double counted", () => {
  const recent = computeTrust(base({ cases: [{ action: "ban", createdAt: ago(5) }] }), "balanced", NOW);
  const old = computeTrust(base({ cases: [{ action: "ban", createdAt: ago(300) }] }), "balanced", NOW);
  const timeout = computeTrust(base({ cases: [{ action: "timeout", createdAt: ago(5) }] }), "balanced", NOW);
  const revoked = computeTrust(base({ cases: [{ action: "ban", createdAt: ago(5), revoked: true }] }), "balanced", NOW);
  const warnCase = computeTrust(base({ cases: [{ action: "warn", createdAt: ago(5) }] }), "balanced", NOW);
  const pts = (r: ReturnType<typeof computeTrust>) => r.factors.find(f => f.key === "cases")!.points;
  assert.ok(pts(recent) < pts(old));
  assert.ok(pts(recent) < pts(timeout));
  assert.equal(pts(revoked), 0);
  assert.equal(pts(warnCase), 0);
  const active = computeTrust(base({ cases: [{ action: "timeout", createdAt: ago(1), active: true }] }), "balanced", NOW);
  assert.ok(pts(active) < pts(timeout));
  assert.equal(recencyWeight(ago(10), NOW), 1);
  assert.ok(recencyWeight(ago(400), NOW) < recencyWeight(ago(100), NOW));
});

test("engine: penalties are capped and the score stays in 0–100", () => {
  const many = Array.from({ length: 50 }, () => ({ createdAt: ago(1) }));
  const r = computeTrust(base({ warnings: many, cases: many.map(w => ({ action: "ban", createdAt: w.createdAt })), automodHits30: 99, gateFlags: 9 }), "strict", NOW);
  assert.equal(r.factors.find(f => f.key === "warnings")!.points, -49); // 35 × 1.4
  assert.ok(r.score >= 0 && r.score <= 100);
});

test("engine: presets change weights in the expected direction; bots are not scored", () => {
  const facts = base({ warnings: [{ createdAt: ago(3) }, { createdAt: ago(3) }], accountCreatedAt: ago(100), joinedAt: ago(30), messageCount: 20, activeDays30: 3 });
  const s = computeTrust(facts, "strict", NOW).score, b = computeTrust(facts, "balanced", NOW).score, l = computeTrust(facts, "lenient", NOW).score;
  assert.ok(s < b && b < l, `${s} ${b} ${l}`);
  assert.equal(computeTrust(base({ isBot: true, accountCreatedAt: ago(0) }), "balanced", NOW).bandLabel, "Bot (not scored)");
  assert.equal(formatPoints(-4.5), "−4.5");
  assert.equal(formatPoints(0), "±0");
});

test("config: defaults are off, values are clamped, junk is dropped, and it round-trips through guild config", () => {
  assert.deepEqual(normalizeTrustConfig(undefined), DEFAULT_TRUST_CONFIG);
  const c = normalizeTrustConfig({ enabled: true, preset: "evil", lowThreshold: "999", lowTrustRoleId: "$where", incidentGate: "yes" });
  assert.equal(c.preset, "balanced");
  assert.equal(c.lowThreshold, 90);
  assert.equal(c.lowTrustRoleId, null);
  assert.equal(c.incidentGate, false);
  assert.equal(normalizeGuildConfig("1", { trust: { enabled: true, lowThreshold: 40 } } as never).trust?.lowThreshold, 40);
  assert.equal(normalizeGuildConfig("1").trust?.enabled, false);
  const set = guildConfigSetPaths({ trust: { ...DEFAULT_TRUST_CONFIG, lowThreshold: 3 } });
  assert.equal((set.trust as { lowThreshold: number }).lowThreshold, 5);
  assert.match(describeTrustConfig(c), /Integrations:\*\* on/);
});

test("integrations: link filter, low-trust role and Incident join gate", () => {
  const on = normalizeTrustConfig({ enabled: true, linkFilterLowTrustOnly: true, lowThreshold: 30, lowTrustRoleId: "123456789012345678" });
  assert.equal(linkFilterApplies(DEFAULT_TRUST_CONFIG, 99), true, "off: everyone filtered");
  assert.equal(linkFilterApplies(on, 80), false);
  assert.equal(linkFilterApplies(on, 10), true);
  assert.equal(linkFilterApplies(on, null), true, "unknown score fails closed");
  assert.equal(lowTrustRoleDecision(on, 10, { editable: true, managed: false }).assign, true);
  assert.equal(lowTrustRoleDecision(on, 10, { editable: false, managed: false }).assign, false);
  assert.equal(lowTrustRoleDecision(on, 50, { editable: true, managed: false }).assign, false);
  assert.equal(lowTrustRoleDecision({ ...on, enabled: false }, 10, { editable: true, managed: false }).assign, false);

  const opts = { joinGate: "timeout" as const, minAccountAgeDays: 7 };
  const old = { isBot: false, accountCreatedAt: ago(400), actionable: true };
  assert.equal(joinGateDecision(opts, old, NOW).act, "none");
  const gated = joinGateDecision(opts, { ...old, trust: { score: 12, threshold: 30 } }, NOW);
  assert.equal(gated.act, "timeout");
  assert.ok(gated.act !== "none" && isGateCase(gated.reason), "gate cases are recognised as gate flags");
  assert.equal(joinGateDecision(opts, { ...old, trust: { score: 50, threshold: 30 } }, NOW).act, "none");
  assert.equal(joinGateDecision(opts, { ...old, actionable: false, trust: { score: 1, threshold: 30 } }, NOW).act, "none");
  assert.equal(joinGateDecision({ ...opts, joinGate: "off" }, { ...old, trust: { score: 1, threshold: 30 } }, NOW).act, "none");
  assert.equal(joinGateDecision(opts, { ...old, isBot: true, trust: { score: 1, threshold: 30 } }, NOW).act, "none");
});

test("facts: gate cases become flags, recent days are windowed, a running timeout marks only its newest case", () => {
  const f = factsFromRows({
    isBot: false, accountCreatedAt: ago(500), joinedAt: ago(100), verified: null, timeoutUntil: new Date(NOW + 60_000),
    warnings: [], automodHits30: 2, now: NOW,
    cases: [
      { action: "timeout", reason: "Incident join gate: account is 2d old (minimum 7d)", createdAt: ago(3) },
      { action: "timeout", reason: "spam", createdAt: ago(2) },
      { action: "timeout", reason: "older", createdAt: ago(20) },
    ],
    activity: { messageCount: 40, lastMessageAt: ago(1), recentDays: ["2026-10-31", "2026-10-30", "2026-09-01", "2026-10-31"] },
  });
  assert.equal(f.gateFlags, 1);
  assert.equal(f.cases.length, 2);
  assert.deepEqual(f.cases.map(c => c.active), [true, false]);
  assert.equal(f.activeDays30, 2);
});

test("activity counter: pipeline update bumps the count and keeps a 30-day day list, never content", () => {
  const [stage] = activityUpdate({ guildId: "1", userId: "2", count: 3, lastAt: NOW });
  const set = (stage as { $set: Record<string, unknown> }).$set;
  assert.deepEqual(Object.keys(set).sort(), ["lastMessageAt", "lastMessageDate", "messageCount", "recentDays"]);
  assert.match(JSON.stringify(set.recentDays), /"2026-10-02"/);
  assert.match(JSON.stringify(set.messageCount), /3/);
});

test("command: /trust user + config, Manage Server for config, role hierarchy enforced", () => {
  const json = trustCommand.data.toJSON() as { name: string; options: Array<{ name: string }> };
  assert.equal(json.name, "trust");
  assert.deepEqual(json.options.map(o => o.name), ["user", "config"]);
  assert.match(lowTrustRoleProblem({ id: "1", managed: false, position: 1 }, "1", 5, 5, false) ?? "", /@everyone/);
  assert.match(lowTrustRoleProblem({ id: "2", managed: false, position: 5 }, "1", 5, 9, false) ?? "", /Aegis/);
  assert.match(lowTrustRoleProblem({ id: "2", managed: false, position: 4 }, "1", 5, 3, false) ?? "", /your highest/);
  assert.equal(lowTrustRoleProblem({ id: "2", managed: false, position: 4 }, "1", 5, 3, true), null);
  assert.match(lowTrustRoleProblem({ id: "2", managed: true, position: 1 }, "1", 5, 9, false) ?? "", /managed/);
});

test("histogram: ten buckets, low bands marked, accessible text", () => {
  assert.deepEqual(trustDistribution([0, 9, 10, 55, 100, 100]), [2, 1, 0, 0, 0, 1, 0, 0, 0, 2]);
  const svg = trustHistogram([1, 2, 0, 0, 0, 0, 0, 0, 0, 3], 30);
  assert.equal((svg.match(/class="bar[^"]*low/g) ?? []).length, 3);
  assert.match(svg, /role="img"/);
  assert.doesNotMatch(svg, /style=|<script/);
});

/* ── Dashboard ─────────────────────────────────────────────────────── */

const USER = "900000000000000001";
const GUILD = "800000000000000001";
const ROLE = "600000000000000001";
const HIGH_ROLE = "600000000000000002";
const MEMBER = "500000000000000001";
const SECRET = "s".repeat(64);
const site: SiteConfig = { inviteUrl: "#", supportUrl: "", version: "test", contactEmail: "", assetVersion: "t" };
const bot: BotView = {
  hasGuild: id => id === GUILD,
  guild: id => (id === GUILD ? { id, name: "Test", memberCount: 10, iconUrl: null } : null),
  memberCanManage: async (g, u) => g === GUILD && u === USER,
  memberHasPermission: async () => true,
  textChannels: () => [], hiddenChannelIds: () => new Set(),
  roles: () => [{ id: ROLE, name: "Probation", position: 1, assignable: true }, { id: HIGH_ROLE, name: "Admin", position: 9, assignable: false }],
  viewerRoleLimit: async () => ({ ownerId: "1", topPosition: 5 }),
  userName: () => null,
};
const snapshot = { guild: normalizeGuildConfig(GUILD) } as unknown as SettingsSnapshot;
const data = { loadSettings: async () => snapshot } as unknown as DashboardData;
const profile: MemberProfile = { id: MEMBER, username: "newbie", globalName: null, avatarUrl: null, bot: false, inServer: true, owner: false, joinedAt: ago(1), createdAt: ago(2), timeoutUntil: null, topRolePosition: 0, roles: [], botCan: { timeout: true, kick: true, ban: true } };
const extras = memoryDashboardExtras({
  members: [profile],
  trust: {
    overview: { scored: 3, distribution: [1, 1, 0, 0, 0, 0, 0, 0, 0, 1], average: 40, lowCount: 2, lowest: [{ userId: MEMBER, name: "newbie <b>", avatarUrl: null, score: 4, bandLabel: "High risk" }] },
    members: { [MEMBER]: computeTrust(base({ accountCreatedAt: ago(2), joinedAt: ago(1), verified: false, messageCount: 0, activeDays30: 0, lastActiveAt: null }), "balanced", NOW) },
  },
});
const audit = memoryAuditStore();
let server: Server, url = "", cookie = "", csrf = "";

before(async () => {
  const config = readDashboardConfig({ DISCORD_APPLICATION_ID: "123456789012345678", DISCORD_CLIENT_SECRET: "x", DASHBOARD_SESSION_SECRET: SECRET, DASHBOARD_REDIRECT_URI: "http://127.0.0.1/dashboard/callback" });
  assert.ok(config);
  const sessions = memorySessionStore();
  const sid = "session-id-for-trust-tests-0123";
  const now = Date.now();
  await sessions.create(sid, { userId: USER, username: "aj", globalName: "AJ", avatar: null, accessToken: "t", tokenExpiresAt: new Date(now + 1e9), guilds: [{ id: GUILD, name: "Test", icon: null, owner: false, permissions: "32" }], guildsFetchedAt: new Date(now), createdAt: new Date(now), expiresAt: new Date(now + 1e9) });
  cookie = `${cookieNames(config.secureCookies).session}=${encodeURIComponent(signSessionId(SECRET, sid))}`;
  csrf = csrfToken(SECRET, sid);
  const app = express();
  app.use("/dashboard", createDashboardRouter({ site, config, bot, data, sessions, audit, extras, limits: { auth: 100, post: 1000, page: 2000 } }));
  server = app.listen(0);
  await new Promise(r => server.once("listening", r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

const get = (p: string) => fetch(url + p, { redirect: "manual", headers: { Cookie: cookie } });
const post = (p: string, form: Record<string, string>, withCsrf = true) => {
  const body = new URLSearchParams(withCsrf ? { _csrf: csrf, ...form } : form);
  return fetch(url + p, { method: "POST", redirect: "manual", headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
};

test("dashboard: Trust page renders chart, escaped lowest list and settings; nav links it", async () => {
  const res = await get(`/dashboard/${GUILD}/trust`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<svg[^>]*aria-label="Trust Score distribution/);
  assert.match(html, /newbie &lt;b&gt;/);
  assert.match(html, /href="\/dashboard\/800000000000000001\/trust" aria-current="page"/);
  assert.match(html, /@Admin \(Aegis cannot assign\)/);
  assert.doesNotMatch(html, /style="/);
});

test("dashboard: settings save needs CSRF, rejects roles Aegis can't assign, audits the change", async () => {
  assert.equal((await post(`/dashboard/${GUILD}/trust/settings`, { enabled: "on" }, false)).status, 403);
  const bad = await post(`/dashboard/${GUILD}/trust/settings`, { enabled: "on", preset: "strict", lowThreshold: "40", lowTrustRoleId: HIGH_ROLE });
  assert.equal(bad.status, 400);
  assert.match(await bad.text(), /Aegis cannot assign that role/);
  const ok = await post(`/dashboard/${GUILD}/trust/settings`, { enabled: "on", preset: "strict", lowThreshold: "40", incidentGate: "on", lowTrustRoleId: ROLE });
  assert.equal(ok.status, 303);
  assert.match(ok.headers.get("location") ?? "", /notice=trust-saved/);
  const saved = extras.saved.trust.at(-1) as { preset: string; lowThreshold: number; incidentGate: boolean; lowTrustRoleId: string; linkFilterLowTrustOnly: boolean };
  assert.deepEqual([saved.preset, saved.lowThreshold, saved.incidentGate, saved.lowTrustRoleId, saved.linkFilterLowTrustOnly], ["strict", 40, true, ROLE, false]);
  const { items } = await audit.list(GUILD, { page: 1, perPage: 10 });
  assert.ok(items.some(e => e.action === "trust.settings"));
});

test("dashboard: member page shows the trust card with factors", async () => {
  const html = await (await get(`/dashboard/${GUILD}/members/${MEMBER}`)).text();
  assert.match(html, /<h2 id="trust-h">Trust Score<\/h2>/);
  assert.match(html, /Brand-new account/);
  assert.match(html, /below threshold/);
});
