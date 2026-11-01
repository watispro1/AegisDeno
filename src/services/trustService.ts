/**
 * Gathers the facts behind Trust Score v2 (see trustEngine.ts) from Mongo and
 * Discord, caches results briefly, and runs the opt-in integrations: the
 * low-trust role on join and the automod / Incident Mode checks. No message
 * content is read or stored; only counts and timestamps.
 */
import type { Guild, GuildMember } from "discord.js";
import { AutomodHitModel, ModerationCaseModel, UserActivityModel, WarningModel } from "../database/mongo";
import { getGuildConfig } from "./configuration";
import { getVerificationConfig } from "./verificationService";
import { utcDay } from "./memberActivity";
import {
  computeTrust, lowTrustRoleDecision, normalizeTrustConfig,
  type TrustCaseFact, type TrustConfig, type TrustFacts, type TrustResult, type TrustWarningFact,
} from "./trustEngine";
import { logger } from "../utils/logger";

const DAY = 86_400_000;
export const TRUST_CACHE_MS = 5 * 60_000;
const MAX_CACHE = 20_000;
/** Most members scored at once for the dashboard overview. */
export const TRUST_OVERVIEW_MAX = 1000;

/** A case written by Incident Mode's join gate counts as a gate flag, not as a regular case. */
export function isGateCase(reason: string | null | undefined): boolean {
  return typeof reason === "string" && reason.startsWith("Incident join gate");
}

export interface RawCase { action: string; reason?: string | null; createdAt: Date; revoked?: boolean }
export interface RawActivity { messageCount?: number; lastMessageAt?: Date | null; recentDays?: string[] | null }

/** Turns stored rows into engine facts. Pure; shared by the single-member and dashboard paths. */
export function factsFromRows(input: {
  isBot: boolean; accountCreatedAt: Date; joinedAt: Date | null; verified: boolean | null; timeoutUntil?: Date | null;
  warnings: readonly TrustWarningFact[]; cases: readonly RawCase[]; activity: RawActivity | null; automodHits30: number; now: number;
}): TrustFacts {
  const cutoff = utcDay(input.now - 30 * DAY);
  const days = Array.isArray(input.activity?.recentDays) ? input.activity!.recentDays!.filter(d => typeof d === "string" && d >= cutoff) : [];
  const timeoutLive = Boolean(input.timeoutUntil && input.timeoutUntil.getTime() > input.now);
  let latestTimeout: RawCase | null = null;
  for (const c of input.cases) if (c.action === "timeout" && !c.revoked && !isGateCase(c.reason) && (!latestTimeout || c.createdAt > latestTimeout.createdAt)) latestTimeout = c;
  const cases: TrustCaseFact[] = input.cases.filter(c => !isGateCase(c.reason))
    .map(c => ({ action: c.action, createdAt: c.createdAt, revoked: c.revoked, active: timeoutLive && c === latestTimeout }));
  return {
    isBot: input.isBot,
    accountCreatedAt: input.accountCreatedAt,
    joinedAt: input.joinedAt,
    verified: input.verified,
    messageCount: Math.max(0, Number(input.activity?.messageCount) || 0),
    activeDays30: new Set(days).size,
    lastActiveAt: input.activity?.lastMessageAt ? new Date(input.activity.lastMessageAt) : null,
    warnings: input.warnings,
    cases,
    automodHits30: input.automodHits30,
    gateFlags: input.cases.filter(c => isGateCase(c.reason) && !c.revoked).length,
  };
}

const cache = new Map<string, { at: number; result: TrustResult }>();

export function clearTrustCache(guildId?: string): void {
  if (!guildId) { cache.clear(); return; }
  for (const key of cache.keys()) if (key.startsWith(`${guildId}:`)) cache.delete(key);
}

export async function getTrustConfig(guildId: string): Promise<TrustConfig> {
  const config = await getGuildConfig(guildId).catch(() => null);
  return normalizeTrustConfig(config?.trust);
}

async function verifiedState(guildId: string, roleIds: ReadonlySet<string> | null): Promise<boolean | null> {
  const v = await getVerificationConfig(guildId).catch(() => null);
  if (!v || !v.enabled || !v.verifiedRoleId) return null;
  return roleIds ? roleIds.has(v.verifiedRoleId) : false;
}

export interface TrustSubject {
  guildId: string;
  userId: string;
  isBot: boolean;
  accountCreatedAt: Date;
  joinedAt: Date | null;
  roleIds: ReadonlySet<string> | null;
  timeoutUntil?: Date | null;
}

export function subjectFromMember(member: GuildMember): TrustSubject {
  return {
    guildId: member.guild.id,
    userId: member.id,
    isBot: member.user.bot,
    accountCreatedAt: member.user.createdAt,
    joinedAt: member.joinedAt ?? null,
    roleIds: new Set(member.roles.cache.keys()),
    timeoutUntil: member.communicationDisabledUntil ?? null,
  };
}

/** Computes (or returns a cached) trust result for one member. `fresh` skips the cache. */
export async function getMemberTrust(subject: TrustSubject, opts: { fresh?: boolean; preset?: TrustConfig["preset"] } = {}): Promise<TrustResult> {
  const key = `${subject.guildId}:${subject.userId}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (!opts.fresh && hit && now - hit.at < TRUST_CACHE_MS && (!opts.preset || hit.result.preset === opts.preset)) return hit.result;
  const { guildId, userId } = subject;
  const since = new Date(now - 30 * DAY);
  const [config, warnings, cases, activity, hits, verified] = await Promise.all([
    opts.preset ? Promise.resolve(null) : getTrustConfig(guildId),
    WarningModel.find({ guildId, userId }).select("createdAt revoked").sort({ createdAt: -1 }).limit(100).lean(),
    ModerationCaseModel.find({ guildId, userId }).select("action reason createdAt revoked").sort({ createdAt: -1 }).limit(100).lean(),
    UserActivityModel.findOne({ guildId, userId }).select("messageCount lastMessageAt recentDays").lean(),
    AutomodHitModel.countDocuments({ guildId, userId, triggeredAt: { $gte: since } }),
    verifiedState(guildId, subject.roleIds),
  ]);
  const facts = factsFromRows({
    isBot: subject.isBot, accountCreatedAt: subject.accountCreatedAt, joinedAt: subject.joinedAt, verified, timeoutUntil: subject.timeoutUntil,
    warnings: warnings.map(w => ({ createdAt: new Date(w.createdAt), revoked: w.revoked === true })),
    cases: cases.map(c => ({ action: String(c.action), reason: c.reason, createdAt: new Date(c.createdAt), revoked: c.revoked === true })),
    activity: activity as RawActivity | null, automodHits30: hits, now,
  });
  const result = computeTrust(facts, opts.preset ?? config!.preset, now);
  cache.set(key, { at: now, result });
  if (cache.size > MAX_CACHE) { const oldest = cache.keys().next().value; if (oldest !== undefined) cache.delete(oldest); }
  return result;
}

/** Scores up to TRUST_OVERVIEW_MAX cached non-bot members in a handful of queries. */
export async function scoreGuildMembers(guild: Guild, config: TrustConfig): Promise<Array<{ userId: string; name: string; avatarUrl: string | null; result: TrustResult }>> {
  const members = [...guild.members.cache.values()].filter(m => !m.user.bot).slice(0, TRUST_OVERVIEW_MAX);
  if (!members.length) return [];
  const ids = members.map(m => m.id);
  const now = Date.now();
  const since = new Date(now - 30 * DAY);
  const [warnings, cases, activity, hits, verify] = await Promise.all([
    WarningModel.find({ guildId: guild.id, userId: { $in: ids } }).select("userId createdAt revoked").lean(),
    ModerationCaseModel.find({ guildId: guild.id, userId: { $in: ids } }).select("userId action reason createdAt revoked").lean(),
    UserActivityModel.find({ guildId: guild.id, userId: { $in: ids } }).select("userId messageCount lastMessageAt recentDays").lean(),
    AutomodHitModel.aggregate<{ _id: string; n: number }>([
      { $match: { guildId: guild.id, userId: { $in: ids }, triggeredAt: { $gte: since } } },
      { $group: { _id: "$userId", n: { $sum: 1 } } },
    ]),
    getVerificationConfig(guild.id).catch(() => null),
  ]);
  const group = <T extends { userId: string }>(rows: T[]) => rows.reduce((m, r) => { (m.get(r.userId) ?? m.set(r.userId, []).get(r.userId)!).push(r); return m; }, new Map<string, T[]>());
  const w = group(warnings as Array<{ userId: string; createdAt: Date; revoked?: boolean }>);
  const c = group(cases as Array<{ userId: string; action: string; reason?: string; createdAt: Date; revoked?: boolean }>);
  const a = new Map((activity as Array<RawActivity & { userId: string }>).map(x => [x.userId, x]));
  const h = new Map(hits.map(x => [x._id, x.n]));
  const vRole = verify?.enabled ? verify.verifiedRoleId : null;
  return members.map(m => {
    const facts = factsFromRows({
      isBot: false, accountCreatedAt: m.user.createdAt, joinedAt: m.joinedAt ?? null,
      verified: vRole ? m.roles.cache.has(vRole) : null, timeoutUntil: m.communicationDisabledUntil ?? null,
      warnings: (w.get(m.id) ?? []).map(x => ({ createdAt: new Date(x.createdAt), revoked: x.revoked === true })),
      cases: (c.get(m.id) ?? []).map(x => ({ action: String(x.action), reason: x.reason, createdAt: new Date(x.createdAt), revoked: x.revoked === true })),
      activity: a.get(m.id) ?? null, automodHits30: h.get(m.id) ?? 0, now,
    });
    return { userId: m.id, name: m.displayName, avatarUrl: m.displayAvatarURL({ size: 64 }), result: computeTrust(facts, config.preset, now) };
  });
}

/** Opt-in: gives a low-trust role on join. Never touches roles above Aegis or managed roles. */
export async function applyLowTrustRole(member: GuildMember): Promise<void> {
  if (member.user.bot) return;
  const config = await getTrustConfig(member.guild.id);
  if (!config.enabled || !config.lowTrustRoleId) return;
  const trust = await getMemberTrust(subjectFromMember(member), { preset: config.preset });
  const role = member.guild.roles.cache.get(config.lowTrustRoleId) ?? null;
  const decision = lowTrustRoleDecision(config, trust.score, role ? { editable: role.editable, managed: role.managed } : null);
  if (!decision.assign) {
    if (decision.why === "role is above Aegis or managed" || decision.why === "role missing") logger.warn(`Low-trust role ${config.lowTrustRoleId} in ${member.guild.id}: ${decision.why}; skipped.`);
    return;
  }
  if (member.roles.cache.has(config.lowTrustRoleId)) return;
  await member.roles.add(config.lowTrustRoleId, `Trust Score ${trust.score} below ${config.lowThreshold}`).catch(err =>
    logger.warn(`Could not give low-trust role in ${member.guild.id}:`, err));
}

/** Removes the per-member activity counters Aegis keeps for a server it left. */
export async function purgeGuildTrustData(guildId: string): Promise<number> {
  clearTrustCache(guildId);
  const res = await UserActivityModel.deleteMany({ guildId });
  return res.deletedCount ?? 0;
}
