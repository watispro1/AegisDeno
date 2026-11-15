/**
 * Where Premium entitlements and handled Paddle event IDs live. Production uses
 * Mongo; tests and a database-less dev run use the in-memory store.
 */
import type { Entitlement } from "./premiumState";
import { PaddleEventModel, PremiumEntitlementModel } from "../database/premiumModels";

export interface PremiumStore {
  bySubscription(subscriptionId: string): Promise<Entitlement | null>;
  forGuild(guildId: string): Promise<Entitlement[]>;
  /** Insert or replace by subscriptionId. */
  save(e: Entitlement): Promise<void>;
  hasEvent(eventId: string): Promise<boolean>;
  /** Record an event as handled. A second call for the same ID is harmless. */
  recordEvent(eventId: string, eventType: string, at: Date): Promise<void>;
}

const copy = (e: Entitlement): Entitlement => ({ ...e });

export function memoryPremiumStore(): PremiumStore & { events: Map<string, string> } {
  const rows = new Map<string, Entitlement>();
  const events = new Map<string, string>();
  return {
    events,
    async bySubscription(id) { const e = rows.get(id); return e ? copy(e) : null; },
    async forGuild(guildId) { return [...rows.values()].filter(e => e.guildId === guildId).map(copy); },
    async save(e) { rows.set(e.subscriptionId, copy(e)); },
    async hasEvent(id) { return events.has(id); },
    async recordEvent(id, type) { if (!events.has(id)) events.set(id, type); },
  };
}

type Lean = Record<string, unknown>;

function toEntitlement(d: Lean): Entitlement {
  const dt = (v: unknown) => (v instanceof Date ? v : v ? new Date(String(v)) : null);
  return {
    guildId: String(d.guildId),
    userId: (d.userId as string | null) ?? null,
    subscriptionId: String(d.subscriptionId),
    customerId: (d.customerId as string | null) ?? null,
    status: d.status as Entitlement["status"],
    currentPeriodEnd: dt(d.currentPeriodEnd),
    pastDueSince: dt(d.pastDueSince),
    cancelAt: dt(d.cancelAt),
    lastEventAt: dt(d.lastEventAt) ?? new Date(0),
    createdAt: dt(d.createdAt) ?? new Date(0),
    updatedAt: dt(d.updatedAt) ?? new Date(0),
  };
}

/** Mongo-backed store. */
export function mongoPremiumStore(): PremiumStore {
  return {
    async bySubscription(id) {
      const d = await PremiumEntitlementModel.findOne({ subscriptionId: String(id) }).lean();
      return d ? toEntitlement(d as Lean) : null;
    },
    async forGuild(guildId) {
      const rows = await PremiumEntitlementModel.find({ guildId: String(guildId) }).sort({ updatedAt: -1 }).limit(20).lean();
      return rows.map(r => toEntitlement(r as Lean));
    },
    async save(e) {
      await PremiumEntitlementModel.updateOne({ subscriptionId: e.subscriptionId }, { $set: { ...e } }, { upsert: true });
    },
    async hasEvent(id) {
      return (await PaddleEventModel.exists({ eventId: String(id) })) !== null;
    },
    async recordEvent(id, type, at) {
      await PaddleEventModel.updateOne({ eventId: String(id) }, { $setOnInsert: { eventId: String(id), eventType: type, processedAt: at } }, { upsert: true });
    },
  };
}
