/**
 * Incident Mode: the pure rules. No Discord or database access here, so every
 * decision (which channels change, what restoring means, whether a join is
 * gated, when a join burst starts an incident) is unit-tested directly.
 * The Discord side is incidentDiscord.ts; the orchestration is incidentService.ts.
 */

/** An incident always ends on its own within a day. */
export const INCIDENT_MAX_MINUTES = 24 * 60;
export const INCIDENT_DEFAULT_MINUTES = 60;
/** Most channels one incident edits; each edit is a Discord API call. */
export const INCIDENT_MAX_CHANNELS = 50;
/** Ordinary timeline events stop being stored past this; counters keep counting. */
export const INCIDENT_TIMELINE_MAX = 480;
/** Discord's slowmode ceiling (6 hours). */
export const MAX_SLOWMODE_SECONDS = 21_600;
/** Discord's timeout ceiling (28 days). */
export const MAX_GATE_TIMEOUT_MINUTES = 28 * 24 * 60;
/** After an incident ends, a join burst may not auto-start another one this soon. */
export const AUTO_TRIGGER_COOLDOWN_MS = 10 * 60_000;

export type JoinGateAction = "off" | "timeout" | "kick";
export type LockMode = "none" | "selected" | "public";
export type IncidentTrigger = "command" | "dashboard" | "auto";

export interface IncidentOptions {
  /** 0 leaves slowmode alone. */
  slowmodeSeconds: number;
  /** Channels to slow down; empty means every public text channel Aegis can manage. */
  slowmodeChannelIds: string[];
  lockMode: LockMode;
  /** Used when lockMode is "selected". */
  lockChannelIds: string[];
  joinGate: JoinGateAction;
  /** Accounts younger than this are gated. */
  minAccountAgeDays: number;
  /** How long a gated join is timed out. */
  gateTimeoutMinutes: number;
  pauseInvites: boolean;
  /** Auto-ends after this long (1 to 1440 minutes). */
  durationMinutes: number;
}

export interface IncidentConfig {
  autoTrigger: { enabled: boolean; joins: number; seconds: number };
  defaults: IncidentOptions;
}

export const DEFAULT_INCIDENT_OPTIONS: IncidentOptions = {
  slowmodeSeconds: 10,
  slowmodeChannelIds: [],
  lockMode: "none",
  lockChannelIds: [],
  joinGate: "timeout",
  minAccountAgeDays: 7,
  gateTimeoutMinutes: 60,
  pauseInvites: false,
  durationMinutes: INCIDENT_DEFAULT_MINUTES,
};

export const DEFAULT_INCIDENT_CONFIG: IncidentConfig = {
  autoTrigger: { enabled: false, joins: 10, seconds: 30 },
  defaults: DEFAULT_INCIDENT_OPTIONS,
};

const SNOWFLAKE = /^\d{17,20}$/;

function int(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

function ids(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is string => typeof v === "string" && SNOWFLAKE.test(v)))].slice(0, INCIDENT_MAX_CHANNELS);
}

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Clamps every incident option; unknown or malformed values fall back to the defaults. */
export function normalizeIncidentOptions(value: unknown, fallback: IncidentOptions = DEFAULT_INCIDENT_OPTIONS): IncidentOptions {
  const o = rec(value);
  const lockMode = o.lockMode === "selected" || o.lockMode === "public" || o.lockMode === "none" ? o.lockMode : fallback.lockMode;
  const joinGate = o.joinGate === "off" || o.joinGate === "timeout" || o.joinGate === "kick" ? o.joinGate : fallback.joinGate;
  return {
    slowmodeSeconds: int(o.slowmodeSeconds, 0, MAX_SLOWMODE_SECONDS, fallback.slowmodeSeconds),
    slowmodeChannelIds: o.slowmodeChannelIds === undefined ? [...fallback.slowmodeChannelIds] : ids(o.slowmodeChannelIds),
    lockMode,
    lockChannelIds: o.lockChannelIds === undefined ? [...fallback.lockChannelIds] : ids(o.lockChannelIds),
    joinGate,
    minAccountAgeDays: int(o.minAccountAgeDays, 1, 365, fallback.minAccountAgeDays),
    gateTimeoutMinutes: int(o.gateTimeoutMinutes, 1, MAX_GATE_TIMEOUT_MINUTES, fallback.gateTimeoutMinutes),
    pauseInvites: typeof o.pauseInvites === "boolean" ? o.pauseInvites : fallback.pauseInvites,
    durationMinutes: int(o.durationMinutes, 1, INCIDENT_MAX_MINUTES, fallback.durationMinutes),
  };
}

export function normalizeIncidentConfig(value: unknown): IncidentConfig {
  const o = rec(value);
  const auto = rec(o.autoTrigger);
  return {
    autoTrigger: {
      enabled: auto.enabled === true,
      joins: int(auto.joins, 3, 500, DEFAULT_INCIDENT_CONFIG.autoTrigger.joins),
      seconds: int(auto.seconds, 5, 600, DEFAULT_INCIDENT_CONFIG.autoTrigger.seconds),
    },
    defaults: normalizeIncidentOptions(o.defaults),
  };
}

/* ── Channel changes ──────────────────────────────────────────────── */

export type SendState = "allow" | "deny" | "neutral";

/** What Aegis can see of one channel before or after an incident. */
export interface ChannelSnapshot {
  id: string;
  name: string;
  /** "text" supports slowmode and locking; "announcement" only locking. */
  kind: "text" | "announcement" | "other";
  /** Discord obfuscated it for Aegis (no View Channel): never touched or listed. */
  hidden: boolean;
  /** @everyone can view it. */
  isPublic: boolean;
  /** Aegis has Manage Channels there (slowmode). */
  canEditChannel: boolean;
  /** Aegis has Manage Channels and Manage Roles there (permission overwrites). */
  canEditOverwrites: boolean;
  rateLimitPerUser: number;
  everyoneSend: SendState;
  /** An @everyone overwrite exists on the channel. */
  hasEveryoneOverwrite: boolean;
  /** The @everyone overwrite denies Send Messages and nothing else is set on it. */
  everyoneOverwriteOnlySendDeny: boolean;
}

/** One channel's recorded change, enough to put it back exactly. */
export interface ChannelChange {
  channelId: string;
  name: string;
  slowmode?: { from: number; to: number };
  lock?: { previous: SendState; hadOverwrite: boolean };
}

export interface ChangePlan {
  changes: ChannelChange[];
  skipped: Array<{ channelId: string; name: string; reason: string }>;
}

/** Which channels an incident changes and how, from a snapshot of the server. */
export function planIncidentChanges(channels: readonly ChannelSnapshot[], options: IncidentOptions): ChangePlan {
  const visible = channels.filter(c => !c.hidden);
  const byId = new Map(visible.map(c => [c.id, c]));
  const plan = new Map<string, ChannelChange>();
  const skipped: ChangePlan["skipped"] = [];
  const skip = (c: ChannelSnapshot, reason: string) => {
    if (!skipped.some(s => s.channelId === c.id && s.reason === reason)) skipped.push({ channelId: c.id, name: c.name, reason });
  };
  const entry = (c: ChannelSnapshot) => plan.get(c.id) ?? plan.set(c.id, { channelId: c.id, name: c.name }).get(c.id)!;

  if (options.slowmodeSeconds > 0) {
    const targets = options.slowmodeChannelIds.length
      ? options.slowmodeChannelIds.map(id => byId.get(id)).filter((c): c is ChannelSnapshot => Boolean(c))
      : visible.filter(c => c.isPublic && c.kind === "text");
    for (const c of targets) {
      if (c.kind !== "text") { skip(c, "slowmode only works in text channels"); continue; }
      if (!c.canEditChannel) { skip(c, "Aegis lacks Manage Channels there"); continue; }
      if (c.rateLimitPerUser >= options.slowmodeSeconds) continue; // already at least as slow
      entry(c).slowmode = { from: c.rateLimitPerUser, to: options.slowmodeSeconds };
    }
  }

  if (options.lockMode !== "none") {
    const targets = options.lockMode === "selected"
      ? options.lockChannelIds.map(id => byId.get(id)).filter((c): c is ChannelSnapshot => Boolean(c))
      : visible.filter(c => c.isPublic && c.kind !== "other");
    for (const c of targets) {
      if (c.kind === "other") { skip(c, "only text and announcement channels can be locked"); continue; }
      if (!c.canEditOverwrites) { skip(c, "Aegis lacks Manage Channels or Manage Roles there"); continue; }
      if (c.everyoneSend === "deny") continue; // already locked; nothing to restore later
      entry(c).lock = { previous: c.everyoneSend, hadOverwrite: c.hasEveryoneOverwrite };
    }
  }

  const changes = [...plan.values()].filter(c => c.slowmode || c.lock);
  for (const c of changes.slice(INCIDENT_MAX_CHANNELS)) skipped.push({ channelId: c.channelId, name: c.name, reason: `over the ${INCIDENT_MAX_CHANNELS}-channel limit` });
  return { changes: changes.slice(0, INCIDENT_MAX_CHANNELS), skipped };
}

export type OverwriteRestore = { kind: "set"; value: boolean | null } | { kind: "delete" };

export interface RestoreStep {
  channelId: string;
  name: string;
  slowmode?: number;
  overwrite?: OverwriteRestore;
  notes: string[];
}

/**
 * How to undo one change, given the channel as it is now. A value someone
 * changed by hand during the incident is left alone (and noted), so ending
 * an incident never undoes a moderator's own later decision.
 */
export function planRestore(change: ChannelChange, now: ChannelSnapshot | null): RestoreStep {
  const step: RestoreStep = { channelId: change.channelId, name: change.name, notes: [] };
  if (!now) { step.notes.push("channel no longer exists"); return step; }
  if (now.hidden) { step.notes.push("Aegis can no longer see the channel"); return step; }
  if (change.slowmode) {
    if (now.rateLimitPerUser === change.slowmode.to) step.slowmode = change.slowmode.from;
    else step.notes.push(`slowmode was changed to ${now.rateLimitPerUser}s during the incident, so it was kept`);
  }
  if (change.lock) {
    if (now.everyoneSend !== "deny") {
      step.notes.push("someone unlocked it during the incident, so it was left as is");
    } else if (!change.lock.hadOverwrite && now.everyoneOverwriteOnlySendDeny) {
      step.overwrite = { kind: "delete" };
    } else {
      step.overwrite = { kind: "set", value: change.lock.previous === "allow" ? true : change.lock.previous === "deny" ? false : null };
    }
  }
  return step;
}

/* ── Join gate and auto-trigger ───────────────────────────────────── */

export interface JoinFacts {
  isBot: boolean;
  accountCreatedAt: Date;
  /** Aegis can time out (or kick) this member: their highest role is below Aegis's and they are not the owner. */
  actionable: boolean;
}

export type GateDecision = { act: "none"; why: string } | { act: "timeout" | "kick"; reason: string };

/** Whether a join during an incident is timed out, kicked, or let through. */
export function joinGateDecision(options: Pick<IncidentOptions, "joinGate" | "minAccountAgeDays">, facts: JoinFacts, nowMs: number): GateDecision {
  if (options.joinGate === "off") return { act: "none", why: "join gate off" };
  // A bot can only join when someone with Manage Server adds it, so it is never gated.
  if (facts.isBot) return { act: "none", why: "bots are never gated" };
  const ageDays = (nowMs - facts.accountCreatedAt.getTime()) / 86_400_000;
  if (!(ageDays < options.minAccountAgeDays)) return { act: "none", why: "account old enough" };
  if (!facts.actionable) return { act: "none", why: "member is above Aegis in the role list" };
  const age = ageDays < 1 ? `${Math.max(0, Math.floor(ageDays * 24))}h` : `${Math.floor(ageDays)}d`;
  return { act: options.joinGate, reason: `Incident join gate: account is ${age} old (minimum ${options.minAccountAgeDays}d)` };
}

/** Counts joins per guild in a sliding window, for the optional auto-trigger. */
export class JoinBurstTracker {
  private readonly joins = new Map<string, number[]>();
  private readonly cooldownUntil = new Map<string, number>();

  /** Records a join and returns how many joins fall within the last `seconds`. */
  record(guildId: string, nowMs: number, seconds: number): number {
    const since = nowMs - seconds * 1000;
    const list = (this.joins.get(guildId) ?? []).filter(t => t > since);
    list.push(nowMs);
    // Bounded: nobody configures more than 500 joins, so older entries never matter.
    this.joins.set(guildId, list.slice(-600));
    if (this.joins.size > 5000) for (const [g, l] of this.joins) if (!l.length || l[l.length - 1] <= since) this.joins.delete(g);
    return list.length;
  }

  /** True when this join pushes the window over the threshold and the guild is not cooling down. */
  shouldTrigger(guildId: string, nowMs: number, auto: IncidentConfig["autoTrigger"]): boolean {
    if (!auto.enabled) return false;
    const count = this.record(guildId, nowMs, auto.seconds);
    if (count < auto.joins) return false;
    if ((this.cooldownUntil.get(guildId) ?? 0) > nowMs) return false;
    this.cooldown(guildId, nowMs);
    return true;
  }

  cooldown(guildId: string, nowMs: number, ms = AUTO_TRIGGER_COOLDOWN_MS): void {
    this.cooldownUntil.set(guildId, nowMs + ms);
    this.joins.delete(guildId);
  }
}

/* ── Reports ──────────────────────────────────────────────────────── */

export type TimelineKind = "start" | "end" | "join" | "gate" | "case" | "delete" | "change" | "error" | "note";

export interface TimelineEvent {
  at: Date;
  kind: TimelineKind;
  text: string;
  userId?: string | null;
  caseId?: string | null;
}

export interface IncidentCounts {
  joins: number;
  gated: number;
  cases: number;
  deleted: number;
}

export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

/** Plain-text summary lines for the mod-log report and `/incident status`. */
export function summarizeIncident(input: {
  startedAt: Date; endedAt?: Date | null; counts: IncidentCounts; changes: readonly ChannelChange[];
  invitesPaused: boolean; caseIds: readonly string[];
}): string[] {
  const end = input.endedAt ?? new Date();
  const slowed = input.changes.filter(c => c.slowmode).length;
  const locked = input.changes.filter(c => c.lock).length;
  const lines = [
    `Duration: ${formatMinutes((end.getTime() - input.startedAt.getTime()) / 60_000)}`,
    `Joins: ${input.counts.joins} (gated ${input.counts.gated})`,
    `Channels: ${slowed} slowed, ${locked} locked${input.invitesPaused ? "; invites paused" : ""}`,
    `Cases: ${input.counts.cases} · Messages deleted: ${input.counts.deleted}`,
  ];
  if (input.caseIds.length) lines.push(`Case IDs: ${input.caseIds.slice(0, 15).join(", ")}${input.caseIds.length > 15 ? ` and ${input.caseIds.length - 15} more` : ""}`);
  return lines;
}

/** Reads a friendly duration ("90m", "2h", "1d") as minutes, capped at 24 hours. */
export function parseIncidentDuration(text: string | null | undefined, parse: (s: string) => number | null): { minutes: number } | { error: string } {
  const raw = (text ?? "").trim();
  if (!raw) return { minutes: INCIDENT_DEFAULT_MINUTES };
  const seconds = parse(raw);
  if (seconds === null) return { error: "I couldn't read that duration. Try `30m`, `2h` or `12h`." };
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return { error: "An incident lasts at least 1 minute." };
  if (minutes > INCIDENT_MAX_MINUTES) return { error: "An incident can last at most 24 hours; end it early with `/incident end`." };
  return { minutes };
}
