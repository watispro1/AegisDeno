/**
 * Dashboard Premium page and portal, the Premium-only CSP, the /premium
 * command and the public page. Fake bot, in-memory sessions and stores.
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
import type { BotView } from "../src/web/dashboard/botView";
import type { DashboardData, SettingsSnapshot } from "../src/web/dashboard/data";
import type { SiteConfig } from "../src/web/pages";
import { renderPremium, renderPricing, renderRefunds, renderTerms } from "../src/web/pages";
import { normalizeGuildConfig } from "../src/services/guildConfigNormalize";
import { memoryPremiumStore } from "../src/services/premiumStore";
import { isStripeSubscription, renderPremiumPage } from "../src/web/dashboard/views/premium";
import type { Entitlement } from "../src/services/premiumState";
import type { StripeConfig } from "../src/config/stripe";
import type { DiscordPremiumOffer } from "../src/config/discordSku";
import { CONTENT_SECURITY_POLICY, PREMIUM_CONTENT_SECURITY_POLICY, isPremiumCheckoutPath, securityHeaders } from "../src/web/securityHeaders";
import { command as premiumCommand, premiumStatusLine } from "../src/commands/general/premium";
import { portalUrl } from "../src/services/stripeApi";

const SECRET = "s".repeat(64);
const STAFF = "900000000000000001", MEMBER = "900000000000000002", STRANGER = "900000000000000003";
const GUILD = "800000000000000001";
const SUB = "sub_1ABCDEF01234567890abcdef", CTM = "cus_1ABCDEF01234567890abcdef";
const site: SiteConfig = { inviteUrl: "#", supportUrl: "", version: "test", contactEmail: "", assetVersion: "t" };
const stripe: StripeConfig = {
  secretKey: "sk_test_51HtestSecretKey0000000000",
  publishableKey: "pk_test_51HtestPubKey0000000000",
  priceId: "price_1ABC123DefGhiJklMnoPqrSt",
  webhookSecret: "whsec_testSecretKey1234567890abcdef",
  isLive: false,
};
const SKU = "123456789012345678", APP_ID = "223456789012345678";
const STORE_URL = `https://discord.com/application-directory/${APP_ID}/store/${SKU}`;
const discordOffer: DiscordPremiumOffer = { storeUrl: STORE_URL, skuId: SKU };
const bot: BotView = {
  hasGuild: id => id === GUILD, guild: id => (id === GUILD ? { id, name: "Test <b>Guild</b>", memberCount: 10, iconUrl: null } : null),
  memberCanManage: async (g, u) => g === GUILD && u === STAFF, memberHasPermission: async () => true,
  textChannels: () => [], hiddenChannelIds: () => new Set(),
  roles: () => [], viewerRoleLimit: async () => ({ ownerId: "1", topPosition: 5 }), userName: id => (id === MEMBER ? "buyer-name" : null),
};
const data = { loadSettings: async () => ({ guild: normalizeGuildConfig(GUILD) }) as unknown as SettingsSnapshot } as unknown as DashboardData;
const store = memoryPremiumStore();
const portalCalls: Array<{ url: string; auth: string; body: string }> = [];
let portalOk = true;
const fakeStripe = async (url: string, init: { headers: Record<string, string>; body?: string }) => {
  portalCalls.push({ url, auth: init.headers.Authorization, body: init.body ?? "" });
  if (url.includes("/checkout/sessions")) {
    return {
      ok: portalOk,
      status: portalOk ? 200 : 500,
      json: async () => ({ id: "cs_test_123", url: "https://checkout.stripe.com/c/pay/cs_test_123" }),
    };
  }
  return {
    ok: portalOk,
    status: portalOk ? 200 : 500,
    json: async () => ({ url: "https://billing.stripe.com/session/test_token" }),
  };
};
let server: Server, url = "";
const cookies: Record<string, string> = {}, csrfs: Record<string, string> = {};
let offered = true;
let onDiscord = true;

before(async () => {
  const config = readDashboardConfig({ DISCORD_APPLICATION_ID: "123456789012345678", DISCORD_CLIENT_SECRET: "x", DASHBOARD_SESSION_SECRET: SECRET, DASHBOARD_REDIRECT_URI: "http://127.0.0.1/dashboard/callback" })!;
  const sessions = memorySessionStore();
  const now = Date.now();
  for (const [uid, inGuild] of [[STAFF, true], [MEMBER, true], [STRANGER, false]] as const) {
    const sid = `session-${uid}-premium-tests-0123`;
    await sessions.create(sid, { userId: uid, username: `u${uid.slice(-1)}`, globalName: null, avatar: null, accessToken: "t", tokenExpiresAt: new Date(now + 1e9), guilds: inGuild ? [{ id: GUILD, name: "Test", icon: null, owner: false, permissions: "0" }] : [], guildsFetchedAt: new Date(now), createdAt: new Date(now), expiresAt: new Date(now + 1e9) });
    cookies[uid] = `${cookieNames(config.secureCookies).session}=${encodeURIComponent(signSessionId(SECRET, sid))}`;
    csrfs[uid] = csrfToken(SECRET, sid);
  }
  const app = express();
  app.use((req, res, next) => { for (const [k, v] of Object.entries(securityHeaders(req.path))) res.setHeader(k, v); next(); });
  app.use("/dashboard", createDashboardRouter({ site, config, bot, data, sessions, audit: memoryAuditStore(), limits: { auth: 100, post: 1000, page: 2000 },
    premium: { store, stripe: () => (offered ? stripe : null), discord: () => (onDiscord ? discordOffer : null), stripeFetch: fakeStripe } }));
  server = app.listen(0);
  await new Promise(r => server.once("listening", r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

const get = (path: string, uid: string) => fetch(url + path, { headers: { cookie: cookies[uid] }, redirect: "manual" });
const post = (path: string, uid: string, form: Record<string, string>) => fetch(url + path, {
  method: "POST", redirect: "manual",
  headers: { cookie: cookies[uid], "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ _csrf: csrfs[uid], ...form }).toString(),
});

function active(over: Partial<Entitlement> = {}): Entitlement {
  const at = new Date();
  return { guildId: GUILD, userId: MEMBER, subscriptionId: SUB, customerId: CTM, status: "active", currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000), pastDueSince: null, cancelAt: null, lastEventAt: at, createdAt: at, updatedAt: at, ...over };
}

test("a plain member gets Subscribe in Discord, never a checkout, and no Stripe.js even with every Stripe secret set", async () => {
  assert.ok(offered && stripe.secretKey && stripe.publishableKey && stripe.priceId && stripe.webhookSecret, "Stripe fully configured");
  const res = await get(`/dashboard/${GUILD}/premium`, MEMBER);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes(`href="${STORE_URL}"`), "links the SKU in the app's Discord store");
  assert.ok(html.includes("Subscribe in Discord"));
  assert.ok(html.includes("/premium") && html.includes("Subscribe</strong>"), "how-to copy");
  assert.ok(!html.includes("data-premium-checkout") && !html.includes("data-premium-subscribe"), "no checkout UI");
  assert.ok(!html.includes(`/premium/checkout`), "no checkout form");
  assert.doesNotMatch(html, /js\.stripe\.com/, "Stripe.js never loads");
  assert.ok(!html.includes("/assets/premium.js"));
  assert.ok(!html.includes(stripe.publishableKey) && !html.includes(stripe.priceId), "no Stripe settings on the page");
  assert.ok(html.includes("Test &lt;b&gt;Guild&lt;/b&gt;"), "server name escaped");
  assert.ok(!html.includes(stripe.secretKey) && !html.includes(stripe.webhookSecret), "server secrets never reach the page");
  assert.doesNotMatch(html, /<script>(?!\s*\{)|\sstyle=|\son[a-z]+=/i, "no inline script, style or handlers");
  assert.equal(res.headers.get("content-security-policy"), PREMIUM_CONTENT_SECURITY_POLICY);
  const other = await get(`/dashboard/${GUILD}/digest`, STAFF);
  assert.equal(other.headers.get("content-security-policy"), CONTENT_SECURITY_POLICY, "every other page keeps the strict policy");
});

test("without the Discord SKU the page says Coming soon on Discord, with no price call to action", async () => {
  onDiscord = false;
  try {
    const html = await (await get(`/dashboard/${GUILD}/premium`, MEMBER)).text();
    assert.ok(html.includes("Coming soon on Discord"));
    assert.ok(!html.includes("Subscribe in Discord") && !html.includes("application-directory"));
    assert.doesNotMatch(html, /js\.stripe\.com|data-premium-checkout/);
  } finally { onDiscord = true; }
});

test("checkout answers 403 web_checkout_disabled even with every Stripe secret set, and never calls Stripe", async () => {
  const before = portalCalls.length;
  for (const uid of [MEMBER, STAFF, STRANGER]) {
    const res = await post(`/dashboard/${GUILD}/premium/checkout`, uid, {});
    assert.equal(res.status, 403, uid);
    assert.deepEqual(await res.json(), { error: "web_checkout_disabled" });
  }
  // Without a session or CSRF token too: the switch is checked first.
  const anon = await fetch(`${url}/dashboard/${GUILD}/premium/checkout`, { method: "POST", redirect: "manual" });
  assert.equal(anon.status, 403);
  assert.deepEqual(await anon.json(), { error: "web_checkout_disabled" });
  assert.equal(portalCalls.length, before, "no Stripe API call");
  assert.ok(!portalCalls.some(c => c.url.includes("/checkout/sessions")), "never a checkout session");
});

test("staff see the page in the sidebar layout; strangers are refused; hidden with neither Discord nor Stripe", async () => {
  const staff = await (await get(`/dashboard/${GUILD}/premium`, STAFF)).text();
  assert.ok(staff.includes('id="dash-sidebar"'));
  assert.equal((await get(`/dashboard/${GUILD}/premium`, STRANGER)).status, 403);
  assert.equal((await get(`/dashboard/800000000000000009/premium`, MEMBER)).status, 404);
  offered = false;
  try {
    assert.equal((await get(`/dashboard/${GUILD}/premium`, MEMBER)).status, 200, "Discord alone is enough");
    onDiscord = false;
    assert.equal((await get(`/dashboard/${GUILD}/premium`, MEMBER)).status, 404);
  } finally { offered = true; onDiscord = true; }
});

test("an active server shows the badge and no second checkout; only the buyer gets billing controls", async () => {
  await store.save(active());
  const buyer = await (await get(`/dashboard/${GUILD}/premium`, MEMBER)).text();
  assert.ok(!buyer.includes("data-premium-checkout") && !buyer.includes("Subscribe in Discord"), "no double subscription");
  assert.ok(!buyer.includes("js.stripe.com"));
  assert.ok(buyer.includes("Manage billing") && buyer.includes("Cancel subscription"));
  const staff = await (await get(`/dashboard/${GUILD}/premium`, STAFF)).text();
  assert.ok(!staff.includes("Manage billing"));
  assert.ok(staff.includes("buyer-name"));
  assert.ok(staff.includes('class="premium-badge"'), "sidebar badge");
  assert.ok((await (await get(`/dashboard/${GUILD}/digest`, STAFF)).text()).includes('class="premium-badge"'));
  // A stranger who bought it (left the server since) may still open it to cancel
  await store.save(active({ subscriptionId: "sub_1ABCDEF01234567890abcdez", userId: STRANGER, customerId: "cus_1ABCDEF01234567890abcdez", status: "canceled" }));
  assert.equal((await get(`/dashboard/${GUILD}/premium`, STRANGER)).status, 200);
});

test("a Discord subscription is managed in Discord: no Stripe portal buttons, and the portal refuses it", async () => {
  const discordSub = active({ subscriptionId: "discord_987654321098765432", customerId: `discord_${MEMBER}` });
  const html = renderPremiumPage(site, {
    guild: { id: GUILD, name: "Test", memberCount: 1, iconUrl: null },
    viewer: { userId: MEMBER, username: "m", globalName: null, csrf: "x" },
    premium: true,
    entitlement: discordSub,
    discord: discordOffer,
    stripePortal: true,
    buyerName: "buyer-name",
    noticeCode: null,
  });
  assert.ok(html.includes("Subscribed in Discord"));
  assert.ok(!html.includes("Manage billing") && !html.includes("/premium/portal"));
  assert.ok(!isStripeSubscription(discordSub) && isStripeSubscription(active()));
});

test("portal: buyer is redirected to Stripe customer portal; others get 403; failures fall back", async () => {
  await store.save(active());
  const res = await post(`/dashboard/${GUILD}/premium/portal`, MEMBER, { action: "cancel" });
  assert.equal(res.status, 303);
  assert.match(res.headers.get("location") ?? "", /^https:\/\/billing\.stripe\.com\/session\/test/);
  const call = portalCalls.at(-1)!;
  assert.equal(call.url, "https://api.stripe.com/v1/billing_portal/sessions");
  assert.equal(call.auth, `Bearer ${stripe.secretKey}`);
  assert.ok(call.body.includes(`customer=${CTM}`));
  const overview = await post(`/dashboard/${GUILD}/premium/portal`, MEMBER, { action: "overview" });
  assert.match(overview.headers.get("location") ?? "", /^https:\/\/billing\.stripe\.com\/session\/test/);
  assert.equal((await post(`/dashboard/${GUILD}/premium/portal`, STAFF, { action: "overview" })).status, 403);
  const noCsrf = await fetch(`${url}/dashboard/${GUILD}/premium/portal`, { method: "POST", redirect: "manual", headers: { cookie: cookies[MEMBER], "content-type": "application/x-www-form-urlencoded" }, body: "action=cancel" });
  assert.equal(noCsrf.status, 403);
  portalOk = false;
  try {
    const failed = await post(`/dashboard/${GUILD}/premium/portal`, MEMBER, { action: "overview" });
    assert.equal(failed.headers.get("location"), `/dashboard/${GUILD}/premium?notice=premium-portal-failed`);
  } finally { portalOk = true; }
});

test("portalUrl only follows https links on Stripe's portal hosts", () => {
  assert.ok(portalUrl("https://billing.stripe.com/session/abc123xyz"));
  assert.ok(portalUrl("https://checkout.stripe.com/c/pay/cs_test_abc123"));
  assert.equal(portalUrl("https://evil.example/session"), null);
  assert.equal(portalUrl("http://billing.stripe.com/session"), null);
  assert.equal(portalUrl("javascript:alert(1)"), null);
});

test("Premium CSP: only the portal redirect to Stripe is allowed; no Stripe.js, frames or payment feature", () => {
  assert.ok(isPremiumCheckoutPath(`/dashboard/${GUILD}/premium`));
  assert.ok(isPremiumCheckoutPath(`/dashboard/${GUILD}/premium/portal`));
  assert.ok(isPremiumCheckoutPath(`/dashboard/${GUILD}/premium/checkout`));
  for (const p of ["/premium", "/dashboard", `/dashboard/${GUILD}`, `/dashboard/${GUILD}/premiumx`, "/dashboard/abc/premium"]) assert.ok(!isPremiumCheckoutPath(p), p);
  assert.ok(!PREMIUM_CONTENT_SECURITY_POLICY.includes("unsafe"));
  assert.ok(!CONTENT_SECURITY_POLICY.includes("stripe"));
  assert.match(PREMIUM_CONTENT_SECURITY_POLICY, /script-src 'self';/);
  assert.ok(!PREMIUM_CONTENT_SECURITY_POLICY.includes("js.stripe.com") && !PREMIUM_CONTENT_SECURITY_POLICY.includes("checkout.stripe.com"));
  assert.match(PREMIUM_CONTENT_SECURITY_POLICY, /frame-src 'none'/);
  assert.match(PREMIUM_CONTENT_SECURITY_POLICY, /form-action 'self' https:\/\/billing\.stripe\.com;/);
  assert.match(PREMIUM_CONTENT_SECURITY_POLICY, /frame-ancestors 'none'/);
  assert.match(securityHeaders(`/dashboard/${GUILD}/premium`)["Permissions-Policy"], /payment=\(\)/);
  assert.match(securityHeaders("/")["Permissions-Policy"], /payment=\(\)/);
});

test("/premium command is guild-only and its status lines cover every state", () => {
  const json = premiumCommand.data.toJSON() as { name: string; contexts?: number[] };
  assert.equal(json.name, "premium");
  assert.equal(premiumCommand.guildOnly, true);
  assert.match(premiumStatusLine({ premium: false, entitlement: null }), /doesn't have Premium/);
  assert.match(premiumStatusLine({ premium: true, entitlement: active() }), /is on, renewing <t:\d+:D>/);
  assert.match(premiumStatusLine({ premium: true, entitlement: active({ cancelAt: new Date(Date.now() + 86_400_000) }) }), /until <t:\d+:D>, then ends/);
  assert.match(premiumStatusLine({ premium: true, entitlement: active({ status: "past_due", pastDueSince: new Date() }) }), /payment failed/);
  assert.match(premiumStatusLine({ premium: false, entitlement: active({ status: "canceled" }) }), /has ended/);
});

test("public /premium page: Subscribe in Discord when the SKU is set, Coming soon on Discord otherwise, never a web checkout", () => {
  const on = renderPremium(site, discordOffer);
  assert.ok(on.includes("$5 / month") && on.includes("Autoresponders"));
  assert.ok(on.includes(`href="${STORE_URL}"`) && on.includes("Subscribe in Discord"), "Discord CTA rendered");
  assert.ok(!on.includes("Coming soon on Discord"));
  const off = renderPremium(site, null);
  assert.ok(off.includes("Coming soon on Discord"));
  assert.ok(!off.includes("Subscribe in Discord") && !off.includes("application-directory"), "no price CTA without the SKU");
  for (const html of [on, off]) {
    assert.doesNotMatch(html, /\/premium\/checkout|js\.stripe\.com|Open the dashboard/);
    assert.doesNotMatch(html, /\sstyle=|\son[a-z]+=/i);
  }
});

test("Discord billing copy is on /premium, /refunds and the Terms Premium section", () => {
  const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&#39;/g, "'").replace(/\s+/g, " ");
  for (const html of [renderPremium(site, discordOffer), renderPremium(site, null), renderRefunds(site, discordOffer), renderRefunds(site)]) {
    const t = text(html);
    assert.ok(t.includes("billed by Discord as an in-app subscription"));
    assert.ok(t.includes("can't be bought on the Aegis website"));
  }
  const terms = renderTerms(site, discordOffer);
  const premiumSection = terms.slice(terms.indexOf('id="premium"'), terms.indexOf('id="acceptable-use"'));
  assert.ok(text(premiumSection).includes("sold only as a Discord in-app subscription"));
  assert.doesNotMatch(premiumSection, /handled by Paddle|billed monthly via Stripe/);
  assert.doesNotMatch(renderRefunds(site), /\sstyle=|\son[a-z]+=/i);
});

test("public /pricing page compares Free vs Premium with the Discord CTA, and is CSP-clean", () => {
  const on = renderPricing(site, discordOffer);
  assert.ok(on.includes("$5 / month"));
  assert.ok(on.includes("Free forever"));
  assert.ok(on.includes("✦ Premium"));
  assert.ok(on.includes("Autoresponders"));
  assert.ok(on.includes(`href="${STORE_URL}"`) && on.includes("Subscribe in Discord"));
  assert.ok(on.includes('href="/refunds"'));
  assert.ok(!on.includes("Upgrade on Dashboard") && !on.includes("Checkout details"));
  assert.doesNotMatch(on, /\sstyle=|\son[a-z]+=/i);

  const off = renderPricing(site, null);
  assert.ok(off.includes("Coming soon on Discord"));
  assert.ok(!off.includes("application-directory"));
  assert.doesNotMatch(off, /\sstyle=|\son[a-z]+=/i);
});

test("dedicated /refunds page: Discord handles refunds and cancellation", () => {
  const html = renderRefunds(site);
  assert.ok(html.includes("Refund and Cancellation Policy"));
  assert.ok(html.includes("Cancellation Policy"));
  assert.ok(html.includes("What Happens When Premium Ends"));
  assert.ok(html.includes("https://discord.com/terms/paid-services-terms"));
  assert.ok(html.includes("/terms#premium"));
  assert.ok(html.includes("/pricing"));
  assert.doesNotMatch(html, /\sstyle=|\son[a-z]+=/i);
});
