/**
 * Reads and writes for the dashboard's module pages (autoresponders,
 * scheduled messages, giveaways, suggestions, Ghost Watch, announcements and
 * the overview's extra numbers), behind one interface so routes can be tested
 * with the in-memory version. The Mongo version goes through the same service
 * functions the slash commands use.
 */
import { ChannelType, PermissionFlagsBits, type Client, type TextChannel } from "discord.js";
import { AutomodHitModel, GiveawayModel, ModerationCaseModel, SuggestionModel, TaskModel, WatchlistEntryModel, WarningModel } from "../../database/mongo";
import { addAutoResponder, autoResponderExists, getAutoResponders, removeAutoResponder, setAutoResponderEnabled } from "../../services/autoResponderService";
import { AUTOMATION_TASK_TYPES, createTask, deleteTask, getTasksForGuild } from "../../services/scheduler";
import { cancelTask, scheduleTask } from "../../services/schedulerRunner";
import { removeWatchFromCache } from "../../services/watchlistService";
import { buildEmbedFromSpec, type EmbedSpec } from "../../services/embedSpec";
import { sendGuildLog } from "../../services/logging";
import { updateGuildConfig } from "../../services/configuration";
import { isObfuscatedChannel } from "../../utils/channels";
import { logger } from "../../utils/logger";
import type { Actor, PanelResult } from "./data";

export type MatchType = "exact" | "contains" | "startsWith";

export interface AutoResponderRow {
  id: string;
  trigger: string;
  response: string;
  matchType: MatchType;
  enabled: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface AutomationRow {
  id: string;
  channelId: string;
  creatorId: string;
  type: string;
  payload: string;
  executeAt: Date;
  intervalMs: number | null;
}

export interface GiveawayRow {
  messageId: string;
  channelId: string;
  prize: string;
  winnerCount: number;
  entrants: number;
  winners: string[];
  hostId: string;
  endsAt: Date;
  ended: boolean;
}

export type SuggestionFilter = "open" | "approved" | "rejected" | "all";

export interface SuggestionRow {
  id: string;
  authorId: string;
  content: string;
  status: string;
  up: number;
  down: number;
  reviewedBy: string | null;
  reviewReason: string | null;
  createdAt: Date;
}

export interface WatchView {
  targetId: string;
  reason: string | null;
  events: string[];
  alertCount: number;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface OverviewExtras {
  /** Cases plus warnings per UTC day, oldest first, 30 entries ending today. */
  casesPerDay: number[];
  activeGiveaways: number;
  automodHits7: number;
  openSuggestions: number;
  autoresponders: number;
  scheduled: number;
}

export type ActionResult = { ok: true; detail?: string } | { ok: false; error: string };

export interface ModuleData {
  overviewExtras(guildId: string): Promise<OverviewExtras>;
  listAutoResponders(guildId: string): Promise<AutoResponderRow[]>;
  addAutoResponder(guildId: string, input: { trigger: string; response: string; matchType: MatchType }, actor: Actor): Promise<ActionResult>;
  setAutoResponderEnabled(guildId: string, id: string, enabled: boolean): Promise<boolean>;
  removeAutoResponder(guildId: string, id: string): Promise<boolean>;
  listAutomations(guildId: string): Promise<AutomationRow[]>;
  createAutomation(guildId: string, input: { channelId: string; message: string; delayMs: number; intervalMs: number | null }, actor: Actor): Promise<PanelResult>;
  cancelAutomation(guildId: string, id: string): Promise<boolean>;
  listGiveaways(guildId: string): Promise<GiveawayRow[]>;
  endGiveaway(guildId: string, messageId: string, actor: Actor): Promise<ActionResult>;
  rerollGiveaway(guildId: string, messageId: string, actor: Actor): Promise<ActionResult>;
  listSuggestions(guildId: string, filter: SuggestionFilter, page: number, perPage: number): Promise<{ items: SuggestionRow[]; total: number }>;
  reviewSuggestion(guildId: string, id: string, action: "approve" | "deny" | "consider", note: string | null, actor: Actor): Promise<ActionResult>;
  /** Only the viewer's own watches: Ghost Watch lists are personal, as in /watchlist list. */
  listWatches(guildId: string, moderatorId: string): Promise<WatchView[]>;
  removeWatch(guildId: string, targetId: string, moderatorId: string): Promise<boolean>;
  postEmbed(guildId: string, channelId: string, content: string | null, embed: EmbedSpec, actor: Actor): Promise<PanelResult>;
  /** Module switches and channels kept on the guild config that have no settings section of their own. */
  saveModuleConfig(guildId: string, patch: ModuleConfigPatch, actor: Actor): Promise<void>;
}

export interface ModuleConfigPatch {
  suggestionsChannelId?: string | null;
  autorespondersEnabled?: boolean;
}

export const MAX_AUTORESPONDERS = 50;
const DAY_MS = 86_400_000;

/** The last `days` UTC day keys (YYYY-MM-DD), oldest first. */
export function dayKeys(nowMs: number, days = 30): string[] {
  const today = Math.floor(nowMs / DAY_MS);
  return Array.from({ length: days }, (_, i) => new Date((today - days + 1 + i) * DAY_MS).toISOString().slice(0, 10));
}

/** Folds { _id: "YYYY-MM-DD", n } rows into a dense per-day series. */
export function densify(rows: ReadonlyArray<{ _id: string; n: number }>, keys: readonly string[]): number[] {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r._id, (map.get(r._id) ?? 0) + r.n);
  return keys.map(k => map.get(k) ?? 0);
}

export function mongoModuleData(client: Client): ModuleData {
  const textChannel = (guildId: string, channelId: string): TextChannel | null => {
    const ch = client.guilds?.cache?.get(guildId)?.channels.cache.get(channelId);
    if (!ch || isObfuscatedChannel(ch) || (ch.type !== ChannelType.GuildText && ch.type !== ChannelType.GuildAnnouncement)) return null;
    return ch as TextChannel;
  };
  /** Whether Aegis may view, send and embed in the channel (what /automation and /announce check). */
  const canPost = (channel: TextChannel): boolean => {
    const me = channel.guild.members.me;
    return Boolean(me && channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]));
  };
  const log = (guildId: string, title: string, description: string) =>
    sendGuildLog(client, guildId, { title, color: 0x3498db, description }).catch(() => null);
  // Lazily loaded: the command modules pull in the whole interaction stack.
  const giveaways = () => import("../../commands/community/giveaway");
  const suggestions = () => import("../../commands/community/suggest");

  return {
    async overviewExtras(guildId) {
      const now = Date.now();
      const keys = dayKeys(now);
      const since = new Date(`${keys[0]}T00:00:00Z`);
      const perDay = (Model: typeof ModerationCaseModel | typeof WarningModel) => (Model as typeof ModerationCaseModel).aggregate<{ _id: string; n: number }>([
        { $match: { guildId, createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, n: { $sum: 1 } } },
      ]);
      const [cases, warnings, activeGiveaways, automodHits7, openSuggestions, autoresponders, scheduled] = await Promise.all([
        perDay(ModerationCaseModel),
        perDay(WarningModel),
        GiveawayModel.countDocuments({ guildId, ended: false }),
        AutomodHitModel.countDocuments({ guildId, triggeredAt: { $gte: new Date(now - 7 * DAY_MS) } }),
        SuggestionModel.countDocuments({ guildId, status: { $in: ["pending", "considered"] } }),
        getAutoResponders(guildId).then(r => r.length),
        TaskModel.countDocuments({ guildId, type: { $in: AUTOMATION_TASK_TYPES } }),
      ]);
      return { casesPerDay: densify([...cases, ...warnings], keys), activeGiveaways, automodHits7, openSuggestions, autoresponders, scheduled };
    },

    async listAutoResponders(guildId) {
      return (await getAutoResponders(guildId)).map(r => ({
        id: r.id, trigger: r.trigger, response: r.response, matchType: r.matchType,
        enabled: r.enabled !== false, createdBy: r.createdBy, createdAt: new Date(r.createdAt ?? 0),
      }));
    },
    async addAutoResponder(guildId, input, actor) {
      const existing = await getAutoResponders(guildId);
      if (existing.length >= MAX_AUTORESPONDERS) return { ok: false, error: `This server already has ${MAX_AUTORESPONDERS} autoresponders, the most Aegis keeps. Delete one first.` };
      if (await autoResponderExists(guildId, input.trigger, input.matchType)) return { ok: false, error: "An autoresponder with that trigger and match type already exists." };
      const created = await addAutoResponder({ guildId, ...input, createdBy: actor.userId });
      if (!created) return { ok: false, error: "The autoresponder could not be saved. Try again in a moment." };
      return { ok: true, detail: created.id };
    },
    setAutoResponderEnabled,
    removeAutoResponder,

    async listAutomations(guildId) {
      return (await getTasksForGuild(guildId, undefined, AUTOMATION_TASK_TYPES)).map(t => ({
        id: String(t.id ?? t._id), channelId: t.channelId, creatorId: t.creatorId, type: t.type,
        payload: t.payload, executeAt: t.executeAt, intervalMs: t.intervalMs ?? null,
      }));
    },
    async createAutomation(guildId, input, actor) {
      const channel = textChannel(guildId, input.channelId);
      if (!channel) return "channel-missing";
      if (!canPost(channel)) return "failed";
      try {
        const task = await createTask(guildId, channel.id, actor.userId, "scheduled", input.message, new Date(Date.now() + input.delayMs), input.intervalMs);
        scheduleTask(client, task);
      } catch (err) {
        logger.warn(`Dashboard: scheduled message failed in guild ${guildId}: ${(err as Error)?.message ?? err}`);
        return "failed";
      }
      await log(guildId, "📅 Message Scheduled", `**Channel:** <#${channel.id}>\n**Scheduled by:** <@${actor.userId}> on the web dashboard`);
      return "posted";
    },
    async cancelAutomation(guildId, id) {
      const ok = await deleteTask(guildId, id);
      if (ok) cancelTask(id);
      return ok;
    },

    async listGiveaways(guildId) {
      const docs = await GiveawayModel.find({ guildId }).sort({ ended: 1, endsAt: -1 }).limit(50).lean();
      return docs.map(g => ({
        messageId: String(g.messageId), channelId: String(g.channelId), prize: String(g.prize),
        winnerCount: Number(g.winnerCount ?? 1), entrants: g.entrants?.length ?? 0, winners: g.winners ?? [],
        hostId: String(g.hostId), endsAt: new Date(g.endsAt), ended: g.ended === true,
      }));
    },
    async endGiveaway(guildId, messageId, actor) {
      const result = await (await giveaways()).endGiveaway(client, guildId, messageId);
      if (!result.ok) return { ok: false, error: result.error ?? "That giveaway could not be ended." };
      await log(guildId, "🎉 Giveaway Ended Early", `**Message:** \`${messageId}\`\n**Ended by:** <@${actor.userId}> on the web dashboard`);
      return { ok: true, detail: `${result.winners?.length ?? 0}` };
    },
    async rerollGiveaway(guildId, messageId, actor) {
      const result = await (await giveaways()).rerollGiveaway(client, guildId, messageId, null, `<@${actor.userId}> on the web dashboard`);
      return result.ok ? { ok: true, detail: `${result.winners?.length ?? 0}` } : { ok: false, error: result.error ?? "That giveaway could not be rerolled." };
    },

    async listSuggestions(guildId, filter, page, perPage) {
      const status = filter === "open" ? { $in: ["pending", "considered"] } : filter === "all" ? undefined : filter;
      const query: Record<string, unknown> = { guildId, ...(status ? { status } : {}) };
      const [docs, total] = await Promise.all([
        SuggestionModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * perPage).limit(perPage).lean(),
        SuggestionModel.countDocuments(query),
      ]);
      return {
        total,
        items: docs.map(d => ({
          id: String(d.id), authorId: String(d.authorId), content: String(d.content), status: String(d.status),
          up: d.upvotes?.length ?? 0, down: d.downvotes?.length ?? 0,
          reviewedBy: d.reviewedBy ?? null, reviewReason: d.reviewReason ?? null, createdAt: new Date(d.createdAt ?? 0),
        })),
      };
    },
    async reviewSuggestion(guildId, id, action, note, actor) {
      const guild = client.guilds?.cache?.get(guildId);
      const moderator = await client.users.fetch(actor.userId).catch(() => null);
      if (!guild || !moderator) return { ok: false, error: "Aegis could not reach this server or your Discord account just now." };
      const result = await (await suggestions()).applySuggestionReview(client, guild, id, action, moderator, note);
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    },

    async listWatches(guildId, moderatorId) {
      const docs = await WatchlistEntryModel.find({ guildId, moderatorId }).sort({ createdAt: -1 }).limit(100).lean();
      return docs.map(d => ({
        targetId: String(d.targetId), reason: d.reason ?? null, events: d.events ?? [], alertCount: Number(d.alertCount ?? 0),
        expiresAt: d.expiresAt ? new Date(d.expiresAt) : null, createdAt: new Date(d.createdAt ?? 0),
      }));
    },
    async removeWatch(guildId, targetId, moderatorId) {
      const deleted = await WatchlistEntryModel.findOneAndDelete({ guildId, targetId, moderatorId });
      if (deleted) removeWatchFromCache(guildId, targetId, moderatorId);
      return Boolean(deleted);
    },

    async postEmbed(guildId, channelId, content, embed, actor) {
      const channel = textChannel(guildId, channelId);
      if (!channel) return "channel-missing";
      if (!canPost(channel)) return "failed";
      try {
        // Dashboard posts never ping: no @everyone, roles or users.
        await channel.send({ content: content ?? undefined, embeds: [buildEmbedFromSpec(embed)], allowedMentions: { parse: [] } });
      } catch (err) {
        logger.warn(`Dashboard: announcement failed in guild ${guildId}: ${(err as Error)?.message ?? err}`);
        return "failed";
      }
      await log(guildId, "📣 Announcement Posted", `**Channel:** <#${channel.id}>\n**Posted by:** <@${actor.userId}> on the web dashboard`);
      return "posted";
    },
    async saveModuleConfig(guildId, patch, actor) {
      await updateGuildConfig(guildId, patch);
      logger.info(`Dashboard: module settings ${Object.keys(patch).join(", ")} saved for guild ${guildId} by user ${actor.userId}`);
      await log(guildId, "⚙️ Settings Changed", `**Changed:** ${Object.keys(patch).join(", ")}\n**Changed by:** <@${actor.userId}> on the web dashboard`);
    },
  };
}
