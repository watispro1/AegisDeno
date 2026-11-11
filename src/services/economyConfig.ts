/**
 * Per-server economy settings: the shape, the defaults, the bounds of every
 * number, and the two ways settings come in (stored documents, normalized
 * leniently; edits from /economy or the dashboard, validated strictly).
 */

/** Highest balance anyone can hold (wallet and bank each). Integer coins only. */
export const MAX_BALANCE = 1_000_000_000_000;
/** Default number of streak days that add a bonus; a longer streak keeps that bonus. */
export const STREAK_BONUS_CAP = 7;

export interface EconomyConfig {
  enabled: boolean;
  currencyName: string;
  currencyEmoji: string;
  dailyAmount: number;
  dailyStreakBonus: number;
  /** Streak days that add dailyStreakBonus; 0 turns the streak bonus off. */
  dailyStreakCapDays: number;
  dailyCooldownHours: number;
  /** /weekly reward; 0 turns /weekly off. Cooldown is 7 days. */
  weeklyAmount: number;
  workMin: number;
  workMax: number;
  workCooldownMinutes: number;
  /** Most coins one member may keep in the bank; 0 = no limit. */
  bankCap: number;
  /** /pay asks for confirmation at or above this amount. 0 turns the prompt off. */
  payConfirmThreshold: number;
  /** Hours a member must have been in the server before they can send coins. */
  payMinMemberHours: number;
  /** Most coins one member may send per UTC day; 0 = no limit. */
  payDailyLimit: number;
  /** Percent of each payment removed as tax (the recipient gets the rest). */
  payTaxPercent: number;
  /** Percent of the current price paid back by /shop sell; 0 turns selling off. */
  shopSellPercent: number;
  crimeEnabled: boolean;
  crimeSuccessPercent: number;
  crimeMin: number;
  crimeMax: number;
  /** Fine on a failed /crime, never more than the wallet holds. */
  crimeFine: number;
  crimeCooldownMinutes: number;
  /** /gamble is off unless a server manager turns it on. */
  gamblingEnabled: boolean;
  gambleMinBet: number;
  gambleMaxBet: number;
  /** Most a member may lose (net) per UTC day; 0 = no limit. */
  gambleDailyLossCap: number;
  gambleCooldownSeconds: number;
  /** Extra /work pay per work level above 1, in percent (level 10 = 9 × this). 0 turns level bonuses off. */
  workLevelBonusPercent: number;
  /** Daily bank interest in basis points (100 = 1% a day), claimed with /interest. 0 turns interest off. */
  bankInterestBps: number;
  /** Most interest one member can earn per claim; 0 = no cap besides the bank limit. */
  bankInterestMaxDaily: number;
  /** /rob is off unless a server manager turns it on. */
  robEnabled: boolean;
  robSuccessPercent: number;
  /** A successful /rob takes a random 1..this percent of the target's wallet. */
  robMaxStealPercent: number;
  /** Most coins one /rob can take, whatever the target holds. */
  robMaxSteal: number;
  /** Percent of the robber's wallet lost on a failed /rob (removed from circulation). */
  robFinePercent: number;
  /** The robber must hold at least this in their wallet (so a failure always costs something). */
  robMinWallet: number;
  /** Targets with less than this in their wallet can't be robbed. */
  robMinTargetWallet: number;
  robCooldownMinutes: number;
  /** After being robbed, a member can't be robbed again for this long. */
  robProtectMinutes: number;
}

export const DEFAULT_ECONOMY_CONFIG: Readonly<EconomyConfig> = Object.freeze({
  enabled: false,
  currencyName: "coins",
  currencyEmoji: "🪙",
  dailyAmount: 100,
  dailyStreakBonus: 10,
  dailyStreakCapDays: STREAK_BONUS_CAP,
  dailyCooldownHours: 24,
  weeklyAmount: 500,
  workMin: 20,
  workMax: 80,
  workCooldownMinutes: 60,
  bankCap: 0,
  payConfirmThreshold: 1000,
  payMinMemberHours: 24,
  payDailyLimit: 10_000,
  payTaxPercent: 0,
  shopSellPercent: 50,
  crimeEnabled: true,
  crimeSuccessPercent: 50,
  crimeMin: 50,
  crimeMax: 250,
  crimeFine: 100,
  crimeCooldownMinutes: 120,
  gamblingEnabled: false,
  gambleMinBet: 10,
  gambleMaxBet: 1000,
  gambleDailyLossCap: 5000,
  gambleCooldownSeconds: 10,
  workLevelBonusPercent: 5,
  bankInterestBps: 50,
  bankInterestMaxDaily: 250,
  robEnabled: false,
  robSuccessPercent: 40,
  robMaxStealPercent: 20,
  robMaxSteal: 1000,
  robFinePercent: 20,
  robMinWallet: 250,
  robMinTargetWallet: 500,
  robCooldownMinutes: 240,
  robProtectMinutes: 360,
});

/** Inclusive limits for each number setting. */
export const ECONOMY_LIMITS = {
  dailyAmount: [1, 1_000_000],
  dailyStreakBonus: [0, 100_000],
  dailyStreakCapDays: [0, 365],
  dailyCooldownHours: [1, 168],
  weeklyAmount: [0, 10_000_000],
  workMin: [1, 1_000_000],
  workMax: [1, 1_000_000],
  workCooldownMinutes: [1, 1440],
  bankCap: [0, MAX_BALANCE],
  payConfirmThreshold: [0, MAX_BALANCE],
  payMinMemberHours: [0, 720],
  payDailyLimit: [0, MAX_BALANCE],
  payTaxPercent: [0, 50],
  shopSellPercent: [0, 90],
  crimeSuccessPercent: [5, 95],
  crimeMin: [1, 1_000_000],
  crimeMax: [1, 1_000_000],
  crimeFine: [0, 1_000_000],
  crimeCooldownMinutes: [5, 1440],
  gambleMinBet: [1, 1_000_000],
  gambleMaxBet: [1, 10_000_000],
  gambleDailyLossCap: [0, MAX_BALANCE],
  gambleCooldownSeconds: [0, 3600],
  workLevelBonusPercent: [0, 20],
  bankInterestBps: [0, 500],
  bankInterestMaxDaily: [0, 1_000_000],
  robSuccessPercent: [5, 90],
  robMaxStealPercent: [1, 50],
  robMaxSteal: [1, 1_000_000],
  robFinePercent: [0, 100],
  robMinWallet: [1, 1_000_000],
  robMinTargetWallet: [1, 1_000_000],
  robCooldownMinutes: [10, 10_080],
  robProtectMinutes: [0, 10_080],
} as const satisfies Record<string, readonly [number, number]>;

export type EconomyNumberKey = keyof typeof ECONOMY_LIMITS;
export const ECONOMY_NUMBER_KEYS = Object.keys(ECONOMY_LIMITS) as EconomyNumberKey[];
export const ECONOMY_BOOLEAN_KEYS = ["enabled", "crimeEnabled", "gamblingEnabled", "robEnabled"] as const;
export type EconomyBooleanKey = typeof ECONOMY_BOOLEAN_KEYS[number];

export const ECONOMY_LABELS: Record<EconomyNumberKey, string> = {
  dailyAmount: "Daily amount",
  dailyStreakBonus: "Streak bonus",
  dailyStreakCapDays: "Streak bonus days",
  dailyCooldownHours: "Daily cooldown (hours)",
  weeklyAmount: "Weekly amount",
  workMin: "Work minimum",
  workMax: "Work maximum",
  workCooldownMinutes: "Work cooldown (minutes)",
  bankCap: "Bank limit",
  payConfirmThreshold: "Pay confirmation threshold",
  payMinMemberHours: "Hours in the server before paying",
  payDailyLimit: "Daily sending limit",
  payTaxPercent: "Pay tax (%)",
  shopSellPercent: "Sell-back rate (%)",
  crimeSuccessPercent: "Crime success chance (%)",
  crimeMin: "Crime minimum",
  crimeMax: "Crime maximum",
  crimeFine: "Crime fine",
  crimeCooldownMinutes: "Crime cooldown (minutes)",
  gambleMinBet: "Minimum bet",
  gambleMaxBet: "Maximum bet",
  gambleDailyLossCap: "Daily loss limit",
  gambleCooldownSeconds: "Gamble cooldown (seconds)",
  workLevelBonusPercent: "Work level bonus (%)",
  bankInterestBps: "Bank interest (basis points a day)",
  bankInterestMaxDaily: "Most interest per claim",
  robSuccessPercent: "Rob success chance (%)",
  robMaxStealPercent: "Rob takes at most (% of wallet)",
  robMaxSteal: "Rob takes at most (coins)",
  robFinePercent: "Rob fine (% of robber's wallet)",
  robMinWallet: "Wallet needed to rob",
  robMinTargetWallet: "Target wallet needed",
  robCooldownMinutes: "Rob cooldown (minutes)",
  robProtectMinutes: "Rob protection (minutes)",
};

/** Pairs where the second value must be at least the first. */
const MIN_MAX_PAIRS: Array<[EconomyNumberKey, EconomyNumberKey, string]> = [
  ["workMin", "workMax", "Work maximum must be at least the work minimum."],
  ["crimeMin", "crimeMax", "Crime maximum must be at least the crime minimum."],
  ["gambleMinBet", "gambleMaxBet", "Maximum bet must be at least the minimum bet."],
];

const CUSTOM_EMOJI = /^<a?:\w{2,32}:\d{17,20}>$/;
const CURRENCY_NAME = /^[\p{L}\p{N}][\p{L}\p{N} '\-]{0,23}$/u;

export function validCurrencyEmoji(value: string): boolean {
  if (CUSTOM_EMOJI.test(value)) return true;
  // A short Unicode emoji or symbol: no mentions, markdown, links or spaces.
  return value.length >= 1 && value.length <= 16 && !/[\s<>@#*_`~|:\\/]/.test(value) && !/[a-z0-9]/i.test(value);
}

export function intIn(value: unknown, [min, max]: readonly [number, number]): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && /^\s*-?\d+\s*$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
}

/** Stored settings (any shape) as a complete, valid config. Bad values fall back to defaults. */
export function normalizeEconomyConfig(raw: unknown): EconomyConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: EconomyConfig = { ...DEFAULT_ECONOMY_CONFIG };
  out.enabled = r.enabled === true;
  if (typeof r.crimeEnabled === "boolean") out.crimeEnabled = r.crimeEnabled;
  out.gamblingEnabled = r.gamblingEnabled === true;
  out.robEnabled = r.robEnabled === true;
  if (typeof r.currencyName === "string" && CURRENCY_NAME.test(r.currencyName.trim())) out.currencyName = r.currencyName.trim();
  if (typeof r.currencyEmoji === "string" && validCurrencyEmoji(r.currencyEmoji.trim())) out.currencyEmoji = r.currencyEmoji.trim();
  for (const key of ECONOMY_NUMBER_KEYS) {
    const n = intIn(r[key], ECONOMY_LIMITS[key]);
    if (n !== null) out[key] = n;
  }
  for (const [lo, hi] of MIN_MAX_PAIRS) if (out[hi] < out[lo]) out[hi] = Math.min(out[lo], ECONOMY_LIMITS[hi][1]);
  return out;
}

export type EconomySettingsInput =
  Partial<Record<Exclude<keyof EconomyConfig, EconomyBooleanKey>, string | number | null | undefined>> &
  Partial<Record<EconomyBooleanKey, boolean>>;

/**
 * Apply a change to the settings. Every field is optional (missing keeps the
 * current value); every given field must be valid, or nothing is applied.
 */
export function applyEconomySettings(base: EconomyConfig, input: EconomySettingsInput):
  { ok: true; value: EconomyConfig } | { ok: false; errors: Partial<Record<keyof EconomyConfig, string>> } {
  const errors: Partial<Record<keyof EconomyConfig, string>> = {};
  const next: EconomyConfig = { ...base };
  for (const key of ECONOMY_BOOLEAN_KEYS) if (typeof input[key] === "boolean") next[key] = input[key] as boolean;
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
  for (const key of ECONOMY_NUMBER_KEYS) {
    const raw = input[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const n = intIn(raw, ECONOMY_LIMITS[key]);
    if (n === null) errors[key] = `${ECONOMY_LABELS[key]} must be a whole number from ${ECONOMY_LIMITS[key][0].toLocaleString("en-US")} to ${ECONOMY_LIMITS[key][1].toLocaleString("en-US")}.`;
    else next[key] = n;
  }
  for (const [lo, hi, message] of MIN_MAX_PAIRS) {
    if (!errors[lo] && !errors[hi] && next[hi] < next[lo]) errors[hi] = message;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: next };
}
