/**
 * Community dashboard pages: giveaway Cancel and bonus entries, the Polls
 * page, and suggestion search and sort. Pure helpers are tested directly; the
 * routes run on the real router with a fake bot and in-memory module data.
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
import {
  cancelConfirmed, filterAndSortSuggestions, formatPollPercent, messageJumpUrl, parseSuggestionQuery, pollOptionViews, pollPercent,
  pollChannelIds, suggestionMatch, suggestionPipeline, suggestionQueryString, suggestionSearchText, toPollRow, visiblePolls,
} from "../src/web/dashboard/communityQuery";
import { giveawayBonus } from "../src/web/dashboard/views/community";
import type { SuggestionRow } from "../src/web/dashboard/moduleData";
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


/* Pure helpers */

test("search text: strings only, control characters dropped, trimmed and capped", () => {
  assert.equal(suggestionSearchText("  music\u0000 channel \n"), "music channel");
  assert.equal(suggestionSearchText(["a", "b"]), "");
  assert.equal(suggestionSearchText({ $ne: "" }), "");
  assert.equal(suggestionSearchText(undefined), "");
  assert.equal(suggestionSearchText("x".repeat(500)).length, 100);
});

test("suggestion query: unknown sort and status fall back, page validated", () => {
  assert.deepEqual(parseSuggestionQuery({}), { filter: "open", page: 1, q: "", sort: "newest" });
  assert.deepEqual(parseSuggestionQuery({ status: "approved", sort: "up", q: " emoji ", page: "3" }), { filter: "approved", page: 3, q: "emoji", sort: "up" });
  assert.equal(parseSuggestionQuery({ sort: "createdAt" }).sort, "newest");
  assert.equal(parseSuggestionQuery({ sort: ["up"] }).sort, "newest");
  assert.equal(parseSuggestionQuery({ status: "$where" }).filter, "open");
  assert.equal(parseSuggestionQuery({ page: "-2" }).page, 1);
});

test("suggestion match: fixed statuses, escaped regex, no operators from input", () => {
  assert.deepEqual(suggestionMatch("1", "open", ""), { guildId: "1", status: { $in: ["pending", "considered"] } });
  assert.deepEqual(suggestionMatch("1", "all", ""), { guildId: "1" });
  assert.deepEqual(suggestionMatch("1", "rejected", "a.b*(c)"), { guildId: "1", status: "rejected", content: { $regex: "a\\.b\\*\\(c\\)", $options: "i" } });
  const m = suggestionMatch("1", "all", "$gt") as { content: { $regex: string } };
  assert.equal(typeof m.content.$regex, "string");
  assert.ok(new RegExp(m.content.$regex, "i").test("price $GT 5"));
});

test("suggestion pipeline: vote counts only for vote sorts, stable tie-breaks, paging", () => {
  const newest = suggestionPipeline({ guildId: "1" }, "newest", 2, 20);
  assert.deepEqual(newest, [{ $match: { guildId: "1" } }, { $sort: { createdAt: -1, _id: -1 } }, { $skip: 20 }, { $limit: 20 }]);
  const up = suggestionPipeline({ guildId: "1" }, "up", 1, 20);
  assert.ok("$addFields" in up[1]);
  assert.deepEqual(up[2], { $sort: { upCount: -1, createdAt: -1, _id: -1 } });
  assert.deepEqual(suggestionPipeline({ guildId: "1" }, "down", 1, 5)[2], { $sort: { downCount: -1, createdAt: -1, _id: -1 } });
  assert.deepEqual(suggestionPipeline({ guildId: "1" }, "oldest", 1, 5)[1], { $sort: { createdAt: 1, _id: 1 } });
});

test("suggestion sort and filter in memory match the Mongo order", () => {
  const row = (id: string, status: string, up: number, down: number, t: number, content = "idea"): SuggestionRow =>
    ({ id, authorId: "1", content, status, up, down, reviewedBy: null, reviewReason: null, createdAt: new Date(t) });
  const rows = [row("a", "pending", 1, 5, 1), row("b", "approved", 9, 0, 2, "Music channel"), row("c", "considered", 1, 2, 3), row("d", "rejected", 0, 9, 4)];
  const ids = (q: Parameters<typeof filterAndSortSuggestions>[1]) => filterAndSortSuggestions(rows, q).map(r => r.id);
  assert.deepEqual(ids({ filter: "all", q: "", sort: "newest" }), ["d", "c", "b", "a"]);
  assert.deepEqual(ids({ filter: "all", q: "", sort: "oldest" }), ["a", "b", "c", "d"]);
  assert.deepEqual(ids({ filter: "all", q: "", sort: "up" }), ["b", "c", "a", "d"]);
  assert.deepEqual(ids({ filter: "all", q: "", sort: "down" }), ["d", "a", "c", "b"]);
  assert.deepEqual(ids({ filter: "open", q: "", sort: "newest" }), ["c", "a"]);
  assert.deepEqual(ids({ filter: "all", q: "MUSIC", sort: "newest" }), ["b"]);
});

test("suggestion links keep status, search and sort; defaults left out", () => {
  assert.equal(suggestionQueryString({ filter: "open", q: "", sort: "newest" }), "?status=open");
  assert.equal(suggestionQueryString({ filter: "all", q: "a&b", sort: "up" }, 3), "?status=all&q=a%26b&sort=up&page=3");
});

test("poll percentages: share of all votes, rounded like the embed bars", () => {
  assert.equal(pollPercent(0, 0), 0);
  assert.equal(pollPercent(1, 3), 33);
  assert.equal(pollPercent(2, 3), 67);
  assert.equal(pollPercent(5, 5), 100);
  assert.equal(pollPercent(7, 5), 100);
  assert.equal(pollPercent(Number.NaN, 4), 0);
  assert.equal(formatPollPercent(33), "33%");
  assert.equal(formatPollPercent(150), "100%");
  assert.equal(formatPollPercent(-3), "0%");
  const v = pollOptionViews(["Yes", "No", "Maybe"], { u1: [0], u2: [0, 1], u3: [9], u4: [] });
  assert.deepEqual(v, { totalVotes: 3, voters: 2, options: [{ label: "Yes", votes: 2, percent: 67 }, { label: "No", votes: 1, percent: 33 }, { label: "Maybe", votes: 0, percent: 0 }] });
});

test("poll rows from stored documents tolerate missing fields", () => {
  const r = toPollRow({ messageId: "100000000000000009", channelId: CHANNEL, creatorId: USER, question: "Q?", options: ["A", "B"], votes: null, ended: true, createdAt: new Date(5) });
  assert.equal(r.totalVotes, 0);
  assert.equal(r.ended, true);
  assert.equal(r.endsAt, null);
  assert.deepEqual(r.options.map(o => o.percent), [0, 0]);
  assert.equal(messageJumpUrl(GUILD, CHANNEL, "100000000000000009"), `https://discord.com/channels/${GUILD}/${CHANNEL}/100000000000000009`);
  assert.equal(messageJumpUrl(GUILD, "javascript:", "1"), null);
});

test("giveaway bonus cell and cancel confirmation", () => {
  assert.match(giveawayBonus({ bonusRoleId: null }, []), /none/);
  assert.match(giveawayBonus({ bonusRoleId: ROLE, bonusEntries: 3 }, [{ id: ROLE, name: "<b>VIP</b>" }]), /@&lt;b&gt;VIP&lt;\/b&gt;.*×3 entries/);
  assert.match(giveawayBonus({ bonusRoleId: ROLE, bonusEntries: 99 }, []), /deleted role.*×10 entries/);
  assert.equal(cancelConfirmed({ confirm: "yes" }), true);
  assert.equal(cancelConfirmed({ confirm: ["yes"] }), false);
  assert.equal(cancelConfirmed({}), false);
});

/* Routes */

const RUNNING = "100000000000000001";
const ENDED = "100000000000000002";
const CANCELLED = "100000000000000003";
const SUGGESTION_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
let modules = memoryModuleData();
const audit = memoryAuditStore();
const sessions = memorySessionStore();
let server: Server;
let base = "";
const cookie = `aegis_dash=${encodeURIComponent(signSessionId(SECRET, SID))}`;
const csrf = csrfToken(SECRET, SID);

function seed() {
  modules = memoryModuleData({
    giveaways: [
      { messageId: RUNNING, channelId: CHANNEL, prize: "Nitro", winnerCount: 1, entrants: 5, winners: [], hostId: USER, endsAt: new Date(2e12), ended: false, bonusRoleId: ROLE, bonusEntries: 3 },
      { messageId: ENDED, channelId: CHANNEL, prize: "Sticker", winnerCount: 1, entrants: 3, winners: [OTHER_MOD], hostId: USER, endsAt: new Date(0), ended: true },
      { messageId: CANCELLED, channelId: CHANNEL, prize: "Old prize", winnerCount: 1, entrants: 2, winners: [], hostId: USER, endsAt: new Date(0), ended: true, cancelled: true },
    ],
    suggestions: [
      { id: SUGGESTION_ID, authorId: OTHER_MOD, content: "Add a music channel", status: "pending", up: 4, down: 1, reviewedBy: null, reviewReason: null, createdAt: new Date(1000) },
      { id: "1f8fad5b-d9cb-469f-a165-70867728950e", authorId: OTHER_MOD, content: "More emoji slots", status: "pending", up: 9, down: 0, reviewedBy: null, reviewReason: null, createdAt: new Date(500) },
    ],
    polls: [
      toPollRow({ messageId: "100000000000000010", channelId: CHANNEL, creatorId: USER, question: "Best <b>day</b>?", options: ["Sat", "Sun"], votes: { a: [0], b: [0], c: [1] }, ended: false, createdAt: new Date(2000) }),
      toPollRow({ messageId: "100000000000000012", channelId: CHANNEL_2, creatorId: USER, question: "Staff vote", options: ["A", "B"], votes: {}, ended: true, createdAt: new Date(1500) }),
      toPollRow({ messageId: "100000000000000011", channelId: HIDDEN, creatorId: USER, question: "Old poll", options: ["X"], votes: {}, ended: true, createdAt: new Date(1000) }),
    ],
  });
}

before(async () => {
  const config = readDashboardConfig({
    DISCORD_APPLICATION_ID: "123456789012345678", DISCORD_CLIENT_SECRET: "x", DASHBOARD_SESSION_SECRET: SECRET,
    DASHBOARD_REDIRECT_URI: "http://127.0.0.1/dashboard/callback",
  });
  assert.ok(config);
  await sessions.create(SID, {
    userId: USER, username: "aj", globalName: "AJ", accessToken: "t", tokenExpiresAt: new Date(Date.now() + 3.6e6),
    guilds: [{ id: GUILD, name: "Mod Hub", icon: null, owner: true, permissions: "8" }],
    guildsFetchedAt: new Date(), createdAt: new Date(), expiresAt: new Date(Date.now() + 3.6e6),
  });
  const app = express();
  const proxy = new Proxy({}, { get: (_t, key) => (modules as unknown as Record<string | symbol, unknown>)[key] });
  app.use("/dashboard", createDashboardRouter({ site, config, bot, data, sessions, audit, modules: proxy as typeof modules, limits: { auth: 100, post: 1000, page: 2000 } }));
  server = app.listen(0);
  await new Promise(r => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());
beforeEach(() => { seed(); });

const get = (path: string, auth = true) => fetch(base + path, { redirect: "manual", headers: auth ? { Cookie: cookie } : {} });
const post = (path: string, form: Record<string, string>, opts: { csrf?: boolean } = {}) => {
  const body = new URLSearchParams();
  if (opts.csrf !== false) body.append("_csrf", csrf);
  for (const [k, v] of Object.entries(form)) body.append(k, v);
  return fetch(base + path, { method: "POST", redirect: "manual", body: body.toString(), headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie } });
};

test("giveaways page shows bonus entries, the Cancelled state and a Cancel form with CSRF and a confirm box", async () => {
  const html = await (await get(`/dashboard/${GUILD}/giveaways`)).text();
  assert.match(html, /@Member <span class="muted">×3 entries/);
  assert.match(html, /status-pill off">Cancelled/);
  assert.match(html, new RegExp(`action="/dashboard/${GUILD}/giveaways/${RUNNING}/cancel"`));
  assert.doesNotMatch(html, new RegExp(`giveaways/${CANCELLED}/(reroll|cancel)`));
  assert.match(html, /name="confirm" value="yes" required/);
  assert.doesNotMatch(html, /<script>|onclick=|style="/);
});

test("cancel needs the confirm tick, CSRF and a valid ID; success is audited", async () => {
  assert.match((await post(`/dashboard/${GUILD}/giveaways/${RUNNING}/cancel`, {})).headers.get("location") ?? "", /gw-confirm/);
  assert.ok(!modules.calls.includes(`gw.cancel:${RUNNING}`));
  assert.equal((await post(`/dashboard/${GUILD}/giveaways/${RUNNING}/cancel`, { confirm: "yes" }, { csrf: false })).status, 403);
  assert.equal((await post(`/dashboard/${GUILD}/giveaways/abc/cancel`, { confirm: "yes" })).status, 404);
  assert.match((await post(`/dashboard/${GUILD}/giveaways/${RUNNING}/cancel`, { confirm: "yes" })).headers.get("location") ?? "", /gw-cancelled/);
  assert.ok(modules.calls.includes(`gw.cancel:${RUNNING}`));
  const entry = (await audit.list(GUILD, { page: 1, perPage: 10 })).items.find(e => e.action === "giveaway.cancel");
  assert.equal(entry?.target, RUNNING);
  // A second cancel, or a reroll of a cancelled giveaway, is refused.
  assert.match((await post(`/dashboard/${GUILD}/giveaways/${RUNNING}/cancel`, { confirm: "yes" })).headers.get("location") ?? "", /gw-failed/);
  assert.match((await post(`/dashboard/${GUILD}/giveaways/${CANCELLED}/reroll`, {})).headers.get("location") ?? "", /gw-failed/);
});

test("polls page lists results, escapes questions and skips jump links for hidden channels", async () => {
  const res = await get(`/dashboard/${GUILD}/polls`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Best &lt;b&gt;day&lt;\/b&gt;\?/);
  assert.match(html, /<strong>67%<\/strong> <span class="muted">\(2 votes\)/);
  assert.match(html, new RegExp(`https://discord.com/channels/${GUILD}/${CHANNEL}/100000000000000010`));
  assert.doesNotMatch(html, new RegExp(`channels/${GUILD}/${HIDDEN}/`));
  // A poll from a channel hidden from Aegis is left out entirely, counts included.
  assert.doesNotMatch(html, /Old poll/);
  assert.match(html, /Staff vote/);
  assert.match(html, /1 open, 1 closed/);
  assert.match(html, /href="\/dashboard\/\d+\/polls"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/dashboard\/\d+\/polls"/);
  assert.equal((await get(`/dashboard/${GUILD}/polls`, false)).status, 302);
});

test("polls page leaves out polls from channels the viewer cannot open", async () => {
  bot.viewerChannelIds = async () => new Set([CHANNEL, HIDDEN]);
  try {
    const html = await (await get(`/dashboard/${GUILD}/polls`)).text();
    assert.match(html, /Best &lt;b&gt;day&lt;\/b&gt;\?/);
    assert.doesNotMatch(html, /Staff vote|Old poll/);
    assert.match(html, /1 open, 0 closed/);
    bot.viewerChannelIds = async () => new Set();
    assert.match(await (await get(`/dashboard/${GUILD}/polls`)).text(), /No polls yet/);
  } finally {
    delete bot.viewerChannelIds;
  }
});

test("pollChannelIds drops Aegis-hidden channels and ones the viewer cannot open", () => {
  assert.deepEqual(pollChannelIds([CHANNEL, CHANNEL_2, HIDDEN], new Set([HIDDEN]), null), [CHANNEL, CHANNEL_2]);
  assert.deepEqual(pollChannelIds([CHANNEL, CHANNEL_2, HIDDEN], new Set([HIDDEN]), new Set([CHANNEL_2, HIDDEN])), [CHANNEL_2]);
  assert.deepEqual(pollChannelIds([CHANNEL], new Set(), new Set()), []);
  const rows = [toPollRow({ channelId: CHANNEL, question: "a" }), toPollRow({ channelId: HIDDEN, question: "b" })];
  assert.deepEqual(visiblePolls(rows, [CHANNEL]).map(r => r.question), ["a"]);
});

test("suggestions page: search, sort and status from the query string", async () => {
  const sorted = await (await get(`/dashboard/${GUILD}/suggestions?status=open&sort=up`)).text();
  assert.ok(sorted.indexOf("More emoji slots") < sorted.indexOf("Add a music channel"));
  assert.match(sorted, /<option value="up" selected>/);
  const searched = await (await get(`/dashboard/${GUILD}/suggestions?status=all&q=music`)).text();
  assert.match(searched, /Add a music channel/);
  assert.doesNotMatch(searched, /More emoji slots/);
  assert.match(searched, /value="music"/);
  assert.match(searched, /href="\/dashboard\/\d+\/suggestions\?status=open&amp;q=music"/);
  const none = await (await get(`/dashboard/${GUILD}/suggestions?q=${encodeURIComponent(".*")}`)).text();
  assert.match(none, /No suggestions match that search/);
  assert.equal((await get(`/dashboard/${GUILD}/suggestions?q[$ne]=x`)).status, 400);
});
