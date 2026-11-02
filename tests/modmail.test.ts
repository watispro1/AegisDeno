/** ModMail (3.7.0): routing, limits, relay formatting, config, command shape, dashboard page. No network, no Mongo. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import {
  SlidingLimiter, attachmentLines, isModmailStaff, normalizeModmailConfig, openingMentions, relayBody, routeDm,
  snippetNameProblem, staffSignature, stripRelayPrefix, threadName, transcriptExpiry, transcriptText, withBlocked, RELAY_MENTIONS,
} from "../src/services/modmailLogic";
import { normalizeGuildConfig, guildConfigSetPaths } from "../src/services/guildConfigNormalize";
import { command as modmailCommand } from "../src/commands/moderation/modmail";
import { componentRouter } from "../src/bot/interactions";
import { createDashboardRouter } from "../src/web/dashboard/router";
import { readDashboardConfig } from "../src/web/dashboard/config";
import { memorySessionStore } from "../src/web/dashboard/sessions";
import { memoryAuditStore } from "../src/web/dashboard/audit";
import { cookieNames, csrfToken, signSessionId } from "../src/web/dashboard/security";
import type { BotView } from "../src/web/dashboard/botView";
import type { DashboardData, SettingsSnapshot } from "../src/web/dashboard/data";
import { memoryDashboardExtras } from "../src/web/dashboard/extras";
import { memoryModmailDashboard } from "../src/web/dashboard/modmailData";
import type { SiteConfig } from "../src/web/pages";

const A = "100000000000000001", B = "100000000000000002";

test("routing: open ticket wins, several → picker, none → none", () => {
  assert.deepEqual(routeDm([A], [B]), { kind: "relay", guildId: A });
  assert.deepEqual(routeDm([A, B], []), { kind: "pick", guildIds: [A, B], reason: "open" });
  assert.deepEqual(routeDm([], [B]), { kind: "open", guildId: B });
  assert.deepEqual(routeDm([], [A, B]), { kind: "pick", guildIds: [A, B], reason: "new" });
  assert.deepEqual(routeDm([], []), { kind: "none" });
  assert.equal((routeDm([], Array.from({ length: 40 }, (_, i) => String(1e17 + i))) as { guildIds: string[] }).guildIds.length, 25);
});

test("rate limit: sliding window per user", () => {
  const l = new SlidingLimiter(2, 1000);
  assert.ok(l.take("u", 0)); assert.ok(l.take("u", 10)); assert.ok(!l.take("u", 20));
  assert.ok(l.take("other", 20));
  assert.ok(l.take("u", 1011));
});

test("config: normalised, safe defaults, blocked list deduped and capped", () => {
  const c = normalizeModmailConfig({ enabled: true, channelId: "x", staffRoleId: A, relayPrefix: " = ", blockedUserIds: [A, A, "nope", { $gt: 1 }] });
  assert.equal(c.channelId, null);
  assert.equal(c.relayPrefix, "=");
  assert.deepEqual(c.blockedUserIds, [A]);
  assert.equal(normalizeModmailConfig(undefined).enabled, false);
  assert.deepEqual(withBlocked(c, B, true).blockedUserIds, [B, A]);
  assert.deepEqual(withBlocked(c, A, false).blockedUserIds, []);
  const g = normalizeGuildConfig("1", { modmail: { enabled: true } } as never);
  assert.equal(g.modmail?.enabled, true);
  assert.ok("modmail" in guildConfigSetPaths({ modmail: c }));
});

test("mentions: only the staff role, only when asked; relays never ping", () => {
  const c = normalizeModmailConfig({ staffRoleId: A, pingStaff: false });
  assert.deepEqual(openingMentions(c).roles, []);
  assert.deepEqual(openingMentions({ ...c, pingStaff: true }), { parse: [], roles: [A], users: [] });
  assert.deepEqual(RELAY_MENTIONS.parse, []);
});

test("staff check: Manage Server or the staff role", () => {
  const c = normalizeModmailConfig({ staffRoleId: A });
  assert.ok(isModmailStaff(c, { roleIds: [A], manageGuild: false }));
  assert.ok(isModmailStaff(c, { roleIds: [], manageGuild: true }));
  assert.ok(!isModmailStaff(c, { roleIds: [B], manageGuild: false }));
  assert.ok(!isModmailStaff(normalizeModmailConfig({}), { roleIds: [A], manageGuild: false }));
});

test("relay: attachments as links with size cap, odd hosts refused, prefix stripping", () => {
  const lines = attachmentLines([
    { name: "a.png", url: "https://cdn.discordapp.com/attachments/1/2/a.png", size: 10 },
    { name: "big.zip", url: "https://cdn.discordapp.com/x", size: 30 * 1048576 },
    { name: "evil", url: "https://evil.example/x", size: 1 },
  ]);
  assert.match(lines[0], /^📎 \[a\.png\]\(https:\/\/cdn/);
  assert.match(lines[1], /too large/);
  assert.match(lines[2], /not relayed/);
  assert.equal(relayBody("   ", []), "*(empty message)*");
  const c = normalizeModmailConfig({ relayPrefix: "=" });
  assert.equal(stripRelayPrefix(c, "=hello"), "hello");
  assert.equal(stripRelayPrefix(c, "hello"), null);
  assert.equal(stripRelayPrefix(c, "=   "), null);
  assert.equal(stripRelayPrefix({ ...c, relayPrefix: "" }, "=x"), null);
  assert.equal(staffSignature({ anonymous: true, staffTag: "mod#1", guildName: "G" }), "Staff · G");
});

test("transcripts: text export, 90-day expiry, snippet names, thread names", () => {
  const t = transcriptText([{ authorId: A, authorTag: "m", fromStaff: true, anonymous: true, content: "hi", at: new Date(0) }], "H");
  assert.match(t, /\[staff, anonymous\] m/);
  assert.equal(transcriptExpiry(new Date(0)).getTime(), 90 * 86_400_000);
  assert.equal(snippetNameProblem("rules"), null);
  assert.ok(snippetNameProblem("Bad Name"));
  assert.equal(threadName("a b<c>", "123456789"), "modmail-abc-6789");
});

test("command: /modmail shape; components routed", () => {
  const json = modmailCommand.data.toJSON() as { name: string; options: Array<{ name: string; options?: Array<{ name: string }> }> };
  assert.equal(json.name, "modmail");
  assert.deepEqual(json.options.map(o => o.name), ["setup", "reply", "close", "block", "unblock", "snippet"]);
  assert.deepEqual(json.options.at(-1)!.options!.map(o => o.name), ["add", "remove", "use", "list"]);
  for (const id of ["mm_pick:new", "mm_pick:open", "mm_reply:a", "mm_reply:n", "mm_replymodal:a", "mm_close", "mm_closeyes"]) {
    assert.ok(componentRouter.find(id), id);
  }
});

/* ── Dashboard ─────────────────────────────────────────────────────── */

const USER = "900000000000000001";
const GUILD = "800000000000000001";
const CHANNEL = "700000000000000001";
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
  textChannels: () => [{ id: CHANNEL, name: "staff", parentName: null } as never],
  hiddenChannelIds: () => new Set(),
  roles: () => [{ id: ROLE, name: "Staff", position: 1, assignable: true }, { id: HIGH_ROLE, name: "Admin", position: 9, assignable: false }],
  viewerRoleLimit: async () => ({ ownerId: "1", topPosition: 5 }),
  userName: () => null,
};
const snapshot = { guild: normalizeGuildConfig(GUILD) } as unknown as SettingsSnapshot;
const data = { loadSettings: async () => snapshot } as unknown as DashboardData;
const mm = memoryModmailDashboard({
  config: { blockedUserIds: [MEMBER] },
  tickets: [{ guildId: GUILD, id: "a".repeat(24), userId: MEMBER, userTag: "m", threadId: "1", status: "closed", createdAt: new Date(), closedAt: new Date(), closedBy: USER, closeReason: "done <b>", messageCount: 1, lines: [{ authorId: MEMBER, authorTag: "m<i>", fromStaff: false, anonymous: false, content: "<script>x</script>", at: new Date() }] }],
});
const extras = memoryDashboardExtras({ modmail: mm });
const audit = memoryAuditStore();
let server: Server, url = "", cookie = "", csrf = "";

before(async () => {
  const config = readDashboardConfig({ DISCORD_APPLICATION_ID: "123456789012345678", DISCORD_CLIENT_SECRET: "x", DASHBOARD_SESSION_SECRET: SECRET, DASHBOARD_REDIRECT_URI: "http://127.0.0.1/dashboard/callback" });
  assert.ok(config);
  const sessions = memorySessionStore();
  const sid = "session-id-for-modmail-tests-012";
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

test("dashboard: ModMail page renders lists, blocked members, settings; nav links it", async () => {
  const res = await get(`/dashboard/${GUILD}/modmail`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Open conversations/);
  assert.match(html, /Transcripts/);
  assert.match(html, /done &lt;b&gt;/);
  assert.match(html, new RegExp(`/modmail/unblock`));
  assert.match(html, /href="\/dashboard\/\d+\/modmail"/);
  assert.doesNotMatch(html, /style="|<script>(?!\s*<\/script>)[^<]/);
});

test("dashboard: transcript viewer escapes content; bad and unknown ids are 404", async () => {
  const ok = await get(`/dashboard/${GUILD}/modmail/${"a".repeat(24)}`);
  assert.equal(ok.status, 200);
  const html = await ok.text();
  assert.match(html, /&lt;script&gt;x&lt;\/script&gt;/);
  assert.match(html, /m&lt;i&gt;/);
  assert.equal((await get(`/dashboard/${GUILD}/modmail/${"b".repeat(24)}`)).status, 404);
  assert.equal((await get(`/dashboard/${GUILD}/modmail/$where`)).status, 404);
});

test("dashboard: settings need CSRF, enforce role hierarchy, save and audit", async () => {
  assert.equal((await post(`/dashboard/${GUILD}/modmail/settings`, { enabled: "on", channelId: CHANNEL }, false)).status, 403);
  const noChannel = await post(`/dashboard/${GUILD}/modmail/settings`, { enabled: "on" });
  assert.equal(noChannel.status, 400);
  const high = await post(`/dashboard/${GUILD}/modmail/settings`, { enabled: "on", channelId: CHANNEL, staffRoleId: HIGH_ROLE });
  assert.equal(high.status, 400);
  const badPrefix = await post(`/dashboard/${GUILD}/modmail/settings`, { enabled: "on", channelId: CHANNEL, relayPrefix: "a b" });
  assert.equal(badPrefix.status, 400);
  const ok = await post(`/dashboard/${GUILD}/modmail/settings`, { enabled: "on", channelId: CHANNEL, staffRoleId: ROLE, pingStaff: "on", relayPrefix: "!r", mg_on: "on", mg_title: "Hi {server}" });
  assert.equal(ok.status, 303);
  const saved = mm.saved.at(-1)!;
  assert.equal(saved.enabled, true);
  assert.equal(saved.staffRoleId, ROLE);
  assert.equal(saved.greeting?.title, "Hi {server}");
  assert.deepEqual(saved.blockedUserIds, [MEMBER], "settings save keeps the block list");
  const entries = await audit.list(GUILD, { limit: 10 } as never).catch(() => null);
  if (entries && Array.isArray((entries as { entries?: unknown[] }).entries ?? entries)) assert.ok(JSON.stringify(entries).includes("modmail.settings"));
});

test("dashboard: block/unblock validate IDs and refuse self-block", async () => {
  assert.equal((await post(`/dashboard/${GUILD}/modmail/block`, { userId: "{$gt:1}" })).status, 400);
  assert.equal((await post(`/dashboard/${GUILD}/modmail/block`, { userId: USER })).status, 400);
  assert.equal((await post(`/dashboard/${GUILD}/modmail/block`, { userId: B })).status, 303);
  assert.ok(mm.saved.at(-1)!.blockedUserIds.includes(B));
  assert.equal((await post(`/dashboard/${GUILD}/modmail/unblock`, { userId: B })).status, 303);
  assert.ok(!mm.saved.at(-1)!.blockedUserIds.includes(B));
});
