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
import type { Entitlement } from "../src/services/premiumState";
import type { StripeConfig } from "../src/config/stripe";
import { CONTENT_SECURITY_POLICY, PREMIUM_CONTENT_SECURITY_POLICY, isPremiumCheckoutPath, securityHeaders } from "../src/web/securityHeaders";
import { premiumScript } from "../src/web/dashboard/clientPremium";
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
    premium: { store, stripe: () => (offered ? stripe : null), stripeFetch: fakeStripe } }));
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

test("a plain member can open the Premium page and gets the checkout, with Stripe's CSP only there", async () => {
  const res = await get(`/dashboard/${GUILD}/premium`, MEMBER);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes("data-premium-checkout"));
  assert.ok(html.includes(`data-guild="${GUILD}"`) && html.includes(`data-user="${MEMBER}"`));
  assert.ok(html.includes(`data-price="${stripe.priceId}"`));
  assert.ok(html.includes('src="https://js.stripe.com/v3/"'));
  assert.ok(html.includes("Test &lt;b&gt;Guild&lt;/b&gt;"), "server name escaped");
  assert.ok(!html.includes(stripe.secretKey) && !html.includes(stripe.webhookSecret), "server secrets never reach the page");
  assert.doesNotMatch(html, /<script>(?!\s*\{)|\sstyle=|\son[a-z]+=/i, "no inline script, style or handlers");
  assert.equal(res.headers.get("content-security-policy"), PREMIUM_CONTENT_SECURITY_POLICY);
  const other = await get(`/dashboard/${GUILD}/digest`, STAFF);
  assert.equal(other.headers.get("content-security-policy"), CONTENT_SECURITY_POLICY, "every other page keeps the strict policy");
});

test("staff see the page in the sidebar layout; strangers are refused; hidden without Stripe", async () => {
  const staff = await (await get(`/dashboard/${GUILD}/premium`, STAFF)).text();
  assert.ok(staff.includes('id="dash-sidebar"'));
  assert.equal((await get(`/dashboard/${GUILD}/premium`, STRANGER)).status, 403);
  assert.equal((await get(`/dashboard/800000000000000009/premium`, MEMBER)).status, 404);
  offered = false;
  try {
    assert.equal((await get(`/dashboard/${GUILD}/premium`, MEMBER)).status, 404);
  } finally { offered = true; }
});

test("an active server shows the badge and no second checkout; only the buyer gets billing controls", async () => {
  await store.save(active());
  const buyer = await (await get(`/dashboard/${GUILD}/premium`, MEMBER)).text();
  assert.ok(!buyer.includes("data-premium-checkout"), "no double subscription");
  assert.ok(!buyer.includes("js.stripe.com/v3/"));
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

test("checkout: buyer POST creates Stripe checkout session and redirects", async () => {
  const store2 = memoryPremiumStore();
  const res = await post(`/dashboard/${GUILD}/premium/checkout`, MEMBER, {});
  assert.equal(res.status, 303);
  assert.match(res.headers.get("location") ?? "", /^https:\/\/checkout\.stripe\.com\/c\/pay\/cs_test/);
  const call = portalCalls.at(-1)!;
  assert.equal(call.url, "https://api.stripe.com/v1/checkout/sessions");
  assert.equal(call.auth, `Bearer ${stripe.secretKey}`);
  assert.ok(call.body.includes(`client_reference_id=${GUILD}`));
});

test("portalUrl only follows https links on Stripe's portal hosts", () => {
  assert.ok(portalUrl("https://billing.stripe.com/session/abc123xyz"));
  assert.ok(portalUrl("https://checkout.stripe.com/c/pay/cs_test_abc123"));
  assert.equal(portalUrl("https://evil.example/session"), null);
  assert.equal(portalUrl("http://billing.stripe.com/session"), null);
  assert.equal(portalUrl("javascript:alert(1)"), null);
});

test("Premium CSP: Stripe allowed only where needed, still no unsafe-inline", () => {
  assert.ok(isPremiumCheckoutPath(`/dashboard/${GUILD}/premium`));
  assert.ok(isPremiumCheckoutPath(`/dashboard/${GUILD}/premium/portal`));
  assert.ok(isPremiumCheckoutPath(`/dashboard/${GUILD}/premium/checkout`));
  for (const p of ["/premium", "/dashboard", `/dashboard/${GUILD}`, `/dashboard/${GUILD}/premiumx`, "/dashboard/abc/premium"]) assert.ok(!isPremiumCheckoutPath(p), p);
  assert.ok(!PREMIUM_CONTENT_SECURITY_POLICY.includes("unsafe"));
  assert.ok(!CONTENT_SECURITY_POLICY.includes("stripe"));
  assert.match(PREMIUM_CONTENT_SECURITY_POLICY, /script-src 'self' https:\/\/js\.stripe\.com;/);
  assert.match(PREMIUM_CONTENT_SECURITY_POLICY, /frame-src https:\/\/js\.stripe\.com https:\/\/checkout\.stripe\.com/);
  assert.match(PREMIUM_CONTENT_SECURITY_POLICY, /frame-ancestors 'none'/);
  assert.match(securityHeaders(`/dashboard/${GUILD}/premium`)["Permissions-Policy"], /payment=\(self "https:\/\/checkout\.stripe\.com"\)/);
  assert.match(securityHeaders("/")["Permissions-Policy"], /payment=\(\)/);
});

test("premium.js handles form submission and status message", () => {
  assert.match(premiumScript, /data-premium-checkout/);
  assert.match(premiumScript, /data-premium-subscribe/);
  assert.match(premiumScript, /Redirecting to secure Stripe checkout/);
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

test("public /premium page shows the price and limits, and says when it is not on sale", () => {
  const on = renderPremium(site, true);
  assert.ok(on.includes("$5 / month") && on.includes("Autoresponders") && on.includes('href="/dashboard"'));
  assert.ok(on.includes("Stripe"));
  assert.ok(renderPremium(site, false).includes("Not on sale yet"));
  assert.doesNotMatch(on, /\sstyle=|\son[a-z]+=/i);
});

test("refund policy: the same 14-day policy is on /premium (on sale or not) and in the Terms Premium section", () => {
  const policy = "Aegis Premium is $5 USD per month per server, billed monthly via Stripe. You can cancel anytime from the dashboard Premium page; Premium stays active until the end of the paid period and is not renewed. If you're not happy, request a full refund within 14 days of any payment through our support server; refunds after 14 days are not given except where required by law. All refunds are processed securely via Stripe.";
  const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
  for (const html of [renderPremium(site, true), renderPremium(site, false)]) {
    assert.ok(text(html).includes(policy), "policy on /premium");
  }
  const terms = renderTerms(site);
  const premiumSection = terms.slice(terms.indexOf('id="premium"'), terms.indexOf('id="acceptable-use"'));
  assert.ok(text(premiumSection).includes(policy), "policy in the Terms Premium section");
  assert.doesNotMatch(premiumSection, /handled by Paddle/);
  const refunds = renderRefunds(site);
  assert.ok(text(refunds).includes(policy), "policy on /refunds");
  assert.doesNotMatch(refunds, /\sstyle=|\son[a-z]+=/i);
});

test("public /pricing page compares Free vs Premium, lists limits, and is CSP-clean", () => {
  const on = renderPricing(site, true);
  assert.ok(on.includes("$5 / month"));
  assert.ok(on.includes("Free forever"));
  assert.ok(on.includes("✦ Premium"));
  assert.ok(on.includes("Autoresponders"));
  assert.ok(on.includes("Stripe"));
  assert.ok(on.includes('href="/refunds"'));
  assert.ok(on.includes('href="/dashboard"'));
  assert.doesNotMatch(on, /\sstyle=|\son[a-z]+=/i);

  const off = renderPricing(site, false);
  assert.ok(off.includes("Not on sale yet"));
  assert.doesNotMatch(off, /\sstyle=|\son[a-z]+=/i);
});

test("dedicated /refunds page details 14-day guarantee and cancellation steps", () => {
  const html = renderRefunds(site);
  assert.ok(html.includes("Refund and Cancellation Policy"));
  assert.ok(html.includes("14-Day Money-Back Guarantee"));
  assert.ok(html.includes("Cancellation Policy"));
  assert.ok(html.includes("What Happens When Premium Ends"));
  assert.ok(html.includes("Stripe"));
  assert.ok(html.includes("/terms#premium"));
  assert.ok(html.includes("/pricing"));
  assert.doesNotMatch(html, /\sstyle=|\son[a-z]+=/i);
});
