/**
 * Economy rules with no I/O: daily/work payouts and cooldowns, /pay rules,
 * shop item validation and the role hierarchy rule for role items. Settings
 * live in economyConfig.ts (re-exported here). Used by the slash commands,
 * the service and the dashboard.
 */

import { MAX_BALANCE, intIn, type EconomyConfig } from "./economyConfig";

export * from "./economyConfig";

/** Most shop items a server may list. */
export const MAX_SHOP_ITEMS = 50;
/** Transactions are kept this long (Mongo TTL). */
export const TRANSACTION_TTL_DAYS = 90;

/** "🪙 1,250 coins" */
export function formatCoins(cfg: Pick<EconomyConfig, "currencyEmoji" | "currencyName">, amount: number): string {
  return `${cfg.currencyEmoji} ${Math.trunc(amount).toLocaleString("en-US")} ${cfg.currencyName}`;
}

/** A user-typed amount ("1,000", "2500") as whole coins in 1..MAX_BALANCE, else null. */
export function parseAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 1 && value <= MAX_BALANCE ? value : null;
  if (typeof value !== "string") return null;
  const clean = value.replace(/[,_\s]/g, "");
  if (!/^\d{1,13}$/.test(clean)) return null;
  return parseAmount(Number(clean));
}

/* Cooldowns and payouts */

export type ClaimResult = { ok: true; amount: number; streak: number } | { ok: false; retryAt: number };

export function dailyClaim(last: Date | null, streak: number, now: number, cfg: EconomyConfig): ClaimResult {
  const cooldown = cfg.dailyCooldownHours * 3_600_000;
  const lastMs = last ? last.getTime() : null;
  if (lastMs !== null && now - lastMs < cooldown) return { ok: false, retryAt: lastMs + cooldown };
  // Claiming again within two cooldowns keeps the streak going.
  const nextStreak = lastMs !== null && now - lastMs < cooldown * 2 ? Math.max(1, streak) + 1 : 1;
  const bonusDays = Math.min(nextStreak - 1, cfg.dailyStreakCapDays);
  return { ok: true, amount: cfg.dailyAmount + bonusDays * cfg.dailyStreakBonus, streak: nextStreak };
}

export function workClaim(last: Date | null, now: number, cfg: EconomyConfig, rng: () => number = Math.random): ClaimResult {
  const cooldown = cfg.workCooldownMinutes * 60_000;
  const lastMs = last ? last.getTime() : null;
  if (lastMs !== null && now - lastMs < cooldown) return { ok: false, retryAt: lastMs + cooldown };
  const span = cfg.workMax - cfg.workMin + 1;
  const roll = Math.min(span - 1, Math.max(0, Math.floor(rng() * span)));
  return { ok: true, amount: cfg.workMin + roll, streak: 0 };
}

/** Discord relative timestamp, e.g. "<t:1700000000:R>". */
export function relativeTimestamp(ms: number): string {
  return `<t:${Math.ceil(ms / 1000)}:R>`;
}

/* Pay */

export function payRefusal(input: { fromId: string; toId: string; toBot: boolean; amount: number | null }): string | null {
  if (input.fromId === input.toId) return "You can't pay yourself.";
  if (input.toBot) return "Bots can't hold coins.";
  if (input.amount === null) return `Amount must be a whole number from 1 to ${MAX_BALANCE.toLocaleString("en-US")}.`;
  return null;
}

export function needsPayConfirmation(amount: number, cfg: EconomyConfig): boolean {
  return cfg.payConfirmThreshold > 0 && amount >= cfg.payConfirmThreshold;
}

/* Shop */

export interface ShopItemInput {
  name: string;
  description: string;
  price: number;
  roleId: string | null;
  /** null = unlimited. */
  stock: number | null;
  /** Most units one member may ever buy; null = no limit. */
  perUserLimit: number | null;
  /** Role items only: hours until Aegis takes the role back; null = permanent. */
  roleDurationHours: number | null;
  /** Role items only: the role is given by /use instead of on purchase. */
  useToGrant: boolean;
}

export interface ShopItem extends ShopItemInput {
  id: string;
  guildId: string;
  createdAt: Date;
}

export const SHOP_LIMITS = { name: 40, description: 200, maxStock: 1_000_000, maxPerUser: 1000, maxRoleHours: 8760 } as const;
const SNOWFLAKE = /^\d{17,20}$/;

/** Validate a shop item; returns the cleaned item or field errors. */
export function validateShopItem(raw: {
  name?: unknown; description?: unknown; price?: unknown; roleId?: unknown; stock?: unknown;
  perUserLimit?: unknown; roleDurationHours?: unknown; useToGrant?: unknown;
}):
  { ok: true; value: ShopItemInput } | { ok: false; errors: Partial<Record<keyof ShopItemInput, string>> } {
  const errors: Partial<Record<keyof ShopItemInput, string>> = {};
  const name = typeof raw.name === "string" ? raw.name.replace(/\s+/g, " ").trim() : "";
  if (!name || name.length > SHOP_LIMITS.name) errors.name = `Item name: 1–${SHOP_LIMITS.name} characters.`;
  else if (/[@<>`]|https?:/i.test(name)) errors.name = "Item names can't contain mentions, links, < > @ or `.";
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  if (description.length > SHOP_LIMITS.description) errors.description = `Description: at most ${SHOP_LIMITS.description} characters.`;
  const price = parseAmount(raw.price);
  if (price === null) errors.price = `Price must be a whole number from 1 to ${MAX_BALANCE.toLocaleString("en-US")}.`;
  let roleId: string | null = null;
  if (raw.roleId !== undefined && raw.roleId !== null && raw.roleId !== "") {
    if (typeof raw.roleId !== "string" || !SNOWFLAKE.test(raw.roleId)) errors.roleId = "Pick a role from the list.";
    else roleId = raw.roleId;
  }
  let stock: number | null = null;
  if (raw.stock !== undefined && raw.stock !== null && raw.stock !== "") {
    stock = intIn(raw.stock, [0, SHOP_LIMITS.maxStock]);
    if (stock === null) errors.stock = `Stock must be blank (unlimited) or a whole number from 0 to ${SHOP_LIMITS.maxStock.toLocaleString("en-US")}.`;
  }
  const perUserLimit = optionalInt(raw.perUserLimit, [1, SHOP_LIMITS.maxPerUser]);
  if (perUserLimit === undefined) errors.perUserLimit = `Per-member limit must be blank (no limit) or a whole number from 1 to ${SHOP_LIMITS.maxPerUser.toLocaleString("en-US")}.`;
  const roleDurationHours = optionalInt(raw.roleDurationHours, [1, SHOP_LIMITS.maxRoleHours]);
  if (roleDurationHours === undefined) errors.roleDurationHours = `Role duration must be blank (permanent) or 1 to ${SHOP_LIMITS.maxRoleHours.toLocaleString("en-US")} hours.`;
  else if (roleDurationHours !== null && !roleId && !errors.roleId) errors.roleDurationHours = "A duration only applies to items that give a role.";
  const useToGrant = roleId !== null && (raw.useToGrant === true || raw.useToGrant === "on" || raw.useToGrant === "true");
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: { name, description, price: price as number, roleId, stock, perUserLimit: perUserLimit ?? null, roleDurationHours: roleDurationHours ?? null, useToGrant },
  };
}

/** Blank → null, a valid whole number → it, anything else → undefined (an error). */
function optionalInt(value: unknown, range: readonly [number, number]): number | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  return intIn(value, range) ?? undefined;
}

/** Lower-cased name used to keep item names unique in a server. */
export function itemNameKey(name: string): string {
  return name.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Whether a role may be sold in the shop. Aegis must be able to hand it out
 * (below Aegis's highest role, not managed, not @everyone) and the staff
 * member adding it must outrank it (server owner exempt), the same rule as
 * role panels.
 */
export function roleItemRefusal(role: { id: string; position: number; managed: boolean }, ctx: {
  guildId: string; botTopPosition: number; actorTopPosition: number | null; actorIsOwner: boolean;
}): string | null {
  if (role.id === ctx.guildId) return "@everyone can't be sold.";
  if (role.managed) return "That role is managed by an integration (a bot or booster role), so it can't be handed out.";
  if (role.position >= ctx.botTopPosition) return "That role is at or above Aegis's highest role, so Aegis can't hand it out. Move Aegis's role above it first.";
  if (!ctx.actorIsOwner && (ctx.actorTopPosition === null || role.position >= ctx.actorTopPosition)) return "That role is equal to or above your highest role, so you can't sell it.";
  return null;
}
