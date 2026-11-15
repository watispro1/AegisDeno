/**
 * Find a moderation case or, when no case has that ID, a warning. Warnings
 * live in their own collection, and /warn shows a warning ID that /case edit
 * already accepted, but /case view used to answer "No case" for it.
 */
import { isValidObjectId } from "mongoose";
import { ModerationCaseModel, WarningModel } from "../../../database/mongo";

export interface CaseRecordView {
  kind: "case" | "warning";
  id: string;
  action: string;
  userId: string;
  moderatorId: string;
  reason: string;
  details: string | null;
  proofUrl: string | null;
  revoked: boolean;
  revokedBy: string | null;
  revokedAt: Date | null;
  createdAt: Date;
}

type RawRecord = {
  _id: unknown; action?: string; userId: string; moderatorId: string; reason?: string | null; details?: string | null;
  proofUrl?: string | null; revoked?: boolean | null; revokedBy?: string | null; revokedAt?: Date | null; createdAt: Date | string;
};

/** Normalise a case or warning document into one shape. Pure. */
export function toCaseView(raw: RawRecord, kind: "case" | "warning"): CaseRecordView {
  return {
    kind,
    id: String(raw._id),
    action: kind === "warning" ? "warn" : String(raw.action ?? "unknown"),
    userId: raw.userId,
    moderatorId: raw.moderatorId,
    reason: raw.reason || "No reason provided",
    details: raw.details ?? null,
    proofUrl: raw.proofUrl ?? null,
    revoked: Boolean(raw.revoked),
    revokedBy: raw.revokedBy ?? null,
    revokedAt: raw.revokedAt ? new Date(raw.revokedAt) : null,
    createdAt: new Date(raw.createdAt),
  };
}

export async function findCaseOrWarning(guildId: string, id: string): Promise<CaseRecordView | null> {
  if (!isValidObjectId(id)) return null;
  const record = await ModerationCaseModel.findOne({ guildId, _id: id }).lean().catch(() => null);
  if (record) return toCaseView(record as unknown as RawRecord, "case");
  const warning = await WarningModel.findOne({ guildId, _id: id }).lean().catch(() => null);
  return warning ? toCaseView(warning as unknown as RawRecord, "warning") : null;
}

/** Recent warnings for the case_id autocomplete on view and edit (not delete, which removes cases only). */
export async function recentWarningsForAutocomplete(guildId: string, limit: number) {
  const rows = await WarningModel.find({ guildId })
    .select("_id reason userId createdAt")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()
    .catch(() => []);
  return rows.map(w => ({ _id: w._id, action: "warn", reason: w.reason, userId: w.userId, createdAt: w.createdAt }));
}

/** Embed colour per action, so a case reads at a glance. Pure. */
export function caseColor(action: string, revoked = false): number {
  if (revoked) return 0x95A5A6;
  switch (action.toLowerCase()) {
    case "ban": case "softban": return 0xED4245;
    case "kick": return 0xE67E22;
    case "timeout": case "warn": return 0xFEE75C;
    case "unban": case "untimeout": case "unlock": case "clearwarnings": return 0x57F287;
    default: return 0x3498DB;
  }
}
