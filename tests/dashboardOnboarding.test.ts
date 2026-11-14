/** Overview "Get started" checklist, its no-JS Dismiss, the "Recent activity" card and the sidebar Activity link. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { createDashboardRouter } from "../src/web/dashboard/router";
import { readDashboardConfig } from "../src/web/dashboard/config";
import { memorySessionStore } from "../src/web/dashboard/sessions";
import { memoryAuditStore, type AuditEntry } from "../src/web/dashboard/audit";
import { cookieNames, csrfToken, signSessionId } from "../src/web/dashboard/security";
import type { BotView } from "../src/web/dashboard/botView";
import type { DashboardData, OverviewData, SettingsSnapshot } from "../src/web/dashboard/data";
import { normalizeGuildConfig, guildConfigSetPaths } from "../src/services/guildConfigNormalize";
import { normalizeAutomodConfig } from "../src/services/automod";
import { onboardingSteps, showGettingStarted, recentActivityCard } from "../src/web/dashboard/views/gettingStarted";
import type { SiteConfig } from "../src/web/pages";

const GUILD = "800000000000000001";
const USER = "700000000000000001";
const OTHER = "700000000000000002";
const CHANNEL = "900000000000000001";
const SECRET = "s".repeat(64);
const site: SiteConfig = { inviteUrl: "#", supportUrl: "", version: "test", contactEmail: "", assetVersion: "t" };

const emptyOverview: OverviewData = { cases7: 0, cases30: 0, warnings7: 0, warnings30: 0, recentCases: [], openTicketCount: 0, openTickets: [], pendingAppeals: 0 };
const fresh = (): SettingsSnapshot => ({
  guild: normalizeGuildConfig(GUILD),
  automod: normalizeAutomodConfig(GUILD),
  tickets: { logChannelId: null, autoCloseHours: 48, transcriptLogging: true },
  verification: null,
  starboard: { enabled: false, channelId: null, threshold: 3, emoji: "⭐" },
} as unknown as SettingsSnapshot);
const entry = (userId: string, action = "settings.logging"): AuditEntry => ({ guildId: GUILD, userId, username: userId === USER ? "aj" : "mod <b>", action, target: null, summary: "", createdAt: new Date() });

test("steps: done state comes from config; invite is done once someone else used the dashboard", () => {
  const s = fresh();
  let steps = onboardingSteps(GUILD, s, [], USER);
  assert.deepEqual(steps.map(x => x.key), ["logging", "automod", "staff", "trust", "invite"]);
  assert.ok(steps.every(x => !x.done));
  assert.equal(steps[0].href, `/dashboard/${GUILD}/settings/logging`);
  assert.equal(steps[1].href, `/dashboard/${GUILD}/settings/automod`);
  s.guild.loggingEnabled = true; s.guild.loggingChannelId = CHANNEL;
  (s.automod as unknown as Record<string, { enabled: boolean }>).spam = { ...(s.automod as never as Record<string, object>).spam, enabled: true };
  s.guild.modmail = { ...s.guild.modmail!, staffRoleId: "600000000000000001" };
  s.guild.trust = { ...s.guild.trust!, enabled: true };
  steps = onboardingSteps(GUILD, s, [entry(USER), entry(OTHER)], USER);
  assert.ok(steps.every(x => x.done), JSON.stringify(steps.filter(x => !x.done)));
  assert.equal(onboardingSteps(GUILD, s, [entry(USER)], USER)[4].done, false);
});

test("visibility: new server shows it; dismissed, all done or no snapshot hides it", () => {
  const s = fresh();
  const steps = onboardingSteps(GUILD, s, [], USER);
  assert.equal(showGettingStarted(s, emptyOverview, steps), true);
  assert.equal(showGettingStarted(null, emptyOverview, steps), false);
  assert.equal(showGettingStarted({ ...s, guild: { ...s.guild, onboardingDismissed: true } }, emptyOverview, steps), false);
  assert.equal(showGettingStarted(s, emptyOverview, steps.map(x => ({ ...x, done: true }))), false);
});

test("config: the dismiss flag defaults off, normalises and saves as a flat path", () => {
  assert.equal(normalizeGuildConfig(GUILD).onboardingDismissed, false);
  assert.equal(normalizeGuildConfig(GUILD, { onboardingDismissed: true }).onboardingDismissed, true);
  assert.equal(normalizeGuildConfig(GUILD, { onboardingDismissed: "yes" as never }).onboardingDismissed, false);
  assert.deepEqual(guildConfigSetPaths({ onboardingDismissed: true }), { onboardingDismissed: true });
});

test("recent activity card: five newest, escaped, links to the full log; handles empty and failed reads", () => {
  const html = recentActivityCard(GUILD, Array.from({ length: 8 }, () => entry(OTHER)));
  assert.equal((html.match(/<li>/g) ?? []).length, 5);
  assert.match(html, /mod &lt;b&gt;/);
  assert.match(html, new RegExp(`href="/dashboard/${GUILD}/activity"`));
  assert.match(recentActivityCard(GUILD, []), /No dashboard changes yet/);
  assert.match(recentActivityCard(GUILD, null), /couldn't be loaded/);
});

/* Routes */

let snapshot = fresh();
let dismissed = 0;
const data = {
  overview: async () => emptyOverview,
  loadSettings: async () => snapshot,
  listRolePanels: async () => [],
  dismissOnboarding: async (g: string) => { assert.equal(g, GUILD); dismissed++; snapshot = { ...snapshot, guild: { ...snapshot.guild, onboardingDismissed: true } }; },
} as unknown as DashboardData;
const bot: BotView = {
  hasGuild: id => id === GUILD,
  guild: id => (id === GUILD ? { id, name: "Test", memberCount: 10, iconUrl: null } : null),
  memberCanManage: async (g, u) => g === GUILD && u === USER,
  memberHasPermission: async () => true,
  textChannels: () => [], hiddenChannelIds: () => new Set(),
  roles: () => [],
  viewerRoleLimit: async () => ({ ownerId: "1", topPosition: 5 }),
  userName: () => null,
};
const audit = memoryAuditStore();
let server: Server, url = "", cookie = "", csrf = "";

before(async () => {
  const config = readDashboardConfig({ DISCORD_APPLICATION_ID: "123456789012345678", DISCORD_CLIENT_SECRET: "x", DASHBOARD_SESSION_SECRET: SECRET, DASHBOARD_REDIRECT_URI: "http://127.0.0.1/dashboard/callback" });
  assert.ok(config);
  const sessions = memorySessionStore();
  const sid = "session-id-for-onboarding-tests-01";
  const now = Date.now();
  await sessions.create(sid, { userId: USER, username: "aj", globalName: "AJ", avatar: null, accessToken: "t", tokenExpiresAt: new Date(now + 1e9), guilds: [{ id: GUILD, name: "Test", icon: null, owner: false, permissions: "32" }], guildsFetchedAt: new Date(now), createdAt: new Date(now), expiresAt: new Date(now + 1e9) });
  cookie = `${cookieNames(config.secureCookies).session}=${encodeURIComponent(signSessionId(SECRET, sid))}`;
  csrf = csrfToken(SECRET, sid);
  await audit.record({ guildId: GUILD, userId: OTHER, username: "mod <b>", action: "settings.automod", target: null, summary: "" });
  const app = express();
  app.use("/dashboard", createDashboardRouter({ site, config, bot, data, sessions, audit, limits: { auth: 100, post: 1000, page: 2000 } }));
  server = app.listen(0);
  await new Promise(r => server.once("listening", r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

const get = (p: string) => fetch(url + p, { redirect: "manual", headers: { Cookie: cookie } });
const post = (p: string, form: Record<string, string>, withCsrf = true) =>
  fetch(url + p, { method: "POST", redirect: "manual", headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(withCsrf ? { _csrf: csrf, ...form } : form).toString() });

test("overview: new server shows Get started (no-JS form with CSRF) and Recent activity", async () => {
  const res = await get(`/dashboard/${GUILD}`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<h2 id="get-started-h">Get started<\/h2>/);
  assert.match(html, /1 of 5 done/, "invite is done: another staff member saved something");
  assert.match(html, new RegExp(`<form method="post" action="/dashboard/${GUILD}/onboarding/dismiss"[^>]*><input type="hidden" name="_csrf" value="${csrf}">`));
  assert.match(html, /<h2 id="recent-activity-h">Recent activity<\/h2>/);
  assert.match(html, /mod &lt;b&gt;<\/strong>: Changed automod/);
  assert.doesNotMatch(html, /style="|onclick=|<script>(?!<\/script>)/);
});

test("dismiss: needs CSRF, stores the flag, audits it and hides the card", async () => {
  assert.equal((await post(`/dashboard/${GUILD}/onboarding/dismiss`, {}, false)).status, 403);
  assert.equal(dismissed, 0);
  const ok = await post(`/dashboard/${GUILD}/onboarding/dismiss`, {});
  assert.equal(ok.status, 303);
  assert.equal(ok.headers.get("location"), `/dashboard/${GUILD}?notice=onboarding-dismissed`);
  assert.equal(dismissed, 1);
  const { items } = await audit.list(GUILD, { page: 1, perPage: 10 });
  assert.ok(items.some(e => e.action === "onboarding.dismiss" && e.userId === USER));
  const html = await (await get(`/dashboard/${GUILD}?notice=onboarding-dismissed`)).text();
  assert.doesNotMatch(html, /id="get-started-h"/);
  assert.match(html, /Get started checklist hidden/);
  assert.match(html, /id="recent-activity-h"/);
});
