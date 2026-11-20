import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { parseStripeSignature, signStripePayload, verifyStripeSignature, STRIPE_SIGNATURE_TOLERANCE_SECONDS } from "../src/services/stripeSignature";
import { applyStripeEvent, entitlementActive, graceEndsAt, parseStripeEvent, primaryEntitlement, type Entitlement, type StripeEvent } from "../src/services/premiumState";
import { memoryPremiumStore } from "../src/services/premiumStore";
import { handleStripeEvent, isPremium, premiumLimit, setPremiumStore } from "../src/services/premium";
import { registerStripeWebhook, STRIPE_WEBHOOK_PATH } from "../src/web/stripeWebhook";
import { readStripeConfig, missingStripeSettings, premiumOffered, premiumPageAvailable, webCheckoutEnabled, WEB_CHECKOUT_ENABLED } from "../src/config/stripe";
import { PREMIUM_GRACE_DAYS, PREMIUM_LIMITS, limitValue } from "../src/config/premium";

const SECRET = "whsec_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const GUILD = "123456789012345678";
const USER = "223456789012345678";
const SUB = "sub_1ABCDEF01234567890abcdef";
const CTM = "cus_1ABCDEF01234567890abcdef";
const DAY = 86_400_000;
let seq = 0;
const evtId = () => `evt_1ABCDEF01234567890${String(++seq).padStart(5, "0")}`;

function subEvent(type: string, status: string, atSec: number, extra: Record<string, unknown> = {}): StripeEvent {
  return {
    eventId: evtId(),
    eventType: type,
    occurredAt: new Date(atSec * 1000),
    data: {
      id: SUB,
      customer: CTM,
      status,
      current_period_start: atSec,
      current_period_end: atSec + 30 * 86400,
      metadata: { guildId: GUILD, userId: USER },
      cancel_at: null,
      cancel_at_period_end: false,
      ...extra,
    },
  };
}

/* Signature verification */

test("verifyStripeSignature accepts a correct signature over the raw body", () => {
  const body = '{"id":"evt_1","data":{}}';
  const ts = 1_763_200_000;
  const header = `t=${ts},v1=${signStripePayload(SECRET, ts, body)}`;
  assert.deepEqual(verifyStripeSignature(Buffer.from(body), header, SECRET, ts * 1000), { ok: true, timestamp: ts });
});

test("verifyStripeSignature matches Stripe's documented algorithm (HMAC-SHA256 of t.body, hex)", () => {
  const { createHmac } = require("node:crypto") as typeof import("node:crypto");
  const expected = createHmac("sha256", SECRET).update("1671552777.hello").digest("hex");
  assert.equal(signStripePayload(SECRET, 1671552777, "hello"), expected);
});

test("verifyStripeSignature rejects tampered bodies, wrong secrets and re-serialised JSON", () => {
  const body = '{"a": 1}';
  const ts = 1_763_200_000;
  const header = `t=${ts},v1=${signStripePayload(SECRET, ts, body)}`;
  assert.deepEqual(verifyStripeSignature(Buffer.from('{"a": 2}'), header, SECRET, ts * 1000), { ok: false, reason: "mismatch" });
  assert.deepEqual(verifyStripeSignature(Buffer.from(body), header, "other_secret", ts * 1000), { ok: false, reason: "mismatch" });
  assert.deepEqual(verifyStripeSignature(Buffer.from(JSON.stringify(JSON.parse(body))), header, SECRET, ts * 1000), { ok: false, reason: "mismatch" });
});

test("verifyStripeSignature enforces the timestamp tolerance both ways", () => {
  const body = "{}";
  const ts = 1_763_200_000;
  const header = `t=${ts},v1=${signStripePayload(SECRET, ts, body)}`;
  const tol = STRIPE_SIGNATURE_TOLERANCE_SECONDS;
  assert.equal(verifyStripeSignature(Buffer.from(body), header, SECRET, (ts + tol) * 1000).ok, true);
  assert.deepEqual(verifyStripeSignature(Buffer.from(body), header, SECRET, (ts + tol + 1) * 1000), { ok: false, reason: "expired" });
  assert.deepEqual(verifyStripeSignature(Buffer.from(body), header, SECRET, (ts - tol - 1) * 1000), { ok: false, reason: "expired" });
});

test("verifyStripeSignature handles missing, malformed and rotated headers", () => {
  const ts = 1_763_200_000;
  const good = signStripePayload(SECRET, ts, "{}");
  assert.deepEqual(verifyStripeSignature(Buffer.from("{}"), undefined, SECRET, ts * 1000), { ok: false, reason: "missing" });
  for (const bad of ["garbage", `t=abc,v1=${good}`, `t=${ts}`, `v1=${good}`, `t=${ts},v1=zz`, `t=${ts},t=${ts},v1=${good}`]) {
    assert.deepEqual(verifyStripeSignature(Buffer.from("{}"), bad, SECRET, ts * 1000), { ok: false, reason: "malformed" }, String(bad));
  }
  // During secret rotation Stripe sends multiple v1 values; either may match.
  const rotated = `t=${ts},v1=${"0".repeat(64)},v1=${good}`;
  assert.equal(verifyStripeSignature(Buffer.from("{}"), rotated, SECRET, ts * 1000).ok, true);
  assert.equal(parseStripeSignature(rotated)?.signatures.length, 2);
});

/* Event parsing and status transitions */

test("parseStripeEvent reads the envelope and refuses anything else", () => {
  const e = parseStripeEvent({
    id: "evt_1ABCDEF01234567890",
    type: "customer.subscription.created",
    created: 1763200000,
    data: { object: { id: SUB, customer: CTM, status: "active" } },
  });
  assert.equal(e?.eventType, "customer.subscription.created");
  assert.equal(parseStripeEvent({ id: "x", type: "customer.subscription.created", created: 1763200000, data: { object: {} } }), null);
  assert.equal(parseStripeEvent({ id: "evt_123", type: "customer.subscription.created", created: "nope", data: { object: {} } }), null);
  assert.equal(parseStripeEvent([]), null);
});

test("subscription lifecycle: created → past_due → active → canceled", () => {
  const now = new Date("2026-11-15T10:00:00Z");
  const atSec = Math.floor(now.getTime() / 1000);
  let t = applyStripeEvent(null, subEvent("customer.subscription.created", "active", atSec), now);
  assert.equal(t.kind, "apply");
  let e = (t as { entitlement: Entitlement }).entitlement;
  assert.deepEqual([e.guildId, e.userId, e.customerId, e.status], [GUILD, USER, CTM, "active"]);
  assert.equal(e.currentPeriodEnd?.toISOString(), new Date((atSec + 30 * 86400) * 1000).toISOString());

  t = applyStripeEvent(e, subEvent("customer.subscription.updated", "past_due", atSec + 30 * 86400), now);
  e = (t as { entitlement: Entitlement }).entitlement;
  assert.equal(e.status, "past_due");
  assert.equal(e.pastDueSince?.toISOString(), new Date((atSec + 30 * 86400) * 1000).toISOString());

  // A second past_due update keeps the original start of the grace period
  t = applyStripeEvent(e, subEvent("customer.subscription.updated", "past_due", atSec + 31 * 86400), now);
  e = (t as { entitlement: Entitlement }).entitlement;
  assert.equal(e.pastDueSince?.toISOString(), new Date((atSec + 30 * 86400) * 1000).toISOString());

  // Renewal succeeds -> active
  t = applyStripeEvent(e, subEvent("customer.subscription.updated", "active", atSec + 32 * 86400, { current_period_end: atSec + 60 * 86400 }), now);
  e = (t as { entitlement: Entitlement }).entitlement;
  assert.equal(e.status, "active");
  assert.equal(e.pastDueSince, null);

  // Scheduled cancellation
  const cancelTime = atSec + 60 * 86400;
  t = applyStripeEvent(e, subEvent("customer.subscription.updated", "active", atSec + 35 * 86400, { cancel_at: cancelTime }), now);
  e = (t as { entitlement: Entitlement }).entitlement;
  assert.equal(e.cancelAt?.toISOString(), new Date(cancelTime * 1000).toISOString());

  // Cancellation takes effect
  t = applyStripeEvent(e, subEvent("customer.subscription.deleted", "canceled", cancelTime), now);
  e = (t as { entitlement: Entitlement }).entitlement;
  assert.deepEqual([e.status, e.cancelAt, e.currentPeriodEnd], ["canceled", null, null]);
});

test("invoice.payment_succeeded clears past_due but never revives a canceled subscription", () => {
  const now = new Date("2026-12-16T00:00:00Z");
  const pastDue = (applyStripeEvent(null, subEvent("customer.subscription.updated", "past_due", 1765756800), now) as { entitlement: Entitlement }).entitlement;
  const paid: StripeEvent = {
    eventId: evtId(),
    eventType: "invoice.payment_succeeded",
    occurredAt: new Date(1765778400 * 1000),
    data: {
      id: "in_123",
      subscription: SUB,
      customer: CTM,
      metadata: { guildId: GUILD, userId: USER },
      lines: { data: [{ period: { end: 1768435200 } }] },
    },
  };
  const after = (applyStripeEvent(pastDue, paid, now) as { entitlement: Entitlement }).entitlement;
  assert.deepEqual([after.status, after.pastDueSince, after.currentPeriodEnd?.toISOString()], ["active", null, new Date(1768435200 * 1000).toISOString()]);

  const canceled = { ...after, status: "canceled" as const, lastEventAt: new Date(1765770000 * 1000) };
  assert.equal((applyStripeEvent(canceled, paid, now) as { entitlement: Entitlement }).entitlement.status, "canceled");
});

test("out-of-order, unattributed and unrelated events are ignored", () => {
  const now = new Date("2026-11-15T10:00:00Z");
  const e = (applyStripeEvent(null, subEvent("customer.subscription.updated", "canceled", 1764547200), now) as { entitlement: Entitlement }).entitlement;
  assert.deepEqual(applyStripeEvent(e, subEvent("customer.subscription.updated", "active", 1763683200), now), { kind: "ignore", reason: "stale" });
  assert.deepEqual(applyStripeEvent(null, subEvent("customer.subscription.created", "active", 1763200000, { metadata: null }), now), { kind: "ignore", reason: "no-guild" });
  assert.deepEqual(applyStripeEvent(null, subEvent("customer.subscription.created", "active", 1763200000, { metadata: { guildId: "1; drop" } }), now), { kind: "ignore", reason: "no-guild" });
  assert.deepEqual(applyStripeEvent(null, subEvent("customer.subscription.created", "weird_status", 1763200000), now), { kind: "ignore", reason: "bad-status" });
  assert.deepEqual(applyStripeEvent(null, { ...subEvent("x", "active", 1763200000), eventType: "customer.updated" }, now), { kind: "ignore", reason: "unhandled" });
  // metadata can't move an existing subscription to another server
  const moved = applyStripeEvent(e, subEvent("customer.subscription.updated", "active", 1764633600, { metadata: { guildId: "999999999999999999", userId: USER } }), now);
  assert.equal((moved as { entitlement: Entitlement }).entitlement.guildId, GUILD);
});

/* isPremium and the grace period */

function ent(over: Partial<Entitlement>): Entitlement {
  const at = new Date("2026-11-15T00:00:00Z");
  return {
    guildId: GUILD,
    userId: USER,
    subscriptionId: SUB,
    customerId: CTM,
    status: "active",
    currentPeriodEnd: new Date("2026-12-15T00:00:00Z"),
    pastDueSince: null,
    cancelAt: null,
    lastEventAt: at,
    createdAt: at,
    updatedAt: at,
    ...over,
  };
}

test("entitlementActive: past_due keeps Premium for the grace period, then drops it", () => {
  const since = new Date("2026-12-15T00:00:00Z");
  const e = ent({ status: "past_due", pastDueSince: since });
  assert.equal(PREMIUM_GRACE_DAYS, 3);
  assert.equal(entitlementActive(e, new Date(since.getTime() + 3 * DAY - 1)), true);
  assert.equal(entitlementActive(e, new Date(since.getTime() + 3 * DAY)), false);
  assert.equal(graceEndsAt(e)?.toISOString(), "2026-12-18T00:00:00.000Z");
  assert.equal(graceEndsAt(ent({})), null);
});

test("entitlementActive: active until period end plus grace; paused and canceled never", () => {
  const end = new Date("2026-12-15T00:00:00Z");
  assert.equal(entitlementActive(ent({}), new Date("2026-12-17T23:00:00Z")), true);
  assert.equal(entitlementActive(ent({}), new Date(end.getTime() + 3 * DAY)), false);
  assert.equal(entitlementActive(ent({ currentPeriodEnd: null }), new Date("2030-01-01T00:00:00Z")), true);
  assert.equal(entitlementActive(ent({ status: "trialing" }), new Date("2026-11-20T00:00:00Z")), true);
  assert.equal(entitlementActive(ent({ status: "paused" }), new Date("2026-11-20T00:00:00Z")), false);
  assert.equal(entitlementActive(ent({ status: "canceled" }), new Date("2026-11-20T00:00:00Z")), false);
});

test("primaryEntitlement prefers an active subscription over a newer canceled one", () => {
  const now = new Date("2026-11-20T00:00:00Z");
  const a = ent({ subscriptionId: "sub_a", updatedAt: new Date("2026-11-01T00:00:00Z") });
  const c = ent({ subscriptionId: "sub_c", status: "canceled", updatedAt: new Date("2026-11-19T00:00:00Z") });
  assert.equal(primaryEntitlement([c, a], now)?.subscriptionId, "sub_a");
  assert.equal(primaryEntitlement([c], now)?.subscriptionId, "sub_c");
  assert.equal(primaryEntitlement([], now), null);
});

test("isPremium caches, honours grace, and the webhook clears the cache", async () => {
  const store = memoryPremiumStore();
  setPremiumStore(store);
  try {
    const t0 = Date.parse("2026-12-15T00:00:00Z");
    assert.equal(await isPremium(GUILD, t0), false);
    await store.save(ent({ status: "past_due", pastDueSince: new Date(t0) }));
    assert.equal(await isPremium(GUILD, t0 + 1000), false);
    assert.equal(await isPremium(GUILD, t0 + 61_000), true);
    assert.equal(await premiumLimit(GUILD, "autoresponders"), limitValue("autoresponders", true));
    assert.equal(await isPremium(GUILD, t0 + 3 * DAY + 61_000), false);
    // A webhook for the guild clears its cache entry immediately
    await handleStripeEvent(subEvent("customer.subscription.updated", "active", Math.floor((t0 + 3 * DAY + 62_000) / 1000)), store, t0 + 3 * DAY + 62_000);
    assert.equal(await isPremium(GUILD, t0 + 3 * DAY + 63_000), true);
    assert.equal(await isPremium("not-a-guild"), false);
    assert.equal(await isPremium(null), false);
  } finally {
    setPremiumStore(null);
  }
});

test("isPremium answers false (uncached) when the store fails", async () => {
  const store = memoryPremiumStore();
  setPremiumStore({ ...store, forGuild: async () => { throw new Error("db down"); } });
  try {
    assert.equal(await isPremium(GUILD), false);
  } finally {
    setPremiumStore(null);
  }
});

test("free caps are today's caps and Premium only raises them", () => {
  for (const l of Object.values(PREMIUM_LIMITS)) assert.ok(l.premium >= l.free);
  assert.equal(limitValue("autoresponders", false), 50);
  assert.equal(limitValue("shopItems", false), 50);
  assert.equal(limitValue("modmailSnippets", false), 50);
});

/* Idempotency */

test("handleStripeEvent is idempotent by event ID", async () => {
  const store = memoryPremiumStore();
  const e = subEvent("customer.subscription.created", "active", 1763200000);
  assert.equal((await handleStripeEvent(e, store)).outcome, "applied");
  await store.save({ ...(await store.bySubscription(SUB))!, status: "paused" });
  assert.equal((await handleStripeEvent(e, store)).outcome, "duplicate");
  assert.equal((await store.bySubscription(SUB))?.status, "paused", "a redelivery changes nothing");
  assert.equal(store.events.size, 1);
  const ignored = await handleStripeEvent({ ...subEvent("x", "active", 1763200000), eventType: "customer.created" }, store);
  assert.equal(ignored.outcome, "ignored");
});

test("a failed apply is not recorded, so Stripe's retry is applied", async () => {
  const store = memoryPremiumStore();
  let fail = true;
  const flaky = { ...store, save: async (x: Entitlement) => { if (fail) throw new Error("write failed"); return store.save(x); } };
  const e = subEvent("customer.subscription.created", "active", 1763200000);
  await assert.rejects(handleStripeEvent(e, flaky));
  fail = false;
  assert.equal((await handleStripeEvent(e, flaky)).outcome, "applied");
});

/* The HTTP endpoint */

async function withServer(deps: Parameters<typeof registerStripeWebhook>[1], run: (url: string) => Promise<void>) {
  const app = express();
  registerStripeWebhook(app, deps);
  const server = app.listen(0);
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}${STRIPE_WEBHOOK_PATH}`);
  } finally {
    server.close();
  }
}

test("POST /api/stripe/webhook: 503 unconfigured, 401 bad signature, 200 then duplicate", async () => {
  await withServer({ secret: () => null }, async url => {
    assert.equal((await fetch(url, { method: "POST", body: "{}" })).status, 503);
  });
  const store = memoryPremiumStore();
  const nowMs = Date.parse("2026-11-15T10:00:05Z");
  await withServer({ secret: () => SECRET, store, now: () => nowMs }, async url => {
    const rawData = subEvent("customer.subscription.created", "active", Math.floor(nowMs / 1000)).data;
    const body = JSON.stringify({
      id: "evt_1ABCDEF0123456789000001",
      type: "customer.subscription.created",
      created: Math.floor(nowMs / 1000),
      data: { object: rawData },
    });
    const ts = Math.floor(nowMs / 1000);
    const sig = `t=${ts},v1=${signStripePayload(SECRET, ts, body)}`;
    const headers = { "Content-Type": "application/json", "Stripe-Signature": sig };

    // Malformed signature header -> 400
    assert.equal((await fetch(url, { method: "POST", body })).status, 400);

    // Tampered payload -> 401
    assert.equal((await fetch(url, { method: "POST", body: body.replace("active", "paused"), headers })).status, 401);

    // Good payload -> 200 applied
    const first = await fetch(url, { method: "POST", body, headers });
    assert.equal(first.status, 200);
    assert.equal((await first.json() as { outcome: string }).outcome, "applied");
    assert.equal((await store.bySubscription(SUB))?.guildId, GUILD);

    // Duplicate -> 200 duplicate
    const again = await fetch(url, { method: "POST", body, headers });
    assert.equal((await again.json() as { outcome: string }).outcome, "duplicate");

    // Unparseable JSON -> 400
    const junk = "not json";
    assert.equal((await fetch(url, { method: "POST", body: junk, headers: { "Stripe-Signature": `t=${ts},v1=${signStripePayload(SECRET, ts, junk)}` } })).status, 400);
  });
});

/* Config */

test("readStripeConfig needs every value and matching test/live keys", () => {
  const full = {
    STRIPE_SECRET_KEY: "sk_test_51HtestSecretKey0000000000",
    STRIPE_PUBLISHABLE_KEY: "pk_test_51HtestPubKey0000000000",
    STRIPE_PRICE_ID: "price_1ABC123DefGhiJklMnoPqrSt",
    STRIPE_WEBHOOK_SECRET: SECRET,
  };
  assert.equal(readStripeConfig(full)?.isLive, false);
  // Stripe alone never puts Premium on sale: it is sold only through Discord.
  assert.equal(premiumOffered(full), false);
  assert.equal(premiumPageAvailable(full), true, "the page stays for earlier Stripe subscribers");

  // Mismatched test secret + live publishable key
  assert.equal(readStripeConfig({ ...full, STRIPE_PUBLISHABLE_KEY: "pk_live_51HtestPubKey0000000000" }), null);

  // Missing a key
  assert.equal(readStripeConfig({ ...full, STRIPE_SECRET_KEY: "" }), null);
  assert.equal(premiumOffered({}), false);
  assert.deepEqual(missingStripeSettings({}), [
    "STRIPE_SECRET_KEY (missing)",
    "STRIPE_PUBLISHABLE_KEY (missing)",
    "STRIPE_PRICE_ID (missing)",
    "STRIPE_WEBHOOK_SECRET (missing)",
  ]);
  const s = JSON.stringify(missingStripeSettings(full));
  assert.ok(!s.includes(SECRET), "never logs secrets");
});

test("web checkout is hard-disabled; Premium is offered only with the Discord SKU and application ID", () => {
  assert.equal(WEB_CHECKOUT_ENABLED, false);
  assert.equal(webCheckoutEnabled(), false);
  const discord = { DISCORD_PREMIUM_SKU_ID: "123456789012345678", DISCORD_APPLICATION_ID: "223456789012345678" };
  assert.equal(premiumOffered(discord), true);
  assert.equal(premiumPageAvailable(discord), true);
  assert.equal(premiumOffered({ DISCORD_PREMIUM_SKU_ID: "123456789012345678" }), false, "no store link without the app ID");
  assert.equal(premiumOffered({ DISCORD_APPLICATION_ID: "223456789012345678" }), false, "no SKU, nothing to sell");
  assert.equal(premiumPageAvailable({}), false);
});

/* Benefits reach the existing caps */

test("Premium raises the shop cap from 50 to 100; a lapsed server keeps its items", async () => {
  const { EconomyService } = await import("../src/services/economyService");
  const { memoryEconomyStore } = await import("../src/services/economyStore");
  const premium = memoryPremiumStore();
  setPremiumStore(premium);
  try {
    const svc = new EconomyService(memoryEconomyStore());
    for (let i = 0; i < 50; i++) assert.ok((await svc.addItem(GUILD, { name: `Item ${i}`, price: i + 1 })).ok);
    const full = await svc.addItem(GUILD, { name: "Item 50", price: 1 });
    assert.equal(full.ok, false);
    assert.match(JSON.stringify(full), /The shop is full \(50 items\)/);
    await premium.save(ent({ currentPeriodEnd: new Date(Date.now() + 10 * DAY) }));
    setPremiumStore(premium);
    assert.ok((await svc.addItem(GUILD, { name: "Item 50", price: 1 })).ok);
    assert.equal((await svc.items(GUILD)).length, 51);
    await premium.save(ent({ status: "canceled" }));
    setPremiumStore(premium);
    assert.equal((await svc.items(GUILD)).length, 51, "nothing is removed when Premium ends");
    assert.equal((await svc.addItem(GUILD, { name: "Item 51", price: 1 })).ok, false);
  } finally {
    setPremiumStore(null);
  }
});

test("autoresponder trigger check takes the server's cap", async () => {
  const { validateTrigger, MAX_AUTORESPONDERS } = await import("../src/commands/autoresponder/autoresponder");
  const many = Array.from({ length: 50 }, (_, i) => ({ trigger: `t${i}`, matchType: "contains" as const }));
  assert.equal(MAX_AUTORESPONDERS, 50);
  assert.match(validateTrigger("new", "contains", many) ?? "", /already has 50/);
  assert.equal(validateTrigger("new", "contains", many, limitValue("autoresponders", true)), null);
});
