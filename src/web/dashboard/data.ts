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
  VerificationSettingsInput,
  WelcomeSettings,
} from "./validation";

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

export interface DashboardData {
  overview(guildId: string): Promise<OverviewData>;
  listCases(guildId: string, filter: CaseFilter, perPage: number): Promise<{ items: CaseRecord[]; total: number }>;
  getCase(guildId: string, id: string): Promise<CaseRecord | null>;
  editCaseReason(guildId: string, id: string, reason: string, actor: Actor): Promise<boolean>;
  /** Marks a case or warning revoked. False when missing or already revoked. */
  revokeCase(guildId: string, id: string, actor: Actor): Promise<boolean>;
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

  async function listCases(guildId: string, filter: CaseFilter, perPage: number) {
    const people: Record<string, string> = {};
    if (filter.userId) people.userId = filter.userId;
    if (filter.moderatorId) people.moderatorId = filter.moderatorId;
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
        { $match: { guildId, ...people, ...(filter.type ? { action: filter.type } : {}) } },
        { $project: { ...PROJECT, kind: { $literal: "case" } } },
      ];
      if (wantWarnings) {
        pipeline.push({
          $unionWith: {
            coll: WarningModel.collection.collectionName,
            pipeline: [
              { $match: { guildId, ...people } },
              { $project: { ...PROJECT, action: { $literal: "warn" }, kind: { $literal: "warning" } } },
            ],
          },
        });
      }
      rows = await ModerationCaseModel.aggregate(pipeline.concat(tail));
    } else {
      rows = await WarningModel.aggregate([
        { $match: { guildId, ...people } },
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
        listCases(guildId, { type: null, userId: null, moderatorId: null, page: 1 }, 10),
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
          // updateAutomodConfig normalises the whole document, so merge onto the current one
          // to keep the word list and exemptions that the dashboard does not edit.
          const current = await getAutomodConfig(guildId);
          const v = input.value;
          await updateAutomodConfig(guildId, {
            ...current,
            words: { ...current.words, ...v.words },
            links: { ...current.links, ...v.links },
            mentions: { ...current.mentions, ...v.mentions },
            spam: { ...current.spam, ...v.spam },
            caps: { ...current.caps, ...v.caps },
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
