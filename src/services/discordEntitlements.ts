/**
 * Discord In-App Subscriptions (SKU) Entitlement processing and synchronization.
 *
 * Handles Discord's native Entitlement lifecycle events:
 *   - Events.EntitlementCreate: member subscribes via Discord in-app modal
 *   - Events.EntitlementUpdate: renewal or subscription state change
 *   - Events.EntitlementDelete: subscription canceled or revoked
 *
 * Persists entitlements into the unified PremiumEntitlement collection and clears
 * the premium cache so perks activate immediately.
 */
import { Client, Events } from "discord.js";
import { logger } from "../utils/logger";
import { discordSkuId } from "../config/discordSku";
import { clearPremiumCache, premiumStore } from "./premium";
import type { PremiumStore } from "./premiumStore";
import type { Entitlement, PremiumStatus } from "./premiumState";

export interface DiscordEntitlementLike {
  id: string;
  skuId: string;
  guildId?: string | null;
  userId?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  deleted?: boolean;
}

/**
 * Whether an entitlement is for the Premium SKU. DISCORD_PREMIUM_SKU_ID is
 * required: without it no SKU grants Premium, and an entitlement to any other
 * SKU of the app never does.
 */
export function isPremiumSku(skuId: string, configuredId = discordSkuId()): boolean {
  if (!configuredId) return false;
  return skuId === configuredId;
}

/** Convert and apply a Discord Entitlement to the Premium store. */
export async function applyDiscordEntitlement(
  entitlement: DiscordEntitlementLike,
  s: PremiumStore = premiumStore(),
  now = new Date(),
): Promise<Entitlement | null> {
  const guildId = entitlement.guildId;
  if (!guildId || !/^\d{17,20}$/.test(guildId)) {
    logger.debug(`Discord Entitlement ${entitlement.id} has no valid guildId (user subscription or unlinked); skipping guild premium.`);
    return null;
  }

  const sku = discordSkuId();
  if (!isPremiumSku(entitlement.skuId, sku)) {
    logger.debug(sku
      ? `Discord Entitlement ${entitlement.id} SKU ${entitlement.skuId} does not match configured ${sku}; skipping.`
      : `Discord Entitlement ${entitlement.id} ignored: DISCORD_PREMIUM_SKU_ID is not set, so no SKU grants Premium.`);
    return null;
  }

  const isExpired = Boolean(entitlement.endsAt && entitlement.endsAt.getTime() < now.getTime());
  const status: PremiumStatus = entitlement.deleted || isExpired ? "canceled" : "active";
  const subId = `discord_${entitlement.id}`;
  const existing = await s.bySubscription(subId).catch(() => null);

  const record: Entitlement = {
    guildId,
    userId: entitlement.userId ?? existing?.userId ?? null,
    subscriptionId: subId,
    customerId: entitlement.userId ? `discord_${entitlement.userId}` : existing?.customerId ?? null,
    status,
    currentPeriodEnd: entitlement.endsAt ?? null,
    pastDueSince: null,
    cancelAt: null,
    lastEventAt: now,
    createdAt: entitlement.startsAt ?? existing?.createdAt ?? now,
    updatedAt: now,
  };

  await s.save(record);
  clearPremiumCache(guildId);
  logger.info(`Discord Entitlement ${status}: guild ${guildId}, user ${entitlement.userId}, entitlement ${entitlement.id}`);
  return record;
}

/** Handle deletion or cancellation of a Discord Entitlement. */
export async function removeDiscordEntitlement(
  entitlement: DiscordEntitlementLike,
  s: PremiumStore = premiumStore(),
  now = new Date(),
): Promise<Entitlement | null> {
  const guildId = entitlement.guildId;
  if (!guildId) return null;

  const subId = `discord_${entitlement.id}`;
  const existing = await s.bySubscription(subId).catch(() => null);
  if (!existing) return null;

  const updated: Entitlement = {
    ...existing,
    status: "canceled",
    currentPeriodEnd: null,
    lastEventAt: now,
    updatedAt: now,
  };

  await s.save(updated);
  clearPremiumCache(guildId);
  logger.info(`Discord Entitlement removed: guild ${guildId}, entitlement ${entitlement.id}`);
  return updated;
}

/** Sync active Discord Entitlements from Discord REST API on startup. */
export async function syncDiscordEntitlements(client: Client, s: PremiumStore = premiumStore()): Promise<number> {
  const sku = discordSkuId();
  if (!sku || !client.application) return 0;

  try {
    const entitlements = await client.application.entitlements.fetch({ skus: [sku] });
    let count = 0;
    const now = new Date();
    for (const ent of entitlements.values()) {
      if (ent.guildId) {
        await applyDiscordEntitlement(ent, s, now);
        count++;
      }
    }
    if (count > 0) {
      logger.info(`Discord Entitlements sync: ${count} active entitlement(s) synchronized.`);
    }
    return count;
  } catch (err) {
    logger.warn("Discord Entitlements sync failed (non-fatal):", err);
    return 0;
  }
}

/** Register Discord Entitlement lifecycle events with the client. */
export function registerDiscordEntitlementEvents(client: Client, s: PremiumStore = premiumStore()): void {
  client.on(Events.EntitlementCreate, async (entitlement) => {
    if (!entitlement) return;
    try {
      await applyDiscordEntitlement(entitlement, s);
    } catch (err) {
      logger.error(`Error handling EntitlementCreate for ${entitlement.id}:`, err);
    }
  });

  client.on(Events.EntitlementUpdate, async (entitlement) => {
    if (!entitlement) return;
    try {
      await applyDiscordEntitlement(entitlement, s);
    } catch (err) {
      logger.error(`Error handling EntitlementUpdate for ${entitlement.id}:`, err);
    }
  });

  client.on(Events.EntitlementDelete, async (entitlement) => {
    if (!entitlement) return;
    try {
      await removeDiscordEntitlement(entitlement, s);
    } catch (err) {
      logger.error(`Error handling EntitlementDelete for ${entitlement.id}:`, err);
    }
  });
}
