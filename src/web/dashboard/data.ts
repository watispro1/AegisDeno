/**
 * Everything the dashboard reads or writes in Mongo, behind one interface so
 * the routes can be tested with a fake. The Mongo implementation goes through
 * the same service functions the slash commands use.
 */
import { isValidObjectId, type PipelineStage } from "mongoose";
import type { Client } from "discord.js";
import { BanAppealModel, ModerationCaseModel, TicketModel, WarningModel } from "../../database/mongo";
import { getGuildConfig, updateGuildConfig, type GuildConfig } from "../../services/configuration";
import { getAutomodConfig, updateAutomodConfig, type AutomodConfig } from "../../services/automod";
import { editCaseReason, revokeModerationCase } from "../../services/moderationCases";
import { revokeWarning } from "../../services/warnings";
import { ensureAutoCloseChecks, getTicketSettings, updateTicketSettings, type TicketSettings } from "../../services/ticketService";
import { getVerificationConfig, updateVerificationSettings, type VerificationConfig } from "../../services/verificationService";
import { getStarboardConfig, updateStarboardConfig, type StarboardConfig } from "../../services/starboard";
import { sendGuildLog } from "../../services/logging";
import { getAppeal, listAppeals, reviewBanAppeal, type AppealRecord, type AppealStatus } from "../../services/appeals";
import { unbanMember } from "../../services/unban";
import { postTicketPanel } from "../../services/ticketService";
import { setupVerification } from "../../services/verificationService";
import { getRolePanels, repostRolePanel } from "../../services/rolePanelService";
import { ChannelType, type TextChannel } from "discord.js";
import { logger } from "../../utils/logger";
import { SECTION_TITLES } from "./validation";
import type {
  AutomodSettings,
  CaseFilter,
  EscalationSettings,
  LoggingSettings,
  SettingsSection,
  StarboardSettingsInput,
  TicketSettingsInput,
  TicketPanelInput,
  VerificationPanelInput,
  VerificationSettingsInput,
  WelcomeSettings,
} from "./validation";
import { isObfuscatedChannel } from "../../utils/channels";

export type { AppealRecord, AppealStatus } from "../../services/appeals";

export interface Actor {
  userId: string;
  username: string;
}

export interface CaseRecord {
  id: string;
  kind: "case" | "warning";
  userId: string;
  moderatorId: string;
  action: string;
  reason: string;
  details: string | null;
  proofUrl: string | null;
  revoked: boolean;
  revokedBy: string | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface OpenTicket {
  id: string;
  channelId: string;
  userId: string;
  category: string;
  claimedBy: string | null;
  createdAt: Date;
}

export interface OverviewData {
  cases7: number;
  cases30: number;
  warnings7: number;
  warnings30: number;
  recentCases: CaseRecord[];
  openTicketCount: number;
  openTickets: OpenTicket[];
  pendingAppeals: number;
}

export interface SettingsSnapshot {
  guild: GuildConfig;
  automod: AutomodConfig;
  tickets: TicketSettings;
  verification: VerificationConfig | null;
  starboard: StarboardConfig;
}

export type SettingsValue =
  | { section: "logging"; value: LoggingSettings }
  | { section: "escalation"; value: EscalationSettings }
  | { section: "automod"; value: AutomodSettings }
  | { section: "welcome"; value: WelcomeSettings }
  | { section: "tickets"; value: TicketSettingsInput }
  | { section: "verification"; value: VerificationSettingsInput }
  | { section: "starboard"; value: StarboardSettingsInput };

export interface RolePanelSummary {
  id: string;
  title: string;
  channelId: string;
  roleCount: number;
  /** The panel's role IDs, to check them against the viewer's highest role. */
  roleIds?: string[];
  style: string;
  createdAt: Date;
}

/** Outcome of posting a panel from the dashboard. */
export type PanelResult = "posted" | "channel-missing" | "not-found" | "failed";

export type UnbanOutcome = "done" | "not-banned" | "failed";

export type AppealReviewOutcome =
  | { ok: true; unban: "done" | "failed" | null }
  | { ok: false; reason: "not_found" | "already_reviewed" };

export interface DashboardData {
  overview(guildId: string): Promise<OverviewData>;
  listCases(guildId: string, filter: CaseFilter, perPage: number): Promise<{ items: CaseRecord[]; total: number }>;
  getCase(guildId: string, id: string): Promise<CaseRecord | null>;
  editCaseReason(guildId: string, id: string, reason: string, actor: Actor): Promise<boolean>;
  /** Marks a case or warning revoked. False when missing or already revoked. */
  revokeCase(guildId: string, id: string, actor: Actor): Promise<boolean>;
  /** Lifts the ban for a ban case's member (shared with /unban). */
  unbanCaseMember(guildId: string, record: CaseRecord, actor: Actor): Promise<UnbanOutcome>;
  listAppeals(guildId: string, status: AppealStatus | "all", page: number, perPage: number): Promise<{ items: AppealRecord[]; total: number }>;
  getAppeal(guildId: string, code: string): Promise<AppealRecord | null>;
  /** Same path as /appeal review: approve unbans, the appellant gets a DM. */
  reviewAppeal(guildId: string, code: string, decision: "approved" | "denied", note: string | null, actor: Actor): Promise<AppealReviewOutcome>;
  listRolePanels(guildId: string): Promise<RolePanelSummary[]>;
  postTicketPanel(guildId: string, input: TicketPanelInput, actor: Actor): Promise<PanelResult>;
  /** Same as /verify setup: posts the panel and saves the settings. */
  setupVerificationPanel(guildId: string, input: VerificationPanelInput, actor: Actor): Promise<PanelResult>;
  repostRolePanel(guildId: string, panelId: string, channelId: string, actor: Actor): Promise<PanelResult>;
  loadSettings(guildId: string): Promise<SettingsSnapshot>;
  /** Saves one section. Resolves false when the section cannot be saved yet (verification not set up). */
  saveSettings(guildId: string, input: SettingsValue, actor: Actor): Promise<boolean>;
}

const DAY_MS = 86_400_000;

function toRecord(doc: Record<string, unknown>, kind: "case" | "warning"): CaseRecord {
  const date = (v: unknown) => (v ? new Date(v as string) : null);
  return {
    id: String(doc._id),
    kind,
    userId: String(doc.userId ?? ""),
    moderatorId: String(doc.moderatorId ?? ""),
    action: kind === "warning" ? "warn" : String(doc.action ?? "unknown"),
    reason: String(doc.reason ?? ""),
    details: typeof doc.details === "string" ? doc.details : null,
    proofUrl: typeof doc.proofUrl === "string" ? doc.proofUrl : null,
    revoked: doc.revoked === true,
    revokedBy: typeof doc.revokedBy === "string" ? doc.revokedBy : null,
    revokedAt: date(doc.revokedAt),
    createdAt: date(doc.createdAt) ?? new Date(0),
  };
}

const PROJECT = {
  _id: 1, userId: 1, moderatorId: 1, action: 1, reason: 1, details: 1,
  proofUrl: 1, revoked: 1, revokedBy: 1, revokedAt: 1, createdAt: 1,
};

function plainText(value: string, max = 300): string {
  // Guild log embeds are Markdown; keep dashboard-entered text from forming mentions.
  return value.replace(/@(everyone|here)/g, "@\u200b$1").slice(0, max);
}

export function mongoDashboardData(client: Client): DashboardData {
  const log = (guildId: string, title: string, description: string) =>
    sendGuildLog(client, guildId, { title, color: 0x3498db, description }).catch(() => null);

  /** A text or announcement channel from the bot's cache, or null. */
  const textChannel = (guildId: string, channelId: string): TextChannel | null => {
    const ch = client.guilds?.cache?.get(guildId)?.channels.cache.get(channelId);
    if (!ch || isObfuscatedChannel(ch) || (ch.type !== ChannelType.GuildText && ch.type !== ChannelType.GuildAnnouncement)) return null;
    return ch as TextChannel;
  };

  async function listCases(guildId: string, filter: CaseFilter, perPage: number) {
    const people: Record<string, string> = {};
    if (filter.userId) people.userId = filter.userId;
    if (filter.moderatorId) people.moderatorId = filter.moderatorId;
    const reasonMatch: Record<string, unknown> = filter.query
      ? { reason: { $regex: filter.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }
      : {};
    const wantCases = filter.type !== "warn";
    const wantWarnings = filter.type === null || filter.type === "warn";
    const skip = (filter.page - 1) * perPage;

    const tail: PipelineStage[] = [
      { $sort: { createdAt: -1, _id: -1 } },
      { $facet: { items: [{ $skip: skip }, { $limit: perPage }], total: [{ $count: "n" }] } },
    ];

    let rows: Array<{ items: Array<Record<string, unknown>>; total: Array<{ n: number }> }>;
    if (wantCases) {
      const pipeline: PipelineStage[] = [
        { $match: { guildId, ...people, ...reasonMatch, ...(filter.type ? { action: filter.type } : {}) } },
        { $project: { ...PROJECT, kind: { $literal: "case" } } },
      ];
      if (wantWarnings) {
        pipeline.push({
          $unionWith: {
            coll: WarningModel.collection.collectionName,
            pipeline: [
              { $match: { guildId, ...people, ...reasonMatch } },
              { $project: { ...PROJECT, action: { $literal: "warn" }, kind: { $literal: "warning" } } },
            ],
          },
        });
      }
      rows = await ModerationCaseModel.aggregate(pipeline.concat(tail));
    } else {
      rows = await WarningModel.aggregate([
        { $match: { guildId, ...people, ...reasonMatch } },
        { $project: { ...PROJECT, action: { $literal: "warn" }, kind: { $literal: "warning" } } },
        ...tail,
      ]);
    }

    const first = rows[0] ?? { items: [], total: [] };
    return {
      items: first.items.map(d => toRecord(d, d.kind === "warning" ? "warning" : "case")),
      total: first.total[0]?.n ?? 0,
    };
  }

  async function getCase(guildId: string, id: string): Promise<CaseRecord | null> {
    if (!isValidObjectId(id)) return null;
    const c = await ModerationCaseModel.findOne({ guildId, _id: id }).lean();
    if (c) return toRecord(c as unknown as Record<string, unknown>, "case");
    const w = await WarningModel.findOne({ guildId, _id: id }).lean();
    return w ? toRecord(w as unknown as Record<string, unknown>, "warning") : null;
  }

  return {
    async overview(guildId) {
      const now = Date.now();
      const since7 = new Date(now - 7 * DAY_MS);
      const since30 = new Date(now - 30 * DAY_MS);
      const [cases7, cases30, warnings7, warnings30, recent, openTicketCount, tickets, pendingAppeals] = await Promise.all([
        ModerationCaseModel.countDocuments({ guildId, createdAt: { $gte: since7 } }),
        ModerationCaseModel.countDocuments({ guildId, createdAt: { $gte: since30 } }),
        WarningModel.countDocuments({ guildId, createdAt: { $gte: since7 } }),
        WarningModel.countDocuments({ guildId, createdAt: { $gte: since30 } }),
        listCases(guildId, { type: null, userId: null, moderatorId: null, query: null, page: 1 }, 10),
        TicketModel.countDocuments({ guildId, status: "open" }),
        TicketModel.find({ guildId, status: "open" }).sort({ createdAt: -1 }).limit(10).lean(),
        BanAppealModel.countDocuments({ guildId, status: "pending" }),
      ]);
      return {
        cases7, cases30, warnings7, warnings30,
        recentCases: recent.items,
        openTicketCount,
        openTickets: tickets.map(t => ({
          id: String(t.id),
          channelId: String(t.channelId),
          userId: String(t.userId),
          category: String(t.category ?? "general"),
          claimedBy: t.claimedBy ?? null,
          createdAt: new Date(t.createdAt ?? 0),
        })),
        pendingAppeals,
      };
    },

    listCases,
    getCase,

    async editCaseReason(guildId, id, reason, actor) {
      const edited = await editCaseReason(guildId, id, reason);
      if (!edited) return false;
      await log(
        guildId,
        "✏️ Case Reason Edited",
        `**${edited.kind === "warning" ? "Warning" : "Case"}:** \`${id}\`\n**User:** <@${edited.userId}>\n` +
          `**Old reason:** ${plainText(edited.previousReason)}\n**New reason:** ${plainText(reason)}\n` +
          `**Edited by:** <@${actor.userId}> on the web dashboard`,
      );
      return true;
    },

    async revokeCase(guildId, id, actor) {
      const record = await getCase(guildId, id);
      if (!record || record.revoked) return false;
      const ok = record.kind === "warning"
        ? await revokeWarning(guildId, id, actor.userId)
        : await revokeModerationCase(guildId, id, actor.userId);
      if (ok) {
        await log(
          guildId,
          record.kind === "warning" ? "↩️ Warning Revoked" : "↩️ Case Revoked",
          `**${record.kind === "warning" ? "Warning" : "Case"}:** \`${id}\` (${record.action})\n**User:** <@${record.userId}>\n` +
            `**Revoked by:** <@${actor.userId}> on the web dashboard`,
        );
      }
      return ok;
    },

    async unbanCaseMember(guildId, record, actor) {
      const guild = client.guilds?.cache?.get(guildId);
      if (!guild) return "failed";
      const result = await unbanMember(
        guild,
        record.userId,
        { id: actor.userId, tag: actor.username },
        plainText(`Ban case ${record.id} revoked on the web dashboard`, 200),
        { via: "on the web dashboard" },
      );
      return result.ok ? "done" : result.reason === "not_banned" ? "not-banned" : "failed";
    },

    async listAppeals(guildId, status, page, perPage) {
      return listAppeals(guildId, status, { skip: (page - 1) * perPage, limit: perPage });
    },

    getAppeal,

    async reviewAppeal(guildId, code, decision, note, actor) {
      const result = await reviewBanAppeal(client, guildId, code, decision, note, { id: actor.userId, tag: actor.username });
      if (!result.ok) return { ok: false, reason: result.reason };
      await log(
        guildId,
        decision === "approved" ? "✅ Ban Appeal Approved" : "❌ Ban Appeal Denied",
        `**Appeal:** \`${result.appeal.code}\`\n**User:** <@${result.appeal.userId}>\n` +
          (note ? `**Note:** ${plainText(note)}\n` : "") +
          (result.unban === "done" ? "**Unbanned:** yes\n" : result.unban === "failed" ? "**Unbanned:** failed, unban manually\n" : "") +
          `**Reviewed by:** <@${actor.userId}> on the web dashboard`,
      );
      return { ok: true, unban: result.unban };
    },

    async listRolePanels(guildId) {
      const panels = await getRolePanels(guildId);
      return panels.map(p => ({
        id: p.id,
        title: p.title,
        channelId: p.channelId,
        roleCount: p.roles?.length ?? 0,
        roleIds: (p.roles ?? []).map(r => r.roleId),
        style: p.panelStyle ?? "button",
        createdAt: new Date(p.createdAt ?? 0),
      }));
    },

    async postTicketPanel(guildId, input, actor) {
      const channel = textChannel(guildId, input.channelId);
      if (!channel) return "channel-missing";
      try {
        await postTicketPanel(channel, input);
      } catch (err) {
        logger.warn(`Dashboard: ticket panel post failed in guild ${guildId}: ${(err as Error)?.message ?? err}`);
        return "failed";
      }
      await log(guildId, "🎫 Ticket Panel Posted", `**Channel:** <#${channel.id}>\n**Posted by:** <@${actor.userId}> on the web dashboard`);
      return "posted";
    },

    async setupVerificationPanel(guildId, input, actor) {
      const guild = client.guilds?.cache?.get(guildId);
      const channel = textChannel(guildId, input.channelId);
      if (!guild || !channel) return "channel-missing";
      const result = await setupVerification(
        guild, channel, input.verifiedRoleId, input.type,
        input.title ?? undefined, input.description ?? undefined, input.kickUnverifiedMinutes,
      );
      if (!result) return "failed";
      logger.info(`Dashboard: verification panel posted in guild ${guildId} by user ${actor.userId}`);
      return "posted";
    },

    async repostRolePanel(guildId, panelId, channelId, actor) {
      const guild = client.guilds?.cache?.get(guildId);
      const channel = textChannel(guildId, channelId);
      if (!guild || !channel) return "channel-missing";
      const exists = (await getRolePanels(guildId)).some(p => p.id === panelId);
      if (!exists) return "not-found";
      const created = await repostRolePanel(guild, panelId, channel);
      if (!created) return "failed";
      logger.info(`Dashboard: role panel ${panelId} re-posted in guild ${guildId} by user ${actor.userId}`);
      return "posted";
    },

    async loadSettings(guildId) {
      const [guild, automod, tickets, verification, starboard] = await Promise.all([
        getGuildConfig(guildId),
        getAutomodConfig(guildId),
        getTicketSettings(guildId),
        getVerificationConfig(guildId),
        getStarboardConfig(guildId),
      ]);
      return { guild, automod, tickets, verification, starboard };
    },

    async saveSettings(guildId, input, actor) {
      switch (input.section) {
        case "logging":
          await updateGuildConfig(guildId, input.value);
          break;
        case "escalation":
          await updateGuildConfig(guildId, { escalation: input.value });
          break;
        case "automod": {
          // The form carries every automod field, the word list and exemptions included.
          const v = input.value;
          await updateAutomodConfig(guildId, {
            words: { ...v.words },
            links: { ...v.links },
            mentions: { ...v.mentions },
            spam: { ...v.spam },
            caps: { ...v.caps },
            exemptRoleIds: v.exemptRoleIds,
            exemptChannelIds: v.exemptChannelIds,
          });
          break;
        }
        case "welcome":
          await updateGuildConfig(guildId, input.value);
          break;
        case "tickets": {
          const settings = await updateTicketSettings(guildId, input.value);
          const guild = client.guilds?.cache?.get(guildId);
          if (settings.autoCloseHours > 0 && guild) void ensureAutoCloseChecks(guild).catch(() => 0);
          break;
        }
        case "verification":
          if (!(await updateVerificationSettings(guildId, input.value))) return false;
          break;
        case "starboard":
          await updateStarboardConfig(guildId, input.value);
          break;
      }
      logger.info(`Dashboard: ${input.section} settings saved for guild ${guildId} by user ${actor.userId}`);
      await log(guildId, "⚙️ Settings Changed", `**Section:** ${SECTION_TITLES[input.section]}\n**Changed by:** <@${actor.userId}> on the web dashboard`);
      return true;
    },
  };
}
