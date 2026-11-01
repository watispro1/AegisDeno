/**
 * Daily join and leave counts per server, for the dashboard's analytics page.
 * One small document per server per UTC day, removed after 120 days. Only
 * counts are kept: no user IDs.
 */
import mongoose from "mongoose";
import { logger } from "../utils/logger";

const MemberFlowSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  day: { type: String, required: true }, // YYYY-MM-DD (UTC)
  date: { type: Date, required: true },
  joins: { type: Number, default: 0 },
  leaves: { type: Number, default: 0 },
}, { versionKey: false });
MemberFlowSchema.index({ guildId: 1, day: 1 }, { unique: true });
MemberFlowSchema.index({ date: 1 }, { expireAfterSeconds: 120 * 86_400 });
export const MemberFlowModel = mongoose.models.MemberFlow ?? mongoose.model("MemberFlow", MemberFlowSchema);

export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export async function recordMemberFlow(guildId: string, kind: "join" | "leave", nowMs = Date.now()): Promise<void> {
  const day = utcDay(nowMs);
  await MemberFlowModel.updateOne(
    { guildId, day },
    { $inc: { [kind === "join" ? "joins" : "leaves"]: 1 }, $setOnInsert: { date: new Date(`${day}T00:00:00Z`) } },
    { upsert: true },
  ).catch((err: unknown) => logger.debug(`Member flow count failed for ${guildId}: ${(err as Error)?.message ?? err}`));
}

/** Joins and leaves per day, oldest first, one entry per day ending today (missing days are zero). */
export function fillDays(rows: ReadonlyArray<{ day: string; joins?: number; leaves?: number }>, days: number, nowMs: number): Array<{ day: string; joins: number; leaves: number }> {
  const byDay = new Map(rows.map(r => [r.day, r]));
  const out: Array<{ day: string; joins: number; leaves: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = utcDay(nowMs - i * 86_400_000);
    const r = byDay.get(day);
    out.push({ day, joins: Number(r?.joins ?? 0), leaves: Number(r?.leaves ?? 0) });
  }
  return out;
}

export async function memberFlowSeries(guildId: string, days: number, nowMs = Date.now()): Promise<Array<{ day: string; joins: number; leaves: number }>> {
  const since = utcDay(nowMs - (days - 1) * 86_400_000);
  const rows = (await MemberFlowModel.find({ guildId, day: { $gte: since } }).select({ day: 1, joins: 1, leaves: 1 }).lean()) as Array<{ day: string; joins?: number; leaves?: number }>;
  return fillDays(rows, days, nowMs);
}
