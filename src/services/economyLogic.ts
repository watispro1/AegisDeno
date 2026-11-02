/**
 * Economy rules with no I/O: settings and their validation, daily/work payouts
 * and cooldowns, /pay rules, shop item validation and the role hierarchy rule
 * for role items. Used by the slash commands, the service and the dashboard.
 */

/** Highest balance anyone can hold. Integer coins only. */
export const MAX_BALANCE = 1_000_000_000_000;
/** Most shop items a server may list. */
export const MAX_SHOP_ITEMS = 50;
/** Streak days that add a bonus; a longer streak keeps the 7-day bonus. */
export const STREAK_BONUS_CAP = 7;
/** Transactions are kept this long (Mongo TTL). */
export const TRANSACTION_TTL_DAYS = 90;

export interface EconomyConfig {
  enabled: boolean;
  currencyName: string;
  currencyEmoji: string;
  dailyAmount: number;
  dailyStreakBonus: number;
  dailyCooldownHours: number;
  workMin: number;
  workMax: number;
  workCooldownMinutes: number;
  /** /pay asks for confirmation at or above this amount. 0 turns the prompt off. */
  payConfirmThreshold: number;
}

export const DEFAULT_ECONOMY_CONFIG: Readonly<EconomyConfig> = Object.freeze({
  enabled: false,
  currencyName: "coins",
  currencyEmoji: "🪙",
  dailyAmount: 100,
  dailyStreakBonus: 10,
  dailyCooldownHours: 24,
  workMin: 20,
  workMax: 80,
  workCooldownMinutes: 60,
  payConfirmThreshold: 1000,
});

/** Inclusive limits for each number setting. */
export const ECONOMY_LIMITS = {
  dailyAmount: [1, 1_000_000],
  dailyStreakBonus: [0, 100_000],
  dailyCooldownHours: [1, 168],
  workMin: [1, 1_000_000],
  workMax: [1, 1_000_000],
  workCooldownMinutes: [1, 1440],
  payConfirmThreshold: [0, MAX_BALANCE],
} as const satisfies Record<string, readonly [number, number]>;

type NumberKey = keyof typeof ECONOMY_LIMITS;
const NUMBER_KEYS = Object.keys(ECONOMY_LIMITS) as NumberKey[];

const CUSTOM_EMOJI = /^<a?:\w{2,32}:\d{17,20}>$/;
const CURRENCY_NAME = /^[\p{L}\p{N}][\p{L}\p{N} '\-]{0,23}$/u;

export function validCurrencyEmoji(value: string): boolean {
  if (CUSTOM_EMOJI.test(value)) return true;
  // A short Unicode emoji or symbol: no mentions, markdown, links or spaces.
  return value.length >= 1 && value.length <= 16 && !/[\s<>@#*_`~|:\\/]/.test(value) && !/[a-z0-9]/i.test(value);
}

function intIn(value: unknown, [min, max]: readonly [number, number]): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && /^\s*-?\d+\s*$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
}

/** Stored settings (any shape) as a complete, valid config. Bad values fall back to defaults. */
export function normalizeEconomyConfig(raw: unknown): EconomyConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: EconomyConfig = { ...DEFAULT_ECONOMY_CONFIG };
  out.enabled = r.enabled === true;
  if (typeof r.currencyName === "string" && CURRENCY_NAME.test(r.currencyName.trim())) out.currencyName = r.currencyName.trim();
  if (typeof r.currencyEmoji === "string" && validCurrencyEmoji(r.currencyEmoji.trim())) out.currencyEmoji = r.currencyEmoji.trim();
  for (const key of NUMBER_KEYS) {
    const n = intIn(r[key], ECONOMY_LIMITS[key]);
    if (n !== null) out[key] = n;
  }
  if (out.workMax < out.workMin) out.workMax = out.workMin;
  return out;
}

export type EconomySettingsInput = Partial<Record<Exclude<keyof EconomyConfig, "enabled">, string | number | null | undefined>> & { enabled?: boolean };

/**
 * Apply a change to the settings. Every field is optional (missing keeps the
 * current value); every given field must be valid, or nothing is applied.
 */
export function applyEconomySettings(base: EconomyConfig, input: EconomySettingsInput):
  { ok: true; value: EconomyConfig } | { ok: false; errors: Partial<Record<keyof EconomyConfig, string>> } {
  const errors: Partial<Record<keyof EconomyConfig, string>> = {};
  const next: EconomyConfig = { ...base };
  if (typeof input.enabled === "boolean") next.enabled = input.enabled;
  if (input.currencyName !== undefined && input.currencyName !== null) {
    const name = String(input.currencyName).trim();
    if (!CURRENCY_NAME.test(name)) errors.currencyName = "Currency name: 1–24 letters, numbers, spaces, - or '.";
    else next.currencyName = name;
  }
  if (input.currencyEmoji !== undefined && input.currencyEmoji !== null) {
    const emoji = String(input.currencyEmoji).trim();
    if (!validCurrencyEmoji(emoji)) errors.currencyEmoji = "Currency emoji: one emoji, or a custom emoji like <:coin:123456789012345678>.";
    else next.currencyEmoji = emoji;
  }
  for (const key of NUMBER_KEYS) {
    const raw = input[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const n = intIn(raw, ECONOMY_LIMITS[key]);
    if (n === null) errors[key] = `${LABELS[key]} must be a whole number from ${ECONOMY_LIMITS[key][0].toLocaleString("en-US")} to ${ECONOMY_LIMITS[key][1].toLocaleString("en-US")}.`;
    else next[key] = n;
  }
  if (!errors.workMin && !errors.workMax && next.workMax < next.workMin) errors.workMax = "Work maximum must be at least the work minimum.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: next };
}

const LABELS: Record<NumberKey, string> = {
  dailyAmount: "Daily amount",
  dailyStreakBonus: "Streak bonus",
  dailyCooldownHours: "Daily cooldown (hours)",
  workMin: "Work minimum",
  workMax: "Work maximum",
  workCooldownMinutes: "Work cooldown (minutes)",
  payConfirmThreshold: "Pay confirmation threshold",
};

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

/* ── Cooldowns and payouts ─────────────────────────────────────────── */

export type ClaimResult = { ok: true; amount: number; streak: number } | { ok: false; retryAt: number };

export function dailyClaim(last: Date | null, streak: number, now: number, cfg: EconomyConfig): ClaimResult {
  const cooldown = cfg.dailyCooldownHours * 3_600_000;
  const lastMs = last ? last.getTime() : null;
  if (lastMs !== null && now - lastMs < cooldown) return { ok: false, retryAt: lastMs + cooldown };
  // Claiming again within two cooldowns keeps the streak going.
  const nextStreak = lastMs !== null && now - lastMs < cooldown * 2 ? Math.max(1, streak) + 1 : 1;
  const bonusDays = Math.min(nextStreak - 1, STREAK_BONUS_CAP);
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

/* ── Pay ───────────────────────────────────────────────────────────── */

export function payRefusal(input: { fromId: string; toId: string; toBot: boolean; amount: number | null }): string | null {
  if (input.fromId === input.toId) return "You can't pay yourself.";
  if (input.toBot) return "Bots can't hold coins.";
  if (input.amount === null) return `Amount must be a whole number from 1 to ${MAX_BALANCE.toLocaleString("en-US")}.`;
  return null;
}

export function needsPayConfirmation(amount: number, cfg: EconomyConfig): boolean {
  return cfg.payConfirmThreshold > 0 && amount >= cfg.payConfirmThreshold;
}

/* ── Shop ──────────────────────────────────────────────────────────── */

export interface ShopItemInput {
  name: string;
  description: string;
  price: number;
  roleId: string | null;
  /** null = unlimited. */
  stock: number | null;
}

export interface ShopItem extends ShopItemInput {
  id: string;
  guildId: string;
  createdAt: Date;
}

export const SHOP_LIMITS = { name: 40, description: 200, maxStock: 1_000_000 } as const;
const SNOWFLAKE = /^\d{17,20}$/;

/** Validate a shop item; returns the cleaned item or field errors. */
export function validateShopItem(raw: { name?: unknown; description?: unknown; price?: unknown; roleId?: unknown; stock?: unknown }):
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
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name, description, price: price as number, roleId, stock } };
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
