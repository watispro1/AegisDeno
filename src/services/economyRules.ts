/**
 * Pure rules for the bank, /weekly, /crime, /gamble, /pay limits and item
 * use or sale. No I/O; randomness comes in as a `randomInt(max)` function
 * (crypto.randomInt in production) so outcomes can be tested.
 */
import { MAX_BALANCE, type EconomyConfig } from "./economyConfig";
import type { ShopItem } from "./economyLogic";

/** Returns an integer in [0, max). */
export type RandomInt = (max: number) => number;

export const WEEKLY_COOLDOWN_MS = 7 * 24 * 3_600_000;

/** UTC calendar day ("2026-11-05"): daily sending and loss limits reset at 00:00 UTC. */
export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Next 00:00 UTC after `ms`, for "resets <t:…:R>" lines. */
export function nextUtcMidnight(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

/** When a fixed-cooldown action is ready again; null when it is ready now. */
export function cooldownLeft(last: Date | null, cooldownMs: number, now: number): number | null {
  if (!last) return null;
  const at = last.getTime() + cooldownMs;
  return now < at ? at : null;
}

/* Bank */

/** "all", "half" or a number ("1,000") as an amount request; null when it can't be read. */
export function parseAmountOrAll(raw: string): number | "all" | "half" | null {
  const v = raw.trim().toLowerCase();
  if (v === "all" || v === "max") return "all";
  if (v === "half") return "half";
  const clean = v.replace(/[,_\s]/g, "");
  if (!/^\d{1,13}$/.test(clean)) return null;
  const n = Number(clean);
  return n >= 1 && n <= MAX_BALANCE ? n : null;
}

export type BankPlan = { ok: true; amount: number } | { ok: false; reason: "empty" | "insufficient" | "bank_full" | "wallet_full" | "invalid" };

/** How much a deposit moves: never more than the wallet holds or the bank has room for. */
export function planDeposit(request: number | "all" | "half" | null, wallet: number, bank: number, bankCap: number): BankPlan {
  if (request === null) return { ok: false, reason: "invalid" };
  const room = bankCap > 0 ? Math.max(0, bankCap - bank) : MAX_BALANCE - bank;
  if (request === "all" || request === "half") {
    if (wallet <= 0) return { ok: false, reason: "empty" };
    if (room <= 0) return { ok: false, reason: "bank_full" };
    const want = request === "all" ? wallet : Math.max(1, Math.floor(wallet / 2));
    return { ok: true, amount: Math.min(want, room) };
  }
  if (request > wallet) return { ok: false, reason: "insufficient" };
  if (request > room) return { ok: false, reason: "bank_full" };
  return { ok: true, amount: request };
}

/** How much a withdrawal moves: never more than the bank holds or the wallet can take. */
export function planWithdraw(request: number | "all" | "half" | null, wallet: number, bank: number): BankPlan {
  if (request === null) return { ok: false, reason: "invalid" };
  const room = MAX_BALANCE - wallet;
  if (request === "all" || request === "half") {
    if (bank <= 0) return { ok: false, reason: "empty" };
    if (room <= 0) return { ok: false, reason: "wallet_full" };
    const want = request === "all" ? bank : Math.max(1, Math.floor(bank / 2));
    return { ok: true, amount: Math.min(want, room) };
  }
  if (request > bank) return { ok: false, reason: "insufficient" };
  if (request > room) return { ok: false, reason: "wallet_full" };
  return { ok: true, amount: request };
}

/* Crime */

export type CrimeRoll = { success: true; amount: number } | { success: false; fine: number };

/**
 * One /crime attempt. Success pays a random amount in [crimeMin, crimeMax];
 * failure fines crimeFine, but never more than the wallet holds, so a fine
 * can't push anyone below zero.
 */
export function rollCrime(cfg: Pick<EconomyConfig, "crimeSuccessPercent" | "crimeMin" | "crimeMax" | "crimeFine">, wallet: number, randomInt: RandomInt): CrimeRoll {
  if (randomInt(100) < cfg.crimeSuccessPercent) {
    return { success: true, amount: cfg.crimeMin + randomInt(cfg.crimeMax - cfg.crimeMin + 1) };
  }
  return { success: false, fine: Math.max(0, Math.min(cfg.crimeFine, wallet)) };
}

/* Gambling */

/**
 * Coinflip pays 1.96× the bet on a win (a 2% house edge; payouts round
 * down, so very small bets lose a little more).
 */
export const COINFLIP_RETURN_PERCENT = 196;

export const SLOT_SYMBOLS = ["🍒", "🍋", "🔔", "⭐", "💎"] as const;
export type SlotSymbol = typeof SLOT_SYMBOLS[number];
/** Reel weights (out of 18), same on each of the three reels. */
export const SLOT_WEIGHTS: Record<SlotSymbol, number> = { "🍒": 6, "🍋": 5, "🔔": 4, "⭐": 2, "💎": 1 };
/** Return in tenths of the bet: three of a kind, and any two matching. Expected return ≈ 96.4% (3.6% house edge). */
export const SLOT_TRIPLE_TENTHS: Record<SlotSymbol, number> = { "🍒": 50, "🍋": 80, "🔔": 120, "⭐": 350, "💎": 1000 };
export const SLOT_PAIR_TENTHS: Record<SlotSymbol, number> = { "🍒": 5, "🍋": 5, "🔔": 10, "⭐": 20, "💎": 40 };
/** Largest multiple of the bet any game can return (three diamonds). */
export const MAX_GAMBLE_MULTIPLE = 100;

export function spinReel(randomInt: RandomInt): SlotSymbol {
  const total = SLOT_SYMBOLS.reduce((n, s) => n + SLOT_WEIGHTS[s], 0);
  let roll = randomInt(total);
  for (const s of SLOT_SYMBOLS) {
    if (roll < SLOT_WEIGHTS[s]) return s;
    roll -= SLOT_WEIGHTS[s];
  }
  return SLOT_SYMBOLS[0];
}

/** What a spin returns, in tenths of the bet (0 = lose everything). */
export function slotReturnTenths(reels: readonly SlotSymbol[]): number {
  const [a, b, c] = reels;
  if (a === b && b === c) return SLOT_TRIPLE_TENTHS[a];
  const pair = a === b || a === c ? a : b === c ? b : null;
  return pair ? SLOT_PAIR_TENTHS[pair] : 0;
}

export type GameResult = { payout: number; win: boolean; detail: string; reels?: SlotSymbol[] };

export function playCoinflip(bet: number, call: "heads" | "tails", randomInt: RandomInt): GameResult {
  const landed = randomInt(2) === 0 ? "heads" : "tails";
  const win = landed === call;
  return { payout: win ? Math.floor((bet * COINFLIP_RETURN_PERCENT) / 100) : 0, win, detail: landed };
}

export function playSlots(bet: number, randomInt: RandomInt): GameResult {
  const reels = [spinReel(randomInt), spinReel(randomInt), spinReel(randomInt)];
  const payout = Math.floor((bet * slotReturnTenths(reels)) / 10);
  return { payout, win: payout > bet, detail: reels.join(" "), reels };
}

export type BetRefusal = { reason: "off" | "min" | "max" | "insufficient" | "loss_cap" | "cap" | "invalid"; limit?: number };

/**
 * Whether a bet may be placed. `lossToday` is the member's net loss so far
 * this UTC day (negative when they are up). The daily loss cap counts the
 * whole bet as at risk.
 */
export function betRefusal(bet: number, ctx: { cfg: EconomyConfig; wallet: number; lossToday: number }): BetRefusal | null {
  const { cfg } = ctx;
  if (!cfg.gamblingEnabled) return { reason: "off" };
  if (!Number.isSafeInteger(bet) || bet < 1) return { reason: "invalid" };
  if (bet < cfg.gambleMinBet) return { reason: "min", limit: cfg.gambleMinBet };
  if (bet > cfg.gambleMaxBet) return { reason: "max", limit: cfg.gambleMaxBet };
  if (bet > ctx.wallet) return { reason: "insufficient" };
  if (cfg.gambleDailyLossCap > 0 && ctx.lossToday + bet > cfg.gambleDailyLossCap) {
    return { reason: "loss_cap", limit: Math.max(0, cfg.gambleDailyLossCap - ctx.lossToday) };
  }
  if (ctx.wallet - bet > MAX_BALANCE - bet * MAX_GAMBLE_MULTIPLE) return { reason: "cap" };
  return null;
}

/* Pay */

/** Refusal when the sender joined too recently; null when they may pay. Unknown join dates pass. */
export function payTenureRefusal(joinedAtMs: number | null, now: number, minHours: number): { readyAt: number } | null {
  if (minHours <= 0 || joinedAtMs === null) return null;
  const readyAt = joinedAtMs + minHours * 3_600_000;
  return now < readyAt ? { readyAt } : null;
}

/** Tax taken from a payment (rounded down); the recipient gets amount − tax. */
export function payTax(amount: number, taxPercent: number): number {
  return taxPercent > 0 ? Math.floor((amount * taxPercent) / 100) : 0;
}

/** Coins still sendable today under the daily limit; Infinity when there is no limit. */
export function payRoomToday(limit: number, sentDay: string | null, sentTotal: number, today: string): number {
  if (limit <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, limit - (sentDay === today ? sentTotal : 0));
}

/* Items */

/** Why an inventory item can't be used; null when /use applies. */
export function useRefusal(item: Pick<ShopItem, "roleId" | "useToGrant"> & Partial<Pick<ShopItem, "effect">> | null, ownsRole: boolean): string | null {
  if (!item) return "That item is no longer in the shop, so it can't be used.";
  if (item.effect) return null;
  if (!item.roleId) return "That's a collectible: it stays in your inventory and has nothing to use.";
  if (!item.useToGrant) return "That item's role was given when you bought it.";
  if (ownsRole) return "You already have that role.";
  return null;
}

/** Coins /shop sell pays for one unit; null when it can't be sold back. */
export function sellPrice(item: Pick<ShopItem, "price" | "roleId" | "useToGrant">, sellPercent: number): number | null {
  if (sellPercent <= 0) return null;
  // A role given on purchase was already handed out, so the item can't be returned.
  if (item.roleId && !item.useToGrant) return null;
  return Math.floor((item.price * sellPercent) / 100);
}
