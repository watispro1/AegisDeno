/**
 * Pure rules for the newer economy features: work levels, bank interest,
 * /rob, item effects (rob shields, work boosts), the dice game and badges.
 * No I/O; randomness comes in as `randomInt(max)` (crypto.randomInt in
 * production) so every outcome can be tested.
 */
import { MAX_BALANCE, type EconomyConfig } from "./economyConfig";
import type { RandomInt } from "./economyRules";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/* Work levels */

export const WORK_MAX_LEVEL = 10;
/** Most a work boost item may add, in percent. */
export const MAX_WORK_BOOST_PERCENT = 100;

/** XP needed to reach `level` (level 1 needs 0; each /work is 1 XP): 0, 5, 15, 30, 50 … 225. */
export function xpForLevel(level: number): number {
  const l = Math.max(1, Math.min(WORK_MAX_LEVEL, Math.floor(level)));
  return (5 * (l - 1) * l) / 2;
}

/** Work level for an XP total, 1..WORK_MAX_LEVEL. Junk (negative, NaN) counts as 0 XP. */
export function workLevel(xp: number): number {
  const safe = Number.isFinite(xp) && xp > 0 ? Math.floor(xp) : 0;
  let level = 1;
  while (level < WORK_MAX_LEVEL && safe >= xpForLevel(level + 1)) level++;
  return level;
}

export const WORK_TITLES = [
  "Intern", "Helper", "Regular", "Trusted helper", "Specialist",
  "Senior specialist", "Team lead", "Manager", "Director", "Legend",
] as const;

export function workTitle(level: number): string {
  return WORK_TITLES[Math.max(1, Math.min(WORK_MAX_LEVEL, level)) - 1];
}

/** Jobs by level band: higher levels unlock better-sounding jobs (flavour only). */
const JOBS_BY_BAND: string[][] = [
  ["walked the server's dogs", "organised the emoji list", "cleaned up the pins", "baked cookies for the mods"],
  ["answered a pile of tickets", "reviewed some suggestions", "fixed a broken role panel", "welcomed the new members"],
  ["moderated a heated debate", "wrote the weekly announcement", "tested a new bot feature", "ran the game night"],
  ["planned the server event", "trained the new helpers", "audited the permissions", "redesigned the channel list"],
];

export function pickJob(level: number, randomInt: RandomInt): string {
  const band = JOBS_BY_BAND[Math.min(JOBS_BY_BAND.length - 1, Math.floor((Math.max(1, level) - 1) / 3))];
  return band[randomInt(band.length)];
}

/** Bonus percent from a work level (level 1 = 0). */
export function levelBonusPercent(level: number, perLevel: number): number {
  return Math.max(0, Math.min(WORK_MAX_LEVEL, level) - 1) * Math.max(0, perLevel);
}

/** /work pay after level and boost bonuses, rounded down, always a whole coin count ≤ MAX_BALANCE. */
export function boostedPay(base: number, levelPercent: number, boostPercent: number): number {
  const pct = 100 + Math.max(0, levelPercent) + Math.max(0, Math.min(MAX_WORK_BOOST_PERCENT, boostPercent));
  return Math.min(MAX_BALANCE, Math.floor((base * pct) / 100));
}

/** Boost percent in force at `now` (0 when none or expired). */
export function activeBoost(until: Date | null, percent: number, now: number): number {
  return until && until.getTime() > now ? Math.max(0, Math.min(MAX_WORK_BOOST_PERCENT, percent)) : 0;
}

/* Bank interest */

export const INTEREST_COOLDOWN_MS = DAY;

export type InterestPlan =
  | { ok: true; amount: number }
  | { ok: false; reason: "off" | "empty" | "bank_full" | "too_small" }
  | { ok: false; reason: "cooldown"; retryAt: number };

/**
 * One interest claim: once per 24 hours, on the bank as it is now, rounded
 * down, never more than the per-claim cap or the room under the bank limit.
 * Nothing builds up while unclaimed, so parking coins just before a claim
 * earns no more than keeping them in the bank all along.
 */
export function planInterest(bank: number, lastInterest: Date | null, now: number, cfg: Pick<EconomyConfig, "bankInterestBps" | "bankInterestMaxDaily" | "bankCap">): InterestPlan {
  if (cfg.bankInterestBps <= 0) return { ok: false, reason: "off" };
  if (lastInterest && now - lastInterest.getTime() < INTEREST_COOLDOWN_MS) return { ok: false, reason: "cooldown", retryAt: lastInterest.getTime() + INTEREST_COOLDOWN_MS };
  if (bank <= 0) return { ok: false, reason: "empty" };
  const room = cfg.bankCap > 0 ? Math.max(0, cfg.bankCap - bank) : MAX_BALANCE - bank;
  if (room <= 0) return { ok: false, reason: "bank_full" };
  let amount = Math.floor((bank * cfg.bankInterestBps) / 10_000);
  if (cfg.bankInterestMaxDaily > 0) amount = Math.min(amount, cfg.bankInterestMaxDaily);
  amount = Math.min(amount, room);
  return amount >= 1 ? { ok: true, amount } : { ok: false, reason: "too_small" };
}

/* Rob */

export interface RobSide { userId: string; wallet: number; isBot: boolean; lastRob: Date | null; lastRobbed: Date | null; shieldUntil: Date | null }

export type RobRefusal =
  | { reason: "off" | "self" | "bot" | "poor" | "target_poor" | "shielded" }
  | { reason: "cooldown" | "protected"; retryAt: number };

/** Why /rob can't go ahead; null when it may. Checked again inside the atomic updates. */
export function robRefusal(robber: RobSide, target: RobSide, now: number, cfg: EconomyConfig): RobRefusal | null {
  if (!cfg.robEnabled) return { reason: "off" };
  if (robber.userId === target.userId) return { reason: "self" };
  if (target.isBot) return { reason: "bot" };
  const cooldown = cfg.robCooldownMinutes * MINUTE;
  if (robber.lastRob && now - robber.lastRob.getTime() < cooldown) return { reason: "cooldown", retryAt: robber.lastRob.getTime() + cooldown };
  if (robber.wallet < cfg.robMinWallet) return { reason: "poor" };
  if (target.shieldUntil && target.shieldUntil.getTime() > now) return { reason: "shielded" };
  const protect = cfg.robProtectMinutes * MINUTE;
  if (protect > 0 && target.lastRobbed && now - target.lastRobbed.getTime() < protect) return { reason: "protected", retryAt: target.lastRobbed.getTime() + protect };
  if (target.wallet < cfg.robMinTargetWallet) return { reason: "target_poor" };
  return null;
}

export type RobRoll = { success: true; percent: number } | { success: false };

/** Roll once per attempt; a lost race never earns a second roll. */
export function rollRob(cfg: Pick<EconomyConfig, "robSuccessPercent" | "robMaxStealPercent">, randomInt: RandomInt): RobRoll {
  if (randomInt(100) < cfg.robSuccessPercent) return { success: true, percent: 1 + randomInt(cfg.robMaxStealPercent) };
  return { success: false };
}

/** Coins a successful rob takes: the rolled percent of the target's wallet, at least 1, at most robMaxSteal and the wallet. */
export function robSteal(targetWallet: number, percent: number, cfg: Pick<EconomyConfig, "robMaxSteal">): number {
  if (targetWallet <= 0) return 0;
  return Math.min(targetWallet, cfg.robMaxSteal, Math.max(1, Math.floor((targetWallet * percent) / 100)));
}

/** Fine for a failed rob: robFinePercent of the robber's wallet, rounded down, never more than it holds. */
export function robFine(robberWallet: number, cfg: Pick<EconomyConfig, "robFinePercent">): number {
  return Math.max(0, Math.min(robberWallet, Math.floor((robberWallet * cfg.robFinePercent) / 100)));
}

/* Item effects */

export const ITEM_EFFECTS = ["rob_shield", "work_boost"] as const;
export type ItemEffect = typeof ITEM_EFFECTS[number];
export const EFFECT_LIMITS = { maxHours: 720, maxPercent: MAX_WORK_BOOST_PERCENT } as const;
/** A shield can't be stacked beyond this far ahead. */
export const MAX_SHIELD_AHEAD_MS = 30 * DAY;

export const EFFECT_LABELS: Record<ItemEffect, string> = { rob_shield: "Rob shield", work_boost: "Work boost" };

export function isItemEffect(v: unknown): v is ItemEffect {
  return typeof v === "string" && (ITEM_EFFECTS as readonly string[]).includes(v);
}

/** "🛡️ rob shield for 24h" / "⚡ +25% /work pay for 12h". */
export function effectSummary(effect: ItemEffect, hours: number, percent: number | null): string {
  return effect === "rob_shield" ? `🛡️ rob shield for ${hours}h` : `⚡ +${percent ?? 0}% /work pay for ${hours}h`;
}

export type EffectPlan =
  | { ok: true; until: Date; percent?: number }
  | { ok: false; reason: "boost_active"; until: number }
  | { ok: false; reason: "shield_max" };

/**
 * What using an effect item does. A shield extends from whichever is later,
 * now or the current shield's end, up to 30 days ahead. A work boost can't be
 * used while another is running, so boosts never stack.
 */
export function planEffect(effect: ItemEffect, hours: number, percent: number | null, acct: { shieldUntil: Date | null; workBoostUntil: Date | null }, now: number): EffectPlan {
  const ms = hours * HOUR;
  if (effect === "rob_shield") {
    const from = Math.max(now, acct.shieldUntil?.getTime() ?? 0);
    if (from + ms > now + MAX_SHIELD_AHEAD_MS) return { ok: false, reason: "shield_max" };
    return { ok: true, until: new Date(from + ms) };
  }
  if (acct.workBoostUntil && acct.workBoostUntil.getTime() > now) return { ok: false, reason: "boost_active", until: acct.workBoostUntil.getTime() };
  return { ok: true, until: new Date(now + ms), percent: Math.max(1, Math.min(MAX_WORK_BOOST_PERCENT, percent ?? 0)) };
}

/* Dice */

/** Dice pays 5.88× the bet on the right face (a 2% house edge, like coinflip). */
export const DICE_RETURN_PERCENT = 588;

export function playDice(bet: number, guess: number, randomInt: RandomInt): { payout: number; win: boolean; detail: string } {
  const rolled = 1 + randomInt(6);
  const win = rolled === guess;
  return { payout: win ? Math.floor((bet * DICE_RETURN_PERCENT) / 100) : 0, win, detail: String(rolled) };
}

/* Badges (computed from stored stats; they pay nothing, so there is nothing to farm) */

export interface Badge { id: string; emoji: string; name: string; hint: string }

export const BADGES: Array<Badge & { earned: (s: BadgeStats) => boolean }> = [
  { id: "first_1k", emoji: "🥉", name: "Saver", hint: "Hold 1,000 coins (wallet + bank)", earned: s => s.total >= 1_000 },
  { id: "rich_100k", emoji: "🥈", name: "Wealthy", hint: "Hold 100,000 coins", earned: s => s.total >= 100_000 },
  { id: "millionaire", emoji: "🥇", name: "Millionaire", hint: "Hold 1,000,000 coins", earned: s => s.total >= 1_000_000 },
  { id: "streak_7", emoji: "🔥", name: "On a roll", hint: "Reach a 7-day daily streak", earned: s => s.streak >= 7 },
  { id: "streak_30", emoji: "☄️", name: "Unstoppable", hint: "Reach a 30-day daily streak", earned: s => s.streak >= 30 },
  { id: "worker_5", emoji: "💼", name: "Hard worker", hint: "Reach work level 5", earned: s => s.workLevel >= 5 },
  { id: "worker_max", emoji: "🏅", name: "Legend", hint: `Reach work level ${WORK_MAX_LEVEL}`, earned: s => s.workLevel >= WORK_MAX_LEVEL },
  { id: "banker", emoji: "🏦", name: "Banker", hint: "Keep 10,000 coins in the bank", earned: s => s.bank >= 10_000 },
  { id: "collector", emoji: "🎒", name: "Collector", hint: "Own 5 different shop items", earned: s => s.distinctItems >= 5 },
];

export interface BadgeStats { total: number; bank: number; streak: number; workLevel: number; distinctItems: number }

export function earnedBadges(stats: BadgeStats): Badge[] {
  return BADGES.filter(b => b.earned(stats)).map(({ earned: _earned, ...b }) => b);
}
