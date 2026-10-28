/**
 * Pure trust-score maths used by /trustscore. The command fetches active
 * warning and infraction counts plus message activity, then hands everything
 * to calculateTrustProfile().
 */

export interface TrustBreakdown {
  accountAge:      number;  // 0–25
  serverTenure:    number;  // 0–25
  warningPenalty:  number;  // 0–(-30)
  casePenalty:     number;  // 0–(-20)
  bonus:           number;  // 0–20  (long tenure bonus)
  activity:        number;  // 0–15  (message volume + recency)
  total:           number;  // 0–100
}

export interface TrustProfile {
  score:      number;
  tier:       "🟢 Trusted" | "🔵 Established" | "🟡 Caution" | "🟠 Elevated Risk" | "🔴 High Risk";
  color:      number;
  breakdown:  TrustBreakdown;
  accountAgeLabel: string;
  tenureLabel:     string;
  /** Raw inputs, so the embed never has to reverse-engineer them from capped penalties. */
  counts: { warnings: number; cases: number; messages: number };
  /** e.g. "3d ago", "Never", "Unknown". */
  lastActiveLabel: string;
}

export interface TrustInput {
  accountCreatedAt: Date;
  joinedAt: Date | null;
  warnings: number;
  cases: number;
  /** Messages the member has sent in this server (tracked count). Omit when unknown. */
  messageCount?: number;
  /** When the member last sent a message here. */
  lastActiveAt?: Date | null;
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

/** Message volume points: 0 / 2 / 4 / 7 / 10 at 10, 50, 250 and 1,000 messages. */
export function messageVolumePoints(messageCount: number): number {
  return messageCount >= 1000 ? 10
       : messageCount >= 250  ? 7
       : messageCount >= 50   ? 4
       : messageCount >= 10   ? 2
       : 0;
}

/** Recency points: +5 if active in the last 7 days, +2 in the last 30. */
export function recencyPoints(lastActiveAt: Date | null | undefined, now: number): number {
  if (!lastActiveAt) return 0;
  const days = (now - lastActiveAt.getTime()) / 86_400_000;
  return days <= 7 ? 5 : days <= 30 ? 2 : 0;
}

export function calculateTrustProfile({
  accountCreatedAt, joinedAt, warnings, cases, messageCount = 0, lastActiveAt = null, now = Date.now(),
}: TrustInput): TrustProfile {
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

  // ── Message activity: 0–15 pts ──────────────────────────────────────────
  const activity = messageVolumePoints(messageCount) + recencyPoints(lastActiveAt, now);

  const raw   = accountScore + tenureScore + warnPenalty + casePenalty + bonus + activity;
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
      activity,
      total,
    },
    accountAgeLabel: fmtAge(accountMs),
    tenureLabel:     joinedAt ? fmtAge(tenureMs) : "Unknown",
    counts: { warnings, cases, messages: messageCount },
    lastActiveLabel: lastActiveAt ? `${fmtAge(Math.max(0, now - lastActiveAt.getTime()))} ago` : "Never",
  };
}

/**
 * Plain-language reasons behind a score, biggest effect first. Used for the
 * "Why" field on /trustscore.
 */
export function explainTrust(p: TrustProfile): string[] {
  const b = p.breakdown;
  const items: Array<{ weight: number; text: string }> = [
    {
      weight: b.accountAge,
      text: b.accountAge >= 20 ? `Established account (${p.accountAgeLabel} old): +${b.accountAge}`
          : b.accountAge <= 5  ? `New account (${p.accountAgeLabel} old): only +${b.accountAge}`
          : `Account is ${p.accountAgeLabel} old: +${b.accountAge}`,
    },
    {
      weight: b.serverTenure + b.bonus,
      text: p.tenureLabel === "Unknown" ? "Not in the server (no tenure): +0"
          : `In the server ${p.tenureLabel}: +${b.serverTenure}${b.bonus ? ` and +${b.bonus} long-tenure bonus` : ""}`,
    },
    {
      weight: -b.warningPenalty,
      text: p.counts.warnings > 0 ? `${p.counts.warnings} active warning(s): ${b.warningPenalty}` : "No active warnings: −0",
    },
    {
      weight: -b.casePenalty,
      text: p.counts.cases > 0 ? `${p.counts.cases} timeout/kick/ban case(s): ${b.casePenalty}` : "No timeouts, kicks or bans: −0",
    },
    {
      weight: b.activity,
      text: p.counts.messages > 0
        ? `${p.counts.messages.toLocaleString("en-US")} message(s), last active ${p.lastActiveLabel}: +${b.activity}`
        : "No tracked messages yet: +0",
    },
  ];
  return items.sort((a, z) => z.weight - a.weight).map((i) => i.text);
}
