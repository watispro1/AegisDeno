/**
 * The 3.6.2 dashboard overhaul: sidebar shell, overview, module pages and the
 * embed builder. Runs the real router with a fake bot, fake data, the
 * in-memory module data and a session created directly in the memory store.
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { createDashboardRouter } from "../src/web/dashboard/router";
import { readDashboardConfig } from "../src/web/dashboard/config";
import { memorySessionStore } from "../src/web/dashboard/sessions";
import { memoryAuditStore } from "../src/web/dashboard/audit";
import { memoryModuleData } from "../src/web/dashboard/moduleDataMemory";
import { csrfToken, signSessionId } from "../src/web/dashboard/security";
import type { BotView, DashboardPermission } from "../src/web/dashboard/botView";
import type { DashboardData, SettingsSnapshot, SettingsValue } from "../src/web/dashboard/data";
import type { SiteConfig } from "../src/web/pages";

const USER = "900000000000000001";
const OTHER_MOD = "900000000000000002";
const GUILD = "800000000000000001";
const GUILD_NO_ACCESS = "800000000000000002";
const CHANNEL = "700000000000000001";
const CHANNEL_2 = "700000000000000002";
const HIDDEN = "700000000000000050";
const ROLE = "600000000000000001";
const ROLE_ABOVE_YOU = "600000000000000003";
const SECRET = "s".repeat(64);
const SID = "test-session-id-0123456789abcdef";
const SUGGESTION = "0f8fad5b-d9cb-469f-a165-70867728950e";
const GIVEAWAY_RUNNING = "100000000000000001";
const GIVEAWAY_ENDED = "100000000000000002";
const TASK = "65a1b2c3d4e5f60718293a4b";

const site: SiteConfig = { inviteUrl: "https://discord.com/oauth2/authorize?client_id=1", supportUrl: "", version: "test", contactEmail: "x@example.com", assetVersion: "test" };
const granted = new Set<DashboardPermission>(["BanMembers", "ManageChannels", "ManageRoles", "ManageMessages", "ModerateMembers"]);
const saved: SettingsValue[] = [];

const bot: BotView = {
  hasGuild: id => id === GUILD || id === GUILD_NO_ACCESS,
  guild: id => (id === GUILD || id === GUILD_NO_ACCESS ? { id, name: id === GUILD ? "Mod <b>Hub</b>" : "Nope", memberCount: 1234 } : null),
  memberCanManage: async (g, u) => g === GUILD && u === USER,
  memberHasPermission: async (g, u, p) => g === GUILD && u === USER && granted.has(p),
  textChannels: () => [{ id: CHANNEL, name: "announcements", parent: null }, { id: CHANNEL_2, name: "general", parent: "Chat" }],
  hiddenChannelIds: () => new Set([HIDDEN]),
  roles: () => [{ id: ROLE_ABOVE_YOU, name: "Senior Mod", position: 6, assignable: true }, { id: ROLE, name: "Member", position: 2, assignable: true }],
  viewerRoleLimit: async () => ({ ownerId: "900000000000000099", topPosition: 5 }),
  userName: id => (id === USER ? "aj" : null),
  botMissingPermissions: () => ["Manage Roles"],
};

function snapshot(): SettingsSnapshot {
  return {
    guild: {
      guildId: GUILD, prefix: "!", language: "en", loggingEnabled: true, loggingChannelId: HIDDEN, logCategories: null,
      welcomeEnabled: true, welcomeChannelId: CHANNEL, welcomeMessage: "Hi {user}", welcomeRoleId: null, suggestionsChannelId: null,
      escalation: { enabled: false, thresholds: [], warnExpiryDays: null },
      tickets: { logChannelId: null, autoCloseHours: 48, transcriptLogging: true },
      roles: { maxRolesPerPanel: 25 },
      goodbyeEnabled: false, goodbyeChannelId: null, goodbyeMessage: "Bye {username}", goodbyeEmbed: null, welcomeEmbed: null,
      autorespondersEnabled: true, logChannels: null,
    },
    automod: {
      guildId: GUILD,
      words: { enabled: true, action: "delete", list: [] }, links: { enabled: false, action: "delete" },
      mentions: { enabled: false, action: "timeout", threshold: 5 }, spam: { enabled: false, action: "timeout", maxMessages: 5, windowSeconds: 5 },
      caps: { enabled: false, action: "delete", threshold: 80 }, exemptRoleIds: [], exemptChannelIds: [],
    },
    tickets: { logChannelId: null, autoCloseHours: 48, transcriptLogging: true },
    verification: null,
    starboard: { guildId: GUILD, channelId: null, emoji: "⭐", threshold: 3, selfStar: false, ignoredChannels: [], ignoredRoles: [], enabled: false },
  };
}

const data = {
  overview: async () => ({ cases7: 2, cases30: 9, warnings7: 1, warnings30: 3, recentCases: [], openTicketCount: 1, openTickets: [], pendingAppeals: 2 }),
  loadSettings: async () => snapshot(),
  saveSettings: async (_g: string, input: SettingsValue) => { saved.push(input); return true; },
  listRolePanels: async () => [],
} as unknown as DashboardData;

let modules = memoryModuleData();
const audit = memoryAuditStore();
const sessions = memorySessionStore();
let server: Server;
let base = "";
const cookie = `aegis_dash=${encodeURIComponent(signSessionId(SECRET, SID))}`;
const csrf = csrfToken(SECRET, SID);

function seed() {
  modules = memoryModuleData({
    responders: [{ id: "ar-1111", trigger: "hello", response: "Hi {user}!", matchType: "contains", enabled: true, createdBy: USER, createdAt: new Date(0) }],
    automations: [{ id: TASK, channelId: CHANNEL, creatorId: USER, type: "scheduled", payload: "Daily <b>reminder</b>", executeAt: new Date(86_400_000), intervalMs: 86_400_000 }],
    giveaways: [
      { messageId: GIVEAWAY_RUNNING, channelId: CHANNEL, prize: "Nitro <script>", winnerCount: 1, entrants: 5, winners: [], hostId: USER, endsAt: new Date(2e12), ended: false },
      { messageId: GIVEAWAY_ENDED, channelId: CHANNEL, prize: "Sticker", winnerCount: 1, entrants: 3, winners: [OTHER_MOD], hostId: USER, endsAt: new Date(0), ended: true },
    ],
    suggestions: [{ id: SUGGESTION, authorId: OTHER_MOD, content: "Add a <i>music</i> channel", status: "pending", up: 4, down: 1, reviewedBy: null, reviewReason: null, createdAt: new Date(0) }],
  });
  modules.watches.set(USER, [{ targetId: "500000000000000001", reason: "alt account", events: ["message"], alertCount: 2, expiresAt: null, createdAt: new Date(0) }]);
  modules.watches.set(OTHER_MOD, [{ targetId: "500000000000000009", reason: "someone else's private watch", events: ["join"], alertCount: 0, expiresAt: null, createdAt: new Date(0) }]);
}

before(async () => {
  const config = readDashboardConfig({
    DISCORD_APPLICATION_ID: "123456789012345678", DISCORD_CLIENT_SECRET: "x", DASHBOARD_SESSION_SECRET: SECRET,
    DASHBOARD_REDIRECT_URI: "http://127.0.0.1/dashboard/callback",
  });
  assert.ok(config);
  await sessions.create(SID, {
    userId: USER, username: "aj", globalName: "AJ", accessToken: "t", tokenExpiresAt: new Date(Date.now() + 3.6e6),
    guilds: [{ id: GUILD, name: "Mod <b>Hub</b>", icon: null, owner: true, permissions: "8" }],
    guildsFetchedAt: new Date(), createdAt: new Date(), expiresAt: new Date(Date.now() + 3.6e6),
  });
  const app = express();
  // The router reads deps.modules once; a getter-backed proxy lets each test reseed it.
  const proxy = new Proxy({}, { get: (_t, key) => (modules as unknown as Record<string | symbol, unknown>)[key] });
  app.use("/dashboard", createDashboardRouter({ site, config, bot, data, sessions, audit, modules: proxy as typeof modules, limits: { auth: 100, post: 1000, page: 2000 } }));
  server = app.listen(0);
  await new Promise(r => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());
beforeEach(() => { seed(); saved.length = 0; granted.add("ManageMessages"); granted.add("ModerateMembers"); });

const get = (path: string, auth = true) => fetch(base + path, { redirect: "manual", headers: auth ? { Cookie: cookie } : {} });
const post = (path: string, form: Record<string, string | string[]>, opts: { auth?: boolean; csrf?: boolean } = {}) => {
  const body = new URLSearchParams();
  if (opts.csrf !== false) body.append("_csrf", csrf);
  for (const [k, v] of Object.entries(form)) for (const one of Array.isArray(v) ? v : [v]) body.append(k, one);
  return fetch(base + path, {
    method: "POST", redirect: "manual", body: body.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...(opts.auth === false ? {} : { Cookie: cookie }) },
  });
};

const PAGES: Array<[string, string]> = [
  ["", "Overview"], ["/settings", "Settings"], ["/autoresponders", "Autoresponders"], ["/automations", "Scheduled messages"],
  ["/announce", "Announcements"], ["/giveaways", "Giveaways"], ["/suggestions", "Suggestions"], ["/watchlist", "Ghost Watch"],
  ["/settings/welcome", "Welcome &amp; Goodbye"], ["/settings/goodbye", "Welcome &amp; Goodbye"], ["/settings/logging", "Logging"],
];

test("every module page needs a session, and a server the viewer can manage", async () => {
  for (const [path] of PAGES) {
    const res = await get(`/dashboard/${GUILD}${path}`, false);
    assert.equal(res.status, 302, path);
    assert.equal(res.headers.get("location"), "/dashboard");
    const other = await get(`/dashboard/${GUILD_NO_ACCESS}${path}`);
    assert.equal(other.status, 403, `${path} on a server without Manage Server`);
  }
  const res = await post(`/dashboard/${GUILD}/autoresponders`, { trigger: "x", response: "y", matchType: "exact" }, { auth: false });
  assert.equal(res.status, 401);
  assert.equal(modules.calls.length, 0);
});

test("pages render in the sidebar shell with the right entry marked, escaped, with no inline script or style", async () => {
  for (const [path, label] of PAGES) {
    const res = await get(`/dashboard/${GUILD}${path}`);
    assert.equal(res.status, 200, path);
    const html = await res.text();
    assert.match(html, /class="app-side"/, `${path} has the sidebar`);
    assert.match(html, new RegExp(`aria-current="page"><span class="side-icon" aria-hidden="true">[^<]*</span>${label}<`), `${path} marks ${label}`);
    assert.ok(html.includes("Mod &lt;b&gt;Hub&lt;/b&gt;") && !html.includes("Mod <b>Hub</b>"), `${path} escapes the server name`);
    assert.match(html, /Signed in as <strong>AJ<\/strong>/);
    assert.doesNotMatch(html, /\sstyle=|\son[a-z]+=|<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)/i, `${path} has no inline script, style or handlers`);
    assert.match(html, /data-unsaved-bar/);
    assert.ok(!html.includes(`value="${HIDDEN}"`), `${path} never offers the hidden channel`);
  }
});

test("overview shows stat cards, the chart, the module grid and the setup checklist", async () => {
  const html = await (await get(`/dashboard/${GUILD}`)).text();
  assert.match(html, /<svg viewBox="0 0 600 140" role="img"/);
  assert.match(html, /Active giveaways/);
  assert.match(html, /Automod hits, 7 days/);
  assert.match(html, /class="module-grid"/);
  assert.match(html, /missing Manage Roles/);
  assert.match(html, /Aegis can&#39;t see the log channel/, "a configured channel that became hidden is flagged");
  assert.match(html, /2026-11-16/, "View Channel readiness note");
});

test("posts without a valid CSRF token are refused and change nothing", async () => {
  for (const path of ["/autoresponders", "/automations", "/announce", `/giveaways/${GIVEAWAY_RUNNING}/end`, `/suggestions/${SUGGESTION}/review`, "/settings/goodbye"]) {
    const res = await post(`/dashboard/${GUILD}${path}`, { trigger: "a", response: "b", matchType: "exact", action: "approve" }, { csrf: false });
    assert.equal(res.status, 403, path);
  }
  assert.equal(modules.calls.length, 0);
  assert.equal(saved.length, 0);
});

test("autoresponders: validation, add, duplicate, toggle, delete and the module switch", async () => {
  let res = await post(`/dashboard/${GUILD}/autoresponders`, { trigger: "", response: "", matchType: "regex" });
  assert.equal(res.status, 400);
  const html = await res.text();
  assert.match(html, /Type the text that triggers/);
  assert.match(html, /Pick how the trigger is matched/);
  res = await post(`/dashboard/${GUILD}/autoresponders`, { trigger: "Rules", response: "See #rules", matchType: "exact" });
  assert.equal(res.status, 303);
  assert.match(res.headers.get("location") ?? "", /notice=ar-added/);
  res = await post(`/dashboard/${GUILD}/autoresponders`, { trigger: "rules", response: "again", matchType: "exact" });
  assert.equal(res.status, 400, "duplicate trigger");
  res = await post(`/dashboard/${GUILD}/autoresponders/ar-1111/toggle`, {});
  assert.match(res.headers.get("location") ?? "", /notice=ar-off/);
  assert.equal(modules.responders[0].enabled, false);
  res = await post(`/dashboard/${GUILD}/autoresponders/ar-1111/delete`, {});
  assert.match(res.headers.get("location") ?? "", /notice=ar-removed/);
  assert.equal((await post(`/dashboard/${GUILD}/autoresponders/..%2Fx/delete`, {})).status, 404);
  res = await post(`/dashboard/${GUILD}/autoresponders/module`, {});
  assert.match(res.headers.get("location") ?? "", /notice=module-off/);
  assert.equal(modules.config.autorespondersEnabled, false);
  const entries = await audit.list(GUILD, { page: 1, perPage: 50 });
  assert.ok(entries.items.some(e => e.action === "autoresponder.add"), "changes are audited");
});

test("scheduled messages: duration and channel validation, create and cancel", async () => {
  let res = await post(`/dashboard/${GUILD}/automations`, { channelId: HIDDEN, message: "Hi", delay: "5s", repeat: "1m" });
  assert.equal(res.status, 400);
  const html = await res.text();
  assert.match(html, /View Channel/);
  assert.match(html, /1 minute to 28 days/);
  assert.match(html, /10 minutes to 28 days/);
  res = await post(`/dashboard/${GUILD}/automations`, { channelId: CHANNEL, message: "Standup!", delay: "1h 30m", repeat: "1d" });
  assert.equal(res.status, 303);
  const created = modules.automations[modules.automations.length - 1];
  assert.equal(created.intervalMs, 86_400_000);
  assert.equal(created.payload, "Standup!");
  assert.equal((await post(`/dashboard/${GUILD}/automations/not-an-id/cancel`, {})).status, 404);
  res = await post(`/dashboard/${GUILD}/automations/${TASK}/cancel`, {});
  assert.match(res.headers.get("location") ?? "", /notice=task-cancelled/);
});

test("announcements: Manage Messages, https-only images, Discord limits, then a post that pings nobody", async () => {
  granted.delete("ManageMessages");
  let res = await post(`/dashboard/${GUILD}/announce`, { channelId: CHANNEL, e_title: "Hi" });
  assert.equal(res.status, 403);
  granted.add("ManageMessages");
  res = await post(`/dashboard/${GUILD}/announce`, { channelId: CHANNEL, e_title: "x".repeat(257), e_image: "javascript:alert(1)", e_thumbnail: "http://example.com/a.png", e_color: "red", e_fname_0: "Only a name" });
  assert.equal(res.status, 400);
  const html = await res.text();
  for (const m of [/Title can be at most 256/, /Image must be a full https/, /Thumbnail must be a full https/, /Colour must be a hex/, /Field 1 needs a value/]) assert.match(html, m);
  assert.equal(modules.posts.length, 0);
  res = await post(`/dashboard/${GUILD}/announce`, { channelId: CHANNEL, content: "@everyone hello", e_title: "Patch notes", e_description: "Line 1\nLine 2", e_color: "#5865F2", e_image: "https://cdn.example.com/a.png", e_fname_0: "New", e_fvalue_0: "Stuff", e_finline_0: "on" });
  assert.equal(res.status, 303);
  const p = modules.posts[0];
  assert.equal(p.embed.title, "Patch notes");
  assert.equal(p.embed.color, 0x5865f2);
  assert.deepEqual(p.embed.fields, [{ name: "New", value: "Stuff", inline: true }]);
  assert.equal(p.content, "@everyone hello", "kept as typed; the data layer sends it with allowedMentions parse: []");
});

test("giveaways: end a running one, reroll an ended one, refuse bad IDs", async () => {
  const html = await (await get(`/dashboard/${GUILD}/giveaways`)).text();
  assert.ok(html.includes("Nitro &lt;script&gt;"));
  assert.match((await post(`/dashboard/${GUILD}/giveaways/${GIVEAWAY_RUNNING}/end`, {})).headers.get("location") ?? "", /gw-ended/);
  assert.match((await post(`/dashboard/${GUILD}/giveaways/${GIVEAWAY_ENDED}/reroll`, {})).headers.get("location") ?? "", /gw-rerolled/);
  assert.match((await post(`/dashboard/${GUILD}/giveaways/${GIVEAWAY_ENDED}/end`, {})).headers.get("location") ?? "", /gw-failed/);
  assert.equal((await post(`/dashboard/${GUILD}/giveaways/abc/end`, {})).status, 404);
  assert.equal((await post(`/dashboard/${GUILD}/giveaways/${GIVEAWAY_RUNNING}/delete`, {})).status, 404);
});

test("suggestions: review with a note, refuse a bad action, and the channel picker rejects hidden channels", async () => {
  let html = await (await get(`/dashboard/${GUILD}/suggestions`)).text();
  assert.ok(html.includes("Add a &lt;i&gt;music&lt;/i&gt; channel"));
  assert.equal((await post(`/dashboard/${GUILD}/suggestions/${SUGGESTION}/review`, { action: "delete" })).status, 400);
  const res = await post(`/dashboard/${GUILD}/suggestions/${SUGGESTION}/review`, { action: "approve", note: "Soon" });
  assert.match(res.headers.get("location") ?? "", /sg-reviewed/);
  assert.equal(modules.suggestions[0].status, "approved");
  assert.equal(modules.suggestions[0].reviewReason, "Soon");
  const again = await post(`/dashboard/${GUILD}/suggestions/${SUGGESTION}/review`, { action: "deny" });
  assert.match(again.headers.get("location") ?? "", /sg-failed/, "a reviewed suggestion stays final");
  const bad = await post(`/dashboard/${GUILD}/suggestions/channel`, { suggestionsChannelId: HIDDEN });
  assert.equal(bad.status, 400);
  html = await bad.text();
  assert.match(html, /View Channel/);
  assert.match((await post(`/dashboard/${GUILD}/suggestions/channel`, { suggestionsChannelId: CHANNEL_2 })).headers.get("location") ?? "", /notice=saved/);
  assert.equal(modules.config.suggestionsChannelId, CHANNEL_2);
});

test("Ghost Watch shows only the viewer's own list and removing needs Moderate Members", async () => {
  const html = await (await get(`/dashboard/${GUILD}/watchlist`)).text();
  assert.match(html, /alt account/);
  assert.doesNotMatch(html, /someone else/);
  granted.delete("ModerateMembers");
  assert.equal((await post(`/dashboard/${GUILD}/watchlist/500000000000000001/remove`, {})).status, 403);
  granted.add("ModerateMembers");
  assert.match((await post(`/dashboard/${GUILD}/watchlist/500000000000000001/remove`, {})).headers.get("location") ?? "", /watch-removed/);
  assert.match((await post(`/dashboard/${GUILD}/watchlist/500000000000000009/remove`, {})).headers.get("location") ?? "", /watch-missing/, "another moderator's watch can't be removed");
});

test("settings: per-event log channels, welcome embed, goodbye, and the role hierarchy still holds", async () => {
  let res = await post(`/dashboard/${GUILD}/settings/logging`, { loggingEnabled: "on", loggingChannelId: CHANNEL, cat_modActions: "on", chan_modActions: CHANNEL_2, chan_memberJoins: HIDDEN });
  assert.equal(res.status, 400, "a hidden channel can't be picked for an event");
  res = await post(`/dashboard/${GUILD}/settings/logging`, { loggingEnabled: "on", loggingChannelId: CHANNEL, cat_modActions: "on", chan_modActions: CHANNEL_2 });
  assert.equal(res.status, 303);
  const logging = saved.pop();
  assert.ok(logging?.section === "logging");
  assert.deepEqual(logging.value.logChannels, { modActions: CHANNEL_2 });

  res = await post(`/dashboard/${GUILD}/settings/welcome`, { welcomeEnabled: "on", welcomeChannelId: CHANNEL, welcomeMessage: "Hi {user}", we_on: "on", we_title: "Welcome to {server}", we_description: "You are #{memberCount}" });
  assert.equal(res.status, 303);
  const welcome = saved.pop();
  assert.ok(welcome?.section === "welcome");
  assert.equal(welcome.value.welcomeEmbed?.title, "Welcome to {server}");

  res = await post(`/dashboard/${GUILD}/settings/welcome`, { welcomeEnabled: "on", welcomeChannelId: CHANNEL, welcomeMessage: "Hi", welcomeRoleId: ROLE_ABOVE_YOU });
  assert.equal(res.status, 400, "join role above the viewer is still refused");

  res = await post(`/dashboard/${GUILD}/settings/goodbye`, { goodbyeEnabled: "on", goodbyeChannelId: CHANNEL, goodbyeMessage: "" });
  assert.equal(res.status, 400);
  assert.match(await res.text(), /Write a goodbye message or turn on the embed/);
  res = await post(`/dashboard/${GUILD}/settings/goodbye`, { goodbyeEnabled: "on", goodbyeChannelId: CHANNEL, goodbyeMessage: "Bye {username}", ge_on: "on", ge_title: "See you" });
  assert.equal(res.status, 303);
  const goodbye = saved.pop();
  assert.ok(goodbye?.section === "goodbye");
  assert.equal(goodbye.value.goodbyeEmbed?.title, "See you");
  assert.equal(goodbye.value.goodbyeChannelId, CHANNEL);
});

test("operator-looking input is refused on the new routes", async () => {
  const res = await post(`/dashboard/${GUILD}/autoresponders`, { "trigger[$ne]": "x", trigger: "a", response: "b", matchType: "exact" });
  assert.equal(res.status, 400);
  assert.equal(modules.calls.length, 0);
});
