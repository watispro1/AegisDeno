/**
 * Data behind the dashboard pages added in 1.2.3's upgrade round: member
 * lookup and quick actions, global search, analytics, Incident Mode, module
 * switches and settings import. One interface so routes run in tests with the
 * in-memory version below; production uses extrasMongo.ts.
 */
import { outranks } from "../../permissions/hierarchy";
import type { IncidentConfig, IncidentOptions } from "../../services/incidentLogic";
import type { IncidentRecord } from "../../services/incidentStore";
import type { EndResult, StartResult } from "../../services/incidentService";
import type { GuildConfigUpdate, ModuleSwitches } from "../../services/guildConfigNormalize";
import type { Actor, CaseRecord } from "./data";
import { normalizeTrustConfig, type TrustConfig, type TrustResult } from "../../services/trustEngine";

export interface TrustOverview {
  config: TrustConfig;
  /** Members scored (cached non-bot members, capped). */
  scored: number;
  truncated: boolean;
  /** Ten buckets: 0–9 … 90–100. */
  distribution: number[];
  average: number | null;
  lowCount: number;
  lowest: Array<{ userId: string; name: string; avatarUrl: string | null; score: number; bandLabel: string }>;
}

export interface TrustDashboard {
  overview(guildId: string): Promise<TrustOverview>;
  /** null when they are not in the server (tenure and roles can't be scored). */
  member(guildId: string, userId: string): Promise<TrustResult | null>;
  saveConfig(guildId: string, config: TrustConfig): Promise<void>;
}

export interface MemberProfile {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
  bot: boolean;
  /** False for someone who left (their records still show). */
  inServer: boolean;
  owner: boolean;
  joinedAt: Date | null;
  createdAt: Date | null;
  timeoutUntil: Date | null;
  topRolePosition: number;
  roles: Array<{ id: string; name: string }>;
  /** What Aegis itself is able to do to them (role hierarchy and Aegis's permissions). */
  botCan: { timeout: boolean; kick: boolean; ban: boolean };
}

export interface StaffNoteRow { id: string; moderatorId: string; note: string; createdAt: Date }

export interface MemberRecords {
  cases: CaseRecord[];
  warnings: CaseRecord[];
  notes: StaffNoteRow[];
}

export type MemberAction = "warn" | "timeout" | "untimeout" | "kick" | "ban";
export const MEMBER_ACTIONS: readonly MemberAction[] = ["warn", "timeout", "untimeout", "kick", "ban"];

export interface MemberActionInput { action: MemberAction; reason: string; minutes: number }
export type MemberActionResult = { ok: true; caseId: string | null } | { ok: false; error: string };

export interface SearchHit { kind: "case" | "member" | "page"; label: string; detail: string; href: string }

export interface AnalyticsData {
  days: string[];
  joins: number[];
  leaves: number[];
  cases: number[];
  automod: number[];
  casesByType: Array<[string, number]>;
  casesByModerator: Array<[string, number]>;
  automodByRule: Array<[string, number]>;
}

export interface IncidentDashboard {
  active(guildId: string): Promise<IncidentRecord | null>;
  list(guildId: string, limit: number): Promise<IncidentRecord[]>;
  get(guildId: string, id: string): Promise<IncidentRecord | null>;
  start(guildId: string, options: IncidentOptions, reason: string, actor: Actor): Promise<StartResult>;
  end(guildId: string, reason: string, actor: Actor): Promise<EndResult>;
}

export interface DashboardExtras {
  member(guildId: string, userId: string): Promise<MemberProfile | null>;
  memberRecords(guildId: string, userId: string): Promise<MemberRecords>;
  memberAction(guildId: string, userId: string, input: MemberActionInput, actor: Actor): Promise<MemberActionResult>;
  searchMembers(guildId: string, query: string, limit: number): Promise<Array<{ id: string; name: string; avatarUrl: string | null }>>;
  /** A full case ID, a member ID, or words from a reason. */
  searchCases(guildId: string, query: string): Promise<CaseRecord[]>;
  analytics(guildId: string, days: number): Promise<AnalyticsData>;
  incidents: IncidentDashboard;
  trust: TrustDashboard;
  saveIncidentConfig(guildId: string, config: IncidentConfig): Promise<void>;
  saveModuleSwitches(guildId: string, switches: ModuleSwitches): Promise<void>;
  applySettingsImport(guildId: string, update: GuildConfigUpdate, automod: Record<string, unknown> | null): Promise<void>;
}

/** Which Discord permission each quick action needs, as its slash command does. */
export const ACTION_PERMISSION = {
  warn: "ModerateMembers", timeout: "ModerateMembers", untimeout: "ModerateMembers", kick: "KickMembers", ban: "BanMembers",
} as const;

/**
 * The hierarchy rule for a quick action, before anything is sent to Discord:
 * nobody acts on themselves or the owner, the viewer must outrank the member
 * (owner exempt), and Aegis must be able to do it. Returns the refusal text, or null.
 */
export function memberActionRefusal(input: {
  action: MemberAction; viewerId: string; ownerId: string | null; viewerTop: number | null; member: MemberProfile;
}): string | null {
  const m = input.member;
  if (m.id === input.viewerId) return "You can't take moderation action on yourself.";
  if (m.owner) return "Nobody can take moderation action on the server owner.";
  if (input.action === "warn") {
    if (m.bot) return "Bots can't be warned.";
  }
  const needsMember = input.action !== "ban" && input.action !== "warn";
  if (needsMember && !m.inServer) return "They are not in the server any more.";
  if (m.inServer) {
    if (input.viewerTop === null && input.ownerId !== input.viewerId) return "Your roles could not be checked just now. Reload and try again.";
    const ok = outranks({ ownerId: input.ownerId ?? "", actorId: input.viewerId, targetId: m.id, actorTopPosition: input.viewerTop ?? -1, targetTopPosition: m.topRolePosition });
    if (!ok) return "Their highest role is equal to or above yours, so you can't act on them (the same rule as the slash commands).";
  }
  if ((input.action === "timeout" || input.action === "untimeout") && !m.botCan.timeout) return "Aegis can't time them out: their highest role is above Aegis's, or Aegis lacks Moderate Members.";
  if (input.action === "kick" && !m.botCan.kick) return "Aegis can't kick them: their highest role is above Aegis's, or Aegis lacks Kick Members.";
  if (input.action === "ban" && m.inServer && !m.botCan.ban) return "Aegis can't ban them: their highest role is above Aegis's, or Aegis lacks Ban Members.";
  if (input.action === "untimeout" && !(m.timeoutUntil && m.timeoutUntil.getTime() > Date.now())) return "They are not timed out.";
  return null;
}

/* ── Memory version (tests and local previews) ─────────────────────── */

export function memoryDashboardExtras(seed: {
  members?: MemberProfile[];
  records?: Record<string, MemberRecords>;
  analytics?: AnalyticsData;
  incidents?: IncidentDashboard;
  trust?: { overview?: Partial<TrustOverview>; members?: Record<string, TrustResult> };
} = {}): DashboardExtras & { actions: Array<{ guildId: string; userId: string; input: MemberActionInput; by: string }>; saved: Record<string, unknown[]> } {
  const actions: Array<{ guildId: string; userId: string; input: MemberActionInput; by: string }> = [];
  const saved: Record<string, unknown[]> = { incident: [], modules: [], import: [], trust: [] };
  const members = seed.members ?? [];
  const emptyIncidents: IncidentDashboard = {
    active: async () => null, list: async () => [], get: async () => null,
    start: async () => ({ ok: false, error: "busy" }), end: async () => ({ ok: false, error: "not_active" }),
  };
  return {
    actions, saved,
    member: async (_g, id) => members.find(m => m.id === id) ?? null,
    memberRecords: async (_g, id) => seed.records?.[id] ?? { cases: [], warnings: [], notes: [] },
    memberAction: async (guildId, userId, input, actor) => { actions.push({ guildId, userId, input, by: actor.userId }); return { ok: true, caseId: input.action === "untimeout" ? null : `case-${actions.length}` }; },
    searchMembers: async (_g, q, limit) => members.filter(m => m.id === q || m.username.toLowerCase().includes(q.toLowerCase()) || (m.globalName ?? "").toLowerCase().includes(q.toLowerCase())).slice(0, limit).map(m => ({ id: m.id, name: m.globalName ?? m.username, avatarUrl: m.avatarUrl })),
    searchCases: async (_g, q) => Object.values(seed.records ?? {}).flatMap(r => [...r.cases, ...r.warnings]).filter(c => c.id === q || c.userId === q || c.reason.toLowerCase().includes(q.toLowerCase())).slice(0, 15),
    analytics: async (_g, days) => seed.analytics ?? { days: Array.from({ length: days }, (_, i) => `d${i}`), joins: new Array(days).fill(0), leaves: new Array(days).fill(0), cases: new Array(days).fill(0), automod: new Array(days).fill(0), casesByType: [], casesByModerator: [], automodByRule: [] },
    incidents: seed.incidents ?? emptyIncidents,
    trust: {
      overview: async () => ({ config: normalizeTrustConfig(saved.trust.at(-1)), scored: 0, truncated: false, distribution: new Array(10).fill(0), average: null, lowCount: 0, lowest: [], ...seed.trust?.overview }),
      member: async (_g, id) => seed.trust?.members?.[id] ?? null,
      saveConfig: async (_g, c) => { saved.trust.push(c); },
    },
    saveIncidentConfig: async (_g, c) => { saved.incident.push(c); },
    saveModuleSwitches: async (_g, s) => { saved.modules.push(s); },
    applySettingsImport: async (_g, u, a) => { saved.import.push({ update: u, automod: a }); },
  };
}
