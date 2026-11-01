/**
 * Trust Score v2: an explainable 0–100 score per member, computed from facts
 * Aegis already has (account age, time in the server, verification, active-day
 * counters, cases and warnings by severity and recency, automod hits and
 * Incident Mode join-gate flags). Pure: no Discord or database access, so every
 * rule is unit-tested directly. trustService.ts gathers the facts.
 *
 * No message content is ever an input: only counts and timestamps.
 */

export type TrustPreset = "strict" | "balanced" | "lenient";
export const TRUST_PRESETS: readonly TrustPreset[] = ["strict", "balanced", "lenient"];

export interface TrustConfig {
  /** Master switch for the integrations below. /trust user works either way. */
  enabled: boolean;
  preset: TrustPreset;
  /** Members scoring below this are "low trust". */
  lowThreshold: number;
  /** Link filtering in automod only applies to low-trust members. */
  linkFilterLowTrustOnly: boolean;
  /** Incident Mode's join gate also gates joins scoring below the threshold. */
  incidentGate: boolean;
  /** Role given to low-trust members when they join (null = off). */
  lowTrustRoleId: string | null;
}

export const DEFAULT_TRUST_CONFIG: TrustConfig = {
  enabled: false,
  preset: "balanced",
  lowThreshold: 30,
  linkFilterLowTrustOnly: false,
  incidentGate: false,
  lowTrustRoleId: null,
};

const SNOWFLAKE = /^\d{17,20}$/;

export function normalizeTrustConfig(value: unknown): TrustConfig {
  const o = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const preset = TRUST_PRESETS.includes(o.preset as TrustPreset) ? o.preset as TrustPreset : DEFAULT_TRUST_CONFIG.preset;
  const t = typeof o.lowThreshold === "string" && o.lowThreshold.trim() !== "" ? Number(o.lowThreshold) : o.lowThreshold;
  const lowThreshold = typeof t === "number" && Number.isFinite(t) ? Math.min(90, Math.max(5, Math.round(t))) : DEFAULT_TRUST_CONFIG.lowThreshold;
  return {
    enabled: o.enabled === true,
    preset,
    lowThreshold,
    linkFilterLowTrustOnly: o.linkFilterLowTrustOnly === true,
    incidentGate: o.incidentGate === true,
    lowTrustRoleId: typeof o.lowTrustRoleId === "string" && SNOWFLAKE.test(o.lowTrustRoleId) ? o.lowTrustRoleId : null,
  };
}

/** How hard each preset leans: multipliers on the positive and negative factors. */
export const PRESET_WEIGHTS: Record<TrustPreset, { positive: number; negative: number }> = {
  strict:   { positive: 0.85, negative: 1.4 },
  balanced: { positive: 1,    negative: 1 },
  lenient:  { positive: 1.15, negative: 0.7 },
};

/** Severity of each case action. Notes and unbans don't count; gate cases are counted separately. */
export const CASE_SEVERITY: Record<string, number> = {
  warn: 6, timeout: 7, mute: 7, kick: 10, softban: 12, tempban: 14, ban: 16,
};

export interface TrustCaseFact { action: string; createdAt: Date; revoked?: boolean; /** Still in effect (a running timeout or tempban). */ active?: boolean }
export interface TrustWarningFact { createdAt: Date; revoked?: boolean }

export interface TrustFacts {
  isBot?: boolean;
  accountCreatedAt: Date;
  joinedAt: Date | null;
  /** True / false when the server uses verification; null when it doesn't. */
  verified: boolean | null;
  messageCount: number;
  /** Distinct days with at least one message in the last 30 days. */
  activeDays30: number;
  lastActiveAt: Date | null;
  warnings: readonly TrustWarningFact[];
  cases: readonly TrustCaseFact[];
  /** Automod hits in the last 30 days. */
  automodHits30: number;
  /** Times Incident Mode's join gate acted on them. */
  gateFlags: number;
}

export type TrustFactorKey = "base" | "account" | "tenure" | "verification" | "activity" | "warnings" | "cases" | "automod" | "gate";

export interface TrustFactor { key: TrustFactorKey; label: string; points: number; detail: string }

export type TrustBand = "trusted" | "established" | "neutral" | "low" | "high-risk";

export interface TrustResult {
  score: number;
  band: TrustBand;
  bandLabel: string;
  /** Biggest effect first; base is always last. */
  factors: TrustFactor[];
  preset: TrustPreset;
}

export const TRUST_BASE = 40;
const DAY = 86_400_000;

/** How much a past event still counts: full for 30 days, then fading to a tenth after a year. */
export function recencyWeight(at: Date, now: number): number {
  const days = (now - at.getTime()) / DAY;
  return days <= 30 ? 1 : days <= 90 ? 0.6 : days <= 180 ? 0.35 : days <= 365 ? 0.2 : 0.1;
}

export function bandFor(score: number): { band: TrustBand; label: string } {
  return score >= 80 ? { band: "trusted", label: "Trusted" }
    : score >= 60 ? { band: "established", label: "Established" }
    : score >= 40 ? { band: "neutral", label: "Neutral" }
    : score >= 20 ? { band: "low", label: "Low trust" }
    : { band: "high-risk", label: "High risk" };
}

function ageLabel(ms: number): string {
  const d = Math.floor(ms / DAY);
  if (d < 1) return `${Math.max(0, Math.floor(ms / 3_600_000))}h`;
  if (d < 60) return `${d}d`;
  if (d < 730) return `${Math.floor(d / 30)}mo`;
  return `${Math.floor(d / 365)}y`;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function computeTrust(f: TrustFacts, preset: TrustPreset = "balanced", now: number = Date.now()): TrustResult {
  const w = PRESET_WEIGHTS[preset];
  const factors: TrustFactor[] = [];
  const add = (key: TrustFactorKey, label: string, raw: number, detail: string) => {
    const points = r1(raw >= 0 ? raw * w.positive : raw * w.negative);
    factors.push({ key, label, points: points === 0 ? 0 : points, detail });
  };

  const accountMs = Math.max(0, now - f.accountCreatedAt.getTime());
  const accountDays = accountMs / DAY;
  add("account", "Account age", accountDays < 7 ? -10 : Math.min(25, (accountDays / 730) * 25),
    accountDays < 7 ? `Brand-new account (${ageLabel(accountMs)} old)` : `Account is ${ageLabel(accountMs)} old (full credit at 2 years)`);

  const tenureMs = f.joinedAt ? Math.max(0, now - f.joinedAt.getTime()) : 0;
  add("tenure", "Time in server", f.joinedAt ? Math.min(20, (tenureMs / DAY / 365) * 20) : 0,
    f.joinedAt ? `In the server ${ageLabel(tenureMs)} (full credit at 1 year)` : "Not in the server");

  add("verification", "Verification", f.verified === true ? 10 : f.verified === false ? -5 : 0,
    f.verified === true ? "Passed verification" : f.verified === false ? "Has not passed verification" : "Server doesn't use verification");

  const volume = f.messageCount >= 1000 ? 8 : f.messageCount >= 250 ? 6 : f.messageCount >= 50 ? 4 : f.messageCount >= 10 ? 2 : 0;
  const days = Math.min(30, Math.max(0, Math.floor(f.activeDays30)));
  const recent = f.lastActiveAt && now - f.lastActiveAt.getTime() <= 7 * DAY ? 2 : 0;
  add("activity", "Message activity", volume + Math.min(10, days / 2) + recent,
    `${f.messageCount.toLocaleString("en-US")} message(s), active ${days} of the last 30 days`);

  const liveWarnings = f.warnings.filter(x => !x.revoked);
  const warnRaw = Math.min(35, liveWarnings.reduce((s, x) => s + 6 * recencyWeight(x.createdAt, now), 0));
  add("warnings", "Warnings", -warnRaw,
    liveWarnings.length ? `${liveWarnings.length} warning(s), recent ones weigh more` : "No warnings");

  const liveCases = f.cases.filter(c => !c.revoked && CASE_SEVERITY[c.action] !== undefined && c.action !== "warn");
  const caseRaw = Math.min(40, liveCases.reduce((s, c) => s + CASE_SEVERITY[c.action] * recencyWeight(c.createdAt, now) * (c.active ? 1.5 : 1), 0));
  const activeCount = liveCases.filter(c => c.active).length;
  add("cases", "Moderation cases", -caseRaw,
    liveCases.length ? `${liveCases.length} timeout/kick/ban case(s)${activeCount ? `, ${activeCount} still in effect` : ""}` : "No timeouts, kicks or bans");

  const hits = Math.max(0, Math.floor(f.automodHits30));
  add("automod", "Automod hits", -Math.min(15, hits * 2), hits ? `${hits} automod hit(s) in 30 days` : "No automod hits in 30 days");

  const flags = Math.max(0, Math.floor(f.gateFlags));
  add("gate", "Incident join gate", -Math.min(20, flags * 10), flags ? `Gated ${flags} time(s) by Incident Mode` : "Never gated by Incident Mode");

  const raw = TRUST_BASE + factors.reduce((s, x) => s + x.points, 0);
  const score = f.isBot ? 100 : Math.max(0, Math.min(100, Math.round(raw)));
  const sorted = factors.filter(x => x.points !== 0 || x.key === "warnings" || x.key === "cases")
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
  sorted.push({ key: "base", label: "Starting score", points: TRUST_BASE, detail: "Everyone starts here" });
  const b = bandFor(score);
  return { score, band: b.band, bandLabel: f.isBot ? "Bot (not scored)" : b.label, factors: sorted, preset };
}

/** "+12.5" / "−8" for embeds and the dashboard. */
export function formatPoints(points: number): string {
  if (points === 0) return "±0";
  return `${points > 0 ? "+" : "−"}${Math.abs(points)}`;
}

export function isLowTrust(score: number, config: Pick<TrustConfig, "lowThreshold">): boolean {
  return score < config.lowThreshold;
}

/** Ten buckets (0–9, 10–19 … 90–100) for the dashboard distribution chart. */
export function trustDistribution(scores: readonly number[]): number[] {
  const out = new Array(10).fill(0);
  for (const s of scores) out[Math.min(9, Math.max(0, Math.floor(s / 10)))]++;
  return out;
}

/** Whether to give the low-trust role on join: integration on, role set, and Aegis can manage it. */
export function lowTrustRoleDecision(config: TrustConfig, score: number, role: { editable: boolean; managed: boolean } | null): { assign: boolean; why: string } {
  if (!config.enabled || !config.lowTrustRoleId) return { assign: false, why: "low-trust role off" };
  if (!isLowTrust(score, config)) return { assign: false, why: "not low trust" };
  if (!role) return { assign: false, why: "role missing" };
  if (role.managed || !role.editable) return { assign: false, why: "role is above Aegis or managed" };
  return { assign: true, why: `score ${score} below ${config.lowThreshold}` };
}

/** Whether automod's link filter applies to this author. Without the integration it always does. */
export function linkFilterApplies(config: TrustConfig, score: number | null): boolean {
  if (!config.enabled || !config.linkFilterLowTrustOnly) return true;
  // Score unknown (lookup failed): fail closed and filter.
  return score === null || isLowTrust(score, config);
}
