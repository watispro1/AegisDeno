/** Weekly staff digest (3.7.0): schedule maths across time zones, idempotency key, embed, command, dashboard. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import {
  buildDigestEmbed, digestWeekKey, isValidTimeZone, nextDigestRun, normalizeDigestConfig, zonedParts, DIGEST_MENTIONS, type DigestStats,
} from "../src/services/digestLogic";
import { normalizeGuildConfig, guildConfigSetPaths } from "../src/services/guildConfigNormalize";
import { command as digestCommand } from "../src/commands/moderation/digest";
import { createDashboardRouter } from "../src/web/dashboard/router";
import { readDashboardConfig } from "../src/web/dashboard/config";
import { memorySessionStore } from "../src/web/dashboard/sessions";
import { memoryAuditStore } from "../src/web/dashboard/audit";
import { cookieNames, csrfToken, signSessionId } from "../src/web/dashboard/security";
import type { BotView } from "../src/web/dashboard/botView";
import type { DashboardData, SettingsSnapshot } from "../src/web/dashboard/data";
import { memoryDashboardExtras } from "../src/web/dashboard/extras";
import { memoryDigestDashboard } from "../src/web/dashboard/digestData";
import type { SiteConfig } from "../src/web/pages";

test("config: defaults off, Monday 09:00 UTC; bad values fall back", () => {
  assert.deepEqual(normalizeDigestConfig(undefined), { enabled: false, channelId: null, day: 1, hour: 9, timezone: "UTC" });
  const c = normalizeDigestConfig({ enabled: true, day: 9, hour: -1, timezone: "Mars/Olympus", channelId: { $ne: 1 } });
  assert.equal(c.day, 1); assert.equal(c.hour, 9); assert.equal(c.timezone, "UTC"); assert.equal(c.channelId, null);
  assert.ok(isValidTimeZone("America/Chicago"));
  assert.ok(!isValidTimeZone("../etc/passwd"));
  assert.equal(normalizeGuildConfig("1", { digest: { enabled: true } } as never).digest?.enabled, true);
  assert.ok("digest" in guildConfigSetPaths({ digest: c }));
});

test("schedule: next run is the right local day and hour, across DST and half-hour zones", () => {
  // Sunday 2026-11-01 12:00 UTC; US DST ended at 07:00 UTC that day.
  const now = new Date("2026-11-01T12:00:00Z");
  const utc = nextDigestRun({ day: 1, hour: 9, timezone: "UTC" }, now);
  assert.equal(utc.toISOString(), "2026-11-02T09:00:00.000Z");
  const chi = nextDigestRun({ day: 1, hour: 9, timezone: "America/Chicago" }, now);
  assert.equal(chi.toISOString(), "2026-11-02T15:00:00.000Z", "CST is UTC-6 after the change");
  const kol = nextDigestRun({ day: 0, hour: 20, timezone: "Asia/Kolkata" }, now);
  assert.equal(kol.toISOString(), "2026-11-01T14:30:00.000Z");
  // Exactly at the run time → the following week, never the same instant again.
  assert.equal(nextDigestRun({ day: 1, hour: 9, timezone: "UTC" }, utc).toISOString(), "2026-11-09T09:00:00.000Z");
  // A skipped DST hour (02:00 on 2026-03-08 in Chicago) falls to the next week instead of firing twice.
  const gap = nextDigestRun({ day: 0, hour: 2, timezone: "America/Chicago" }, new Date("2026-03-07T12:00:00Z"));
  assert.equal(zonedParts(gap, "America/Chicago").hour, 2);
  assert.ok(gap.getTime() > new Date("2026-03-09T00:00:00Z").getTime());
});

test("idempotency key: one ISO week per guild, in the guild's zone", () => {
  assert.equal(digestWeekKey(new Date("2026-11-02T09:00:00Z"), "UTC"), "2026-W45");
  assert.equal(digestWeekKey(new Date("2026-11-02T03:00:00Z"), "America/Chicago"), "2026-W44", "still Sunday in Chicago");
  assert.equal(digestWeekKey(new Date("2027-01-01T12:00:00Z"), "UTC"), "2026-W53");
});

const stats: DigestStats = {
  since: new Date("2026-10-26T00:00:00Z"), until: new Date("2026-11-02T00:00:00Z"),
  casesByType: [["warn", 4], ["ban", 1]], casesByModerator: [["900000000000000001", 5]],
  joins: 10, leaves: 3, automodHits: 7, incidents: 1,
  trust: { scored: 50, average: 61, low: 4, previousLow: 6 },
  open: { tickets: 2, appeals: 1, modmail: 3 },
  lowest: [{ userId: "500000000000000001", name: "x", score: 4 }],
};

test("embed: every section present, within limits, never pings", () => {
  const e = buildDigestEmbed(stats, "My Server");
  const text = JSON.stringify(e);
  for (const s of ["Cases (5)", "Top moderators", "Joins **10**", "Automod hits **7**", "(-2 vs last week)", "ModMail **3**", "<@500000000000000001> · 4"]) assert.ok(text.includes(s), s);
  assert.ok(e.fields.every(f => f.value.length <= 1024));
  assert.deepEqual(DIGEST_MENTIONS, { parse: [], users: [], roles: [] });
  assert.match(buildDigestEmbed(stats, "S", true).title, /^Preview/);
});

test("command: /digest setup|preview|disable, Manage Server", () => {
  const json = digestCommand.data.toJSON() as { name: string; default_member_permissions: string; options: Array<{ name: string }> };
  assert.deepEqual(json.options.map(o => o.name), ["setup", "preview", "disable"]);
  assert.equal(json.default_member_permissions, "32");
});

/* ── Dashboard ─────────────────────────────────────────────────────── */
const USER = "900000000000000001", GUILD = "800000000000000001", CHANNEL = "700000000000000001", SECRET = "s".repeat(64);
const site: SiteConfig = { inviteUrl: "#", supportUrl: "", version: "test", contactEmail: "", assetVersion: "t" };
const bot: BotView = {
  hasGuild: id => id === GUILD, guild: id => (id === GUILD ? { id, name: "Test", memberCount: 10, iconUrl: null } : null),
  memberCanManage: async (g, u) => g === GUILD && u === USER, memberHasPermission: async () => true,
  textChannels: () => [{ id: CHANNEL, name: "staff", parentName: null } as never], hiddenChannelIds: () => new Set(),
  roles: () => [], viewerRoleLimit: async () => ({ ownerId: "1", topPosition: 5 }), userName: () => null,
};
const data = { loadSettings: async () => ({ guild: normalizeGuildConfig(GUILD) }) as unknown as SettingsSnapshot } as unknown as DashboardData;
const dg = memoryDigestDashboard({ preview: { ...buildDigestEmbed(stats, "<b>evil</b>", true) } });
let server: Server, url = "", cookie = "", csrf = "";
before(async () => {
  const config = readDashboardConfig({ DISCORD_APPLICATION_ID: "123456789012345678", DISCORD_CLIENT_SECRET: "x", DASHBOARD_SESSION_SECRET: SECRET, DASHBOARD_REDIRECT_URI: "http://127.0.0.1/dashboard/callback" })!;
  const sessions = memorySessionStore();
  const sid = "session-id-for-digest-tests-0123";
  const now = Date.now();
  await sessions.create(sid, { userId: USER, username: "aj", globalName: "AJ", avatar: null, accessToken: "t", tokenExpiresAt: new Date(now + 1e9), guilds: [{ id: GUILD, name: "Test", icon: null, owner: false, permissions: "32" }], guildsFetchedAt: new Date(now), createdAt: new Date(now), expiresAt: new Date(now + 1e9) });
  cookie = `${cookieNames(config.secureCookies).session}=${encodeURIComponent(signSessionId(SECRET, sid))}`;
  csrf = csrfToken(SECRET, sid);
  const app = express();
  app.use("/dashboard", createDashboardRouter({ site, config, bot, data, sessions, audit: memoryAuditStore(), extras: memoryDashboardExtras({ digest: dg }), limits: { auth: 100, post: 1000, page: 2000 } }));
  server = app.listen(0);
  await new Promise(r => server.once("listening", r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());
const post = (p: string, form: Record<string, string>, withCsrf = true) => fetch(url + p, { method: "POST", redirect: "manual", headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(withCsrf ? { _csrf: csrf, ...form } : form).toString() });

test("dashboard: digest page shows escaped preview and is in the nav", async () => {
  const res = await fetch(`${url}/dashboard/${GUILD}/digest`, { headers: { Cookie: cookie } });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Preview \(last 7 days\)/);
  assert.match(html, /&lt;b&gt;evil&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>evil<\/b>/);
  assert.match(html, /href="\/dashboard\/\d+\/digest"/);
});

test("dashboard: digest settings validate, need CSRF, and save", async () => {
  assert.equal((await post(`/dashboard/${GUILD}/digest/settings`, { enabled: "on" }, false)).status, 403);
  assert.equal((await post(`/dashboard/${GUILD}/digest/settings`, { enabled: "on", timezone: "Nowhere/City" })).status, 400);
  assert.equal((await post(`/dashboard/${GUILD}/digest/settings`, { enabled: "on", hour: "25" })).status, 400);
  assert.equal((await post(`/dashboard/${GUILD}/digest/settings`, { enabled: "on", channelId: "123" })).status, 400);
  const ok = await post(`/dashboard/${GUILD}/digest/settings`, { enabled: "on", channelId: CHANNEL, day: "5", hour: "18", timezone: "Europe/London" });
  assert.equal(ok.status, 303);
  assert.deepEqual(dg.saved.at(-1), { enabled: true, channelId: CHANNEL, day: 5, hour: 18, timezone: "Europe/London" });
});
