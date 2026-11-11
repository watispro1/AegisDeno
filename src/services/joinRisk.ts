/**
 * Heads-up lines for the "Member Joined" log: signs that a join may be an
 * alt or throwaway account, and whether the member already has a record here.
 *
 * These are hints for staff reading the log, never automatic actions: a new
 * account or a missing avatar is common among real newcomers too. (Automatic
 * gating lives in Incident Mode's join gate and the opt-in Trust Score role.)
 */

const DAY_MS = 86_400_000;

export interface JoinRiskInput {
  accountCreatedAt: number;
  now: number;
  /** True when the user never set an avatar (Discord shows a default one). */
  defaultAvatar: boolean;
  username: string;
  /** This user's earlier cases in this server, by action (revoked ones excluded). */
  priorCases?: Readonly<Record<string, number>>;
  /** Live warnings in this server. */
  priorWarnings?: number;
}

export type RiskLevel = "none" | "low" | "high";

export interface JoinRisk {
  level: RiskLevel;
  hints: string[];
}

/** "3 hours", "2 days", "5 weeks". */
export function roughAge(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days} days`;
  return `${Math.floor(days / 7)} weeks`;
}

/** Usernames like "user48213" or "alex_20391": a long digit run at the end, typical of generated names. */
export function looksGenerated(username: string): boolean {
  return /\d{4,}$/.test(username) && !/^\d+$/.test(username);
}

const PRIOR_ORDER = ["ban", "softban", "kick", "timeout"] as const;

/** "1 ban, 2 timeouts" from a per-action count, in order of severity. */
export function priorRecordText(priorCases: Readonly<Record<string, number>>, priorWarnings = 0): string {
  const parts: string[] = [];
  for (const action of PRIOR_ORDER) {
    const n = priorCases[action] ?? 0;
    if (n > 0) parts.push(`${n} ${action}${n === 1 ? "" : "s"}`);
  }
  if (priorWarnings > 0) parts.push(`${priorWarnings} warning${priorWarnings === 1 ? "" : "s"}`);
  return parts.join(", ");
}

export function assessJoinRisk(input: JoinRiskInput): JoinRisk {
  const hints: string[] = [];
  let level: RiskLevel = "none";
  const raise = (to: RiskLevel) => {
    if (to === "high" || (to === "low" && level === "none")) level = to;
  };

  const age = input.now - input.accountCreatedAt;
  if (age < DAY_MS) {
    hints.push(`🚩 Brand-new account: created ${roughAge(age)} ago`);
    raise("high");
  } else if (age < 7 * DAY_MS) {
    hints.push(`⚠️ New account: created ${roughAge(age)} ago`);
    raise("low");
  } else if (age < 30 * DAY_MS) {
    hints.push(`ℹ️ Account is under 30 days old (${roughAge(age)})`);
  }

  if (input.defaultAvatar) hints.push("ℹ️ No profile picture");
  if (looksGenerated(input.username)) hints.push("ℹ️ Username ends in a long number");

  const prior = priorRecordText(input.priorCases ?? {}, input.priorWarnings ?? 0);
  if (prior) {
    const serious = (input.priorCases?.ban ?? 0) + (input.priorCases?.softban ?? 0) + (input.priorCases?.kick ?? 0) > 0;
    hints.push(`${serious ? "🚩" : "⚠️"} Returning member with a record here: ${prior}`);
    raise(serious ? "high" : "low");
  }

  // Several weak signals together are worth a second look even without a strong one.
  if (level === "none" && hints.length >= 3) raise("low");
  return { level, hints };
}

/** Log embed colour for a join: green normally, orange for a low risk, red for a high one. */
export function joinLogColor(level: RiskLevel): number {
  return level === "high" ? 0xED4245 : level === "low" ? 0xE67E22 : 0x57F287;
}
