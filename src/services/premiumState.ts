/**
 * Premium entitlements and how Paddle webhook events change them. Pure: no
 * database, no clock, so every transition is unit-tested.
 *
 * One entitlement per Paddle subscription, attributed to a server through the
 * checkout's custom_data {guildId, userId}. A server has Premium while any of
 * its entitlements is active (see entitlementActive).
 */
import { PREMIUM_GRACE_DAYS } from "../config/premium";

export const PREMIUM_STATUSES = ["active", "trialing", "past_due", "paused", "canceled"] as const;
export type PremiumStatus = (typeof PREMIUM_STATUSES)[number];

export interface Entitlement {
  guildId: string;
  /** Who started the checkout; only they may open the Paddle customer portal from Aegis. */
  userId: string | null;
  subscriptionId: string;
  customerId: string | null;
  status: PremiumStatus;
  currentPeriodEnd: Date | null;
  /** When the subscription first went past_due in its current run; starts the grace period. */
  pastDueSince: Date | null;
  /** A cancellation scheduled for the end of the period (Paddle keeps the status active until then). */
  cancelAt: Date | null;
  /** occurred_at of the newest event applied; older events arriving late are ignored. */
  lastEventAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaddleEvent {
  eventId: string;
  eventType: string;
  occurredAt: Date;
  data: Record<string, unknown>;
}

const SNOWFLAKE = /^\d{17,20}$/;
const EVENT_ID = /^evt_[a-z\d]{26}$/;
const SUB_ID = /^sub_[a-z\d]{26}$/;
const CUSTOMER_ID = /^ctm_[a-z\d]{26}$/;

export const SUBSCRIPTION_EVENTS = new Set([
  "subscription.created", "subscription.updated", "subscription.activated", "subscription.canceled",
  "subscription.past_due", "subscription.paused", "subscription.resumed", "subscription.trialing",
]);
export const HANDLED_EVENTS = new Set([...SUBSCRIPTION_EVENTS, "transaction.completed"]);

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function date(v: unknown): Date | null {
  if (typeof v !== "string" || v.length > 40) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pick(v: unknown, re: RegExp): string | null {
  return typeof v === "string" && re.test(v) ? v : null;
}

/** The webhook envelope, or null when it is not a Paddle Billing event. */
export function parsePaddleEvent(json: unknown): PaddleEvent | null {
  const o = obj(json);
  if (!o) return null;
  const eventId = pick(o.event_id, EVENT_ID);
  const eventType = typeof o.event_type === "string" && /^[a-z_]+\.[a-z_]+$/.test(o.event_type) ? o.event_type : null;
  const occurredAt = date(o.occurred_at);
  const data = obj(o.data);
  if (!eventId || !eventType || !occurredAt || !data) return null;
  return { eventId, eventType, occurredAt, data };
}

/** The guild and buyer from custom_data, when both look like Discord IDs. */
export function customDataOf(data: Record<string, unknown>): { guildId: string | null; userId: string | null } {
  const c = obj(data.custom_data);
  return { guildId: pick(c?.guildId, SNOWFLAKE), userId: pick(c?.userId, SNOWFLAKE) };
}

function statusOf(v: unknown): PremiumStatus | null {
  return typeof v === "string" && (PREMIUM_STATUSES as readonly string[]).includes(v) ? (v as PremiumStatus) : null;
}

/** The subscription a webhook is about, or null when it is not one we track. */
export function subscriptionIdOf(event: PaddleEvent): string | null {
  if (SUBSCRIPTION_EVENTS.has(event.eventType)) return pick(event.data.id, SUB_ID);
  if (event.eventType === "transaction.completed") return pick(event.data.subscription_id, SUB_ID);
  return null;
}

export type Transition =
  | { kind: "apply"; entitlement: Entitlement }
  | { kind: "ignore"; reason: "unhandled" | "no-subscription" | "no-guild" | "stale" | "bad-status" };

/**
 * What one event does to the entitlement it is about. `existing` is the stored
 * entitlement for the same subscription, if any.
 */
export function applyPaddleEvent(existing: Entitlement | null, event: PaddleEvent, now: Date): Transition {
  if (!HANDLED_EVENTS.has(event.eventType)) return { kind: "ignore", reason: "unhandled" };
  const subscriptionId = subscriptionIdOf(event);
  if (!subscriptionId) return { kind: "ignore", reason: "no-subscription" };
  if (existing && existing.lastEventAt.getTime() > event.occurredAt.getTime()) return { kind: "ignore", reason: "stale" };

  const d = event.data;
  const custom = customDataOf(d);
  // The guild is fixed by the first event that names it; later custom_data edits can't move Premium.
  const guildId = existing?.guildId ?? custom.guildId;
  if (!guildId) return { kind: "ignore", reason: "no-guild" };
  const customerId = pick(d.customer_id, CUSTOMER_ID) ?? existing?.customerId ?? null;
  const base = {
    guildId,
    userId: existing?.userId ?? custom.userId,
    subscriptionId,
    customerId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastEventAt: event.occurredAt,
  };

  if (event.eventType === "transaction.completed") {
    // A paid renewal or first payment. It clears past_due; it never revives a paused or canceled subscription.
    const prior = existing?.status ?? "active";
    const status: PremiumStatus = prior === "past_due" ? "active" : prior;
    const period = obj(d.billing_period);
    return {
      kind: "apply",
      entitlement: {
        ...base,
        status,
        currentPeriodEnd: date(period?.ends_at) ?? existing?.currentPeriodEnd ?? null,
        pastDueSince: null,
        cancelAt: existing?.cancelAt ?? null,
      },
    };
  }

  const status = statusOf(d.status);
  if (!status) return { kind: "ignore", reason: "bad-status" };
  const period = obj(d.current_billing_period);
  const change = obj(d.scheduled_change);
  const cancelAt = change?.action === "cancel" ? date(change.effective_at) : null;
  return {
    kind: "apply",
    entitlement: {
      ...base,
      status,
      currentPeriodEnd: date(period?.ends_at) ?? (status === "canceled" || status === "paused" ? null : existing?.currentPeriodEnd ?? null),
      pastDueSince: status === "past_due" ? (existing?.status === "past_due" ? existing.pastDueSince : null) ?? event.occurredAt : null,
      cancelAt: status === "canceled" ? null : cancelAt,
    },
  };
}

const DAY_MS = 86_400_000;

/**
 * Whether an entitlement grants Premium right now.
 * - active / trialing: yes, until PREMIUM_GRACE_DAYS after the period end (a
 *   safety net if a renewal or cancellation webhook never arrives).
 * - past_due: yes for PREMIUM_GRACE_DAYS after it first went past due.
 * - paused / canceled: no.
 */
export function entitlementActive(e: Entitlement, now: Date, graceDays = PREMIUM_GRACE_DAYS): boolean {
  const grace = graceDays * DAY_MS;
  const t = now.getTime();
  if (e.status === "active" || e.status === "trialing") {
    return !e.currentPeriodEnd || t < e.currentPeriodEnd.getTime() + grace;
  }
  if (e.status === "past_due") {
    const since = e.pastDueSince ?? e.lastEventAt;
    return t < since.getTime() + grace;
  }
  return false;
}

/** The entitlement that best describes a server: an active one first, else the newest. */
export function primaryEntitlement(rows: Entitlement[], now: Date): Entitlement | null {
  if (rows.length === 0) return null;
  const active = rows.filter(r => entitlementActive(r, now));
  const pool = active.length ? active : rows;
  return pool.slice().sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
}

/** When a past_due server loses Premium, or null when it is not in grace. */
export function graceEndsAt(e: Entitlement, graceDays = PREMIUM_GRACE_DAYS): Date | null {
  if (e.status !== "past_due") return null;
  return new Date((e.pastDueSince ?? e.lastEventAt).getTime() + graceDays * DAY_MS);
}
