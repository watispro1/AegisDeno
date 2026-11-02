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
import type { BotView } from "../src/web/dashboard/botView";
import type { DashboardData } from "../src/web/dashboard/data";
import { memoryDashboardExtras, type MemberProfile } from "../src/web/dashboard/extras";
import { memoryEconomy } from "../src/services/economyService";
import { shopRoleOptions } from "../src/web/dashboard/views/economy";
import { parseAdjustForm, parseEconomySettings, parseShopItemForm } from "../src/web/dashboard/economyValidation";
import { DEFAULT_ECONOMY_CONFIG } from "../src/services/economyLogic";
import type { SiteConfig } from "../src/web/pages";

const USER = "900000000000000001";
const GUILD = "800000000000000001";
const LOW_ROLE = "600000000000000001";
const ABOVE_VIEWER = "600000000000000002";
const ABOVE_BOT = "600000000000000003";
const MEMBER = "500000000000000001";
const BOT_USER = "500000000000000002";
const SECRET = "e".repeat(64);
const site: SiteConfig = { inviteUrl: "#", supportUrl: "", version: "test", contactEmail: "", assetVersion: "t" };
const roles = [
  { id: LOW_ROLE, name: "Shiny", position: 1, assignable: true },
  { id: ABOVE_VIEWER, name: "Senior", position: 7, assignable: true },
  { id: ABOVE_BOT, name: "Admin", position: 9, assignable: false },
];
const bot: BotView = {
  hasGuild: id => id === GUILD,
  guild: id => (id === GUILD ? { id, name: "Test", memberCount: 10, iconUrl: null } : null),
  memberCanManage: async (g, u) => g === GUILD && u === USER,
  memberHasPermission: async () => true,
  textChannels: () => [],
  hiddenChannelIds: () => new Set(),
  roles: () => roles,
  viewerRoleLimit: async () => ({ ownerId: "1", topPosition: 5 }),
  userName: () => null,
};
const profile = (id: string, over: Partial<MemberProfile> = {}): MemberProfile => ({
  id, username: `u${id.slice(-2)}`, globalName: null, avatarUrl: null, bot: false, inServer: true, owner: false,
  joinedAt: new Date(), createdAt: new Date(), timeoutUntil: null, topRolePosition: 1, roles: [],
  botCan: { timeout: true, kick: true, ban: true }, ...over,
});
const eco = memoryEconomy({ config: { enabled: false } });
const extras = memoryDashboardExtras({ economy: eco.service, members: [profile(MEMBER), profile(BOT_USER, { bot: true })] });
const audit = memoryAuditStore();
const data = { loadSettings: async () => ({}) } as unknown as DashboardData;
let server: Server, limited: Server, url = "", limitedUrl = "", cookie = "", csrf = "";

async function listen(adjust: number): Promise<[Server, string]> {
  const config = readDashboardConfig({ DISCORD_APPLICATION_ID: "123456789012345678", DISCORD_CLIENT_SECRET: "x", DASHBOARD_SESSION_SECRET: SECRET, DASHBOARD_REDIRECT_URI: "http://127.0.0.1/dashboard/callback" });
  assert.ok(config);
  const sessions = memorySessionStore();
  const sid = "session-id-for-economy-tests-0123";
  const now = Date.now();
  await sessions.create(sid, { userId: USER, username: "aj", globalName: "AJ", avatar: null, accessToken: "t", tokenExpiresAt: new Date(now + 1e9), guilds: [{ id: GUILD, name: "Test", icon: null, owner: false, permissions: "32" }], guildsFetchedAt: new Date(now), createdAt: new Date(now), expiresAt: new Date(now + 1e9) });
  cookie = `${cookieNames(config.secureCookies).session}=${encodeURIComponent(signSessionId(SECRET, sid))}`;
  csrf = csrfToken(SECRET, sid);
  const app = express();
  app.use("/dashboard", createDashboardRouter({ site, config, bot, data, sessions, audit, extras, limits: { auth: 100, post: 1000, page: 2000, adjust } }));
  const s = app.listen(0);
  await new Promise(r => s.once("listening", r));
  return [s, `http://127.0.0.1:${(s.address() as AddressInfo).port}`];
}

before(async () => {
  [server, url] = await listen(1000);
  [limited, limitedUrl] = await listen(2);
});
after(() => { server.close(); limited.close(); });

const get = (p: string, base = url) => fetch(base + p, { redirect: "manual", headers: { Cookie: cookie } });
const post = (p: string, form: Record<string, string>, withCsrf = true, base = url) => {
  const body = new URLSearchParams(withCsrf ? { _csrf: csrf, ...form } : form);
  return fetch(base + p, { method: "POST", redirect: "manual", headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
};
const auditActions = async () => (await audit.list(GUILD, { page: 1, perPage: 100 })).items.map(e => e.action);
const settingsForm = (over: Record<string, string> = {}) => ({
  currencyName: "gems", currencyEmoji: "💎", dailyAmount: "150", dailyStreakBonus: "5", dailyCooldownHours: "24",
  workMin: "10", workMax: "40", workCooldownMinutes: "60", payConfirmThreshold: "1000", ...over,
});

test("economy page renders with no inline styles, sidebar link and an off switch by default", async () => {
  const res = await get(`/dashboard/${GUILD}/economy`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Economy is off/);
  assert.match(html, /href="\/dashboard\/\d+\/economy"/);
  assert.match(html, /Adjust a balance/);
  assert.doesNotMatch(html, /style="|onclick=|<script>(?!\s*<\/script>)[^<]/);
});

test("toggle needs CSRF; turning on is audited", async () => {
  assert.equal((await post(`/dashboard/${GUILD}/economy/toggle`, { enabled: "on" }, false)).status, 403);
  assert.equal((await eco.service.config(GUILD)).enabled, false);
  const ok = await post(`/dashboard/${GUILD}/economy/toggle`, { enabled: "on" });
  assert.equal(ok.status, 303);
  assert.match(ok.headers.get("location") ?? "", /notice=economy-on/);
  assert.equal((await eco.service.config(GUILD)).enabled, true);
  assert.ok((await auditActions()).includes("economy.toggle"));
});

test("settings: invalid values are refused with the form kept; valid ones save and audit", async () => {
  const bad = await post(`/dashboard/${GUILD}/economy/settings`, settingsForm({ enabled: "on", workMin: "50", workMax: "5", dailyAmount: "0" }));
  assert.equal(bad.status, 400);
  const html = await bad.text();
  assert.match(html, /Nothing was changed/);
  assert.match(html, /value="gems"/, "typed values are kept");
  assert.equal((await eco.service.config(GUILD)).currencyName, "coins");
  const ok = await post(`/dashboard/${GUILD}/economy/settings`, settingsForm({ enabled: "on" }));
  assert.equal(ok.status, 303);
  const c = await eco.service.config(GUILD);
  assert.equal(c.currencyName, "gems");
  assert.equal(c.dailyAmount, 150);
  assert.equal(c.enabled, true);
  assert.ok((await auditActions()).includes("economy.settings"));
});

test("shop editor: role picker lists only roles below Aegis and the viewer; validation enforces it", async () => {
  const html = await (await get(`/dashboard/${GUILD}/economy`)).text();
  assert.match(html, /@Shiny/);
  assert.doesNotMatch(html, /@Senior|@Admin/);
  for (const roleId of [ABOVE_VIEWER, ABOVE_BOT, GUILD, "123"]) {
    const res = await post(`/dashboard/${GUILD}/economy/shop/add`, { name: "VIP", price: "100", roleId });
    assert.equal(res.status, 400, roleId);
  }
  assert.equal((await eco.service.items(GUILD)).length, 0);
  const ok = await post(`/dashboard/${GUILD}/economy/shop/add`, { name: "VIP <b>", price: "1,000", roleId: LOW_ROLE, stock: "3", description: "Shiny role" });
  assert.equal(ok.status, 400, "names can't contain < >");
  const ok2 = await post(`/dashboard/${GUILD}/economy/shop/add`, { name: "VIP", price: "1,000", roleId: LOW_ROLE, stock: "3", description: "Shiny & nice" });
  assert.equal(ok2.status, 303);
  const [item] = await eco.service.items(GUILD);
  assert.deepEqual([item.name, item.price, item.roleId, item.stock], ["VIP", 1000, LOW_ROLE, 3]);
  assert.equal((await post(`/dashboard/${GUILD}/economy/shop/add`, { name: "vip", price: "5" })).status, 400, "duplicate name");
  const page = await (await get(`/dashboard/${GUILD}/economy`)).text();
  assert.match(page, /Shiny &amp; nice/);
});

test("shop editor: edit and remove validate IDs, keep hierarchy rules, and audit", async () => {
  const [item] = await eco.service.items(GUILD);
  assert.equal((await post(`/dashboard/${GUILD}/economy/shop/${"f".repeat(24)}/edit`, { name: "X", price: "1" })).status, 404);
  assert.equal((await post(`/dashboard/${GUILD}/economy/shop/$where/edit`, { name: "X", price: "1" })).status, 404);
  assert.equal((await post(`/dashboard/${GUILD}/economy/shop/${item.id}/edit`, { name: "VIP", price: "5", roleId: ABOVE_VIEWER })).status, 400);
  const ok = await post(`/dashboard/${GUILD}/economy/shop/${item.id}/edit`, { name: "VIP+", price: "2000", roleId: "", stock: "" });
  assert.equal(ok.status, 303);
  const edited = (await eco.service.item(GUILD, item.id))!;
  assert.deepEqual([edited.name, edited.price, edited.roleId, edited.stock], ["VIP+", 2000, null, null]);
  assert.equal((await post(`/dashboard/${GUILD}/economy/shop/${item.id}/remove`, {})).status, 303);
  assert.equal((await eco.service.items(GUILD)).length, 0);
  const again = await post(`/dashboard/${GUILD}/economy/shop/${item.id}/remove`, {});
  assert.match(again.headers.get("location") ?? "", /economy-item-missing/);
  const actions = await auditActions();
  for (const a of ["economy.shop.add", "economy.shop.edit", "economy.shop.remove"]) assert.ok(actions.includes(a), a);
});

test("adjust: CSRF, ID and amount validation, no bots, no overdraft; applied changes are audited and logged", async () => {
  assert.equal((await post(`/dashboard/${GUILD}/economy/adjust`, { userId: MEMBER, action: "give", amount: "5" }, false)).status, 403);
  assert.equal((await post(`/dashboard/${GUILD}/economy/adjust`, { userId: "{$gt:1}", action: "give", amount: "5" })).status, 400);
  assert.equal((await post(`/dashboard/${GUILD}/economy/adjust`, { userId: MEMBER, action: "give", amount: "-5" })).status, 400);
  assert.equal((await post(`/dashboard/${GUILD}/economy/adjust`, { userId: BOT_USER, action: "give", amount: "5" })).status, 400);
  assert.equal((await post(`/dashboard/${GUILD}/economy/adjust`, { userId: "500000000000000099", action: "give", amount: "5" })).status, 400, "unknown user");
  const give = await post(`/dashboard/${GUILD}/economy/adjust`, { userId: MEMBER, action: "give", amount: "250", reason: "Event winner" });
  assert.equal(give.status, 303);
  assert.equal((await eco.service.balance(GUILD, MEMBER)).balance, 250);
  const take = await post(`/dashboard/${GUILD}/economy/adjust`, { userId: MEMBER, action: "take", amount: "1000" });
  assert.equal(take.status, 409);
  assert.match(await take.text(), /Nothing was changed/);
  assert.equal((await eco.service.balance(GUILD, MEMBER)).balance, 250);
  const tx = eco.store.transactions.find(t => t.type === "admin_give")!;
  assert.equal(tx.actorId, USER);
  assert.equal(tx.note, "Event winner");
  assert.ok((await auditActions()).includes("economy.give"));
  const page = await (await get(`/dashboard/${GUILD}/economy`)).text();
  assert.match(page, /Staff gave/);
  assert.match(page, /💎 250 gems/);
});

test("member page shows the balance card while the economy is on", async () => {
  const html = await (await get(`/dashboard/${GUILD}/members/${MEMBER}`)).text();
  assert.match(html, /id="eco-card-h"/);
  assert.match(html, /💎 250 gems/);
  const botPage = await (await get(`/dashboard/${GUILD}/members/${BOT_USER}`)).text();
  assert.doesNotMatch(botPage, /id="eco-card-h"/);
});

test("adjust has its own tighter rate limit", async () => {
  const statuses: number[] = [];
  for (let i = 0; i < 3; i++) statuses.push((await post(`/dashboard/${GUILD}/economy/adjust`, { userId: MEMBER, action: "give", amount: "1" }, true, limitedUrl)).status);
  assert.deepEqual(statuses, [303, 303, 429]);
});

test("form parsers: settings need every field, shop roles need assignable-and-below, adjust actions are fixed", () => {
  assert.equal(parseEconomySettings({ currencyName: "x" }, DEFAULT_ECONOMY_CONFIG).ok, false);
  const ctx = { textChannelIds: new Set<string>(), roles: new Map([[LOW_ROLE, { assignable: true, aboveViewer: false }], [ABOVE_VIEWER, { assignable: true, aboveViewer: true }]]) };
  assert.ok(parseShopItemForm({ name: "A", price: "1", roleId: LOW_ROLE }, ctx, GUILD).ok);
  assert.ok(!parseShopItemForm({ name: "A", price: "1", roleId: ABOVE_VIEWER }, ctx, GUILD).ok);
  assert.ok(!parseAdjustForm({ userId: MEMBER, action: "drop", amount: "1" }).ok);
  const reset = parseAdjustForm({ userId: MEMBER, action: "reset" });
  assert.ok(reset.ok && reset.value.amount === 0);
  assert.ok(!parseAdjustForm({ userId: MEMBER, action: "give", amount: "1", reason: "r".repeat(201) }).ok);
  const opts = shopRoleOptions([{ id: "1", name: "A", position: 1, assignable: true }, { id: "2", name: "B", position: 9, assignable: false }], "2");
  assert.deepEqual(opts.map(o => [o.value, Boolean(o.disabled)]), [["", false], ["1", false], ["2", true]], "a saved role that can't be sold stays listed but disabled");
});
