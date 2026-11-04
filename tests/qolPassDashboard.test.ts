/**
 * QoL pass, dashboard: per-rule automod exemptions, the paged Trust member
 * list, cases date filter and CSV export, and relative times plus copy buttons
 * on the community and automation pages. Runs the real router with fakes.
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { createDashboardRouter } from "../src/web/dashboard/router";
import { readDashboardConfig } from "../src/web/dashboard/config";
import { memorySessionStore } from "../src/web/dashboard/sessions";
import { memoryAuditStore } from "../src/web/dashboard/audit";
import { memoryModuleData } from "../src/web/dashboard/moduleDataMemory";
import { memoryDashboardExtras, pageTrustRows } from "../src/web/dashboard/extras";
import { csrfToken, signSessionId } from "../src/web/dashboard/security";
import type { BotView } from "../src/web/dashboard/botView";
import type { CaseFilter, CaseRecord, DashboardData, SettingsSnapshot, SettingsValue } from "../src/web/dashboard/data";
import { EXEMPT_ROLE_ABOVE_VIEWER_ERROR, parseRuleExemptions, type ValidationContext } from "../src/web/dashboard/validation";
import { parseTrustMemberQuery, trustMemberList } from "../src/web/dashboard/views/trustMembers";
import type { SiteConfig } from "../src/web/pages";

const USER = "900000000000000001";
const GUILD = "800000000000000001";
const CHANNEL = "700000000000000001";
const CHANNEL_2 = "700000000000000002";
const ROLE = "600000000000000001";
const ROLE_ABOVE_YOU = "600000000000000003";
const OLD_ROLE = "600000000000000009";
const SECRET = "s".repeat(64);
const SID = "test-session-id-qolpass-0123456789";

const site: SiteConfig = { inviteUrl: "https://discord.com/oauth2/authorize?client_id=1", supportUrl: "", version: "test", contactEmail: "x@example.com", assetVersion: "test" };
const saved: SettingsValue[] = [];
const caseFilters: CaseFilter[] = [];

const bot: BotView = {
  hasGuild: id => id === GUILD,
  guild: id => (id === GUILD ? { id, name: "Hub", memberCount: 300 } : null),
  memberCanManage: async (g, u) => g === GUILD && u === USER,
  memberHasPermission: async () => true,
  textChannels: () => [{ id: CHANNEL, name: "general", parent: null }, { id: CHANNEL_2, name: "memes", parent: "Chat" }],
  hiddenChannelIds: () => new Set(),
  roles: () => [{ id: ROLE_ABOVE_YOU, name: "Senior Mod", position: 6, assignable: true }, { id: ROLE, name: "Regular", position: 2, assignable: true }],
  viewerRoleLimit: async () => ({ ownerId: "900000000000000099", topPosition: 5 }),
  userName: id => (id === USER ? "aj" : null),
};

function snapshot(): SettingsSnapshot {
  const rule = { enabled: false, action: "delete" as const, exemptRoleIds: [] as string[], exemptChannelIds: [] as string[] };
  return {
    guild: { guildId: GUILD, prefix: "!", language: "en", loggingEnabled: false, loggingChannelId: null, logCategories: null, welcomeEnabled: false, welcomeChannelId: null, welcomeMessage: "Hi", welcomeRoleId: null, suggestionsChannelId: null, escalation: { enabled: false, thresholds: [] }, tickets: { logChannelId: null, autoCloseHours: 48, transcriptLogging: true }, roles: { maxRolesPerPanel: 25 } },
    automod: {
      guildId: GUILD,
      words: { ...rule, list: [] },
      links: { ...rule, enabled: true, exemptRoleIds: [ROLE_ABOVE_YOU], exemptChannelIds: [CHANNEL] },
      mentions: { ...rule, threshold: 5 }, spam: { ...rule, maxMessages: 5, windowSeconds: 5 }, caps: { ...rule, threshold: 80 },
      exemptRoleIds: [], exemptChannelIds: [],
    },
    tickets: { logChannelId: null, autoCloseHours: 48, transcriptLogging: true },
    verification: null,
    starboard: { guildId: GUILD, channelId: null, emoji: "⭐", threshold: 3, selfStar: false, ignoredChannels: [], ignoredRoles: [], enabled: false },
  } as SettingsSnapshot;
}

const record = {
  id: "65a1b2c3d4e5f60718293a4b", kind: "case", userId: "500000000000000001", moderatorId: USER, action: "ban",
  reason: "=cmd|' /C calc'!A0", details: null, proofUrl: null, revoked: false, revokedBy: null, revokedAt: null, createdAt: new Date("2026-10-02T08:00:00Z"),
} as CaseRecord;

const data = {
  loadSettings: async () => snapshot(),
  saveSettings: async (_g: string, input: SettingsValue) => { saved.push(input); return true; },
  listCases: async (_g: string, filter: CaseFilter) => { caseFilters.push(filter); return { items: [record], total: 1 }; },
  getCase: async () => null,
  listRolePanels: async () => [],
} as unknown as DashboardData;

const trustRows = Array.from({ length: 7 }, (_, i) => ({ userId: String(500000000000000010n + BigInt(i)), name: `m${i}`, score: i * 15, bandLabel: i < 2 ? "Low" : "OK", low: i < 2 }));
const extras = memoryDashboardExtras({ trust: { list: trustRows } });
const audit = memoryAuditStore();
const sessions = memorySessionStore();
let server: Server;
let base = "";
const cookie = `aegis_dash=${encodeURIComponent(signSessionId(SECRET, SID))}`;
const csrf = csrfToken(SECRET, SID);

before(async () => {
  const config = readDashboardConfig({ DISCORD_APPLICATION_ID: "123456789012345678", DISCORD_CLIENT_SECRET: "x", DASHBOARD_SESSION_SECRET: SECRET, DASHBOARD_REDIRECT_URI: "http://127.0.0.1/dashboard/callback" });
  assert.ok(config);
  await sessions.create(SID, {
    userId: USER, username: "aj", globalName: "AJ", accessToken: "t", tokenExpiresAt: new Date(Date.now() + 3.6e6),
    guilds: [{ id: GUILD, name: "Hub", icon: null, owner: false, permissions: "32" }],
    guildsFetchedAt: new Date(), createdAt: new Date(), expiresAt: new Date(Date.now() + 3.6e6),
  });
  const modules = memoryModuleData({
    responders: [{ id: "ar-1111", trigger: "hello", response: "Hi", matchType: "contains", enabled: true, createdBy: USER, createdAt: new Date(Date.now() - 3 * 3_600_000) }],
    giveaways: [{ messageId: "100000000000000002", channelId: CHANNEL, prize: "Sticker", winnerCount: 1, entrants: 3, winners: ["500000000000000001"], hostId: USER, endsAt: new Date(0), ended: true }],
  });
  modules.watches.set(USER, [{ targetId: "500000000000000001", reason: null, events: [], alertCount: 0, expiresAt: null, createdAt: new Date(Date.now() - 2 * 86_400_000) }]);
  const app = express();
  app.use("/dashboard", createDashboardRouter({ site, config, bot, data, sessions, audit, extras, modules, limits: { auth: 100, post: 1000, page: 2000, export: 2 } }));
  server = app.listen(0);
  await new Promise(r => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());
beforeEach(() => { saved.length = 0; caseFilters.length = 0; });

const get = (path: string) => fetch(base + path, { redirect: "manual", headers: { Cookie: cookie } });
const post = (path: string, form: Record<string, string | string[]>, withCsrf = true) => {
  const body = new URLSearchParams();
  if (withCsrf) body.append("_csrf", csrf);
  for (const [k, v] of Object.entries(form)) for (const one of Array.isArray(v) ? v : [v]) body.append(k, one);
  return fetch(base + path, { method: "POST", redirect: "manual", body: body.toString(), headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie } });
};
const EX = `/dashboard/${GUILD}/settings/automod/exemptions`;

test("automod page: one exemption form per rule, prefilled, roles above the viewer labelled, no inline script or style", async () => {
  const html = await (await get(`/dashboard/${GUILD}/settings/automod`)).text();
  assert.equal((html.match(/action="\/dashboard\/800000000000000001\/settings\/automod\/exemptions"/g) ?? []).length, 8);
  assert.match(html, /<summary>Links <span class="faint">\(1 role, 1 channel\)<\/span><\/summary>/);
  assert.match(html, /@Senior Mod \(at or above your highest role\)/);
  assert.match(html, /id="f-rx-links-channels-\d+" name="channels" value="700000000000000001" checked/);
  assert.doesNotMatch(html, /\sstyle=|\son[a-z]+=/i);
});

test("saving one rule's exemptions writes only that rule and records an audit entry", async () => {
  const res = await post(EX, { rule: "caps", roles: [ROLE], channels: [CHANNEL_2] });
  assert.equal(res.status, 303);
  assert.match(res.headers.get("location")!, /settings\/automod\?notice=saved#rx-caps$/);
  assert.deepEqual(saved, [{ section: "automodRule", value: { rule: "caps", exemptRoleIds: [ROLE], exemptChannelIds: [CHANNEL_2] } }]);
  const entries = await audit.list(GUILD, { page: 1, perPage: 10 });
  assert.ok(entries.items.some(e => e.action === "settings.automod.exemptions" && e.target === "caps" && /roles added 600000000000000001/.test(e.summary)));
});

test("a role above the viewer can stay exempt but can't be added or removed; bad input is refused with nothing saved", async () => {
  const keep = await post(EX, { rule: "links", roles: [ROLE_ABOVE_YOU, ROLE], channels: [CHANNEL] });
  assert.equal(keep.status, 303, "keeping the saved role is fine");
  const remove = await post(EX, { rule: "links", channels: [CHANNEL] });
  assert.equal(remove.status, 400);
  assert.ok((await remove.text()).includes("equal to or above your highest role"));
  const add = await post(EX, { rule: "caps", roles: [ROLE_ABOVE_YOU] });
  assert.equal(add.status, 400);
  assert.equal((await post(EX, { rule: "everything", roles: [ROLE] })).status, 400, "unknown rule");
  assert.equal((await post(EX, { rule: "caps", channels: ["700000000000000077"] })).status, 400, "channel Aegis can't see");
  assert.equal((await post(EX, { rule: "caps", "roles[$ne]": "x" })).status, 400, "operator-looking key");
  assert.equal((await post(EX, { rule: "caps", roles: [ROLE] }, false)).status, 403, "no CSRF token");
  assert.equal(saved.length, 1, "only the first, valid save went through");
});

test("parseRuleExemptions: caps at 25 each, keeps saved IDs the picker no longer shows, refuses non-snowflakes", () => {
  const roles = new Map<string, { assignable: boolean; aboveViewer?: boolean }>([[ROLE, { assignable: true }], [ROLE_ABOVE_YOU, { assignable: true, aboveViewer: true }]]);
  const many = Array.from({ length: 26 }, (_, i) => String(700000000000000100n + BigInt(i)));
  const ctx: ValidationContext = { textChannelIds: new Set(many), roles };
  const capped = parseRuleExemptions({ rule: "spam", channels: many }, ctx, {});
  assert.ok(!capped.ok && /at most 25/.test(capped.errors.channels));
  const kept = parseRuleExemptions({ rule: "spam", roles: [OLD_ROLE] }, ctx, { exemptRoleIds: [OLD_ROLE] });
  assert.ok(kept.ok && kept.value.exemptRoleIds[0] === OLD_ROLE);
  const junk = parseRuleExemptions({ rule: "spam", roles: ["$ne"] }, ctx, {});
  assert.ok(!junk.ok);
  const above = parseRuleExemptions({ rule: "spam", roles: [ROLE_ABOVE_YOU] }, ctx, {});
  assert.ok(!above.ok && above.errors.roles === EXEMPT_ROLE_ABOVE_VIEWER_ERROR);
});

test("validation is split into modules under 400 lines, still importable from validation.ts", () => {
  for (const f of ["validation", "formFields", "settingsValidation", "automodValidation", "caseValidation", "panelValidation"]) {
    const lines = fs.readFileSync(`src/web/dashboard/${f}.ts`, "utf8").split("\n").length;
    assert.ok(lines < 400, `${f}.ts has ${lines} lines`);
  }
});

test("trust page: members paged by cursor from the member list, with a low-trust filter and page sizes", async () => {
  const first = await (await get(`/dashboard/${GUILD}/trust?per=25`)).text();
  assert.match(first, /<h2 id="trust-members-h">All members<\/h2>/);
  assert.equal((first.match(/<td data-label="Member"><a href="\/dashboard\/800000000000000001\/members\/5000000000000000\d\d">/g) ?? []).length, 7);
  assert.doesNotMatch(first, /rel="next"/, "everything fits on one page");
  const q = parseTrustMemberQuery({ per: "25", after: "500000000000000011", low: "1" });
  assert.deepEqual(q, { after: "500000000000000011", per: 25, lowOnly: true });
  assert.deepEqual(parseTrustMemberQuery({ per: "9999", after: "nope" }), { after: null, per: 50, lowOnly: false });
  const paged = pageTrustRows(trustRows, { after: null, per: 3, lowOnly: false });
  assert.deepEqual(paged.rows.map(r => r.name), ["m0", "m1", "m2"]);
  assert.equal(paged.next, "500000000000000012");
  const next = pageTrustRows(trustRows, { after: paged.next, per: 3, lowOnly: false });
  assert.deepEqual(next.rows.map(r => r.name), ["m3", "m4", "m5"]);
  assert.equal(pageTrustRows(trustRows, { after: "500000000000000015", per: 3, lowOnly: false }).next, null);
  const low = await (await get(`/dashboard/${GUILD}/trust?low=1`)).text();
  assert.match(low, /aria-current="page">Below the threshold</);
  assert.equal((low.match(/<span class="tag warn">low<\/span>/g) ?? []).length, 2);
});

test("cases: date filter reaches the data layer; CSV export downloads the filtered records, safely, and is audited", async () => {
  const page = await (await get(`/dashboard/${GUILD}/cases?from=2026-10-01&to=2026-10-31`)).text();
  assert.equal(caseFilters[0].from, "2026-10-01");
  assert.match(page, /type="date" value="2026-10-01"/);
  assert.match(page, /href="\/dashboard\/800000000000000001\/cases\/export\.csv\?from=2026-10-01&amp;to=2026-10-31" download/);
  const res = await get(`/dashboard/${GUILD}/cases/export.csv?type=ban&from=2026-10-01`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type")!, /^text\/csv; charset=utf-8/);
  assert.match(res.headers.get("content-disposition")!, /^attachment; filename="aegis-cases-800000000000000001-\d{4}-\d{2}-\d{2}\.csv"$/);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const csv = await res.text();
  assert.ok(csv.includes(`"'=cmd|' /C calc'!A0"`), "formula neutralised");
  assert.equal(caseFilters.at(-1)!.type, "ban");
  assert.equal(caseFilters.at(-1)!.page, 1);
  const entries = await audit.list(GUILD, { page: 1, perPage: 10 });
  assert.ok(entries.items.some(e => e.action === "cases.export" && /1 of 1 record/.test(e.summary) && /type=ban/.test(e.summary)));
  assert.equal((await get(`/dashboard/${GUILD}/cases/export.csv`)).status, 200, "second export in the minute");
  const limited = await get(`/dashboard/${GUILD}/cases/export.csv`);
  assert.equal(limited.status, 429, "exports have their own small rate limit");
  assert.ok(limited.headers.get("retry-after"));
});

test("community and automation pages: relative times with UTC on hover, and copy buttons for IDs", async () => {
  const rel = /<time datetime="[^"]+" title="\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC" data-rel>/;
  const ar = await (await get(`/dashboard/${GUILD}/autoresponders`)).text();
  assert.match(ar, /data-label="Added"><time [^>]+data-rel>3 hours ago<\/time>/);
  assert.match(ar, /data-copy="ar-1111"/);
  const gw = await (await get(`/dashboard/${GUILD}/giveaways`)).text();
  assert.match(gw, rel);
  assert.match(gw, /data-copy="700000000000000001" aria-label="Copy channel ID/);
  assert.match(gw, /data-copy="500000000000000001" aria-label="Copy user ID/, "winner");
  assert.match(gw, /data-copy="900000000000000001" aria-label="Copy user ID/, "host");
  const watch = await (await get(`/dashboard/${GUILD}/watchlist`)).text();
  assert.match(watch, /data-label="Added"><time [^>]+data-rel>2 days ago<\/time>/);
});

test("trust member list view: next and first-page links keep the filter and size; empty and failed pages explain themselves", () => {
  const ctx = { guild: { id: GUILD, name: "Hub", memberCount: 300 }, viewer: { userId: USER, username: "aj", globalName: null, csrf: "x" }, nameOf: () => null };
  const base = `/dashboard/${GUILD}/trust`;
  const html = trustMemberList(ctx, base, { after: "500000000000000011", per: 25, lowOnly: true }, { rows: trustRows.slice(0, 1), next: "500000000000000040", scanned: 25 });
  assert.match(html, /href="\/dashboard\/800000000000000001\/trust\?low=1&amp;per=25&amp;after=500000000000000040#trust-members-h" rel="next">Next page</);
  assert.match(html, /href="\/dashboard\/800000000000000001\/trust\?low=1&amp;per=25#trust-members-h">First page</);
  assert.match(html, /25 members on this page/);
  const none = trustMemberList(ctx, base, { after: null, per: 50, lowOnly: true }, { rows: [], next: null, scanned: 50 });
  assert.match(none, /Nobody on this page is below the threshold/);
  assert.match(trustMemberList(ctx, base, { after: null, per: 50, lowOnly: false }, null), /couldn't load the member list/);
});
