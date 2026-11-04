/**
 * Keeps the opt-in low-trust role in step with each member's Trust Score after
 * they join: a member who drops below the threshold (new warnings or cases)
 * gets the role, and one who climbs back above it (warnings revoked, cases
 * aging out, time in the server) loses it.
 *
 * Two triggers, both bounded:
 * - a debounced recheck of one member when one of their cases or warnings is
 *   added, revoked or removed (see trustHooks.ts);
 * - a slow sweep of servers that use the role, a capped batch of cached
 *   members per pass, with a cap on role edits and a pause between them.
 *
 * Only the configured role is touched, only while the integration and the
 * role are set, and never when the role is managed or above Aegis.
 */
import type { Client, Guild, GuildMember } from "discord.js";
import { isLowTrust, type TrustConfig } from "./trustEngine";
import { clearTrustCache, getMemberTrust, getTrustConfig, scoreMembers, subjectFromMember } from "./trustService";
import { setTrustChangeSink } from "./trustHooks";
import { logger } from "../utils/logger";

/** Wait after a case or warning change before rescoring, so bursts collapse into one check. */
export const RECHECK_DELAY_MS = 15_000;
/** Most members waiting for a recheck at once; more are dropped (the sweep catches them later). */
export const RECHECK_QUEUE_MAX = 1_000;
export const SWEEP_INTERVAL_MS = 6 * 60 * 60_000;
const FIRST_SWEEP_DELAY_MS = 10 * 60_000;
/** Members scored per server per sweep; the next sweep carries on where this one stopped. */
export const SWEEP_BATCH = 1_000;
/** Role edits per server per sweep. */
export const SWEEP_MAX_EDITS = 50;
/** Pause between role edits in a sweep, well inside Discord's per-route limits. */
export const SWEEP_EDIT_GAP_MS = 1_000;
const GUILD_SWEEP_DELAY_MS = 30_000;

export type LowTrustRoleAction = { action: "add" | "remove" | "none"; why: string };

/** What to do with the low-trust role for one member. Pure; tested directly. */
export function lowTrustRoleAction(
  config: Pick<TrustConfig, "enabled" | "lowTrustRoleId" | "lowThreshold">,
  score: number,
  hasRole: boolean,
  role: { editable: boolean; managed: boolean } | null,
): LowTrustRoleAction {
  if (!config.enabled || !config.lowTrustRoleId) return { action: "none", why: "low-trust role off" };
  const low = isLowTrust(score, config);
  if (low && hasRole) return { action: "none", why: "already has the role" };
  if (!low && !hasRole) return { action: "none", why: "not low trust" };
  if (!role) return { action: "none", why: "role missing" };
  if (role.managed || !role.editable) return { action: "none", why: "role is above Aegis or managed" };
  return low
    ? { action: "add", why: `Trust Score ${score} below ${config.lowThreshold}` }
    : { action: "remove", why: `Trust Score ${score}, no longer below ${config.lowThreshold}` };
}

/** The parts of a member this module uses, so tests can pass a plain object. */
export interface RoleMember {
  id: string;
  user: { bot: boolean };
  roles: { cache: { has(id: string): boolean }; add(id: string, reason?: string): Promise<unknown>; remove(id: string, reason?: string): Promise<unknown> };
}

/** Applies the decision for one member. Resolves to what was done; never throws. */
export async function applyLowTrustAction(
  member: RoleMember,
  config: TrustConfig,
  score: number,
  role: { editable: boolean; managed: boolean } | null,
): Promise<LowTrustRoleAction["action"]> {
  if (member.user.bot || !config.lowTrustRoleId) return "none";
  const roleId = config.lowTrustRoleId;
  const decision = lowTrustRoleAction(config, score, member.roles.cache.has(roleId), role);
  if (decision.action === "none") return "none";
  try {
    if (decision.action === "add") await member.roles.add(roleId, decision.why);
    else await member.roles.remove(roleId, decision.why);
    return decision.action;
  } catch (err) {
    logger.warn(`Low-trust role ${decision.action} failed for ${member.id}:`, err);
    return "none";
  }
}

function roleFacts(guild: Guild, roleId: string): { editable: boolean; managed: boolean } | null {
  const role = guild.roles.cache.get(roleId);
  return role ? { editable: role.editable, managed: role.managed } : null;
}

/** Rescores one member now and adds or removes the role. */
export async function recheckMember(client: Client, guildId: string, userId: string): Promise<LowTrustRoleAction["action"]> {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return "none";
  const config = await getTrustConfig(guildId);
  if (!config.enabled || !config.lowTrustRoleId) return "none";
  const member: GuildMember | null = guild.members.cache.get(userId) ?? await guild.members.fetch(userId).catch(() => null);
  if (!member || member.user.bot) return "none";
  const trust = await getMemberTrust(subjectFromMember(member), { fresh: true, preset: config.preset });
  return applyLowTrustAction(member, config, trust.score, roleFacts(guild, config.lowTrustRoleId));
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Where each server's sweep stopped, so large servers are covered over several passes. */
const sweepOffsets = new Map<string, number>();

/** One sweep pass over one server. Returns the number of role edits made. */
export async function sweepGuild(guild: Guild, gapMs = SWEEP_EDIT_GAP_MS): Promise<number> {
  const config = await getTrustConfig(guild.id);
  if (!config.enabled || !config.lowTrustRoleId) { sweepOffsets.delete(guild.id); return 0; }
  const role = roleFacts(guild, config.lowTrustRoleId);
  if (!role || role.managed || !role.editable) return 0;
  const all = [...guild.members.cache.values()].filter(m => !m.user.bot);
  if (!all.length) return 0;
  const start = (sweepOffsets.get(guild.id) ?? 0) % all.length;
  const batch = all.slice(start, start + SWEEP_BATCH);
  sweepOffsets.set(guild.id, start + batch.length >= all.length ? 0 : start + batch.length);
  clearTrustCache(guild.id);
  const scored = await scoreMembers(guild, batch, config);
  const byId = new Map(batch.map(m => [m.id, m]));
  let edits = 0;
  for (const row of scored) {
    if (edits >= SWEEP_MAX_EDITS) break;
    const member = byId.get(row.userId);
    if (!member) continue;
    const hasRole = member.roles.cache.has(config.lowTrustRoleId);
    if (isLowTrust(row.result.score, config) === hasRole) continue;
    const done = await applyLowTrustAction(member, config, row.result.score, role);
    if (done !== "none") { edits++; if (gapMs > 0) await sleep(gapMs); }
  }
  if (edits) logger.info(`Low-trust role sweep in ${guild.id}: ${edits} change(s)`);
  return edits;
}

let sweepTimer: ReturnType<typeof setInterval> | null = null;
let firstTimer: ReturnType<typeof setTimeout> | null = null;
let sweeping = false;
const pending = new Map<string, ReturnType<typeof setTimeout>>();
const guildSweeps = new Map<string, ReturnType<typeof setTimeout>>();
let activeClient: Client | null = null;

async function sweepAll(client: Client): Promise<void> {
  if (sweeping) return;
  sweeping = true;
  try {
    for (const guild of client.guilds.cache.values()) {
      await sweepGuild(guild).catch(err => logger.warn(`Low-trust role sweep failed in ${guild.id}:`, err));
    }
  } finally {
    sweeping = false;
  }
}

/** Queues a debounced recheck of one member. Returns false when the queue is full. */
export function queueRecheck(guildId: string, userId: string): boolean {
  const client = activeClient;
  if (!client) return false;
  const key = `${guildId}:${userId}`;
  const existing = pending.get(key);
  if (existing) clearTimeout(existing);
  else if (pending.size >= RECHECK_QUEUE_MAX) return false;
  const timer = setTimeout(() => {
    pending.delete(key);
    recheckMember(client, guildId, userId).catch(err => logger.warn(`Low-trust recheck failed in ${guildId}:`, err));
  }, RECHECK_DELAY_MS);
  timer.unref?.();
  pending.set(key, timer);
  return true;
}

/** Sweeps one server soon, such as after its trust settings change. Debounced per server. */
export function queueGuildSweep(guildId: string): void {
  const client = activeClient;
  if (!client) return;
  const existing = guildSweeps.get(guildId);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    guildSweeps.delete(guildId);
    sweepOffsets.delete(guildId);
    const guild = client.guilds.cache.get(guildId);
    if (guild) sweepGuild(guild).catch(err => logger.warn(`Low-trust role sweep failed in ${guildId}:`, err));
  }, GUILD_SWEEP_DELAY_MS);
  timer.unref?.();
  guildSweeps.set(guildId, timer);
}

/** Installs the case/warning hook and starts the periodic sweep. Safe to call twice. */
export function startLowTrustSync(client: Client): void {
  stopLowTrustSync();
  activeClient = client;
  setTrustChangeSink((guildId, userId) => { queueRecheck(guildId, userId); });
  firstTimer = setTimeout(() => { sweepAll(client).catch(() => undefined); }, FIRST_SWEEP_DELAY_MS);
  firstTimer.unref?.();
  sweepTimer = setInterval(() => { sweepAll(client).catch(() => undefined); }, SWEEP_INTERVAL_MS);
  sweepTimer.unref?.();
}

export function stopLowTrustSync(): void {
  setTrustChangeSink(null);
  activeClient = null;
  if (firstTimer) clearTimeout(firstTimer);
  if (sweepTimer) clearInterval(sweepTimer);
  firstTimer = null;
  sweepTimer = null;
  for (const t of pending.values()) clearTimeout(t);
  for (const t of guildSweeps.values()) clearTimeout(t);
  pending.clear();
  guildSweeps.clear();
}
