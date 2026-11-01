/** ModMail page data: config, open threads, transcripts. Memory version for tests, Mongo for production. */
import { normalizeModmailConfig, type ModmailConfig, type TranscriptLine } from "../../services/modmailLogic";

export interface ModmailTicketRow {
  id: string;
  userId: string;
  userTag: string;
  threadId: string;
  status: "open" | "closed";
  createdAt: Date;
  closedAt: Date | null;
  closedBy: string | null;
  closeReason: string | null;
  messageCount: number;
}

export interface ModmailOverview {
  config: ModmailConfig;
  open: ModmailTicketRow[];
  closed: ModmailTicketRow[];
}

export interface ModmailDashboard {
  overview(guildId: string): Promise<ModmailOverview>;
  transcript(guildId: string, id: string): Promise<(ModmailTicketRow & { lines: TranscriptLine[] }) | null>;
  saveConfig(guildId: string, config: ModmailConfig): Promise<void>;
}

export const MODMAIL_LIST_LIMIT = 50;

export function memoryModmailDashboard(seed: { config?: Partial<ModmailConfig>; tickets?: Array<ModmailTicketRow & { guildId: string; lines: TranscriptLine[] }> } = {}): ModmailDashboard & { saved: ModmailConfig[] } {
  const saved: ModmailConfig[] = [];
  const tickets = seed.tickets ?? [];
  const config = () => saved.at(-1) ?? normalizeModmailConfig(seed.config ?? {});
  return {
    saved,
    overview: async (guildId) => ({
      config: config(),
      open: tickets.filter(t => t.guildId === guildId && t.status === "open"),
      closed: tickets.filter(t => t.guildId === guildId && t.status === "closed"),
    }),
    transcript: async (guildId, id) => tickets.find(t => t.guildId === guildId && t.id === id) ?? null,
    saveConfig: async (_g, c) => { saved.push(c); },
  };
}

function toRow(d: Record<string, unknown>): ModmailTicketRow {
  const lines = Array.isArray(d.lines) ? d.lines : null;
  return {
    id: String(d._id),
    userId: String(d.userId),
    userTag: String(d.userTag ?? ""),
    threadId: String(d.threadId),
    status: d.status === "closed" ? "closed" : "open",
    createdAt: new Date(d.createdAt as Date),
    closedAt: d.closedAt ? new Date(d.closedAt as Date) : null,
    closedBy: typeof d.closedBy === "string" ? d.closedBy : null,
    closeReason: typeof d.closeReason === "string" ? d.closeReason : null,
    messageCount: typeof d.lineCount === "number" ? d.lineCount : lines ? lines.length : 0,
  };
}

export function mongoModmailDashboard(): ModmailDashboard {
  // Required lazily so the memory version (tests, previews) never loads mongoose models.
  const models = () => require("../../database/modmailModels") as typeof import("../../database/modmailModels");
  const cfg = () => require("../../services/configuration") as typeof import("../../services/configuration");
  const project = { userId: 1, userTag: 1, threadId: 1, status: 1, createdAt: 1, closedAt: 1, closedBy: 1, closeReason: 1, lineCount: { $size: { $ifNull: ["$lines", []] } } };
  return {
    async overview(guildId) {
      const { ModmailThreadModel } = models();
      const [config, open, closed] = await Promise.all([
        cfg().getGuildConfig(guildId).then(c => normalizeModmailConfig(c.modmail)),
        ModmailThreadModel.aggregate([{ $match: { guildId, status: "open" } }, { $sort: { createdAt: -1 } }, { $limit: MODMAIL_LIST_LIMIT }, { $project: project }]),
        ModmailThreadModel.aggregate([{ $match: { guildId, status: "closed" } }, { $sort: { closedAt: -1 } }, { $limit: MODMAIL_LIST_LIMIT }, { $project: project }]),
      ]);
      return { config, open: open.map(toRow), closed: closed.map(toRow) };
    },
    async transcript(guildId, id) {
      if (!/^[0-9a-f]{24}$/i.test(id)) return null;
      const d = await models().ModmailThreadModel.findOne({ guildId, _id: id }).lean() as Record<string, unknown> | null;
      if (!d) return null;
      const lines = (Array.isArray(d.lines) ? d.lines : []) as TranscriptLine[];
      return { ...toRow(d), lines: lines.map(l => ({ ...l, at: new Date(l.at) })) };
    },
    async saveConfig(guildId, config) { await cfg().updateGuildConfig(guildId, { modmail: config }); },
  };
}
