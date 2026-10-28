/**
 * Pure trust-score maths used by /trustscore. The command fetches warning and
 * case counts, then hands everything to calculateTrustProfile().
 */

export interface TrustBreakdown {
  accountAge:      number;  // 0–25
  serverTenure:    number;  // 0–25
  warningPenalty:  number;  // 0–(-30)
  casePenalty:     number;  // 0–(-20)
  bonus:           number;  // 0–20  (long tenure bonus)
  total:           number;  // 0–100
}

export interface TrustProfile {
  score:      number;
  tier:       "🟢 Trusted" | "🔵 Established" | "🟡 Caution" | "🟠 Elevated Risk" | "🔴 High Risk";
  color:      number;
  breakdown:  TrustBreakdown;
  accountAgeLabel: string;
  tenureLabel:     string;
}

export interface TrustInput {
  accountCreatedAt: Date;
  joinedAt: Date | null;
  warnings: number;
  cases: number;
  /** Epoch ms to measure ages from (defaults to Date.now()). */
  now?: number;
}

/** Convert a millisecond duration to a human-readable label. */
export function fmtAge(ms: number): string {
  const days = Math.floor(ms / 86_400_000);
  if (days < 1) return "< 1 day";
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  const years = Math.floor(days / 365);
  const rem   = Math.floor((days % 365) / 30);
  return rem > 0 ? `${years}y ${rem}mo` : `${years}y`;
}

/** Returns a filled/empty bar of given width (1–10). */
export function scoreBar(score: number): string {
  const filled = Math.round(score / 10);
  return "█".repeat(Math.max(0, filled)) + "░".repeat(Math.max(0, 10 - filled));
}

export function calculateTrustProfile({ accountCreatedAt, joinedAt, warnings, cases, now = Date.now() }: TrustInput): TrustProfile {
  // ── Account Age: 0–25 pts (max at 2+ years) ─────────────────────────────
  const accountMs     = now - accountCreatedAt.getTime();
  const accountDays   = accountMs / 86_400_000;
  const accountScore  = Math.min(25, Math.round((accountDays / 730) * 25)); // 730d = 2yr

  // ── Server Tenure: 0–25 pts (max at 1+ year) ────────────────────────────
  const tenureMs     = joinedAt ? now - joinedAt.getTime() : 0;
  const tenureDays   = tenureMs / 86_400_000;
  const tenureScore  = Math.min(25, Math.round((tenureDays / 365) * 25));

  const warnPenalty = -Math.min(30, warnings * 5);
  const casePenalty = -Math.min(20, cases * 4);

  // ── Veteran Bonus: up to +20 for 2+ year tenure ─────────────────────────
  const bonus = tenureDays >= 730 ? 20
              : tenureDays >= 365 ? 12
              : tenureDays >= 180 ? 6
              : 0;

  const raw   = accountScore + tenureScore + warnPenalty + casePenalty + bonus;
  const total = Math.max(0, Math.min(100, raw));

  const tier: TrustProfile["tier"] =
    total >= 80 ? "🟢 Trusted"
  : total >= 60 ? "🔵 Established"
  : total >= 40 ? "🟡 Caution"
  : total >= 20 ? "🟠 Elevated Risk"
  :               "🔴 High Risk";

  const color =
    total >= 80 ? 0x57F287
  : total >= 60 ? 0x5865F2
  : total >= 40 ? 0xFEE75C
  : total >= 20 ? 0xFFA500
  :               0xED4245;

  return {
    score: total,
    tier,
    color,
    breakdown: {
      accountAge:     accountScore,
      serverTenure:   tenureScore,
      warningPenalty: warnPenalty,
      casePenalty,
      bonus,
      total,
    },
    accountAgeLabel: fmtAge(accountMs),
    tenureLabel:     joinedAt ? fmtAge(tenureMs) : "Unknown",
  };
}
