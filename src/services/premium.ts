/**
 * isPremium(guildId) and friends, plus handling a verified Stripe event.
 *
 * Answers are cached per server for PREMIUM_CACHE_MS; a webhook that changes a
 * server clears its entry at once. Any lookup error answers "not premium" for
 * that call (and is not cached), so a database blip never blocks anything free.
 */
import { PREMIUM_CACHE_MS, limitValue, type PremiumLimitKey } from "../config/premium";
import mongoose from "mongoose";
import { logger } from "../utils/logger";
import { applyStripeEvent, entitlementActive, primaryEntitlement, subscriptionIdOf, type Entitlement, type StripeEvent } from "./premiumState";
import { mongoPremiumStore, type PremiumStore } from "./premiumStore";

let store: PremiumStore | null = null;
/** Set when a test or caller injected its own store; the default is Mongo. */
let injected = false;
const cache = new Map<string, { premium: boolean; at: number }>();
const MAX_CACHE = 5_000;

export function premiumStore(): PremiumStore {
  if (!store) store = mongoPremiumStore();
  return store;
}

/** Swap the store (tests) and forget every cached answer. */
export function setPremiumStore(next: PremiumStore | null): void {
  store = next;
  injected = next !== null;
  cache.clear();
}

export function clearPremiumCache(guildId?: string): void {
  if (guildId) cache.delete(guildId);
  else cache.clear();
}

/** Whether a server has Premium right now (cached briefly). */
export async function isPremium(guildId: string | null | undefined, nowMs = Date.now()): Promise<boolean> {
  if (!guildId || !/^\d{17,20}$/.test(guildId)) return false;
  // The default (Mongo) store with no connection: answer free at once instead of waiting on mongoose's buffer.
  if (!injected && mongoose.connection.readyState !== 1) return false;
  const hit = cache.get(guildId);
  if (hit && nowMs - hit.at < PREMIUM_CACHE_MS) return hit.premium;
  try {
    const rows = await premiumStore().forGuild(guildId);
    const now = new Date(nowMs);
    const premium = rows.some(r => entitlementActive(r, now));
    if (cache.size >= MAX_CACHE) cache.clear();
    cache.set(guildId, { premium, at: nowMs });
    return premium;
  } catch (err) {
    logger.warn(`Premium lookup failed for ${guildId}: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

/** The cap for one limit in this server. */
export async function premiumLimit(guildId: string | null | undefined, key: PremiumLimitKey): Promise<number> {
  return limitValue(key, await isPremium(guildId));
}

export interface PremiumSummary {
  premium: boolean;
  entitlement: Entitlement | null;
}

/** Status for display (dashboard, /premium). Uncached, so it reflects a checkout that just finished. */
export async function premiumSummary(guildId: string, nowMs = Date.now()): Promise<PremiumSummary> {
  const rows = await premiumStore().forGuild(guildId);
  const now = new Date(nowMs);
  return { premium: rows.some(r => entitlementActive(r, now)), entitlement: primaryEntitlement(rows, now) };
}

export type EventOutcome = "duplicate" | "applied" | "ignored";

/**
 * Apply one verified Stripe event. Idempotent by event ID: a redelivery returns
 * "duplicate" without touching anything. The event is recorded only after it
 * was applied, so a failure part-way lets Stripe's retry try again.
 */
export async function handleStripeEvent(event: StripeEvent, s: PremiumStore = premiumStore(), nowMs = Date.now()): Promise<{ outcome: EventOutcome; reason?: string; guildId?: string }> {
  if (await s.hasEvent(event.eventId)) return { outcome: "duplicate" };
  const subId = subscriptionIdOf(event);
  const existing = subId ? await s.bySubscription(subId) : null;
  const now = new Date(nowMs);
  const t = applyStripeEvent(existing, event, now);
  if (t.kind === "ignore") {
    await s.recordEvent(event.eventId, event.eventType, now);
    return { outcome: "ignored", reason: t.reason };
  }
  await s.save(t.entitlement);
  await s.recordEvent(event.eventId, event.eventType, now);
  clearPremiumCache(t.entitlement.guildId);
  return { outcome: "applied", guildId: t.entitlement.guildId };
}

/** isPremium bounded in time, for replies that must go out within Discord's 3 seconds. Slow means "no" for this reply. */
export async function isPremiumQuick(guildId: string | null | undefined, timeoutMs = 750): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), timeoutMs); });
  try {
    return await Promise.race([isPremium(guildId), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
