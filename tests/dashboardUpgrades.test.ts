/**
 * Dashboard upgrade round (1.2.3): avatars and icons, command palette, global
 * search, member lookup with quick actions, analytics, Incident Mode pages,
 * module switches, settings export/import and the scheduled-message embed.
 * Runs the real router with fakes; no network, no Mongo.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { createDashboardRouter } from "../src/web/dashboard/router";
import { readDashboardConfig } from "../src/web/dashboard/config";
import { memorySessionStore } from "../src/web/dashboard/sessions";
import { memoryAuditStore } from "../src/web/dashboard/audit";
import { cookieNames, csrfToken, signSessionId } from "../src/web/dashboard/security";
import type { BotView, DashboardPermission } from "../src/web/dashboard/botView";
import type { CaseRecord, DashboardData, SettingsSnapshot } from "../src/web/dashboard/data";
import { memoryDashboardExtras, memberActionRefusal, type MemberProfile } from "../src/web/dashboard/extras";
import { CONTENT_SECURITY_POLICY } from "../src/web/securityHeaders";
import { guildIconUrl, userAvatarUrl, isDiscordCdnUrl } from "../src/web/dashboard/cdn";
import { parseSettingsImport, exportSettings } from "../src/web/dashboard/settingsTransfer";
import { parseAutomation } from "../src/web/dashboard/moduleValidation";
import { decodeScheduledPayload, encodeScheduledPayload, scheduledPayloadPreview } from "../src/services/scheduledPayload";
import { normalizeGuildConfig } from "../src/services/guildConfigNormalize";
import { createIncidentService, type IncidentOps } from "../src/services/incidentService";
import { memoryIncidentStore } from "../src/services/incidentStore";
import { normalizeIncidentConfig, type ChannelSnapshot } from "../src/services/incidentLogic";
import { dashboardScript } from "../src/web/dashboard/client";
import type { SiteConfig } from "../src/web/pages";

const USER = "900000000000000001";
const OWNER = "900000000000000099";
const GUILD = "800000000000000001";
const CHANNEL = "700000000000000001";
const CHANNEL_2 = "700000000000000002";
const HIDDEN = "700000000000000050";
const ROLE = "600000000000000001";
const LOW = "500000000000000001";   // below the viewer
const HIGH = "500000000000000002";  // above the viewer
const CASE_ID = "65a1b2c3d4e5f60718293a4b";
const SECRET = "s".repeat(64);
const site: SiteConfig = { inviteUrl: "#", supportUrl: "", version: "test", contactEmail: "", assetVersion: "t" };

const granted = new Set<DashboardPermission>(["ModerateMembers", "BanMembers"]);
const bot: BotView = {
  hasGuild: id => id === GUILD,
  guild: id => (id === GUILD ? { id, name: "Test", memberCount: 10, iconUrl: guildIconUrl(GUILD, "a".repeat(32)) } : null),
  memberCanManage: async (g, u) => g === GUILD && u === USER,
  memberHasPermission: async (_g, _u, p) => granted.has(p),
  textChannels: () => [{ id: CHANNEL, name: "general", parent: null }, { id: CHANNEL_2, name: "memes", parent: null }],
  hiddenChannelIds: () => new Set([HIDDEN]),
  roles: () => [{ id: ROLE, name: "Member", position: 1, assignable: true }],
  viewerRoleLimit: async () => ({ ownerId: OWNER, topPosition: 5 }),
  userName: () => null,
};

const caseRec: CaseRecord = { id: CASE_ID, kind: "case", userId: LOW, moderatorId: USER, action: "timeout", reason: "spam links", details: null, proofUrl: null, revoked: false, revokedBy: null, revokedAt: null, createdAt: new Date("2026-10-30T12:00:00Z") };
let modules: Record<string, boolean> | undefined;
const snapshot = (): SettingsSnapshot => ({
  guild: { ...normalizeGuildConfig(GUILD), modules: modules as never },
  automod: { guildId: GUILD, words: { enabled: true, action: "delete", list: ["bad"] }, links: { enabled: false, action: "delete" }, mentions: { enabled: false, action: "timeout", threshold: 5 }, spam: { enabled: false, action: "timeout", maxMessages: 5, windowSeconds: 5 }, caps: { enabled: false, action: "delete", threshold: 80 }, exemptRoleIds: [], exemptChannelIds: [] },
  tickets: { logChannelId: null, autoCloseHours: 48, transcriptLogging: true }, verification: null,
  starboard: { guildId: GUILD, channelId: null, emoji: "⭐", threshold: 3, selfStar: false, ignoredChannels: [], ignoredRoles: [], enabled: true },
});
const data = { loadSettings: async () => snapshot(), overview: async () => ({ cases7: 0, cases30: 0, warnings7: 0, warnings30: 0, recentCases: [], openTicketCount: 0, openTickets: [], pendingAppeals: 0 }) } as unknown as DashboardData;

const member = (id: string, top: number, over: Partial<MemberProfile> = {}): MemberProfile => ({
  id, username: `user${id.slice(-1)}`, globalName: null, avatarUrl: userAvatarUrl(id, "b".repeat(32)), bot: false, inServer: true, owner: false,
  joinedAt: new Date("2026-01-01T00:00:00Z"), createdAt: new Date("2025-01-01T00:00:00Z"), timeoutUntil: null, topRolePosition: top, roles: [],
  botCan: { timeout: true, kick: true, ban: true }, ...over,
});

// Incident Mode through the real service, with a fake server.
const channels = new Map<string, ChannelSnapshot>([[CHANNEL, { id: CHANNEL, name: "general", kind: "text", hidden: false, isPublic: true, canEditChannel: true, canEditOverwrites: true, rateLimitPerUser: 0, everyoneSend: "neutral", hasEveryoneOverwrite: false, everyoneOverwriteOnlySendDeny: false }]]);
const ops: IncidentOps = {
  snapshotChannels: async () => [...channels.values()].map(c => ({ ...c })),
  setSlowmode: async (_g, id, s) => { channels.get(id)!.rateLimitPerUser = s; },
  setEveryoneSend: async () => undefined,
  invitesState: () => ({ disabled: false, canChange: true }), setInvitesDisabled: async () => undefined,
  postModLog: async () => undefined, gateMember: async () => undefined, recordCase: async () => null, botUserId: () => "1",
};
const incidents = createIncidentService({ store: memoryIncidentStore(), ops, getConfig: async () => normalizeIncidentConfig(undefined), paceMs: 0 });
const extras = memoryDashboardExtras({
  members: [member(LOW, 2), member(HIGH, 9), member(OWNER, 20, { owner: true })],
  records: { [LOW]: { cases: [caseRec], warnings: [], notes: [{ id: "n1", moderatorId: USER, note: "watch <script>", createdAt: new Date() }] } },
  incidents: {
    active: g => incidents.getActive(g), list: (g, n) => incidents.list(g, n), get: (g, id) => incidents.get(g, id),
    start: (g, o, r, a) => incidents.start(g, { options: o, reason: r, trigger: "dashboard", actor: { id: a.userId, tag: a.username } }),
    end: (g, r, a) => incidents.end(g, { actor: { id: a.userId, tag: a.username }, reason: r }),
  },
});
const audit = memoryAuditStore();
const sessions = memorySessionStore();
let server: Server;
let base = "";
let cookie = "";
let csrf = "";

before(async () => {
  const config = readDashboardConfig({ DISCORD_APPLICATION_ID: "123456789012345678", DISCORD_CLIENT_SECRET: "x", DASHBOARD_SESSION_SECRET: SECRET, DASHBOARD_REDIRECT_URI: "http://127.0.0.1/dashboard/callback" });
  assert.ok(config);
  const sid = "session-id-for-tests-0123456789";
  const now = Date.now();
  await sessions.create(sid, { userId: USER, username: "aj", globalName: "AJ", avatar: "c".repeat(32), accessToken: "t", tokenExpiresAt: new Date(now + 1e9), guilds: [{ id: GUILD, name: "Test", icon: null, owner: false, permissions: "32" }], guildsFetchedAt: new Date(now), createdAt: new Date(now), expiresAt: new Date(now + 1e9) });
  cookie = `${cookieNames(config.secureCookies).session}=${encodeURIComponent(signSessionId(SECRET, sid))}`;
  csrf = csrfToken(SECRET, sid);
  const app = express();
  app.use("/dashboard", createDashboardRouter({ site, config, bot, data, sessions, audit, extras, limits: { auth: 100, post: 1000, page: 2000 } }));
  server = app.listen(0);
  await new Promise(r => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => { incidents.stop(); server.close(); });

const get = (path: string) => fetch(base + path, { redirect: "manual", headers: { Cookie: cookie } });
const post = (path: string, form: Record<string, string | string[]>, withCsrf = true) => {
  const body = new URLSearchParams();
  if (withCsrf) body.append("_csrf", csrf);
  for (const [k, v] of Object.entries(form)) for (const x of Array.isArray(v) ? v : [v]) body.append(k, x);
  return fetch(base + path, { method: "POST", redirect: "manual", headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
};

test("CSP: Discord's CDN is allowed for images only", () => {
  const img = CONTENT_SECURITY_POLICY.split("; ").find(d => d.startsWith("img-src"));
  assert.equal(img, "img-src 'self' data: https://cdn.discordapp.com");
  for (const d of CONTENT_SECURITY_POLICY.split("; ").filter(x => !x.startsWith("img-src"))) assert.doesNotMatch(d, /discordapp/, d);
  assert.equal(isDiscordCdnUrl("https://evil.example/x.png"), false);
  assert.equal(userAvatarUrl(USER, "not-a-hash"), null);
});

test("shell: real server icon and avatar, new modules in the sidebar, palette and search box", async () => {
  const html = await (await get(`/dashboard/${GUILD}/members`)).text();
  assert.match(html, /<img class="g-icon has-img" src="https:\/\/cdn\.discordapp\.com\/icons\/800000000000000001\/a{32}\.png\?size=64"/);
  assert.match(html, /<img class="avatar has-img" src="https:\/\/cdn\.discordapp\.com\/avatars\/900000000000000001\/c{32}\.png/);
  for (const label of ["Incident Mode", "Members", "Analytics", "Modules &amp; backup"]) assert.ok(html.includes(label), label);
  assert.match(html, /data-palette-open/);
  assert.match(html, /<dialog class="palette" data-palette/);
  assert.match(html, /action="\/dashboard\/800000000000000001\/search"/);
  assert.doesNotMatch(html, /\sstyle=|\son[a-z]+=/i);
  assert.doesNotThrow(() => new Function(dashboardScript));
  assert.match(dashboardScript, /e\.ctrlKey \|\| e\.metaKey/);
  assert.doesNotMatch(dashboardScript.slice(dashboardScript.indexOf("Command palette") - 200), /innerHTML/);
});

test("member page: records, escaped notes, quick-action form", async () => {
  const res = await get(`/dashboard/${GUILD}/members/${LOW}`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /spam links/);
  assert.match(html, /watch &lt;script&gt;/);
  assert.match(html, /action="\/dashboard\/800000000000000001\/members\/500000000000000001\/action"/);
  assert.equal((await get(`/dashboard/${GUILD}/members/not-an-id`)).status, 404);
  assert.equal((await get(`/dashboard/${GUILD}/members?q=${LOW}`)).headers.get("location"), `/dashboard/${GUILD}/members/${LOW}`);
});

test("quick actions: permission, hierarchy, owner and CSRF checks before anything happens; audit logged", async () => {
  const before = extras.actions.length;
  assert.equal((await post(`/dashboard/${GUILD}/members/${LOW}/action`, { action: "timeout", minutes: "60", reason: "spam" }, false)).status, 403, "no CSRF token");
  const high = await post(`/dashboard/${GUILD}/members/${HIGH}/action`, { action: "timeout", minutes: "60", reason: "x" });
  assert.equal(high.status, 403);
  assert.match(await high.text(), /equal to or above yours/);
  const owner = await post(`/dashboard/${GUILD}/members/${OWNER}/action`, { action: "ban", reason: "x" });
  assert.equal(owner.status, 403);
  const kick = await post(`/dashboard/${GUILD}/members/${LOW}/action`, { action: "kick", reason: "x" });
  assert.equal(kick.status, 403, "Kick Members not granted");
  assert.match(await kick.text(), /Kick Members/);
  const noReason = await post(`/dashboard/${GUILD}/members/${LOW}/action`, { action: "warn", reason: "" });
  assert.equal(noReason.status, 400);
  assert.equal(extras.actions.length, before, "nothing reached Discord");
  const ok = await post(`/dashboard/${GUILD}/members/${LOW}/action`, { action: "timeout", minutes: "1440", reason: "raid" });
  assert.equal(ok.status, 303);
  assert.match(ok.headers.get("location") ?? "", /notice=member-done/);
  assert.deepEqual(extras.actions.at(-1)?.input, { action: "timeout", reason: "raid", minutes: 1440 });
  const logged = await audit.list(GUILD, { page: 1, perPage: 10 });
  assert.ok(logged.items.some(e => e.action === "member.timeout" && e.target === LOW));
  assert.equal((await post(`/dashboard/${GUILD}/members/${LOW}/action`, { action: "timeout", minutes: "7", reason: "x" })).status, 400, "only listed lengths");
});

test("memberActionRefusal: self, bots, absent members, Aegis below the member", () => {
  const m = member(LOW, 2);
  assert.match(memberActionRefusal({ action: "warn", viewerId: LOW, ownerId: OWNER, viewerTop: 5, member: m }) ?? "", /yourself/);
  assert.match(memberActionRefusal({ action: "warn", viewerId: USER, ownerId: OWNER, viewerTop: 5, member: { ...m, bot: true } }) ?? "", /Bots/);
  assert.match(memberActionRefusal({ action: "kick", viewerId: USER, ownerId: OWNER, viewerTop: 5, member: { ...m, inServer: false } }) ?? "", /not in the server/);
  assert.equal(memberActionRefusal({ action: "ban", viewerId: USER, ownerId: OWNER, viewerTop: 5, member: { ...m, inServer: false, botCan: { timeout: false, kick: false, ban: true } } }), null, "people who left can be banned by ID");
  assert.match(memberActionRefusal({ action: "timeout", viewerId: USER, ownerId: OWNER, viewerTop: 5, member: { ...m, botCan: { timeout: false, kick: true, ban: true } } }) ?? "", /Aegis can't time/);
  assert.equal(memberActionRefusal({ action: "timeout", viewerId: OWNER, ownerId: OWNER, viewerTop: null, member: member(HIGH, 9) }), null, "the owner outranks everyone");
});

test("global search: cases by ID, members, and pages", async () => {
  const html = await (await get(`/dashboard/${GUILD}/search?q=${CASE_ID}`)).text();
  assert.match(html, new RegExp(`/cases/${CASE_ID}`));
  const pages = await (await get(`/dashboard/${GUILD}/search?q=incident`)).text();
  assert.match(pages, /href="\/dashboard\/800000000000000001\/incident"/);
  const people = await (await get(`/dashboard/${GUILD}/search?q=user1`)).text();
  assert.match(people, /members\/500000000000000001/);
  const empty = await (await get(`/dashboard/${GUILD}/search?q=%00%01`)).text();
  assert.doesNotMatch(empty, /Nothing found/, "control characters are stripped to an empty query");
});

test("analytics: SVG charts with text alternatives; unknown ranges fall back to 30 days", async () => {
  const html = await (await get(`/dashboard/${GUILD}/analytics?days=9999`)).text();
  assert.match(html, /<svg viewBox="0 0 300 100" role="img" aria-label="Joins and leaves per day/);
  assert.match(html, /aria-current="page">30 days/);
  assert.doesNotMatch(html, /<script(?! src=)/);
});

test("modules & backup: switches save, export downloads JSON, import validates channels and refuses bad files", async () => {
  const saved = await post(`/dashboard/${GUILD}/tools/modules`, { module_tickets: "on", module_appeals: "on" });
  assert.equal(saved.status, 303);
  assert.deepEqual(extras.saved.modules.at(-1), { tickets: true, giveaways: false, scheduled: false, appeals: true });

  const exp = await get(`/dashboard/${GUILD}/tools/export`);
  assert.equal(exp.status, 200);
  assert.match(exp.headers.get("content-disposition") ?? "", /attachment; filename="aegis-settings-800000000000000001\.json"/);
  assert.equal(exp.headers.get("cache-control"), "no-store");
  const file = await exp.json() as Record<string, unknown>;
  assert.equal(file.format, "aegis-settings");

  const cfg = file.config as Record<string, unknown>;
  cfg.loggingEnabled = true;
  cfg.loggingChannelId = HIDDEN;
  cfg.welcomeChannelId = CHANNEL_2;
  const imp = await post(`/dashboard/${GUILD}/tools/import`, { json: JSON.stringify(file) });
  assert.equal(imp.status, 200);
  const impHtml = await imp.text();
  assert.match(impHtml, /Log channel: Aegis can&#39;t see that channel here|Log channel: Aegis can't see that channel here/);
  const applied = extras.saved.import.at(-1) as { update: Record<string, unknown> };
  assert.equal(applied.update.loggingChannelId, null);
  assert.equal(applied.update.welcomeChannelId, CHANNEL_2);

  assert.equal((await post(`/dashboard/${GUILD}/tools/import`, { json: "{not json" })).status, 400);
  assert.equal((await post(`/dashboard/${GUILD}/tools/import`, { json: JSON.stringify({ format: "aegis-settings", version: 1, config: { $where: "1" } }) })).status, 400);
  assert.equal((await post(`/dashboard/${GUILD}/tools/import`, { json: JSON.stringify({ hello: 1 }) })).status, 400);
});

test("settings import: roles above the viewer are dropped; automod exemptions must exist here", () => {
  const ctx = { textChannelIds: new Set([CHANNEL]), hiddenChannelIds: new Set([HIDDEN]), roles: new Map([[ROLE, { assignable: true, aboveViewer: true }]]) };
  const file = exportSettings(GUILD, "x", { ...normalizeGuildConfig(GUILD), welcomeRoleId: ROLE }, { ...snapshot().automod, exemptChannelIds: [CHANNEL, "700000000000000077"], exemptRoleIds: ["600000000000000077"] });
  const r = parseSettingsImport(JSON.stringify(file), ctx);
  assert.ok(r.ok);
  assert.equal(r.update.welcomeRoleId, null);
  assert.deepEqual(r.automod?.exemptChannelIds, [CHANNEL]);
  assert.deepEqual(r.automod?.exemptRoleIds, []);
  assert.ok(r.warnings.some(w => /Welcome role/.test(w)));
  assert.ok(r.warnings.some(w => /Automod: 2/.test(w)));
  assert.equal(parseSettingsImport("x".repeat(200_001), ctx).ok, false);
});

test("Incident Mode pages: start, live view, end with report; bad input refused", async () => {
  const page = await (await get(`/dashboard/${GUILD}/incident`)).text();
  assert.match(page, /Start Incident Mode/);
  assert.doesNotMatch(page, new RegExp(HIDDEN), "hidden channels are never listed");
  const bad = await post(`/dashboard/${GUILD}/incident/start`, { reason: "x", lockMode: "selected", lockChannelIds: [HIDDEN], durationMinutes: "60", slowmodeSeconds: "0" });
  assert.equal(bad.status, 400);
  assert.match(await bad.text(), /can&#39;t be used|can't be used/);
  const started = await post(`/dashboard/${GUILD}/incident/start`, { reason: "raid", durationMinutes: "30", slowmodeSeconds: "20", lockMode: "none", joinGate: "timeout", minAccountAgeDays: "7", gateTimeoutMinutes: "60" });
  assert.equal(started.status, 303);
  assert.equal(channels.get(CHANNEL)!.rateLimitPerUser, 20);
  const live = await (await get(`/dashboard/${GUILD}/incident`)).text();
  assert.match(live, /Incident Mode is on/);
  assert.match(live, /End incident and restore/);
  assert.match((await post(`/dashboard/${GUILD}/incident/start`, { durationMinutes: "30" })).headers.get("location") ?? "", /incident-active/);
  const ended = await post(`/dashboard/${GUILD}/incident/end`, { reason: "calm" });
  assert.equal(ended.status, 303);
  const reportUrl = ended.headers.get("location") ?? "";
  assert.match(reportUrl, /\/incident\/[0-9a-f-]{36}\?notice=incident-ended/);
  assert.equal(channels.get(CHANNEL)!.rateLimitPerUser, 0, "restored");
  const report = await (await get(reportUrl.replace(/\?.*/, ""))).text();
  assert.match(report, /Incident report/);
  assert.match(report, /slowmode 0s → 20s/);
  assert.equal((await get(`/dashboard/${GUILD}/incident/not-a-uuid`)).status, 404);
  const logged = await audit.list(GUILD, { page: 1, perPage: 50 });
  assert.ok(logged.items.some(e => e.action === "incident.start") && logged.items.some(e => e.action === "incident.end"));
});

test("Incident defaults: auto-trigger saved off by default and validated", async () => {
  const ok = await post(`/dashboard/${GUILD}/incident/settings`, { autoJoins: "12", autoSeconds: "20", durationMinutes: "45", slowmodeSeconds: "5", lockMode: "none", joinGate: "kick", minAccountAgeDays: "3", gateTimeoutMinutes: "60" });
  assert.equal(ok.status, 303);
  const savedCfg = extras.saved.incident.at(-1) as ReturnType<typeof normalizeIncidentConfig>;
  assert.equal(savedCfg.autoTrigger.enabled, false);
  assert.equal(savedCfg.defaults.joinGate, "kick");
  assert.equal((await post(`/dashboard/${GUILD}/incident/settings`, { autoEnabled: "on", autoJoins: "1", durationMinutes: "45" })).status, 400);
});

test("scheduled messages: embed builder payloads round-trip; the module switch blocks new ones", async () => {
  const ctx = { textChannelIds: new Set([CHANNEL]), roles: new Map() };
  const parsed = parseAutomation({ channelId: CHANNEL, message: "", delay: "1h", e_title: "Weekly event", e_description: "See you {server}" }, ctx);
  assert.ok(parsed.ok, "an embed alone is enough");
  assert.equal(parsed.value.embed?.title, "Weekly event");
  assert.equal(parseAutomation({ channelId: CHANNEL, message: "", delay: "1h" }, ctx).ok, false, "message or embed required");
  const payload = encodeScheduledPayload("hi", parsed.value.embed);
  assert.deepEqual(decodeScheduledPayload(payload), { text: "hi", embed: parsed.value.embed });
  assert.deepEqual(decodeScheduledPayload("plain"), { text: "plain", embed: null });
  assert.equal(decodeScheduledPayload("aegis:embed:v1:{broken").embed, null);
  assert.equal(scheduledPayloadPreview(encodeScheduledPayload("", parsed.value.embed)), "Embed: Weekly event");
  modules = { scheduled: false };
  const blocked = await post(`/dashboard/${GUILD}/automations`, { channelId: CHANNEL, message: "x", delay: "1h" });
  assert.equal(blocked.status, 303);
  assert.match(blocked.headers.get("location") ?? "", /notice=module-disabled/);
  modules = undefined;
});
