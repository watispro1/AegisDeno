/**
 * Dashboard 1.2.3 fixes and UX: database outages as 503s, rate-limit and
 * signed-out wording, empty-picker explanations, the double-submit guard,
 * disabled styling. The router runs with fakes; no network, no Mongo.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import express from "express";
import { createDashboardRouter } from "../src/web/dashboard/router";
import { readDashboardConfig } from "../src/web/dashboard/config";
import { memorySessionStore, type SessionStore } from "../src/web/dashboard/sessions";
import { SESSION_COOKIE, signSessionId } from "../src/web/dashboard/security";
import type { BotView } from "../src/web/dashboard/botView";
import type { DashboardData } from "../src/web/dashboard/data";
import { DATABASE_RETRY_AFTER_SECONDS, isDatabaseUnavailable, rateLimitMessage } from "../src/web/dashboard/routes/context";
import { channelPickerEmptyNote } from "../src/web/dashboard/views/form";
import { renderPanels, renderSettings, type GuildContext } from "../src/web/dashboard/views";
import { dashboardScript } from "../src/web/dashboard/client";
import { styles } from "../src/web/theme";
import type { SiteConfig } from "../src/web/pages";

const site: SiteConfig = { inviteUrl: "https://discord.com/oauth2/authorize?client_id=1", supportUrl: "", version: "test", contactEmail: "x@example.com", assetVersion: "test" };
const USER = "900000000000000001";
const GUILD = "800000000000000001";
const SECRET = "s".repeat(64);
const SID = "test-session-id-0123456789";
const config = readDashboardConfig({
  DISCORD_APPLICATION_ID: "123456789012345678",
  DISCORD_CLIENT_SECRET: "test-client-secret",
  DASHBOARD_SESSION_SECRET: SECRET,
  DASHBOARD_REDIRECT_URI: "http://127.0.0.1/dashboard/callback",
});

function mongoError(name: string, message = "connection failed"): Error {
  const err = new Error(message);
  err.name = name;
  return err;
}

const bot: BotView = {
  hasGuild: id => id === GUILD,
  guild: id => (id === GUILD ? { id, name: "G", memberCount: 3 } : null),
  memberCanManage: async () => true,
  memberHasPermission: async () => true,
  textChannels: () => [],
  hiddenChannelIds: () => new Set(["700000000000000050", "700000000000000051"]),
  roles: () => [{ id: "600000000000000001", name: "Verified", position: 1, assignable: true }],
  viewerRoleLimit: async () => ({ ownerId: USER, topPosition: 2 }),
  userName: () => null,
};

const down = () => Promise.reject(mongoError("MongooseServerSelectionError"));
const data = new Proxy({}, { get: () => down }) as unknown as DashboardData;

async function withServer(sessions: SessionStore, fn: (base: string) => Promise<void>, overrides: Partial<BotView> = {}): Promise<void> {
  const app = express();
  app.use("/dashboard", createDashboardRouter({ site, config, bot: { ...bot, ...overrides }, data, sessions, limits: { auth: 1000, post: 1000, page: 1000 } }));
  const srv = app.listen(0);
  await new Promise(r => srv.once("listening", r));
  try {
    await fn(`http://127.0.0.1:${(srv.address() as AddressInfo).port}`);
  } finally {
    srv.close();
  }
}

async function signedIn(): Promise<{ sessions: SessionStore; cookie: string }> {
  const sessions = memorySessionStore();
  const at = Date.now();
  await sessions.create(SID, {
    userId: USER, username: "aj", globalName: null, accessToken: "t", tokenExpiresAt: new Date(at + 3_600_000),
    guilds: [], guildsFetchedAt: new Date(at), createdAt: new Date(at), expiresAt: new Date(at + 3_600_000),
  });
  return { sessions, cookie: `${SESSION_COOKIE}=${signSessionId(SECRET, SID)}` };
}

test("isDatabaseUnavailable recognises Mongo outages and nothing else", () => {
  for (const name of ["MongooseServerSelectionError", "MongoServerSelectionError", "MongoNetworkError", "MongoNetworkTimeoutError", "MongoNotConnectedError", "MongoTopologyClosedError"]) {
    assert.ok(isDatabaseUnavailable(mongoError(name)), name);
  }
  assert.ok(isDatabaseUnavailable(new Error("Operation `guildconfigs.findOne()` buffering timed out after 10000ms")));
  assert.ok(!isDatabaseUnavailable(new Error("Cannot read properties of undefined")));
  assert.ok(!isDatabaseUnavailable(mongoError("MongoServerError", "E11000 duplicate key")), "a real query error is a bug, not an outage");
  assert.ok(!isDatabaseUnavailable(null));
  assert.ok(!isDatabaseUnavailable("MongoNetworkError"));
});

test("a database outage is a 503 with Retry-After, not a 500, and keeps the viewer signed in", async () => {
  const { sessions, cookie } = await signedIn();
  await withServer(sessions, async base => {
    const res = await fetch(`${base}/dashboard/${GUILD}`, { headers: { Cookie: cookie }, redirect: "manual" });
    assert.equal(res.status, 503);
    assert.equal(res.headers.get("retry-after"), String(DATABASE_RETRY_AFTER_SECONDS));
    const html = await res.text();
    assert.match(html, /couldn&#39;t reach its database|couldn't reach its database/);
    assert.match(html, /Nothing was changed/);
    assert.match(html, /Signed in as/, "the page still shows who is signed in");
  });
});

test("a session store outage is a 503 too, not a silent sign-out", async () => {
  const sessions = { ...memorySessionStore(), get: () => Promise.reject(mongoError("MongoNetworkError")) } as SessionStore;
  const cookie = `${SESSION_COOKIE}=${signSessionId(SECRET, SID)}`;
  await withServer(sessions, async base => {
    const page = await fetch(`${base}/dashboard/${GUILD}/settings/logging`, { headers: { Cookie: cookie }, redirect: "manual" });
    assert.equal(page.status, 503, "not a redirect to the logged-out landing page");
    const post = await fetch(`${base}/dashboard/${GUILD}/settings/logging`, {
      method: "POST", redirect: "manual", headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" }, body: "_csrf=x",
    });
    assert.equal(post.status, 503, "not \"Signed out\"");
  });
});

test("a form sent after the session ended says nothing was saved and offers to log in", async () => {
  await withServer(memorySessionStore(), async base => {
    const res = await fetch(`${base}/dashboard/${GUILD}/settings/logging`, {
      method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "_csrf=x",
    });
    assert.equal(res.status, 401);
    const html = await res.text();
    assert.match(html, /nothing was saved/);
    assert.ok(html.includes('href="/dashboard/login"'), "log in button");
  });
});

test("a server Aegis is not in offers the invite for that server", async () => {
  const { sessions, cookie } = await signedIn();
  await withServer(sessions, async base => {
    const res = await fetch(`${base}/dashboard/800000000000000077`, { headers: { Cookie: cookie }, redirect: "manual" });
    assert.equal(res.status, 404);
    const html = await res.text();
    assert.match(html, /Add Aegis to this server/);
    assert.ok(html.includes("guild_id=800000000000000077"), "invite preselects the server");
    assert.ok(html.includes("disable_guild_select=true"));
  });
});

test("rate-limit wording: posts say nothing was saved, pages say reload", () => {
  assert.match(rateLimitMessage("POST", 17), /^Nothing was saved\. Wait 17 seconds/);
  assert.match(rateLimitMessage("GET", 1), /^Wait 1 second, then reload/);
});

test("empty channel pickers explain why: hidden channels or none at all", () => {
  assert.equal(channelPickerEmptyNote([{ id: "1", name: "a", parent: null }], new Set(["2"])), "");
  assert.match(channelPickerEmptyNote([], new Set(["2", "3"])), /2 channels are hidden from it.*View Channel/);
  assert.match(channelPickerEmptyNote([], new Set(["2"])), /1 channel is hidden/);
  assert.match(channelPickerEmptyNote([], new Set()), /no text or announcement channels/);
  // Hidden channel IDs are never printed or offered.
  assert.ok(!channelPickerEmptyNote([], new Set(["700000000000000050"])).includes("700000000000000050"));

  const viewer = { userId: USER, username: "aj", globalName: null, csrf: "x" };
  const ctx: GuildContext = { guild: { id: GUILD, name: "G", memberCount: 1 }, viewer, nameOf: () => null };
  const hidden = new Set(["700000000000000050"]);
  const panels = renderPanels(site, ctx, { channels: [], roles: [], rolePanels: [], verificationSetUp: false, missing: { tickets: null, roles: null }, hiddenChannelIds: hidden });
  assert.match(panels, /data-channel-picker-empty/);
  assert.match(panels, /data-role-picker-empty/);
  assert.ok(!panels.includes('value="700000000000000050"'), "hidden channel never offered");
});

test("settings pages show the empty-channel note, except escalation which has no channel picker", () => {
  const viewer = { userId: USER, username: "aj", globalName: null, csrf: "x" };
  const ctx: GuildContext = { guild: { id: GUILD, name: "G", memberCount: 1 }, viewer, nameOf: () => null };
  const snapshot = {
    guild: { loggingEnabled: false, loggingChannelId: null, logCategories: null, escalation: { enabled: false, thresholds: [], warnExpiryDays: null } },
  } as never;
  const logging = renderSettings(site, ctx, "logging", snapshot, { values: {}, errors: {} }, [], [], null, new Set(["1"]));
  assert.match(logging, /data-channel-picker-empty/);
  const escalation = renderSettings(site, ctx, "escalation", snapshot, { values: {}, errors: {} }, [], [], null, new Set(["1"]));
  assert.ok(!escalation.includes("data-channel-picker-empty"));
});

test("dashboard script: parses, guards against double submits without dropping the clicked button, clears ?notice=", () => {
  assert.doesNotThrow(() => new Function(dashboardScript));
  assert.match(dashboardScript, /data-busy/);
  assert.match(dashboardScript, /setTimeout\(function \(\) \{\s*var buttons/, "buttons are disabled after the form data is read");
  assert.match(dashboardScript, /pageshow/, "Back button restores usable forms");
  assert.match(dashboardScript, /replaceState/);
  assert.ok(dashboardScript.includes("replace(/^\\?/, '')"), "regex survives String.raw");
});

test("stylesheet styles disabled buttons and fields", () => {
  assert.ok(/\.btn:disabled[^{]*\{[^}]*opacity/.test(styles));
  assert.ok(/\.dash-form select:disabled/.test(styles));
});
