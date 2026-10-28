/**
 * Pure verification helpers: math captcha and pending-answer store, plus the
 * auto-kick task payload. Kept free of Discord/Mongo imports for unit tests.
 */

export const MAX_KICK_UNVERIFIED_MINUTES = 7 * 24 * 60;
export const CAPTCHA_TTL_MS = 5 * 60_000;
export const CAPTCHA_MAX_ATTEMPTS = 3;

export interface MathCaptcha {
  question: string;
  answer: number;
}

/** A small addition, subtraction or multiplication problem with a non-negative answer. */
export function generateMathCaptcha(random: () => number = Math.random): MathCaptcha {
  const pick = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const op = pick(0, 2);
  if (op === 0) {
    const a = pick(2, 20), b = pick(2, 20);
    return { question: `${a} + ${b}`, answer: a + b };
  }
  if (op === 1) {
    const a = pick(5, 25), b = pick(1, a);
    return { question: `${a} - ${b}`, answer: a - b };
  }
  const a = pick(2, 9), b = pick(2, 9);
  return { question: `${a} × ${b}`, answer: a * b };
}

/** Accept surrounding whitespace only; anything that is not a whole number is wrong. */
export function checkCaptchaAnswer(input: string, answer: number): boolean {
  const trimmed = input.trim();
  if (!/^-?\d{1,6}$/.test(trimmed)) return false;
  return Number(trimmed) === answer;
}

interface PendingCaptcha {
  answer: number;
  expiresAt: number;
  attempts: number;
}

export type CaptchaCheckResult = "ok" | "wrong" | "expired" | "locked";

/**
 * In-memory store of issued captchas keyed by guild+user. Answers never leave the
 * process (the modal custom id carries no answer). Entries expire after `ttlMs`.
 */
export class CaptchaStore {
  private entries = new Map<string, PendingCaptcha>();

  constructor(private ttlMs = CAPTCHA_TTL_MS, private maxAttempts = CAPTCHA_MAX_ATTEMPTS) {}

  private key(guildId: string, userId: string): string {
    return `${guildId}:${userId}`;
  }

  issue(guildId: string, userId: string, answer: number, now = Date.now()): void {
    this.sweep(now);
    this.entries.set(this.key(guildId, userId), { answer, expiresAt: now + this.ttlMs, attempts: 0 });
  }

  check(guildId: string, userId: string, input: string, now = Date.now()): CaptchaCheckResult {
    const key = this.key(guildId, userId);
    const entry = this.entries.get(key);
    if (!entry || entry.expiresAt <= now) {
      this.entries.delete(key);
      return "expired";
    }
    if (checkCaptchaAnswer(input, entry.answer)) {
      this.entries.delete(key);
      return "ok";
    }
    entry.attempts++;
    if (entry.attempts >= this.maxAttempts) {
      this.entries.delete(key);
      return "locked";
    }
    return "wrong";
  }

  sweep(now = Date.now()): void {
    for (const [k, v] of this.entries) if (v.expiresAt <= now) this.entries.delete(k);
  }

  get size(): number {
    return this.entries.size;
  }
}

/** Clamp the auto-kick delay to whole minutes in [0, 7 days]; 0 means off. */
export function normalizeKickMinutes(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_KICK_UNVERIFIED_MINUTES, Math.floor(value)));
}

export interface VerifyKickPayload {
  userId: string;
}

export function encodeVerifyKick(payload: VerifyKickPayload): string {
  return JSON.stringify(payload);
}

export function decodeVerifyKick(raw: string): VerifyKickPayload | null {
  try {
    const o: unknown = JSON.parse(raw);
    if (o && typeof o === "object" && typeof (o as Record<string, unknown>).userId === "string") {
      return { userId: (o as Record<string, string>).userId };
    }
  } catch {
    // fall through
  }
  return null;
}
