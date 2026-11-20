/**
 * Premium entitlements and how Stripe webhook events change them. Pure: no
 * database, no clock, so every transition is unit-tested.
 *
 * One entitlement per Stripe subscription, attributed to a server through the
 * checkout session or subscription metadata {guildId, userId}. A server has Premium
 * while any of its entitlements is active (see entitlementActive).
 */
import { PREMIUM_GRACE_DAYS } from "../config/premium";

export const PREMIUM_STATUSES = ["active", "trialing", "past_due", "paused", "canceled"] as const;
export type PremiumStatus = (typeof PREMIUM_STATUSES)[number];

export interface Entitlement {
  guildId: string;
  /** Who started the checkout; only they may open the Stripe customer portal from Aegis. */
  userId: string | null;
  subscriptionId: string;
  customerId: string | null;
  status: PremiumStatus;
  currentPeriodEnd: Date | null;
  /** When the subscription first went past_due in its current run; starts the grace period. */
  pastDueSince: Date | null;
  /** A cancellation scheduled for the end of the period. */
  cancelAt: Date | null;
  /** occurred_at of the newest event applied; older events arriving late are ignored. */
  lastEventAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StripeEvent {
  eventId: string;
  eventType: string;
  occurredAt: Date;
  data: Record<string, unknown>;
}

const SNOWFLAKE = /^\d{17,20}$/;
const EVENT_ID = /^evt_[A-Za-z0-9]+$/;
const SUB_ID = /^sub_[A-Za-z0-9]+$/;
const CUSTOMER_ID = /^cus_[A-Za-z0-9]+$/;

export const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

export const HANDLED_EVENTS = new Set([
  ...SUBSCRIPTION_EVENTS,
  "checkout.session.completed",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
]);

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function dateFromSeconds(v: unknown): Date | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    return new Date(v * 1000);
  }
  if (typeof v === "string" && /^\d+$/.test(v)) {
    return new Date(Number(v) * 1000);
  }
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function pick(v: unknown, re: RegExp): string | null {
  return typeof v === "string" && re.test(v) ? v : null;
}

/** The webhook envelope, or null when it is not a Stripe event. */
export function parseStripeEvent(json: unknown): StripeEvent | null {
  const o = obj(json);
  if (!o) return null;
  const eventId = pick(o.id, EVENT_ID);
  const eventType = typeof o.type === "string" && /^[a-z_]+\.[a-z_]+(?:\.[a-z_]+)?$/.test(o.type) ? o.type : null;
  const occurredAt = dateFromSeconds(o.created);
  const dataObj = obj(o.data);
  const data = obj(dataObj?.object);
  if (!eventId || !eventType || !occurredAt || !data) return null;
  return { eventId, eventType, occurredAt, data };
}

/** The guild and buyer from metadata or client_reference_id. */
export function metadataOf(data: Record<string, unknown>): { guildId: string | null; userId: string | null } {
  const meta = obj(data.metadata);
  const guildFromMeta = pick(meta?.guildId, SNOWFLAKE);
  const guildFromRef = pick(data.client_reference_id, SNOWFLAKE);
  const userFromMeta = pick(meta?.userId, SNOWFLAKE);
  return {
    guildId: guildFromMeta ?? guildFromRef,
    userId: userFromMeta,
  };
}

function statusOf(v: unknown): PremiumStatus | null {
  if (typeof v !== "string") return null;
  const val = v.toLowerCase();
  if (val === "active") return "active";
  if (val === "trialing") return "trialing";
  if (val === "past_due") return "past_due";
  if (val === "paused") return "paused";
  if (val === "canceled" || val === "unpaid" || val === "incomplete_expired") return "canceled";
  return null;
}

/** The subscription a webhook is about, or null when it is not one we track. */
export function subscriptionIdOf(event: StripeEvent): string | null {
  if (SUBSCRIPTION_EVENTS.has(event.eventType)) {
    return pick(event.data.id, SUB_ID) ?? pick(event.data.subscription, SUB_ID);
  }
  if (event.eventType === "checkout.session.completed") {
    return pick(event.data.subscription, SUB_ID);
  }
  if (event.eventType === "invoice.payment_succeeded" || event.eventType === "invoice.payment_failed") {
    return pick(event.data.subscription, SUB_ID);
  }
  return null;
}

export type Transition =
  | { kind: "apply"; entitlement: Entitlement }
  | { kind: "ignore"; reason: "unhandled" | "no-subscription" | "no-guild" | "stale" | "bad-status" };

/**
 * What one event does to the entitlement it is about. `existing` is the stored
 * entitlement for the same subscription, if any.
 */
export function applyStripeEvent(existing: Entitlement | null, event: StripeEvent, now: Date): Transition {
  if (!HANDLED_EVENTS.has(event.eventType)) return { kind: "ignore", reason: "unhandled" };
  const subscriptionId = subscriptionIdOf(event);
  if (!subscriptionId) return { kind: "ignore", reason: "no-subscription" };
  if (existing && existing.lastEventAt.getTime() > event.occurredAt.getTime()) return { kind: "ignore", reason: "stale" };

  const d = event.data;
  const meta = metadataOf(d);
  // The guild is fixed by the first event that names it; later metadata edits can't move Premium.
  const guildId = existing?.guildId ?? meta.guildId;
  if (!guildId) return { kind: "ignore", reason: "no-guild" };
  const customerId = pick(d.customer, CUSTOMER_ID) ?? existing?.customerId ?? null;
  const base = {
    guildId,
    userId: existing?.userId ?? meta.userId,
    subscriptionId,
    customerId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastEventAt: event.occurredAt,
  };

  if (event.eventType === "checkout.session.completed") {
    return {
      kind: "apply",
      entitlement: {
        ...base,
        status: "active",
        currentPeriodEnd: existing?.currentPeriodEnd ?? null,
        pastDueSince: null,
        cancelAt: null,
      },
    };
  }

  if (event.eventType === "invoice.payment_succeeded") {
    const prior = existing?.status ?? "active";
    const status: PremiumStatus = prior === "past_due" ? "active" : prior;
    const lines = obj(d.lines);
    const lineData = Array.isArray(lines?.data) ? (lines!.data as Array<Record<string, unknown>>) : [];
    const firstPeriod = obj(lineData[0]?.period);
    const periodEnd = dateFromSeconds(firstPeriod?.end) ?? existing?.currentPeriodEnd ?? null;
    return {
      kind: "apply",
      entitlement: {
        ...base,
        status,
        currentPeriodEnd: periodEnd,
        pastDueSince: null,
        cancelAt: existing?.cancelAt ?? null,
      },
    };
  }

  if (event.eventType === "invoice.payment_failed") {
    return {
      kind: "apply",
      entitlement: {
        ...base,
        status: "past_due",
        currentPeriodEnd: existing?.currentPeriodEnd ?? null,
        pastDueSince: existing?.pastDueSince ?? event.occurredAt,
        cancelAt: existing?.cancelAt ?? null,
      },
    };
  }

  const status = statusOf(d.status);
  if (!status) return { kind: "ignore", reason: "bad-status" };
  const periodEnd = status === "canceled" ? null : (dateFromSeconds(d.current_period_end) ?? (status === "paused" ? null : existing?.currentPeriodEnd ?? null));
  const cancelAt = dateFromSeconds(d.cancel_at) ?? (d.cancel_at_period_end ? periodEnd : null);

  return {
    kind: "apply",
    entitlement: {
      ...base,
      status,
      currentPeriodEnd: periodEnd,
      pastDueSince: status === "past_due" ? (existing?.status === "past_due" ? existing.pastDueSince : null) ?? event.occurredAt : null,
      cancelAt: status === "canceled" ? null : cancelAt,
    },
  };
}

const DAY_MS = 86_400_000;

/**
 * Whether an entitlement grants Premium right now.
 * - active / trialing: yes, until PREMIUM_GRACE_DAYS after the period end.
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
