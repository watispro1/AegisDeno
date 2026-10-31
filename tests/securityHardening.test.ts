/**
 * 3.6.2 security hardening: response headers and CSP, error handling that
 * leaks nothing, NoSQL-operator input, open redirects, __Host- cookies with
 * migration from the old name, session rotation on login, CSRF, secret
 * redaction in logs and the bot's allowedMentions default. No network.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { PermissionFlagsBits } from "discord.js";
import { CONTENT_SECURITY_POLICY, clientIp, isCrossOriginResource, safeLocalPath, secretMatches, securityHeaders } from "../src/web/securityHeaders";
import { escapeRegex, hasOperatorKeys, safeQueryString } from "../src/utils/mongoSafe";
import { redactSecrets } from "../src/utils/logger";
import { DEFAULT_ALLOWED_MENTIONS } from "../src/bot/mentions";
import { createDashboardRouter } from "../src/web/dashboard/router";
import { readDashboardConfig } from "../src/web/dashboard/config";
import { memorySessionStore } from "../src/web/dashboard/sessions";
import { HOST_SESSION_COOKIE, HOST_STATE_COOKIE, SESSION_COOKIE, cookieNames, signSessionId, SESSION_TTL_MS } from "../src/web/dashboard/security";
import type { BotView } from "../src/web/dashboard/botView";
import type { DashboardData } from "../src/web/dashboard/data";
import type { SiteConfig } from "../src/web/pages";

/* ── Headers ─────────────────────────────────────────────────────────── */

test("CSP: no unsafe-inline or unsafe-eval anywhere, framing and plugins blocked", () => {
  assert.ok(!CONTENT_SECURITY_POLICY.includes("unsafe-inline"));
  assert.ok(!CONTENT_SECURITY_POLICY.includes("unsafe-eval"));
  for (const d of ["default-src 'self'", "script-src 'self'", "style-src 'self'", "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'", "form-action 'self'"]) {
    assert.ok(CONTENT_SECURITY_POLICY.includes(d), d);
  }
});

test("security headers: HSTS, nosniff, frame denial, referrer, permissions and isolation", () => {
  const h = securityHeaders("/");
  assert.match(h["Strict-Transport-Security"], /max-age=\d{8,}; includeSubDomains/);
  assert.equal(h["X-Content-Type-Options"], "nosniff");
  assert.equal(h["X-Frame-Options"], "DENY");
  assert.equal(h["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.match(h["Permissions-Policy"], /camera=\(\)/);
  assert.ok(!h["Permissions-Policy"].includes("interest-cohort"), "deprecated directive dropped");
  assert.equal(h["Cross-Origin-Opener-Policy"], "same-origin");
  assert.equal(h["Cross-Origin-Resource-Policy"], "same-origin");
  assert.equal(securityHeaders("/api/stats")["Cross-Origin-Resource-Policy"], "cross-origin");
  assert.ok(isCrossOriginResource("/assets/og.png"));
  assert.ok(!isCrossOriginResource("/assets/site.js"));
});

test("helpers: constant-time secret check, client IP from Fly, local-only redirect paths", () => {
  assert.equal(secretMatches("abc", "abc"), true);
  assert.equal(secretMatches("abd", "abc"), false);
  assert.equal(secretMatches(["abc"], "abc"), false);
  assert.equal(secretMatches("abc", ""), false);
  assert.equal(clientIp({ headers: { "fly-client-ip": "203.0.113.5" }, ip: "10.0.0.1" }), "203.0.113.5");
  assert.equal(clientIp({ headers: {}, ip: "10.0.0.1" }), "10.0.0.1");
  assert.equal(safeLocalPath("/commands#cmd-ban"), "/commands#cmd-ban");
  for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "/a\r\nSet-Cookie: x"]) assert.equal(safeLocalPath(bad), "/", bad);
});

test("NoSQL input: operator keys at any depth are detected; only plain strings pass", () => {
  assert.equal(hasOperatorKeys({ user: "1" }), false);
  assert.equal(hasOperatorKeys({ user: { $ne: null } }), true);
  assert.equal(hasOperatorKeys({ $where: "1" }), true);
  assert.equal(hasOperatorKeys({ "a.b": "x" }), true);
  assert.equal(hasOperatorKeys({ list: [{ $gt: "" }] }), true);
  assert.equal(hasOperatorKeys(undefined), false);
  assert.equal(safeQueryString("AGS-K7X2"), "AGS-K7X2");
  assert.equal(safeQueryString({ $ne: null }), null);
  assert.equal(safeQueryString(["a"]), null);
  assert.equal(safeQueryString("x".repeat(500)), null);
  assert.equal(new RegExp(escapeRegex("a.*b")).test("a.*b"), true);
  assert.equal(new RegExp(escapeRegex("a.*b")).test("axxb"), false);
});

test("logs: secrets, connection-string passwords and tokens are redacted", () => {
  const env = { DISCORD_TOKEN: "super-secret-token-value", MONGO_URI: "" } as NodeJS.ProcessEnv;
  assert.ok(!redactSecrets("login with super-secret-token-value failed", env).includes("super-secret-token-value"));
  assert.equal(redactSecrets("mongodb+srv://aegis:hunter22@cluster0.example.net/db", env), "mongodb+srv://[redacted]@cluster0.example.net/db");
  // Built at runtime so secret scanners don't flag a token-shaped literal in the repo.
  const fakeToken = [Buffer.from("123456789012345678").toString("base64"), "Gab" + "cDE", "x".repeat(20) + "0123456789abcdef"].join(".");
  assert.ok(!redactSecrets(`token ${fakeToken}`, env).includes(fakeToken));
  assert.equal(redactSecrets("Authorization: Bearer abcdefghijklmnopqrstuvwxyz", env), "Authorization: Bearer [redacted]");
  assert.equal(redactSecrets("Guild 123456789012345678 joined", env), "Guild 123456789012345678 joined", "IDs are left alone");
});

test("bot: allowedMentions default lets user mentions through but never @everyone, @here or roles", () => {
  assert.deepEqual(DEFAULT_ALLOWED_MENTIONS.parse, ["users"]);
  assert.equal(DEFAULT_ALLOWED_MENTIONS.roles, undefined);
});

/* ── Site error handler ─────────────────────────────────────────────── */

test("site error handler: generic body, no message or stack trace", async () => {
  const { siteErrorHandler } = await import("../src/web/server");
  const app = express();
  app.get("/boom", () => { throw new Error("db password is hunter2 at /app/src/x.ts:1"); });
  app.get("/api/boom", () => { throw new Error("internal detail"); });
  app.use(siteErrorHandler);
  const srv = app.listen(0);
  await new Promise(r => srv.once("listening", r));
  const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  try {
    const page = await fetch(`${url}/boom`);
    const body = await page.text();
    assert.equal(page.status, 500);
    assert.ok(!body.includes("hunter2") && !body.includes(".ts:"), body);
    const api = await fetch(`${url}/api/boom`);
    assert.deepEqual(await api.json(), { error: "server_error" });
  } finally {
    srv.close();
  }
});

/* ── Dashboard over https: __Host- cookies, migration, rotation, CSRF, operators ── */

const USER = "900000000000000001";
const GUILD = "800000000000000001";
const TOKEN = "fake-access-token";
const SECRET = "k".repeat(64);
const site: SiteConfig = { inviteUrl: "https://discord.com/oauth2/authorize?client_id=1", supportUrl: "", version: "test", contactEmail: "", assetVersion: "t" };
const bot: BotView = {
  hasGuild: id => id === GUILD,
  guild: id => (id === GUILD ? { id, name: "Test", memberCount: 2 } : null),
  memberCanManage: async (g, u) => g === GUILD && u === USER,
  memberHasPermission: async () => true,
  textChannels: () => [],
  hiddenChannelIds: () => new Set(),
  roles: () => [],
  viewerRoleLimit: async () => ({ ownerId: USER, topPosition: 1 }),
  userName: () => "aj",
};
const listCalls: unknown[] = [];
const data = {
  overview: async () => ({ cases7: 0, cases30: 0, warnings7: 0, warnings30: 0, recentCases: [], openTicketCount: 0, openTickets: [], pendingAppeals: 0 }),
  listCases: async (_g: string, filter: unknown) => { listCalls.push(filter); return { items: [], total: 0 }; },
  getCase: async () => null,
} as unknown as DashboardData;
const fakeFetch = async (url: string, init?: RequestInit): Promise<Response> => {
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
  if (url.endsWith("/oauth2/token")) return json({ access_token: TOKEN, expires_in: 3600, scope: "identify guilds" });
  if (String((init?.headers as Record<string, string>)?.Authorization) !== `Bearer ${TOKEN}`) return json({}, 401);
  if (url.endsWith("/users/@me")) return json({ id: USER, username: "aj", global_name: null });
  if (url.endsWith("/users/@me/guilds")) return json([{ id: GUILD, name: "Test", icon: null, owner: true, permissions: PermissionFlagsBits.Administrator.toString() }]);
  return json({}, 404);
};

const sessions = memorySessionStore();
let server: Server;
let base = "";
let jar: Record<string, string> = {};

function store(res: Response): string[] {
  const lines = res.headers.getSetCookie();
  for (const line of lines) {
    const [pair] = line.split(";");
    const eq = pair.indexOf("=");
    if (/Max-Age=0/.test(line)) delete jar[pair.slice(0, eq)];
    else jar[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return lines;
}
const cookieHeader = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
async function get(path: string): Promise<{ res: Response; setCookies: string[] }> {
  const res = await fetch(base + path, { redirect: "manual", headers: Object.keys(jar).length ? { Cookie: cookieHeader() } : {} });
  return { res, setCookies: store(res) };
}
async function post(path: string, form: Record<string, string>): Promise<Response> {
  const res = await fetch(base + path, {
    method: "POST", redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...(Object.keys(jar).length ? { Cookie: cookieHeader() } : {}) },
    body: new URLSearchParams(form).toString(),
  });
  store(res);
  return res;
}
async function login(): Promise<void> {
  const { res } = await get("/dashboard/login");
  const state = new URL(res.headers.get("location") ?? "").searchParams.get("state") ?? "";
  const cb = await get(`/dashboard/callback?code=ok&state=${encodeURIComponent(state)}`);
  assert.equal(cb.res.status, 302);
}

before(async () => {
  const config = readDashboardConfig({
    DISCORD_APPLICATION_ID: "123456789012345678",
    DISCORD_CLIENT_SECRET: "client-secret",
    DASHBOARD_SESSION_SECRET: SECRET,
    DASHBOARD_REDIRECT_URI: "https://aegis.example/dashboard/callback",
  });
  assert.ok(config?.secureCookies);
  const app = express();
  app.use("/dashboard", createDashboardRouter({ site, config, bot, data, sessions, fetchImpl: fakeFetch as typeof fetch, limits: { auth: 500, post: 500, page: 500 } }));
  server = app.listen(0);
  await new Promise(r => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => server.close());

test("https dashboard: cookies use the __Host- prefix with Secure, Path=/ and no Domain", async () => {
  jar = {};
  assert.deepEqual(cookieNames(true), { session: HOST_SESSION_COOKIE, state: HOST_STATE_COOKIE, path: "/" });
  const { setCookies } = await get("/dashboard/login");
  const state = setCookies.find(c => c.startsWith(`${HOST_STATE_COOKIE}=`)) ?? "";
  for (const part of ["Path=/;", "HttpOnly", "SameSite=Lax", "Secure"]) assert.ok(state.includes(part), part);
  assert.ok(!/Domain=/i.test(state));
  jar = {};
  await login();
  assert.ok(jar[HOST_SESSION_COOKIE], "session cookie under the new name");
  assert.equal(jar[SESSION_COOKIE], undefined);
});

test("login rotates the session: the browser's previous session is destroyed", async () => {
  jar = {};
  await login();
  const first = jar[HOST_SESSION_COOKIE];
  const before = sessions.size();
  await login();
  assert.notEqual(jar[HOST_SESSION_COOKIE], first, "a new session ID");
  assert.equal(sessions.size(), before, "the old session was deleted, not kept alongside");
});

test("an old aegis_dash cookie is migrated to __Host-aegis_dash without signing the user out", async () => {
  const sid = "legacySessionId0123456789abcdef";
  const now = Date.now();
  await sessions.create(sid, {
    userId: USER, username: "aj", globalName: null, accessToken: TOKEN, tokenExpiresAt: new Date(now + 3600_000),
    guilds: [{ id: GUILD, name: "Test", icon: null, owner: true, permissions: PermissionFlagsBits.Administrator.toString() }],
    guildsFetchedAt: new Date(now), createdAt: new Date(now), expiresAt: new Date(now + SESSION_TTL_MS),
  });
  jar = { [SESSION_COOKIE]: encodeURIComponent(signSessionId(SECRET, sid)) };
  const { res, setCookies } = await get("/dashboard");
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Signed in as/);
  assert.ok(setCookies.some(c => c.startsWith(`${HOST_SESSION_COOKIE}=`) && c.includes("Path=/;") && c.includes("Secure")));
  assert.ok(setCookies.some(c => c.startsWith(`${SESSION_COOKIE}=;`) && c.includes("Max-Age=0") && c.includes("Path=/dashboard")));
  assert.equal(jar[SESSION_COOKIE], undefined);
  assert.ok(jar[HOST_SESSION_COOKIE]);

  // A forged legacy cookie is cleared and grants nothing.
  jar = { [SESSION_COOKIE]: "forged.signature" };
  const forged = await get("/dashboard");
  assert.match(await forged.res.text(), /Log in with Discord/);
  assert.equal(jar[HOST_SESSION_COOKIE], undefined);
});

test("operator-looking query keys and form fields are refused before reaching the database", async () => {
  jar = {};
  await login();
  listCalls.length = 0;
  const q = await get(`/dashboard/${GUILD}/cases?user[$ne]=1&$where=1`);
  assert.equal(q.res.status, 400);
  assert.equal(listCalls.length, 0);
  const ok = await get(`/dashboard/${GUILD}/cases?user=123`);
  assert.equal(ok.res.status, 200);
  const html = await (await get("/dashboard")).res.text();
  const csrf = html.match(/name="_csrf" value="([^"]+)"/)?.[1] ?? "";
  assert.ok(csrf);
  const res = await post("/dashboard/refresh", { _csrf: csrf, $where: "1" });
  assert.equal(res.status, 400);
});

test("CSRF: mutating routes refuse a missing or foreign token", async () => {
  jar = {};
  await login();
  assert.equal((await post("/dashboard/refresh", {})).status, 403);
  assert.equal((await post("/dashboard/refresh", { _csrf: "x".repeat(43) })).status, 403);
  assert.equal((await post("/dashboard/logout", {})).status, 403);
  assert.ok(jar[HOST_SESSION_COOKIE], "still signed in after a refused logout");
});
