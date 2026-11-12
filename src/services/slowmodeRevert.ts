/**
 * Timed slowmode (`/slowmode set|custom for:`): a persisted `slowmode_revert`
 * task puts the channel back to the rate it had before. It only reverts when
 * the channel still has the rate Aegis set, so a later manual change is never
 * clobbered. One pending revert per channel: setting slowmode again replaces it.
 */
import type { Client } from "discord.js";
import { createTask, deleteTask, getTasksForChannel, type ScheduledTask } from "./scheduler";
import { cancelTask, scheduleTask } from "./schedulerRunner";
import { sendGuildLog } from "./logging";
import { isObfuscatedChannel } from "../utils/channels";
import { formatDurationLong } from "../utils/duration";
import { auditReason } from "../utils/safeText";
import { logger } from "../utils/logger";

/** Longest a timed slowmode can run before reverting. */
export const SLOWMODE_REVERT_MAX_SECONDS = 7 * 86_400;
export const SLOWMODE_REVERT_MIN_SECONDS = 60;

export const SLOWMODE_FOR_PRESETS = [
  { name: "15 minutes", value: "15m" },
  { name: "30 minutes", value: "30m" },
  { name: "1 hour", value: "1h" },
  { name: "2 hours", value: "2h" },
  { name: "6 hours", value: "6h" },
  { name: "12 hours", value: "12h" },
  { name: "1 day", value: "1d" },
  { name: "3 days", value: "3d" },
  { name: "1 week", value: "7d" },
] as const;

export interface SlowmodeRevertPayload {
  /** Rate to restore, in seconds (0 = off). */
  previousRate: number;
  /** Rate Aegis set; the revert is skipped if the channel no longer has it. */
  appliedRate: number;
  moderatorTag: string;
}

export function encodeSlowmodeRevert(p: SlowmodeRevertPayload): string {
  return JSON.stringify(p);
}

export function decodeSlowmodeRevert(raw: string): SlowmodeRevertPayload | null {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const ok = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 21_600;
    if (!ok(o.previousRate) || !ok(o.appliedRate)) return null;
    return { previousRate: o.previousRate, appliedRate: o.appliedRate, moderatorTag: typeof o.moderatorTag === "string" ? o.moderatorTag : "a moderator" };
  } catch {
    return null;
  }
}

/** What a due revert does with the channel's current rate. Pure. */
export function slowmodeRevertDecision(currentRate: number, payload: SlowmodeRevertPayload): "revert" | "changed-since" | "already" {
  if (currentRate === payload.previousRate) return "already";
  if (currentRate !== payload.appliedRate) return "changed-since";
  return "revert";
}

/** Why a `for` length can't be used, or null. Pure. */
export function slowmodeForProblem(seconds: number | null, newRate: number, previousRate: number): string | null {
  if (seconds === null) return "`for` isn't a duration. Try 30m, 2h, 1d or 3 days.";
  if (seconds < SLOWMODE_REVERT_MIN_SECONDS) return "`for` must be at least 1 minute.";
  if (seconds > SLOWMODE_REVERT_MAX_SECONDS) return "`for` can be at most 7 days.";
  if (newRate === previousRate) return `Slowmode is already ${newRate === 0 ? "off" : "at that rate"} there, so there's nothing to change back.`;
  return null;
}

/** Drop any pending revert for this channel (a new slowmode replaces it). Returns how many were removed. */
export async function clearSlowmodeReverts(guildId: string, channelId: string): Promise<number> {
  const pending = await getTasksForChannel(guildId, channelId, "slowmode_revert").catch(() => []);
  for (const t of pending) {
    cancelTask(t.id!);
    await deleteTask(guildId, t.id!).catch(() => false);
  }
  return pending.length;
}

export async function pendingSlowmodeRevert(guildId: string, channelId: string): Promise<ScheduledTask | null> {
  const pending = await getTasksForChannel(guildId, channelId, "slowmode_revert").catch(() => []);
  return pending[0] ?? null;
}

export async function scheduleSlowmodeRevert(client: Client, guildId: string, channelId: string, payload: SlowmodeRevertPayload, at: Date): Promise<ScheduledTask> {
  await clearSlowmodeReverts(guildId, channelId);
  // creatorId is the channel, like timed_unban uses the banned user: one revert per channel.
  const task = await createTask(guildId, channelId, channelId, "slowmode_revert", encodeSlowmodeRevert(payload), at);
  scheduleTask(client, task);
  return task;
}

/** Run a due revert. Throws when the edit fails so the scheduler's retry path runs. */
export async function performSlowmodeRevert(client: Client, task: ScheduledTask): Promise<void> {
  const payload = decodeSlowmodeRevert(task.payload);
  if (!payload) {
    logger.warn(`Task ${task.id}: unreadable slowmode revert payload — removing task.`);
    return;
  }
  const channel = await client.channels.fetch(task.channelId).catch(() => null);
  if (!channel || channel.isDMBased() || !("setRateLimitPerUser" in channel) || channel.guild.id !== task.guildId) {
    logger.warn(`Task ${task.id}: slowmode revert target ${task.channelId} is gone — removing task.`);
    return;
  }
  if (isObfuscatedChannel(channel)) throw new Error(`Slowmode revert target ${task.channelId} is hidden from Aegis (no View Channel).`);
  const current = channel.rateLimitPerUser ?? 0;
  const decision = slowmodeRevertDecision(current, payload);
  if (decision !== "revert") {
    logger.debug(`Task ${task.id}: slowmode revert skipped (${decision}).`);
    return;
  }
  await channel.setRateLimitPerUser(payload.previousRate, auditReason(`Timed slowmode ended (set by ${payload.moderatorTag})`));
  await sendGuildLog(client, task.guildId, {
    title: "⏲️ Timed Slowmode Ended",
    color: 0x99aab5,
    description: `**Channel:** <#${task.channelId}>\n**Restored:** ${payload.previousRate === 0 ? "Off" : formatDurationLong(payload.previousRate)}\n**Was:** ${formatDurationLong(payload.appliedRate)} (set by ${payload.moderatorTag})`,
  }, "modActions");
}
