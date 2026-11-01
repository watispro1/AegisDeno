/**
 * Weekly staff digest: gathers a week of numbers, posts once per guild-week.
 * One `staff_digest` task per guild in the task scheduler, so it survives restarts;
 * the DigestRun unique key (guildId + ISO week) stops duplicate posts.
 */
import { EmbedBuilder, TextChannel, type Client } from "discord.js";
import { ModerationCaseModel, TicketModel, WarningModel } from "../database/mongo";
import { AutomodHitModel, BanAppealModel } from "../database/extraModels";
import { DigestRunModel, ModmailThreadModel, isDuplicateKey } from "../database/modmailModels";
import { MemberFlowModel, utcDay } from "./memberFlow";
import { IncidentModel } from "./incidentStore";
import { getGuildConfig } from "./configuration";
import { createTask, deleteTask, getTasksForGuild } from "./scheduler";
import { DIGEST_MENTIONS, buildDigestEmbed, digestWeekKey, nextDigestRun, normalizeDigestConfig, type DigestConfig, type DigestEmbedData, type DigestStats } from "./digestLogic";
import { isObfuscatedChannel } from "../utils/channels";
import { logger } from "../utils/logger";

const WEEK_MS = 7 * 86_400_000;

type Count = { _id: string; n: number };

export async function gatherDigestStats(client: Client, guildId: string, until: Date): Promise<DigestStats> {
  const since = new Date(until.getTime() - WEEK_MS);
  const range = { $gte: since, $lt: until };
  const days: string[] = [];
  for (let t = since.getTime(); t < until.getTime(); t += 86_400_000) days.push(utcDay(t));
  const { mongoTrustDashboard } = require("../web/dashboard/trustData") as typeof import("../web/dashboard/trustData");
  const [byType, byMod, warnByMod, warnCount, flow, automodHits, incidents, tickets, appeals, modmail, trust, lastRun] = await Promise.all([
    ModerationCaseModel.aggregate<Count>([{ $match: { guildId, createdAt: range } }, { $group: { _id: "$action", n: { $sum: 1 } } }]),
    ModerationCaseModel.aggregate<Count>([{ $match: { guildId, createdAt: range } }, { $group: { _id: "$moderatorId", n: { $sum: 1 } } }]),
    WarningModel.aggregate<Count>([{ $match: { guildId, createdAt: range } }, { $group: { _id: "$moderatorId", n: { $sum: 1 } } }]),
    WarningModel.countDocuments({ guildId, createdAt: range }),
    MemberFlowModel.find({ guildId, day: { $in: days } }).lean() as Promise<Array<{ joins?: number; leaves?: number }>>,
    AutomodHitModel.countDocuments({ guildId, triggeredAt: range }),
    IncidentModel.countDocuments({ guildId, startedAt: range }),
    TicketModel.countDocuments({ guildId, status: "open" }),
    BanAppealModel.countDocuments({ guildId, status: "pending" }),
    ModmailThreadModel.countDocuments({ guildId, status: "open" }),
    mongoTrustDashboard(client).overview(guildId).catch(() => null),
    DigestRunModel.findOne({ guildId }).sort({ postedAt: -1 }).lean() as Promise<{ lowTrust?: number | null } | null>,
  ]);
  const mods = new Map<string, number>();
  for (const r of [...byMod, ...warnByMod]) mods.set(String(r._id), (mods.get(String(r._id)) ?? 0) + r.n);
  const types: Array<[string, number]> = byType.map(r => [String(r._id), r.n]);
  if (warnCount) types.push(["warn", warnCount]);
  return {
    since, until,
    casesByType: types.sort((a, b) => b[1] - a[1]),
    casesByModerator: [...mods.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
    joins: flow.reduce((a, f) => a + (f.joins ?? 0), 0),
    leaves: flow.reduce((a, f) => a + (f.leaves ?? 0), 0),
    automodHits, incidents,
    trust: { scored: trust?.scored ?? 0, average: trust?.average ?? null, low: trust?.lowCount ?? 0, previousLow: typeof lastRun?.lowTrust === "number" ? lastRun.lowTrust : null },
    open: { tickets, appeals, modmail },
    lowest: (trust?.lowest ?? []).slice(0, 5).map(m => ({ userId: m.userId, name: m.name, score: m.score })),
  };
}

export async function previewDigest(client: Client, guildId: string): Promise<DigestEmbedData | null> {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return null;
  return buildDigestEmbed(await gatherDigestStats(client, guildId, new Date()), guild.name, true);
}

async function targetChannel(client: Client, guildId: string, cfg: DigestConfig): Promise<TextChannel | null> {
  const id = cfg.channelId ?? (await getGuildConfig(guildId)).loggingChannelId;
  if (!id) return null;
  const ch = await client.channels.fetch(id).catch(() => null);
  if (!(ch instanceof TextChannel) || ch.guildId !== guildId || isObfuscatedChannel(ch)) return null;
  return ch;
}

export type DigestPostResult = "posted" | "duplicate" | "disabled" | "no-channel";

/** Post this week's digest once. `scheduledFor` fixes the week, so a late or retried run can't post twice. */
export async function postWeeklyDigest(client: Client, guildId: string, scheduledFor: Date): Promise<DigestPostResult> {
  const cfg = normalizeDigestConfig((await getGuildConfig(guildId)).digest);
  const guild = client.guilds.cache.get(guildId);
  if (!cfg.enabled || !guild) return "disabled";
  const channel = await targetChannel(client, guildId, cfg);
  if (!channel) return "no-channel";
  const weekKey = digestWeekKey(scheduledFor, cfg.timezone);
  const stats = await gatherDigestStats(client, guildId, new Date());
  try {
    await DigestRunModel.create({ guildId, weekKey, lowTrust: stats.trust.scored ? stats.trust.low : null });
  } catch (err) {
    if (isDuplicateKey(err)) return "duplicate";
    throw err;
  }
  try {
    await channel.send({ embeds: [new EmbedBuilder(buildDigestEmbed(stats, guild.name))], allowedMentions: DIGEST_MENTIONS });
  } catch (err) {
    // Not posted: free the key so the next attempt this week can try again.
    await DigestRunModel.deleteOne({ guildId, weekKey }).catch(() => null);
    throw err;
  }
  return "posted";
}

/** Replace the guild's digest task with one at the next run time (or none when off). Returns the next run. */
export async function ensureDigestTask(client: Client, guildId: string, cfg: DigestConfig, now = new Date()): Promise<Date | null> {
  const { cancelTask, scheduleTask } = require("./schedulerRunner") as typeof import("./schedulerRunner");
  const existing = await getTasksForGuild(guildId, undefined, ["staff_digest"]).catch(() => []);
  for (const t of existing) { cancelTask(t.id!); await deleteTask(guildId, t.id!).catch(() => null); }
  if (!cfg.enabled) return null;
  const at = nextDigestRun(cfg, now);
  const task = await createTask(guildId, cfg.channelId ?? guildId, client.user?.id ?? "0", "staff_digest", JSON.stringify({ v: 1 }), at);
  scheduleTask(client, task);
  return at;
}

/** Scheduler entry: post (never throws), then always chain the next week's task. */
export async function runDigestTask(client: Client, task: { guildId: string; executeAt: Date }): Promise<void> {
  try {
    const r = await postWeeklyDigest(client, task.guildId, new Date(task.executeAt));
    logger.info(`Staff digest for ${task.guildId}: ${r}.`);
  } catch (err) {
    logger.warn(`Staff digest for ${task.guildId} failed:`, err);
  }
  const cfg = normalizeDigestConfig((await getGuildConfig(task.guildId)).digest);
  if (cfg.enabled && client.guilds.cache.has(task.guildId)) {
    // Never schedule before the run that just happened.
    const from = new Date(Math.max(Date.now(), new Date(task.executeAt).getTime()) + 60_000);
    const { scheduleTask } = require("./schedulerRunner") as typeof import("./schedulerRunner");
    const next = await createTask(task.guildId, cfg.channelId ?? task.guildId, client.user?.id ?? "0", "staff_digest", JSON.stringify({ v: 1 }), nextDigestRun(cfg, from));
    scheduleTask(client, next);
  }
}

/** Boot safety net: a guild with the digest on but no pending task (lost to a crash) gets one. */
export async function reconcileDigestTasks(client: Client): Promise<number> {
  const { GuildConfigModel, TaskModel } = await import("../database/mongo");
  const [enabled, scheduled] = await Promise.all([
    GuildConfigModel.find({ "digest.enabled": true }).select("guildId").limit(10_000).lean() as Promise<Array<{ guildId: string }>>,
    TaskModel.distinct("guildId", { type: "staff_digest" }) as Promise<string[]>,
  ]);
  const have = new Set(scheduled);
  let fixed = 0;
  for (const { guildId } of enabled) {
    if (have.has(guildId) || !client.guilds.cache.has(guildId)) continue;
    await ensureDigestTask(client, guildId, normalizeDigestConfig((await getGuildConfig(guildId)).digest)).catch(err => logger.warn(`Digest reconcile ${guildId}:`, err));
    fixed++;
  }
  return fixed;
}
