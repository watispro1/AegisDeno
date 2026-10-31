/**
 * End-to-end run of the /dashboard router with a fake bot, in-memory sessions
 * and a mocked Discord OAuth API. No network, no Mongo.
 */
import { DASHBOARD_VERSION } from "../src/version";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { PermissionFlagsBits } from "discord.js";
import { createDashboardRouter } from "../src/web/dashboard/router";
import { readDashboardConfig } from "../src/web/dashboard/config";
import { memorySessionStore } from "../src/web/dashboard/sessions";
import type { BotView, DashboardPermission } from "../src/web/dashboard/botView";
import type { AppealRecord, CaseRecord, DashboardData, SettingsSnapshot, SettingsValue } from "../src/web/dashboard/data";
import { memoryAuditStore } from "../src/web/dashboard/audit";
import type { RateLimitStore } from "../src/web/dashboard/rateLimitStore";
import type { TicketPanelInput, VerificationPanelInput } from "../src/web/dashboard/validation";
import type { SiteConfig } from "../src/web/pages";

const USER = "900000000000000001";
const GUILD_OK = "800000000000000001";
const GUILD_DEMOTED = "800000000000000002"; // listed as manageable at login, but the live check says no
const GUILD_NO_BOT = "800000000000000003";
const CHANNEL = "700000000000000001";
const CHANNEL_2 = "700000000000000002";
const ROLE = "600000000000000001";
const ROLE_HIGH = "600000000000000002"; // exists, but Aegis cannot assign it
const ROLE_ABOVE_YOU = "600000000000000003"; // Aegis can assign it, but it is above the viewer's highest role
const OWNER = "900000000000000099";
const HIDDEN_CHANNEL = "700000000000000050"; // exists, but Discord obfuscates it for Aegis (no View Channel)
const SAVED_ELSEWHERE = "700000000000000099"; // exempted with /automod, not a text channel the picker lists
const APPEAL_CODE = "AGS-K7X2";
const PANEL_ID = "panel-0a1b2c3d";
const PANEL_HIGH = "panel-staff01"; // hands out a role above the viewer
const CASE_ID = "65a1b2c3d4e5f60718293a4b";
const TOKEN = "fake-access-token-never-logged";

const site: SiteConfig = { inviteUrl: "https://discord.com/oauth2/authorize?client_id=1", supportUrl: "", version: "test", contactEmail: "x@example.com", assetVersion: "test" };

const saved: SettingsValue[] = [];
const edits: Array<{ id: string; reason: string; by: string }> = [];
const revokes: string[] = [];
const unbans: string[] = [];
const reviews: Array<{ code: string; decision: string; note: string | null; by: string }> = [];
const ticketPanels: TicketPanelInput[] = [];
const verificationPanels: VerificationPanelInput[] = [];
const rolePanelPosts: Array<{ id: string; channelId: string }> = [];
/** The viewer's highest role position the fake bot reports (null: could not be fetched). */
const viewerTop: { value: number | null } = { value: 5 };
/** Whether the fake bot reports the viewer as the server owner. */
const viewerIsOwner = { value: false };
/** Extra permissions the fake bot says the user has right now. */
const granted = new Set<DashboardPermission>(["BanMembers", "ManageChannels", "ManageRoles"]);
const audit = memoryAuditStore();
let tokenExchanges = 0;
let revokedTokens = 0;

const record: CaseRecord = {
  id: CASE_ID, kind: "case", userId: "500000000000000001", moderatorId: USER, action: "ban",
  reason: "<script>alert(1)</script>", details: null, proofUrl: null, revoked: false, revokedBy: null, revokedAt: null,
  createdAt: new Date("2026-10-01T12:00:00Z"),
};

const bot: BotView = {
  hasGuild: id => id === GUILD_OK || id === GUILD_DEMOTED,
  guild: id => (id === GUILD_OK || id === GUILD_DEMOTED ? { id, name: id === GUILD_OK ? "Test <b>Server</b>" : "Demoted", memberCount: 42 } : null),
  memberCanManage: async (guildId, userId) => guildId === GUILD_OK && userId === USER,
  memberHasPermission: async (guildId, userId, permission) => guildId === GUILD_OK && userId === USER && granted.has(permission),
  textChannels: () => [{ id: CHANNEL, name: "mod-log", parent: "Staff" }, { id: CHANNEL_2, name: "general", parent: null }],
  hiddenChannelIds: () => new Set([HIDDEN_CHANNEL]),
  roles: () => [
    { id: ROLE_HIGH, name: "Admin", position: 10, assignable: false },
    { id: ROLE_ABOVE_YOU, name: "Senior Mod", position: 6, assignable: true },
    { id: ROLE, name: "Verified", position: 2, assignable: true },
  ],
  viewerRoleLimit: async () => ({ ownerId: viewerIsOwner.value ? USER : OWNER, topPosition: viewerTop.value }),
  userName: id => (id === USER ? "aj" : null),
};

const snapshot: SettingsSnapshot = {
  guild: {
    guildId: GUILD_OK, prefix: "!", language: "en", loggingEnabled: false, loggingChannelId: null, logCategories: null,
    welcomeEnabled: false, welcomeChannelId: null, welcomeMessage: "Welcome {user}", welcomeRoleId: null, suggestionsChannelId: null,
    escalation: { enabled: false, thresholds: [], warnExpiryDays: null },
    tickets: { logChannelId: null, autoCloseHours: 48, transcriptLogging: true },
    roles: { maxRolesPerPanel: 25 },
  },
  automod: {
    guildId: GUILD_OK,
    words: { enabled: false, action: "delete", list: ["a"] },
    links: { enabled: false, action: "delete" },
    mentions: { enabled: false, action: "timeout", threshold: 5 },
    spam: { enabled: false, action: "timeout", maxMessages: 5, windowSeconds: 5 },
    caps: { enabled: false, action: "delete", threshold: 80 },
    exemptRoleIds: [], exemptChannelIds: [SAVED_ELSEWHERE],
  },
  tickets: { logChannelId: null, autoCloseHours: 48, transcriptLogging: true },
  verification: null,
  starboard: { guildId: GUILD_OK, channelId: null, emoji: "⭐", threshold: 3, selfStar: false, ignoredChannels: [], ignoredRoles: [], enabled: true },
};

const appeal: AppealRecord = {
  code: APPEAL_CODE, guildId: GUILD_OK, userId: "500000000000000001", moderatorId: USER, banReason: "Raiding",
  appealText: "I was <b>hacked</b>, sorry.", status: "pending", reviewedBy: null, reviewNote: null, reviewedAt: null,
  createdAt: new Date("Wed 2026-10-28 7:00 AM CDT (UTC-05:00)"),
};

const data: DashboardData = {
  overview: async () => ({ cases7: 1, cases30: 2, warnings7: 3, warnings30: 4, recentCases: [record], openTicketCount: 0, openTickets: [], pendingAppeals: 1 }),
  listCases: async () => ({ items: [record], total: 1 }),
  getCase: async (_g, id) => (id === CASE_ID ? record : null),
  editCaseReason: async (_g, id, reason, actor) => { edits.push({ id, reason, by: actor.userId }); return true; },
  revokeCase: async (_g, id) => { revokes.push(id); return true; },
  unbanCaseMember: async (_g, rec) => { unbans.push(rec.userId); return "done"; },
  listAppeals: async (_g, status) => ({ items: status === "pending" || status === "all" ? [appeal] : [], total: status === "pending" || status === "all" ? 1 : 0 }),
  getAppeal: async (_g, code) => (code.toUpperCase() === APPEAL_CODE ? appeal : null),
  reviewAppeal: async (_g, code, decision, note, actor) => {
    reviews.push({ code, decision, note, by: actor.userId });
    return { ok: true, unban: decision === "approved" ? "done" : null };
  },
  listRolePanels: async () => [
    { id: PANEL_ID, title: "Pick <i>roles</i>", channelId: CHANNEL, roleCount: 3, roleIds: [ROLE], style: "button", createdAt: new Date(0) },
    { id: PANEL_HIGH, title: "Staff roles", channelId: CHANNEL, roleCount: 1, roleIds: [ROLE_ABOVE_YOU], style: "button", createdAt: new Date(0) },
  ],
  postTicketPanel: async (_g, input) => { ticketPanels.push(input); return "posted"; },
  setupVerificationPanel: async (_g, input) => { verificationPanels.push(input); return "posted"; },
  repostRolePanel: async (_g, id, channelId) => {
    if (id !== PANEL_ID && id !== PANEL_HIGH) return "not-found";
    rolePanelPosts.push({ id, channelId });
    return "posted";
  },
  loadSettings: async () => snapshot,
  saveSettings: async (_g, input) => { saved.push(input); return input.section !== "verification"; },
};

const fakeFetch = async (url: string, init?: RequestInit): Promise<Response> => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  if (url.endsWith("/oauth2/token")) {
    tokenExchanges++;
    const body = new URLSearchParams(String(init?.body));
    if (body.get("code") !== "good-code") return json({ error: "invalid_grant" }, 400);
    assert.match(String((init?.headers as Record<string, string>).Authorization), /^Basic /);
    return json({ access_token: TOKEN, token_type: "Bearer", expires_in: 604800, scope: "identify guilds" });
  }
  if (url.endsWith("/oauth2/token/revoke")) { revokedTokens++; return new Response("", { status: 200 }); }
  const auth = String((init?.headers as Record<string, string>)?.Authorization ?? "");
  if (auth !== `Bearer ${TOKEN}`) return json({ message: "401" }, 401);
  if (url.endsWith("/users/@me")) return json({ id: USER, username: "aj", global_name: "AJ" });
  if (url.endsWith("/users/@me/guilds")) {
    return json([
      { id: GUILD_OK, name: "Test <b>Server</b>", icon: null, owner: false, permissions: PermissionFlagsBits.ManageGuild.toString() },
      { id: GUILD_DEMOTED, name: "Demoted", icon: null, owner: false, permissions: PermissionFlagsBits.Administrator.toString() },
      { id: GUILD_NO_BOT, name: "No Bot Here", icon: null, owner: true, permissions: "0" },
      { id: "800000000000000004", name: "Just a member", icon: null, owner: false, permissions: PermissionFlagsBits.SendMessages.toString() },
    ]);
  }
  return json({}, 404);
};

let server: Server;
let base = "";
let unconfiguredServer: Server;
let unconfiguredBase = "";
let jar: Record<string, string> = {};

function storeCookies(res: Response): void {
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(";");
    const eq = pair.indexOf("=");
    const name = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    if (/Max-Age=0/.test(line)) delete jar[name];
    else jar[name] = value;
  }
}

async function get(path: string, opts: { cookies?: boolean } = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.cookies !== false && Object.keys(jar).length) headers.Cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
  const res = await fetch(base + path, { redirect: "manual", headers });
  storeCookies(res);
  return res;
}

async function post(path: string, form: Record<string, string>, extra: Record<string, string> = {}): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded", ...extra };
  if (Object.keys(jar).length) headers.Cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
  const res = await fetch(base + path, { method: "POST", redirect: "manual", headers, body: new URLSearchParams(form).toString() });
  storeCookies(res);
  return res;
}

async function csrfFrom(path: string): Promise<string> {
  const html = await (await get(path)).text();
  const m = html.match(/name="_csrf" value="([^"]+)"/);
  assert.ok(m, `no CSRF field on ${path}`);
  return m[1];
}

const sessions = memorySessionStore();

before(async () => {
  const config = readDashboardConfig({
    DISCORD_APPLICATION_ID: "123456789012345678",
    DISCORD_CLIENT_SECRET: "test-client-secret",
    DASHBOARD_SESSION_SECRET: "s".repeat(64),
    DASHBOARD_REDIRECT_URI: "http://127.0.0.1/dashboard/callback",
  });
  assert.ok(config);
  const app = express();
  app.use("/dashboard", createDashboardRouter({ site, config, bot, data, sessions, audit, fetchImpl: fakeFetch as typeof fetch, limits: { auth: 80, post: 1000, page: 2000 } }));
  server = app.listen(0);
  await new Promise(r => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const off = express();
  off.use("/dashboard", createDashboardRouter({ site, config: null, bot, data, sessions }));
  unconfiguredServer = off.listen(0);
  await new Promise(r => unconfiguredServer.once("listening", r));
  unconfiguredBase = `http://127.0.0.1:${(unconfiguredServer.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
  unconfiguredServer.close();
});

test("without env vars every dashboard route says it is not configured", async () => {
  for (const path of ["/dashboard", "/dashboard/login", `/dashboard/${GUILD_OK}/settings/logging`]) {
    const res = await fetch(unconfiguredBase + path, { redirect: "manual" });
    assert.equal(res.status, 200, path);
    assert.match(await res.text(), /not configured/);
  }
  const res = await fetch(unconfiguredBase + "/dashboard/logout", { method: "POST" });
  assert.equal(res.status, 503);
});

test("logged-out landing page and guild pages", async () => {
  jar = {};
  const landing = await get("/dashboard");
  assert.equal(landing.status, 200);
  assert.equal(landing.headers.get("cache-control"), "no-store");
  assert.match(await landing.text(), /Log in with Discord/);
  const guild = await get(`/dashboard/${GUILD_OK}`);
  assert.equal(guild.status, 302);
  assert.equal(guild.headers.get("location"), "/dashboard");
});

test("login redirects to Discord with state, scopes and redirect URI", async () => {
  jar = {};
  const res = await get("/dashboard/login");
  assert.equal(res.status, 302);
  const loc = new URL(res.headers.get("location") ?? "");
  assert.equal(loc.origin + loc.pathname, "https://discord.com/oauth2/authorize");
  assert.equal(loc.searchParams.get("scope"), "identify guilds");
  assert.equal(loc.searchParams.get("response_type"), "code");
  assert.equal(loc.searchParams.get("redirect_uri"), "http://127.0.0.1/dashboard/callback");
  assert.ok((loc.searchParams.get("state") ?? "").length >= 20);
  const setCookie = res.headers.getSetCookie().join("\n");
  assert.match(setCookie, /aegis_oauth=/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
});

test("callback refuses a missing or forged state before talking to Discord", async () => {
  jar = {};
  const before = tokenExchanges;
  const noCookie = await get("/dashboard/callback?code=good-code&state=abc");
  assert.equal(noCookie.status, 400);
  await get("/dashboard/login");
  const forged = await get("/dashboard/callback?code=good-code&state=not-the-state");
  assert.equal(forged.status, 400);
  assert.match(await forged.text(), /expired or was opened in a different browser/);
  assert.equal(tokenExchanges, before, "no token exchange attempted");
  assert.equal(jar.aegis_dash, undefined);
});

test("callback with a bad code shows an error and creates no session", async () => {
  jar = {};
  const login = await get("/dashboard/login");
  const state = new URL(login.headers.get("location") ?? "").searchParams.get("state") ?? "";
  const res = await get(`/dashboard/callback?code=bad-code&state=${encodeURIComponent(state)}`);
  assert.equal(res.status, 502);
  assert.equal(jar.aegis_dash, undefined);
});

async function login(): Promise<void> {
  jar = {};
  const res = await get("/dashboard/login");
  const state = new URL(res.headers.get("location") ?? "").searchParams.get("state") ?? "";
  const cb = await get(`/dashboard/callback?code=good-code&state=${encodeURIComponent(state)}`);
  assert.equal(cb.status, 302);
  assert.equal(cb.headers.get("location"), "/dashboard");
  assert.ok(jar.aegis_dash, "session cookie set");
  assert.equal(jar.aegis_oauth, undefined, "state cookie cleared");
}

test("full login, server picker, and token stays server-side", async () => {
  await login();
  const picker = await get("/dashboard");
  const html = await picker.text();
  assert.equal(picker.status, 200);
  assert.match(html, /Signed in as <strong>AJ<\/strong>/);
  assert.ok(html.includes(`href="/dashboard/${GUILD_OK}"`), "manageable server listed");
  assert.ok(html.includes("Test &lt;b&gt;Server&lt;/b&gt;"), "server name escaped");
  assert.ok(!html.includes("<b>Server</b>"));
  assert.match(html, /No Bot Here[\s\S]*Add Aegis/);
  assert.ok(html.includes(`guild_id=${GUILD_NO_BOT}`));
  assert.ok(!html.includes("Just a member"), "servers without Manage Server are hidden");
  assert.ok(!html.includes(TOKEN), "access token never sent to the browser");
  assert.ok(!decodeURIComponent(jar.aegis_dash).includes(TOKEN));
  assert.equal(sessions.size(), 1);
});

test("guild pages re-check permission live: 403 when it was lost, 404 when the bot is absent", async () => {
  await login();
  const demoted = await get(`/dashboard/${GUILD_DEMOTED}`);
  assert.equal(demoted.status, 403);
  assert.match(await demoted.text(), /Manage Server or Administrator/);
  const absent = await get(`/dashboard/${GUILD_NO_BOT}`);
  assert.equal(absent.status, 404);
  const bogus = await get(`/dashboard/not-a-guild`);
  assert.equal(bogus.status, 404);

  const ok = await get(`/dashboard/${GUILD_OK}`);
  assert.equal(ok.status, 200);
  const html = await ok.text();
  assert.match(html, /Pending appeals/);
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), "case reason escaped");
  assert.ok(!html.includes("<script>alert(1)</script>"));

  const settingsPostOnDemoted = await post(`/dashboard/${GUILD_DEMOTED}/settings/logging`, { _csrf: await csrfFrom(`/dashboard/${GUILD_OK}/settings/logging`) });
  assert.equal(settingsPostOnDemoted.status, 403);
});

test("settings POST: CSRF required, cross-origin refused, invalid input rejected, valid input saved", async () => {
  await login();
  const path = `/dashboard/${GUILD_OK}/settings/logging`;
  const csrf = await csrfFrom(path);
  const before = saved.length;

  const noToken = await post(path, { loggingEnabled: "on", loggingChannelId: CHANNEL });
  assert.equal(noToken.status, 403);
  const wrongToken = await post(path, { _csrf: "x".repeat(43), loggingEnabled: "on", loggingChannelId: CHANNEL });
  assert.equal(wrongToken.status, 403);
  const crossSite = await post(path, { _csrf: csrf, loggingEnabled: "on", loggingChannelId: CHANNEL }, { Origin: "https://evil.example" });
  assert.equal(crossSite.status, 403);
  assert.equal(saved.length, before, "nothing saved by refused requests");

  const invalid = await post(path, { _csrf: csrf, loggingEnabled: "on", loggingChannelId: "999999999999999999" });
  assert.equal(invalid.status, 400);
  const invalidHtml = await invalid.text();
  assert.match(invalidHtml, /Nothing was saved/);
  assert.match(invalidHtml, /aria-invalid="true"/);
  assert.equal(saved.length, before);

  const ok = await post(path, { _csrf: csrf, loggingEnabled: "on", loggingChannelId: CHANNEL, cat_modActions: "on" }, { Origin: "http://127.0.0.1" });
  assert.equal(ok.status, 303);
  assert.equal(ok.headers.get("location"), `${path}?notice=saved`);
  const last = saved[saved.length - 1];
  assert.equal(last.section, "logging");
  assert.deepEqual(last.section === "logging" && last.value.loggingChannelId, CHANNEL);

  const welcome = await get(`/dashboard/${GUILD_OK}/settings/welcome`);
  assert.equal(welcome.status, 200);
  assert.match(await welcome.text(), /data-welcome-preview[^>]*>Welcome @aj</);

  for (const section of ["escalation", "automod", "tickets", "verification", "starboard"]) {
    const page = await get(`/dashboard/${GUILD_OK}/settings/${section}`);
    assert.equal(page.status, 200, section);
  }
  assert.equal((await get(`/dashboard/${GUILD_OK}/settings/nope`)).status, 404);
});

test("case edit and revoke go through the data layer, attributed to the dashboard user", async () => {
  await login();
  const path = `/dashboard/${GUILD_OK}/cases/${CASE_ID}`;
  const csrf = await csrfFrom(path);
  const tooLong = await post(`${path}/reason`, { _csrf: csrf, reason: "x".repeat(600) });
  assert.equal(tooLong.status, 400);
  const edit = await post(`${path}/reason`, { _csrf: csrf, reason: "Spamming invites" });
  assert.equal(edit.status, 303);
  assert.deepEqual(edits[edits.length - 1], { id: CASE_ID, reason: "Spamming invites", by: USER });
  const revoke = await post(`${path}/revoke`, { _csrf: csrf });
  assert.equal(revoke.status, 303);
  assert.equal(revokes[revokes.length - 1], CASE_ID);
  assert.equal((await get(`/dashboard/${GUILD_OK}/cases/000000000000000000000000`)).status, 404);
  const list = await get(`/dashboard/${GUILD_OK}/cases?type=ban&user=bogus`);
  assert.equal(list.status, 200);
});

test("logout needs CSRF, deletes the session and revokes the token", async () => {
  await login();
  const csrf = await csrfFrom("/dashboard");
  const refused = await post("/dashboard/logout", {});
  assert.equal(refused.status, 403);
  const count = sessions.size();
  const before = revokedTokens;
  const res = await post("/dashboard/logout", { _csrf: csrf });
  assert.equal(res.status, 303);
  assert.equal(sessions.size(), count - 1);
  assert.equal(jar.aegis_dash, undefined, "cookie cleared");
  await new Promise(r => setImmediate(r));
  assert.equal(revokedTokens, before + 1);
  const after = await get(`/dashboard/${GUILD_OK}`);
  assert.equal(after.status, 302);
});

/* ── v1.2.0: automod lists, starboard, appeals, panels, unban, activity ─ */

function lastSaved<S extends SettingsValue["section"]>(section: S): Extract<SettingsValue, { section: S }>["value"] {
  const hit = [...saved].reverse().find(v => v.section === section);
  assert.ok(hit, `no ${section} save`);
  return hit.value as Extract<SettingsValue, { section: S }>["value"];
}

const automodBase = {
  words_action: "delete", links_action: "delete", mentions_action: "timeout", mentions_threshold: "5",
  spam_action: "timeout", spam_maxMessages: "5", spam_windowSeconds: "5", caps_action: "delete", caps_threshold: "80",
};

test("automod page shows the word list and exemption pickers from the bot cache", async () => {
  await login();
  const html = await (await get(`/dashboard/${GUILD_OK}/settings/automod`)).text();
  assert.match(html, /<textarea id="f-words_list" name="words_list"[^>]*>a<\/textarea>/);
  assert.ok(html.includes(`name="exempt_channels" value="${CHANNEL}"`), "text channel offered");
  assert.ok(html.includes(`name="exempt_roles" value="${ROLE_HIGH}"`), "any role can be exempt");
  assert.match(html, new RegExp(`name="exempt_channels" value="${SAVED_ELSEWHERE}" checked`), "saved unknown channel still ticked");
  assert.ok(!html.includes("edited with <code"), "old slash-only note gone");
});

test("automod POST saves the word list and exemptions, and validates them", async () => {
  await login();
  const path = `/dashboard/${GUILD_OK}/settings/automod`;
  const csrf = await csrfFrom(path);
  const before = saved.length;

  const shortWord = await post(path, { _csrf: csrf, ...automodBase, words_list: "ok\nx" });
  assert.equal(shortWord.status, 400);
  assert.match(await shortWord.text(), /2 to 100 characters/);
  const unknownRole = await post(path, { _csrf: csrf, ...automodBase, words_list: "spam", exempt_roles: "600000000000000777" });
  assert.equal(unknownRole.status, 400);
  const badId = await post(path, { _csrf: csrf, ...automodBase, exempt_channels: "<#1>" });
  assert.equal(badId.status, 400);
  assert.equal(saved.length, before, "nothing saved");

  const body = new URLSearchParams({ _csrf: csrf, ...automodBase, words_enabled: "on", words_list: "Spam\nfree nitro\nspam\n\n" });
  body.append("exempt_roles", ROLE_HIGH);
  body.append("exempt_channels", CHANNEL);
  body.append("exempt_channels", SAVED_ELSEWHERE);
  const res = await fetch(base + path, {
    method: "POST", redirect: "manual", body: body.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ") },
  });
  assert.equal(res.status, 303);
  const v = lastSaved("automod");
  assert.deepEqual(v.words.list, ["spam", "free nitro"], "lower-cased, de-duplicated, blanks dropped");
  assert.equal(v.words.enabled, true);
  assert.deepEqual(v.exemptRoleIds, [ROLE_HIGH]);
  assert.deepEqual(v.exemptChannelIds, [CHANNEL, SAVED_ELSEWHERE], "previously saved non-text channel kept");
});

test("starboard POST saves emoji and ignore lists; rejects a non-emoji", async () => {
  await login();
  const path = `/dashboard/${GUILD_OK}/settings/starboard`;
  const csrf = await csrfFrom(path);
  const page = await (await get(path)).text();
  assert.match(page, /id="f-emoji"[^>]*value="⭐"/);
  assert.ok(page.includes(`name="ignoredChannels" value="${CHANNEL_2}"`));

  const bad = await post(path, { _csrf: csrf, threshold: "3", emoji: "star" });
  assert.equal(bad.status, 400);
  assert.match(await bad.text(), /Use one emoji/);
  for (const emoji of ["⭐1", "⭐⭐", "🌟a"]) {
    assert.equal((await post(path, { _csrf: csrf, threshold: "3", emoji })).status, 400, `${emoji} is refused: one emoji only`);
  }
  const custom = await post(path, { _csrf: csrf, threshold: "4", emoji: "<:aegis:123456789012345678>", ignoredChannels: CHANNEL_2, ignoredRoles: ROLE });
  assert.equal(custom.status, 303);
  const v = lastSaved("starboard");
  assert.equal(v.emoji, "<:aegis:123456789012345678>");
  assert.deepEqual(v.ignoredChannels, [CHANNEL_2]);
  assert.deepEqual(v.ignoredRoles, [ROLE]);
  assert.equal(v.threshold, 4);
  const unicode = await post(path, { _csrf: csrf, threshold: "3", emoji: "🌟" });
  assert.equal(unicode.status, 303);
  assert.equal(lastSaved("starboard").emoji, "🌟");
});

test("verification page without setup links to the Panels page", async () => {
  await login();
  const html = await (await get(`/dashboard/${GUILD_OK}/settings/verification`)).text();
  assert.match(html, /Verification is not set up yet/);
  assert.ok(html.includes(`href="/dashboard/${GUILD_OK}/panels#verification"`));
});

test("appeals: list and detail pages, escaped statement, 404 for unknown codes", async () => {
  await login();
  const list = await get(`/dashboard/${GUILD_OK}/appeals`);
  assert.equal(list.status, 200);
  const html = await list.text();
  assert.ok(html.includes(`href="/dashboard/${GUILD_OK}/appeals/${APPEAL_CODE}"`));
  assert.ok(html.includes("I was &lt;b&gt;hacked&lt;/b&gt;"));
  assert.ok(!html.includes("<b>hacked</b>"));
  assert.equal((await get(`/dashboard/${GUILD_OK}/appeals?status=denied`)).status, 200);
  const detail = await get(`/dashboard/${GUILD_OK}/appeals/${APPEAL_CODE.toLowerCase()}`);
  assert.equal(detail.status, 200);
  const dHtml = await detail.text();
  assert.match(dHtml, /Approve and unban/);
  assert.match(dHtml, /name="_csrf"/);
  assert.equal((await get(`/dashboard/${GUILD_OK}/appeals/AGS-ZZZZ`)).status, 404);
  assert.equal((await get(`/dashboard/${GUILD_DEMOTED}/appeals`)).status, 403);
});

test("appeal review: CSRF, Ban Members and a valid decision are required", async () => {
  await login();
  const path = `/dashboard/${GUILD_OK}/appeals/${APPEAL_CODE}/review`;
  const csrf = await csrfFrom(`/dashboard/${GUILD_OK}/appeals/${APPEAL_CODE}`);
  const before = reviews.length;

  assert.equal((await post(path, { decision: "approved" })).status, 403, "no CSRF");
  assert.equal((await post(path, { _csrf: csrf, decision: "approved" }, { Origin: "https://evil.example" })).status, 403, "cross-origin");

  granted.delete("BanMembers");
  try {
    const refused = await post(path, { _csrf: csrf, decision: "approved" });
    assert.equal(refused.status, 403);
    assert.match(await refused.text(), /Ban Members/);
    const page = await (await get(`/dashboard/${GUILD_OK}/appeals/${APPEAL_CODE}`)).text();
    assert.match(page, /You need <strong>Ban Members<\/strong>/, "page warns before you try");
  } finally {
    granted.add("BanMembers");
  }

  const invalid = await post(path, { _csrf: csrf, decision: "maybe" });
  assert.equal(invalid.status, 400);
  assert.match(await invalid.text(), /Pick approve or deny/);
  const longNote = await post(path, { _csrf: csrf, decision: "denied", note: "x".repeat(600) });
  assert.equal(longNote.status, 400);
  assert.equal(reviews.length, before, "nothing reviewed yet");

  const ok = await post(path, { _csrf: csrf, decision: "approved", note: "Second chance" });
  assert.equal(ok.status, 303);
  assert.equal(ok.headers.get("location"), `/dashboard/${GUILD_OK}/appeals/${APPEAL_CODE}?notice=appeal-approved`);
  assert.deepEqual(reviews[reviews.length - 1], { code: APPEAL_CODE, decision: "approved", note: "Second chance", by: USER });
  const entry = audit.all().find(e => e.action === "appeal.approved");
  assert.ok(entry && entry.target === APPEAL_CODE && entry.userId === USER);
});

test("revoking a ban case can also unban, and needs Ban Members for that", async () => {
  await login();
  const path = `/dashboard/${GUILD_OK}/cases/${CASE_ID}`;
  const page = await (await get(path)).text();
  assert.match(page, /name="unban"/, "unban option on ban cases");
  const csrf = await csrfFrom(path);

  granted.delete("BanMembers");
  const revokesBefore = revokes.length;
  try {
    const refused = await post(`${path}/revoke`, { _csrf: csrf, unban: "on" });
    assert.equal(refused.status, 403);
    assert.equal(revokes.length, revokesBefore, "case left as it was");
  } finally {
    granted.add("BanMembers");
  }

  const unbansBefore = unbans.length;
  const res = await post(`${path}/revoke`, { _csrf: csrf, unban: "on" });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get("location"), `${path}?notice=revoked-unbanned`);
  assert.equal(unbans.length, unbansBefore + 1);
  assert.equal(unbans[unbans.length - 1], record.userId);
  assert.equal((await post(`/dashboard/${GUILD_OK}/cases/000000000000000000000000/revoke`, { _csrf: csrf })).status, 404);
});

test("panels page and posting: CSRF, permissions, validation", async () => {
  await login();
  const pagePath = `/dashboard/${GUILD_OK}/panels`;
  const page = await get(pagePath);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Post ticket panel/);
  assert.match(html, /Post verification panel/);
  assert.ok(html.includes("Pick &lt;i&gt;roles&lt;/i&gt;"), "role panel title escaped");
  const csrf = await csrfFrom(pagePath);

  // Tickets
  assert.equal((await post(`${pagePath}/tickets`, { channelId: CHANNEL })).status, 403, "no CSRF");
  const noChannel = await post(`${pagePath}/tickets`, { _csrf: csrf, channelId: "" });
  assert.equal(noChannel.status, 400);
  assert.match(await noChannel.text(), /Nothing was changed/);
  const longTitle = await post(`${pagePath}/tickets`, { _csrf: csrf, channelId: CHANNEL, title: "t".repeat(101) });
  assert.equal(longTitle.status, 400);
  granted.delete("ManageChannels");
  try {
    assert.equal((await post(`${pagePath}/tickets`, { _csrf: csrf, channelId: CHANNEL })).status, 403);
  } finally {
    granted.add("ManageChannels");
  }
  assert.equal(ticketPanels.length, 0);
  const ticket = await post(`${pagePath}/tickets`, { _csrf: csrf, channelId: CHANNEL, staffRoleId: ROLE_HIGH, title: "Help" });
  assert.equal(ticket.status, 303);
  assert.equal(ticket.headers.get("location"), `${pagePath}?notice=panel-posted#tickets`);
  assert.deepEqual(ticketPanels[0], { channelId: CHANNEL, staffRoleId: ROLE_HIGH, title: "Help", description: null }, "staff role need not be assignable");

  // Verification
  const unassignable = await post(`${pagePath}/verification`, { _csrf: csrf, channelId: CHANNEL, verifiedRoleId: ROLE_HIGH, type: "button" });
  assert.equal(unassignable.status, 400);
  assert.match(await unassignable.text(), /Aegis cannot assign that role/);
  granted.delete("ManageRoles");
  try {
    assert.equal((await post(`${pagePath}/verification`, { _csrf: csrf, channelId: CHANNEL, verifiedRoleId: ROLE, type: "button" })).status, 403);
    assert.equal((await post(`${pagePath}/roles/${PANEL_ID}`, { _csrf: csrf, channelId: CHANNEL })).status, 403);
  } finally {
    granted.add("ManageRoles");
  }
  const verify = await post(`${pagePath}/verification`, { _csrf: csrf, channelId: CHANNEL, verifiedRoleId: ROLE, type: "captcha", kickUnverifiedMinutes: "30" });
  assert.equal(verify.status, 303);
  assert.equal(verify.headers.get("location"), `/dashboard/${GUILD_OK}/settings/verification?notice=verification-posted`);
  assert.deepEqual(verificationPanels[0], { channelId: CHANNEL, verifiedRoleId: ROLE, type: "captcha", kickUnverifiedMinutes: 30, title: null, description: null });

  // Role panels
  const repost = await post(`${pagePath}/roles/${PANEL_ID}`, { _csrf: csrf, channelId: CHANNEL_2 });
  assert.equal(repost.status, 303);
  assert.equal(repost.headers.get("location"), `${pagePath}?notice=rolepanel-posted#roles`);
  assert.deepEqual(rolePanelPosts[0], { id: PANEL_ID, channelId: CHANNEL_2 });
  const gone = await post(`${pagePath}/roles/panel-gone`, { _csrf: csrf, channelId: CHANNEL });
  assert.equal(gone.headers.get("location"), `${pagePath}?notice=panel-not-found#roles`);
  assert.equal((await post(`${pagePath}/roles/..%2Fetc`, { _csrf: csrf, channelId: CHANNEL })).status, 404);
  const badChannel = await post(`${pagePath}/roles/${PANEL_ID}`, { _csrf: csrf, channelId: "999999999999999999" });
  assert.equal(badChannel.headers.get("location"), `${pagePath}?notice=panel-channel-missing#roles`);
  assert.equal(rolePanelPosts.length, 1);
  assert.equal((await post(`/dashboard/${GUILD_DEMOTED}/panels/tickets`, { _csrf: csrf, channelId: CHANNEL })).status, 403);
});

test("role hierarchy: pickers and server-side validation stop roles at or above the viewer's highest role", async () => {
  await login();
  const pagePath = `/dashboard/${GUILD_OK}/panels`;
  const csrf = await csrfFrom(pagePath);
  const html = await (await get(pagePath)).text();
  assert.ok(html.includes(`<option value="${ROLE_ABOVE_YOU}" disabled>@Senior Mod (above your highest role)</option>`), "role above viewer greyed out");
  assert.ok(html.includes(`<option value="${ROLE}">@Verified</option>`), "role below both stays pickable");
  assert.ok(html.includes(`<option value="${ROLE_HIGH}" disabled>@Admin (Aegis cannot assign)</option>`));
  assert.match(html, /data-rolepanel-blocked/, "role panel with a higher role explains why it cannot be re-posted");

  // The form is never trusted: posting the greyed-out role directly is refused.
  const before = verificationPanels.length;
  const forged = await post(`${pagePath}/verification`, { _csrf: csrf, channelId: CHANNEL, verifiedRoleId: ROLE_ABOVE_YOU, type: "button" });
  assert.equal(forged.status, 400);
  const forgedHtml = await forged.text();
  assert.match(forgedHtml, /equal to or above your highest role/);
  assert.ok(forgedHtml.includes(`<option value="${CHANNEL}" selected>`), "entered channel kept on the error page");
  assert.equal(verificationPanels.length, before);

  const welcome = await post(`/dashboard/${GUILD_OK}/settings/welcome`, { _csrf: csrf, welcomeMessage: "Hi {user}", welcomeRoleId: ROLE_ABOVE_YOU });
  assert.equal(welcome.status, 400);
  assert.match(await welcome.text(), /equal to or above your highest role/);

  // Re-posting a role panel that hands out a higher role is refused.
  const posts = rolePanelPosts.length;
  const repost = await post(`${pagePath}/roles/${PANEL_HIGH}`, { _csrf: csrf, channelId: CHANNEL_2 });
  assert.equal(repost.headers.get("location"), `${pagePath}?notice=rolepanel-above-you#roles`);
  assert.equal(rolePanelPosts.length, posts);

  // A viewer whose member record cannot be fetched gets nothing (fails closed).
  viewerTop.value = null;
  try {
    const unknown = await post(`${pagePath}/verification`, { _csrf: csrf, channelId: CHANNEL, verifiedRoleId: ROLE, type: "button" });
    assert.equal(unknown.status, 400);
    assert.match(await (await get(pagePath)).text(), /data-role-picker-empty/);
  } finally {
    viewerTop.value = 5;
  }

  // The server owner may use any role Aegis can assign.
  viewerIsOwner.value = true;
  try {
    const ok = await post(`${pagePath}/verification`, { _csrf: csrf, channelId: CHANNEL, verifiedRoleId: ROLE_ABOVE_YOU, type: "button" });
    assert.equal(ok.status, 303);
    assert.equal(verificationPanels[verificationPanels.length - 1].verifiedRoleId, ROLE_ABOVE_YOU);
    const ownerRepost = await post(`${pagePath}/roles/${PANEL_HIGH}`, { _csrf: csrf, channelId: CHANNEL_2 });
    assert.equal(ownerRepost.headers.get("location"), `${pagePath}?notice=rolepanel-posted#roles`);
  } finally {
    viewerIsOwner.value = false;
  }
});

test("role panel re-post with no channel picked says so instead of blaming Aegis's access", async () => {
  await login();
  const pagePath = `/dashboard/${GUILD_OK}/panels`;
  const csrf = await csrfFrom(pagePath);
  const blank = await post(`${pagePath}/roles/${PANEL_ID}`, { _csrf: csrf, channelId: "" });
  assert.equal(blank.headers.get("location"), `${pagePath}?notice=panel-pick-channel#roles`);
  assert.match(await (await get(`${pagePath}?notice=panel-pick-channel`)).text(), /Pick a channel to post the role panel to/);
});

test("activity page lists dashboard changes for the server, escaped", async () => {
  await login();
  const path = `/dashboard/${GUILD_OK}/settings/logging`;
  const csrf = await csrfFrom(path);
  const before = audit.all().length;
  await post(path, { _csrf: csrf, loggingEnabled: "on", loggingChannelId: CHANNEL });
  assert.equal(audit.all().length, before + 1, "settings save recorded");
  const entry = audit.all()[audit.all().length - 1];
  assert.equal(entry.action, "settings.logging");
  assert.equal(entry.guildId, GUILD_OK);
  await audit.record({ guildId: GUILD_OK, userId: USER, username: "<script>x</script>", action: "case.revoke", target: CASE_ID, summary: "<img>" });

  const res = await get(`/dashboard/${GUILD_OK}/activity`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Changed logging settings/);
  assert.match(html, /Approved an appeal/);
  assert.ok(html.includes("&lt;script&gt;x&lt;/script&gt;") && !html.includes("<script>x</script>"));
  assert.ok(html.includes("&lt;img&gt;"));
  assert.equal((await get(`/dashboard/${GUILD_DEMOTED}/activity`)).status, 403);
  assert.equal((await get(`/dashboard/${GUILD_OK}/activity?page=-1`)).status, 200);
});

test("every guild page carries the server nav and the dashboard version", async () => {
  await login();
  for (const path of ["", "/cases", "/appeals", "/panels", "/settings/automod", "/activity"]) {
    const html = await (await get(`/dashboard/${GUILD_OK}${path}`)).text();
    for (const section of ["cases", "appeals", "panels", "settings", "activity"]) {
      assert.ok(html.includes(`href="/dashboard/${GUILD_OK}/${section}"`), `${path}: nav to ${section}`);
    }
    assert.ok(html.includes(`Dashboard v${DASHBOARD_VERSION}`), `${path}: dashboard version`);
  }
});

test("rate limits go through the injected shared store", async () => {
  const calls: string[] = [];
  const deny: RateLimitStore = {
    async hit(bucket, _key, limit) {
      calls.push(`${bucket}:${limit}`);
      return { allowed: false, retryAfterSeconds: 17 };
    },
  };
  const config = readDashboardConfig({
    DISCORD_APPLICATION_ID: "123456789012345678",
    DISCORD_CLIENT_SECRET: "test-client-secret",
    DASHBOARD_SESSION_SECRET: "s".repeat(64),
    DASHBOARD_REDIRECT_URI: "http://127.0.0.1/dashboard/callback",
  });
  const app = express();
  app.use("/dashboard", createDashboardRouter({ site, config, bot, data, sessions, rateLimits: deny }));
  const srv = app.listen(0);
  await new Promise(r => srv.once("listening", r));
  try {
    const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
    const page = await fetch(`${url}/dashboard`, { redirect: "manual" });
    assert.equal(page.status, 429);
    assert.equal(page.headers.get("retry-after"), "17");
    const login = await fetch(`${url}/dashboard/login`, { redirect: "manual" });
    assert.equal(login.status, 429);
    const form = await fetch(`${url}/dashboard/logout`, { method: "POST", redirect: "manual" });
    assert.equal(form.status, 429);
    assert.deepEqual(calls, ["page:240", "auth:20", "post:30"], "default limits unchanged");
  } finally {
    srv.close();
  }
});

test("hidden (obfuscated) channels: never offered, saved ones explained, picks refused", async () => {
  await login();
  const path = `/dashboard/${GUILD_OK}/settings/logging`;
  const previous = snapshot.guild.loggingChannelId;
  snapshot.guild.loggingChannelId = HIDDEN_CHANNEL;
  try {
    const html = await (await get(path)).text();
    assert.ok(!html.includes(`value="${HIDDEN_CHANNEL}"`), "hidden channel is not a picker option");
    assert.ok(!html.includes("___hidden___"));
    assert.match(html, /Aegis can&#39;t see the saved log channel|Aegis can't see the saved log channel/);
    assert.match(html, /View Channel/);
  } finally {
    snapshot.guild.loggingChannelId = previous;
  }
  const csrf = await csrfFrom(path);
  const before = saved.length;
  const refused = await post(path, { _csrf: csrf, loggingEnabled: "on", loggingChannelId: HIDDEN_CHANNEL });
  assert.equal(refused.status, 400);
  assert.match(await refused.text(), /give Aegis the View Channel permission there/i);
  assert.equal(saved.length, before, "nothing saved");
});

test("automod POST accepts the advertised maximum word list (500 × 100 characters)", async () => {
  await login();
  const path = `/dashboard/${GUILD_OK}/settings/automod`;
  const page = await (await get(path)).text();
  const max = Number(page.match(/<textarea id="f-words_list" name="words_list" maxlength="(\d+)"/)?.[1]);
  assert.ok(max >= 500 * 100 + 499, `textarea maxlength ${max} fits the full list`);
  const csrf = await csrfFrom(path);

  const word = (i: number, fill: string) => `w${i}`.padEnd(100, fill);
  const ascii = Array.from({ length: 500 }, (_, i) => word(i, "x")).join("\r\n");
  const okAscii = await post(path, { _csrf: csrf, ...automodBase, words_enabled: "on", words_list: ascii });
  assert.equal(okAscii.status, 303, "ASCII list saves");
  assert.equal(lastSaved("automod").words.list.length, 500);

  // Multi-byte text URL-encodes to several bytes per character; the full list must still fit.
  const accented = Array.from({ length: 500 }, (_, i) => word(i, "é")).join("\r\n");
  const okAccented = await post(path, { _csrf: csrf, ...automodBase, words_enabled: "on", words_list: accented });
  assert.equal(okAccented.status, 303, "multi-byte list saves");
  assert.equal(lastSaved("automod").words.list.length, 500);

  const tooMany = await post(path, { _csrf: csrf, ...automodBase, words_list: Array.from({ length: 501 }, (_, i) => word(i, "x")).join("\n") });
  assert.equal(tooMany.status, 400);

  // Still bounded: a body far over the limit is refused before parsing.
  const huge = await post(path, { _csrf: csrf, ...automodBase, words_list: "ab\n".repeat(400_000) });
  assert.equal(huge.status, 413);
  // Other dashboard forms keep the small limit.
  const bigLogging = await post(`/dashboard/${GUILD_OK}/settings/logging`, { _csrf: csrf, loggingChannelId: CHANNEL, pad: "x".repeat(40_000) });
  assert.equal(bigLogging.status, 413);
});

// Runs last: it uses up the auth limit for this client.
test("auth routes are rate limited", async () => {
  jar = {};
  let limited = false;
  for (let i = 0; i < 60 && !limited; i++) {
    const res = await get("/dashboard/login", { cookies: false });
    if (res.status === 429) {
      limited = true;
      assert.ok(Number(res.headers.get("retry-after")) > 0);
    }
  }
  assert.ok(limited, "429 after the auth limit");
});
