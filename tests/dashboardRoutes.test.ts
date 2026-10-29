/**
 * End-to-end run of the /dashboard router with a fake bot, in-memory sessions
 * and a mocked Discord OAuth API. No network, no Mongo.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { PermissionFlagsBits } from "discord.js";
import { createDashboardRouter } from "../src/web/dashboard/router";
import { readDashboardConfig } from "../src/web/dashboard/config";
import { memorySessionStore } from "../src/web/dashboard/sessions";
import type { BotView } from "../src/web/dashboard/botView";
import type { CaseRecord, DashboardData, SettingsSnapshot, SettingsValue } from "../src/web/dashboard/data";
import type { SiteConfig } from "../src/web/pages";

const USER = "900000000000000001";
const GUILD_OK = "800000000000000001";
const GUILD_DEMOTED = "800000000000000002"; // listed as manageable at login, but the live check says no
const GUILD_NO_BOT = "800000000000000003";
const CHANNEL = "700000000000000001";
const ROLE = "600000000000000001";
const CASE_ID = "65a1b2c3d4e5f60718293a4b";
const TOKEN = "fake-access-token-never-logged";

const site: SiteConfig = { inviteUrl: "https://discord.com/oauth2/authorize?client_id=1", supportUrl: "", version: "test", contactEmail: "x@example.com", assetVersion: "test" };

const saved: SettingsValue[] = [];
const edits: Array<{ id: string; reason: string; by: string }> = [];
const revokes: string[] = [];
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
  textChannels: () => [{ id: CHANNEL, name: "mod-log", parent: "Staff" }],
  roles: () => [{ id: ROLE, name: "Verified", assignable: true }],
  userName: id => (id === USER ? "aj" : null),
};

const snapshot: SettingsSnapshot = {
  guild: {
    guildId: GUILD_OK, prefix: "!", language: "en", loggingEnabled: false, loggingChannelId: null, logCategories: null,
    welcomeEnabled: false, welcomeChannelId: null, welcomeMessage: "Welcome {user}", welcomeRoleId: null, suggestionsChannelId: null,
    escalation: { enabled: false, thresholds: [], warnExpiryDays: null },
  },
  automod: {
    guildId: GUILD_OK,
    words: { enabled: false, action: "delete", list: ["a"] },
    links: { enabled: false, action: "delete" },
    mentions: { enabled: false, action: "timeout", threshold: 5 },
    spam: { enabled: false, action: "timeout", maxMessages: 5, windowSeconds: 5 },
    caps: { enabled: false, action: "delete", threshold: 80 },
    exemptRoleIds: [], exemptChannelIds: [],
  },
  tickets: { logChannelId: null, autoCloseHours: 48, transcriptLogging: true },
  verification: null,
  starboard: { guildId: GUILD_OK, channelId: null, emoji: "⭐", threshold: 3, selfStar: false, ignoredChannels: [], ignoredRoles: [], enabled: true },
};

const data: DashboardData = {
  overview: async () => ({ cases7: 1, cases30: 2, warnings7: 3, warnings30: 4, recentCases: [record], openTicketCount: 0, openTickets: [], pendingAppeals: 1 }),
  listCases: async () => ({ items: [record], total: 1 }),
  getCase: async (_g, id) => (id === CASE_ID ? record : null),
  editCaseReason: async (_g, id, reason, actor) => { edits.push({ id, reason, by: actor.userId }); return true; },
  revokeCase: async (_g, id) => { revokes.push(id); return true; },
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
  app.use("/dashboard", createDashboardRouter({ site, config, bot, data, sessions, fetchImpl: fakeFetch as typeof fetch, limits: { auth: 40 } }));
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
