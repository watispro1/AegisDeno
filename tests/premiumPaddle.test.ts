import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { parsePaddleSignature, signPaddlePayload, verifyPaddleSignature, PADDLE_SIGNATURE_TOLERANCE_SECONDS } from "../src/services/paddleSignature";
import { applyPaddleEvent, entitlementActive, graceEndsAt, parsePaddleEvent, primaryEntitlement, type Entitlement, type PaddleEvent } from "../src/services/premiumState";
import { memoryPremiumStore } from "../src/services/premiumStore";
import { handlePaddleEvent, isPremium, premiumLimit, setPremiumStore } from "../src/services/premium";
import { registerPaddleWebhook, PADDLE_WEBHOOK_PATH } from "../src/web/paddleWebhook";
import { readPaddleConfig, missingPaddleSettings, premiumOffered } from "../src/config/paddle";
import { PREMIUM_GRACE_DAYS, PREMIUM_LIMITS, limitValue } from "../src/config/premium";

const SECRET = "pdl_ntfset_01gkpjp8bkm3tm53kdgkx6sms7_6h3qd3uFSi9YCD3OLYAShQI90XTI5vEI";
const GUILD = "123456789012345678";
const USER = "223456789012345678";
const SUB = "sub_01hv8y5ehszzq0yv20ttx3166y";
const CTM = "ctm_01hv8wt8nffez4p2t6typn4a5j";
const DAY = 86_400_000;
let seq = 0;
const evtId = () => `evt_01hv8y5ehszzq0yv20ttx${String(++seq).padStart(5, "0")}`;

function subEvent(type: string, status: string, at: string, extra: Record<string, unknown> = {}): PaddleEvent {
  return {
    eventId: evtId(), eventType: type, occurredAt: new Date(at),
    data: { id: SUB, status, customer_id: CTM, custom_data: { guildId: GUILD, userId: USER }, current_billing_period: { starts_at: at, ends_at: "2026-12-15T00:00:00Z" }, scheduled_change: null, ...extra },
  };
}

/* Signature verification */

test("verifyPaddleSignature accepts a correct signature over the raw body", () => {
  const body = '{"event_id":"evt_1","data":{}}';
  const ts = 1_763_200_000;
  const header = `ts=${ts};h1=${signPaddlePayload(SECRET, ts, body)}`;
  assert.deepEqual(verifyPaddleSignature(Buffer.from(body), header, SECRET, ts * 1000), { ok: true, timestamp: ts });
});

test("verifyPaddleSignature matches Paddle's documented algorithm (HMAC-SHA256 of ts:body, hex)", () => {
  const { createHmac } = require("node:crypto") as typeof import("node:crypto");
  const expected = createHmac("sha256", SECRET).update("1671552777:hello").digest("hex");
  assert.equal(signPaddlePayload(SECRET, 1671552777, "hello"), expected);
});

test("verifyPaddleSignature rejects tampered bodies, wrong secrets and re-serialised JSON", () => {
  const body = '{"a": 1}';
  const ts = 1_763_200_000;
  const header = `ts=${ts};h1=${signPaddlePayload(SECRET, ts, body)}`;
  assert.deepEqual(verifyPaddleSignature('{"a": 2}', header, SECRET, ts * 1000), { ok: false, reason: "mismatch" });
  assert.deepEqual(verifyPaddleSignature(body, header, "other", ts * 1000), { ok: false, reason: "mismatch" });
  assert.deepEqual(verifyPaddleSignature(JSON.stringify(JSON.parse(body)), header, SECRET, ts * 1000), { ok: false, reason: "mismatch" });
});

test("verifyPaddleSignature enforces the timestamp tolerance both ways", () => {
  const body = "{}";
  const ts = 1_763_200_000;
  const header = `ts=${ts};h1=${signPaddlePayload(SECRET, ts, body)}`;
  const tol = PADDLE_SIGNATURE_TOLERANCE_SECONDS;
  assert.equal(verifyPaddleSignature(body, header, SECRET, (ts + tol) * 1000).ok, true);
  assert.deepEqual(verifyPaddleSignature(body, header, SECRET, (ts + tol + 1) * 1000), { ok: false, reason: "expired" });
  assert.deepEqual(verifyPaddleSignature(body, header, SECRET, (ts - tol - 1) * 1000), { ok: false, reason: "expired" });
});

test("verifyPaddleSignature handles missing, malformed and rotated headers", () => {
  const ts = 1_763_200_000;
  const good = signPaddlePayload(SECRET, ts, "{}");
  assert.deepEqual(verifyPaddleSignature("{}", undefined, SECRET, ts * 1000), { ok: false, reason: "missing" });
  for (const bad of ["garbage", `ts=abc;h1=${good}`, `ts=${ts}`, `h1=${good}`, `ts=${ts};h1=zz`, `ts=${ts};ts=${ts};h1=${good}`, ["a"]]) {
    assert.deepEqual(verifyPaddleSignature("{}", bad, SECRET, ts * 1000), { ok: false, reason: "malformed" }, String(bad));
  }
  assert.deepEqual(verifyPaddleSignature("{}", `ts=${ts};h1=${good}`, "", ts * 1000), { ok: false, reason: "malformed" });
  // During secret rotation Paddle sends two h1 values; either may match.
  const rotated = `ts=${ts};h1=${"0".repeat(64)};h1=${good}`;
  assert.equal(verifyPaddleSignature("{}", rotated, SECRET, ts * 1000).ok, true);
  assert.deepEqual(parsePaddleSignature(rotated)?.h1.length, 2);
});

/* Event parsing and status transitions */

test("parsePaddleEvent reads the envelope and refuses anything else", () => {
  const e = parsePaddleEvent({ event_id: "evt_01hv8y5ehszzq0yv20ttx3166y", event_type: "subscription.created", occurred_at: "2026-11-15T10:00:00Z", data: { id: SUB } });
  assert.equal(e?.eventType, "subscription.created");
  assert.equal(parsePaddleEvent({ event_id: "x", event_type: "subscription.created", occurred_at: "2026-11-15T10:00:00Z", data: {} }), null);
  assert.equal(parsePaddleEvent({ event_id: "evt_01hv8y5ehszzq0yv20ttx3166y", event_type: "subscription.created", occurred_at: "nope", data: {} }), null);
  assert.equal(parsePaddleEvent([]), null);
});

test("subscription lifecycle: created → past_due → active → canceled", () => {
  const now = new Date("2026-11-15T10:00:00Z");
  let t = applyPaddleEvent(null, subEvent("subscription.created", "active", "2026-11-15T10:00:00Z"), now);
  assert.equal(t.kind, "apply");
  let e = (t as { entitlement: Entitlement }).entitlement;
  assert.deepEqual([e.guildId, e.userId, e.customerId, e.status], [GUILD, USER, CTM, "active"]);
  assert.equal(e.currentPeriodEnd?.toISOString(), "2026-12-15T00:00:00.000Z");

  t = applyPaddleEvent(e, subEvent("subscription.past_due", "past_due", "2026-12-15T01:00:00Z"), now);
  e = (t as { entitlement: Entitlement }).entitlement;
  assert.equal(e.status, "past_due");
  assert.equal(e.pastDueSince?.toISOString(), "2026-12-15T01:00:00.000Z");
  // A second past_due update keeps the original start of the grace period.
  t = applyPaddleEvent(e, subEvent("subscription.updated", "past_due", "2026-12-16T01:00:00Z"), now);
  e = (t as { entitlement: Entitlement }).entitlement;
  assert.equal(e.pastDueSince?.toISOString(), "2026-12-15T01:00:00.000Z");

  t = applyPaddleEvent(e, subEvent("subscription.updated", "active", "2026-12-16T02:00:00Z", { current_billing_period: { ends_at: "2027-01-15T00:00:00Z" } }), now);
  e = (t as { entitlement: Entitlement }).entitlement;
  assert.equal(e.status, "active");
  assert.equal(e.pastDueSince, null);

  t = applyPaddleEvent(e, subEvent("subscription.updated", "active", "2026-12-20T00:00:00Z", { scheduled_change: { action: "cancel", effective_at: "2027-01-15T00:00:00Z", resume_at: null } }), now);
  e = (t as { entitlement: Entitlement }).entitlement;
  assert.equal(e.cancelAt?.toISOString(), "2027-01-15T00:00:00.000Z");

  t = applyPaddleEvent(e, subEvent("subscription.canceled", "canceled", "2027-01-15T00:00:00Z", { current_billing_period: null }), now);
  e = (t as { entitlement: Entitlement }).entitlement;
  assert.deepEqual([e.status, e.cancelAt, e.currentPeriodEnd], ["canceled", null, null]);
});

test("transaction.completed clears past_due but never revives a canceled subscription", () => {
  const now = new Date("2026-12-16T00:00:00Z");
  const pastDue = (applyPaddleEvent(null, subEvent("subscription.past_due", "past_due", "2026-12-15T00:00:00Z"), now) as { entitlement: Entitlement }).entitlement;
  const paid: PaddleEvent = { eventId: evtId(), eventType: "transaction.completed", occurredAt: new Date("2026-12-15T06:00:00Z"), data: { id: "txn_1", subscription_id: SUB, customer_id: CTM, custom_data: { guildId: GUILD, userId: USER }, billing_period: { ends_at: "2027-01-15T00:00:00Z" } } };
  const after = (applyPaddleEvent(pastDue, paid, now) as { entitlement: Entitlement }).entitlement;
  assert.deepEqual([after.status, after.pastDueSince, after.currentPeriodEnd?.toISOString()], ["active", null, "2027-01-15T00:00:00.000Z"]);

  const canceled = { ...after, status: "canceled" as const, lastEventAt: new Date("2026-12-15T05:00:00Z") };
  assert.equal((applyPaddleEvent(canceled, paid, now) as { entitlement: Entitlement }).entitlement.status, "canceled");
  // A first transaction.completed before subscription.created still grants Premium.
  assert.equal((applyPaddleEvent(null, paid, now) as { entitlement: Entitlement }).entitlement.status, "active");
});

test("out-of-order, unattributed and unrelated events are ignored", () => {
  const now = new Date("2026-11-15T10:00:00Z");
  const e = (applyPaddleEvent(null, subEvent("subscription.updated", "canceled", "2026-12-01T00:00:00Z"), now) as { entitlement: Entitlement }).entitlement;
  assert.deepEqual(applyPaddleEvent(e, subEvent("subscription.updated", "active", "2026-11-20T00:00:00Z"), now), { kind: "ignore", reason: "stale" });
  assert.deepEqual(applyPaddleEvent(null, subEvent("subscription.created", "active", "2026-11-15T10:00:00Z", { custom_data: null }), now), { kind: "ignore", reason: "no-guild" });
  assert.deepEqual(applyPaddleEvent(null, subEvent("subscription.created", "active", "2026-11-15T10:00:00Z", { custom_data: { guildId: "1; drop" } }), now), { kind: "ignore", reason: "no-guild" });
  assert.deepEqual(applyPaddleEvent(null, subEvent("subscription.created", "weird", "2026-11-15T10:00:00Z"), now), { kind: "ignore", reason: "bad-status" });
  assert.deepEqual(applyPaddleEvent(null, { ...subEvent("x", "active", "2026-11-15T10:00:00Z"), eventType: "customer.updated" }, now), { kind: "ignore", reason: "unhandled" });
  // custom_data can't move an existing subscription to another server.
  const moved = applyPaddleEvent(e, subEvent("subscription.updated", "active", "2026-12-02T00:00:00Z", { custom_data: { guildId: "999999999999999999", userId: USER } }), now);
  assert.equal((moved as { entitlement: Entitlement }).entitlement.guildId, GUILD);
});

/* isPremium and the grace period */

function ent(over: Partial<Entitlement>): Entitlement {
  const at = new Date("2026-11-15T00:00:00Z");
  return { guildId: GUILD, userId: USER, subscriptionId: SUB, customerId: CTM, status: "active", currentPeriodEnd: new Date("2026-12-15T00:00:00Z"), pastDueSince: null, cancelAt: null, lastEventAt: at, createdAt: at, updatedAt: at, ...over };
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
    // Still the cached "no" inside the cache window…
    assert.equal(await isPremium(GUILD, t0 + 1000), false);
    // …and fresh after it.
    assert.equal(await isPremium(GUILD, t0 + 61_000), true);
    assert.equal(await premiumLimit(GUILD, "autoresponders"), limitValue("autoresponders", true));
    assert.equal(await isPremium(GUILD, t0 + 3 * DAY + 61_000), false);
    // A webhook for the guild clears its cache entry immediately.
    await handlePaddleEvent(subEvent("subscription.updated", "active", "2026-12-18T00:00:00Z", { current_billing_period: { ends_at: "2027-01-15T00:00:00Z" } }), store, t0 + 3 * DAY + 62_000);
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

test("handlePaddleEvent is idempotent by event ID", async () => {
  const store = memoryPremiumStore();
  const e = subEvent("subscription.created", "active", "2026-11-15T10:00:00Z");
  assert.equal((await handlePaddleEvent(e, store)).outcome, "applied");
  await store.save({ ...(await store.bySubscription(SUB))!, status: "paused" });
  assert.equal((await handlePaddleEvent(e, store)).outcome, "duplicate");
  assert.equal((await store.bySubscription(SUB))?.status, "paused", "a redelivery changes nothing");
  assert.equal(store.events.size, 1);
  const ignored = await handlePaddleEvent({ ...subEvent("x", "active", "2026-11-15T10:00:00Z"), eventType: "address.created" }, store);
  assert.equal(ignored.outcome, "ignored");
});

test("a failed apply is not recorded, so Paddle's retry is applied", async () => {
  const store = memoryPremiumStore();
  let fail = true;
  const flaky = { ...store, save: async (x: Entitlement) => { if (fail) throw new Error("write failed"); return store.save(x); } };
  const e = subEvent("subscription.created", "active", "2026-11-15T10:00:00Z");
  await assert.rejects(handlePaddleEvent(e, flaky));
  fail = false;
  assert.equal((await handlePaddleEvent(e, flaky)).outcome, "applied");
});

/* The HTTP endpoint */

async function withServer(deps: Parameters<typeof registerPaddleWebhook>[1], run: (url: string) => Promise<void>) {
  const app = express();
  registerPaddleWebhook(app, deps);
  const server = app.listen(0);
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}${PADDLE_WEBHOOK_PATH}`);
  } finally {
    server.close();
  }
}

test("POST /api/paddle/webhook: 503 unconfigured, 401 bad signature, 200 then duplicate", async () => {
  await withServer({ secret: () => null }, async url => {
    assert.equal((await fetch(url, { method: "POST", body: "{}" })).status, 503);
  });
  const store = memoryPremiumStore();
  const nowMs = Date.parse("2026-11-15T10:00:05Z");
  await withServer({ secret: () => SECRET, store, now: () => nowMs }, async url => {
    const body = JSON.stringify({ event_id: "evt_01hv8y5ehszzq0yv20ttx3166y", event_type: "subscription.created", occurred_at: "2026-11-15T10:00:00Z", notification_id: "ntf_1", data: subEvent("x", "active", "2026-11-15T10:00:00Z").data });
    const ts = Math.floor(nowMs / 1000);
    const sig = `ts=${ts};h1=${signPaddlePayload(SECRET, ts, body)}`;
    const headers = { "Content-Type": "application/json", "Paddle-Signature": sig };
    assert.equal((await fetch(url, { method: "POST", body })).status, 400);
    assert.equal((await fetch(url, { method: "POST", body: body.replace("active", "paused"), headers })).status, 401);
    const first = await fetch(url, { method: "POST", body, headers });
    assert.equal(first.status, 200);
    assert.equal((await first.json() as { outcome: string }).outcome, "applied");
    assert.equal((await store.bySubscription(SUB))?.guildId, GUILD);
    const again = await fetch(url, { method: "POST", body, headers });
    assert.equal((await again.json() as { outcome: string }).outcome, "duplicate");
    const junk = "not json";
    assert.equal((await fetch(url, { method: "POST", body: junk, headers: { "Paddle-Signature": `ts=${ts};h1=${signPaddlePayload(SECRET, ts, junk)}` } })).status, 400);
  });
});

/* Config */

test("readPaddleConfig needs every value and a token that matches PADDLE_ENV", () => {
  const full = { PADDLE_ENV: "sandbox", PADDLE_CLIENT_TOKEN: "test_7d279f61a3499fed520f7cd8c08", PADDLE_PRICE_ID: "pri_01gsz8x8sawmvhz1pv30nge1ke", PADDLE_API_KEY: "pdl_sdbx_apikey_x", PADDLE_WEBHOOK_SECRET: SECRET };
  assert.equal(readPaddleConfig(full)?.environment, "sandbox");
  assert.equal(premiumOffered(full), true);
  assert.equal(readPaddleConfig({ ...full, PADDLE_ENV: "production" }), null);
  assert.ok(missingPaddleSettings({ ...full, PADDLE_ENV: "production" })[0].includes("does not match"));
  assert.equal(readPaddleConfig({ ...full, PADDLE_API_KEY: "" }), null);
  assert.equal(premiumOffered({}), false);
  assert.deepEqual(missingPaddleSettings({}), ["PADDLE_CLIENT_TOKEN", "PADDLE_PRICE_ID", "PADDLE_API_KEY", "PADDLE_WEBHOOK_SECRET"]);
  const s = JSON.stringify(missingPaddleSettings(full));
  assert.ok(!s.includes(SECRET), "never logs values");
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
    setPremiumStore(premium); // clears the cached "no"
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
