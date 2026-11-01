import { auditReason } from "../utils/safeText";
/**
 * Ban appeal review, shared by `/appeal review` and the web dashboard.
 *
 * Reviewing is atomic: the status only moves from "pending" once, so two
 * moderators (or a slash command and a dashboard click) cannot both decide the
 * same appeal. Approving lifts the ban in Discord; either decision DMs the
 * appellant when their DMs are open.
 */
import { EmbedBuilder, type Client } from "discord.js";
import { BanAppealModel } from "../database/mongo";
import { logger } from "../utils/logger";

export type AppealStatus = "pending" | "approved" | "denied" | "expired";
export type AppealDecision = "approved" | "denied";

export const APPEAL_STATUSES: readonly AppealStatus[] = ["pending", "approved", "denied", "expired"];
export const APPEAL_NOTE_MAX = 512;
/** Codes look like AGS-K7X2. */
export const APPEAL_CODE = /^AGS-[A-Z0-9]{4}$/;

export const APPEAL_STATUS_LABELS: Record<AppealStatus, { emoji: string; color: number; label: string }> = {
  pending:  { emoji: "⏳", color: 0xFEE75C, label: "Pending Review" },
  approved: { emoji: "✅", color: 0x57F287, label: "Approved" },
  denied:   { emoji: "❌", color: 0xED4245, label: "Denied" },
  expired:  { emoji: "💤", color: 0x99AAB5, label: "Expired" },
};

export interface AppealRecord {
  code: string;
  guildId: string;
  userId: string;
  moderatorId: string;
  banReason: string;
  appealText: string | null;
  status: AppealStatus;
  reviewedBy: string | null;
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export function toAppealRecord(doc: Record<string, unknown>): AppealRecord {
  const date = (v: unknown) => (v ? new Date(v as string) : null);
  const status = String(doc.status ?? "pending");
  return {
    code: String(doc.appealCode ?? ""),
    guildId: String(doc.guildId ?? ""),
    userId: String(doc.userId ?? ""),
    moderatorId: String(doc.moderatorId ?? ""),
    banReason: String(doc.banReason ?? ""),
    appealText: typeof doc.appealText === "string" ? doc.appealText : null,
    status: (APPEAL_STATUSES as readonly string[]).includes(status) ? (status as AppealStatus) : "pending",
    reviewedBy: typeof doc.reviewedBy === "string" ? doc.reviewedBy : null,
    reviewNote: typeof doc.reviewNote === "string" ? doc.reviewNote : null,
    reviewedAt: date(doc.reviewedAt),
    createdAt: date(doc.createdAt) ?? new Date(0),
  };
}

export async function listAppeals(
  guildId: string,
  status: AppealStatus | "all",
  opts: { skip?: number; limit?: number } = {},
): Promise<{ items: AppealRecord[]; total: number }> {
  const query: Record<string, unknown> = status === "all" ? { guildId } : { guildId, status };
  const [docs, total] = await Promise.all([
    BanAppealModel.find(query).sort({ createdAt: -1 }).skip(opts.skip ?? 0).limit(opts.limit ?? 15).lean(),
    BanAppealModel.countDocuments(query),
  ]);
  return { items: docs.map(d => toAppealRecord(d as unknown as Record<string, unknown>)), total };
}

export async function getAppeal(guildId: string, code: string): Promise<AppealRecord | null> {
  const upper = code.toUpperCase();
  if (!APPEAL_CODE.test(upper)) return null;
  const doc = await BanAppealModel.findOne({ guildId, appealCode: upper }).lean();
  return doc ? toAppealRecord(doc as unknown as Record<string, unknown>) : null;
}

export type ReviewResult =
  | { ok: true; appeal: AppealRecord; unban: "done" | "failed" | null; dmSent: boolean }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "already_reviewed"; status: AppealStatus };

/**
 * Decide a pending appeal. `reviewer.tag` goes into the Discord audit-log
 * reason for the unban.
 */
export async function reviewBanAppeal(
  client: Client,
  guildId: string,
  code: string,
  decision: AppealDecision,
  note: string | null,
  reviewer: { id: string; tag: string },
): Promise<ReviewResult> {
  const upper = code.toUpperCase();
  const updated = await BanAppealModel.findOneAndUpdate(
    { appealCode: upper, guildId, status: "pending" },
    { $set: { status: decision, reviewedBy: reviewer.id, reviewNote: note, reviewedAt: new Date() } },
    { returnDocument: "after" },
  ).lean();

  if (!updated) {
    const existing = await BanAppealModel.findOne({ appealCode: upper, guildId }).lean();
    if (!existing) return { ok: false, reason: "not_found" };
    return { ok: false, reason: "already_reviewed", status: toAppealRecord(existing as unknown as Record<string, unknown>).status };
  }

  const appeal = toAppealRecord(updated as unknown as Record<string, unknown>);
  const guild = client.guilds?.cache?.get(guildId) ?? null;

  let unban: "done" | "failed" | null = null;
  if (decision === "approved") {
    try {
      if (!guild) throw new Error("guild not cached");
      await guild.bans.remove(appeal.userId, auditReason(`Ban appeal ${upper} approved by ${reviewer.tag}`));
      unban = "done";
      const { clearTimedUnbans } = await import("./tempBan");
      await clearTimedUnbans(guildId, appeal.userId).catch(() => 0);
    } catch (err) {
      logger.warn(`Appeal ${upper}: automatic unban failed in guild ${guildId}: ${(err as Error)?.message ?? err}`);
      unban = "failed";
    }
  }

  let dmSent = false;
  try {
    const s = APPEAL_STATUS_LABELS[decision];
    const appellant = await client.users.fetch(appeal.userId);
    const dmEmbed = new EmbedBuilder()
      .setColor(s.color)
      .setTitle(`${s.emoji} Your Ban Appeal Has Been ${s.label}`)
      .setDescription(
        decision === "approved"
          ? `Your ban appeal (\`${upper}\`) in **${guild?.name ?? "the server"}** has been **approved**. You may rejoin the server.`
          : `Your ban appeal (\`${upper}\`) in **${guild?.name ?? "the server"}** has been **denied**. The ban remains in effect.`,
      )
      .addFields({ name: "💬 Staff Note", value: note ?? "No additional comments." })
      .setTimestamp();
    dmSent = (await appellant.send({ embeds: [dmEmbed] }).catch(() => null)) !== null;
  } catch {
    /* user left Discord or DMs closed */
  }

  return { ok: true, appeal, unban, dmSent };
}
