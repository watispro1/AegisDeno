import { isValidObjectId } from "mongoose";
import { ModerationCaseModel, WarningModel } from "../database/mongo";
import { noteIncidentCase } from "./incidentHooks";
import { noteTrustChange } from "./trustHooks";
import { logger } from "../utils/logger";
import { getRustClient } from "../database/rustClient";
import { MODERATION_ACTIONS } from "../database/aegisDb/validation";
import { mirrorToAegis } from "./aegisMirror";

export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export interface ModerationCase {
  _id: string;
  guildId: string;
  userId: string;
  moderatorId: string;
  action: ModerationAction;
  reason: string;
  details: string | null;
  proofUrl?: string | null;
  revoked?: boolean;
  createdAt: Date;
}

export interface ModerationCaseInput {
  guildId: string;
  userId: string;
  moderatorId: string;
  action: ModerationAction;
  reason: string;
  details?: string;
  proofUrl?: string | null;
  /** Display names and duration are mirrored to AegisDB only (Mongo keeps them in `details`). */
  targetTag?: string;
  modTag?: string;
  durationMs?: number;
}

/**
 * Mirrors a case already saved in Mongo into AegisDB, keyed by its Mongo _id
 * (`case_ref`) so later revokes and edits from the bot find the same case and
 * a retried create is a no-op. Never throws; failures are logged and retried.
 */
function mirrorCase(id: string, input: ModerationCaseInput): Promise<void> {
  return mirrorToAegis({
    key: `case:${input.guildId}`,
    label: `createCase ${input.guildId}/${id}`,
    run: () => getRustClient().createCase(input.guildId, {
      case_ref: id,
      target_id: input.userId,
      target_tag: input.targetTag,
      mod_id: input.moderatorId,
      mod_tag: input.modTag,
      action: input.action,
      reason: input.reason,
      duration_ms: input.durationMs,
    }),
  });
}

function mirrorCasePatch(guildId: string, caseId: string, payload: Record<string, unknown>, what: string): Promise<void> {
  return mirrorToAegis({
    key: `case:${guildId}`,
    label: `${what} ${guildId}/${caseId}`,
    run: async () => {
      const updated = await getRustClient().patchCase(guildId, caseId, payload);
      if (!updated) throw new Error("case not in AegisDB yet");
    },
  });
}

export async function addModerationCase(input: ModerationCaseInput): Promise<string | null> {
  try {
    const { targetTag: _t, modTag: _m, durationMs: _d, ...stored } = input;
    const doc = await ModerationCaseModel.create(stored);
    const id = String(doc._id);
    void mirrorCase(id, input);
    noteIncidentCase(input.guildId, id, input.action, input.userId);
    noteTrustChange(input.guildId, input.userId);
    return id;
  } catch (error) {
    logger.error(`Failed to record ${input.action} case for user ${input.userId}:`, error);
    return null;
  }
}

/**
 * Record many cases in one database round trip (bulk actions such as
 * /massban), instead of one insert per member. Returns the new case IDs in
 * input order, or an empty list when the write failed.
 */
export async function addModerationCases(inputs: ReadonlyArray<ModerationCaseInput>): Promise<string[]> {
  if (!inputs.length) return [];
  try {
    const docs = await ModerationCaseModel.insertMany(
      inputs.map(({ targetTag: _t, modTag: _m, durationMs: _d, ...stored }) => stored),
      { ordered: false },
    );
    const ids = docs.map(d => String(d._id));
    docs.forEach((doc, n) => {
      const input = inputs[n];
      void mirrorCase(String(doc._id), input);
      noteIncidentCase(input.guildId, String(doc._id), input.action, input.userId);
      noteTrustChange(input.guildId, input.userId);
    });
    return ids;
  } catch (error) {
    logger.error(`Failed to record ${inputs.length} bulk ${inputs[0].action} case(s):`, error);
    return [];
  }
}

/**
 * Mark a case revoked after its action was reversed (Undo button). The case is
 * kept for the paper trail. Returns false if missing or already revoked.
 */
export async function revokeModerationCase(guildId: string, caseId: string, revokedBy: string): Promise<boolean> {
  try {
    const result = await ModerationCaseModel.findOneAndUpdate(
      { _id: caseId, guildId, revoked: { $ne: true } },
      { $set: { revoked: true, revokedBy, revokedAt: new Date() } },
    );
    if (result) noteTrustChange(guildId, String((result as { userId?: unknown }).userId ?? ""));
    if (result) void mirrorCasePatch(guildId, caseId, { revoked: true, revoked_by: revokedBy }, "revokeCase");
    return result !== null;
  } catch (error) {
    logger.error(`Failed to revoke case ${caseId} in guild ${guildId}:`, error);
    return false;
  }
}

/**
 * Change the reason on a moderation case or, if no case has that ID, on a
 * warning (warnings live in their own collection). Shared by `/case edit` and
 * the web dashboard. Returns what was changed, or null when nothing matched.
 */
export async function editCaseReason(
  guildId: string,
  caseId: string,
  reason: string,
): Promise<{ kind: "case" | "warning"; userId: string; previousReason: string } | null> {
  if (!isValidObjectId(caseId)) return null;
  // Return the old documents so callers can log the previous reason.
  const record = await ModerationCaseModel.findOneAndUpdate(
    { guildId, _id: caseId },
    { $set: { reason } },
    { returnDocument: "before" },
  ).catch(() => null);
  if (record) {
    void mirrorCasePatch(guildId, caseId, { reason }, "editCase");
    return { kind: "case", userId: record.userId, previousReason: record.reason };
  }

  const warning = await WarningModel.findOneAndUpdate(
    { guildId, _id: caseId },
    { $set: { reason } },
    { returnDocument: "before" },
  ).catch(() => null);
  if (warning) return { kind: "warning", userId: warning.userId, previousReason: warning.reason };
  return null;
}

// Alias used by the escalation service
export const createModerationCase = addModerationCase;

export async function getRecentCasesForGuild(
  guildId: string,
  limit = 20,
): Promise<ModerationCase[]> {
  const cases = await ModerationCaseModel.find({ guildId }).sort({ createdAt: -1 }).limit(limit).lean();
  return cases.map(entry => ({ ...entry, _id: String(entry._id) })) as ModerationCase[];
}

export async function getTopOffendersForGuild(
  guildId: string,
  limit = 10,
): Promise<Array<{ userId: string; count: number }>> {
  const results = await ModerationCaseModel.aggregate([
    { $match: { guildId } },
    { $group: { _id: "$userId", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
  return results.map(r => ({ userId: String(r._id), count: r.count as number }));
}

export async function getModerationCases(
  guildId: string,
  userId: string,
  limit = 10,
): Promise<ModerationCase[]> {
  const [cases, warnings] = await Promise.all([
    ModerationCaseModel.find({ guildId, userId }).sort({ createdAt: -1 }).limit(limit).lean(),
    WarningModel.find({ guildId, userId }).sort({ createdAt: -1 }).limit(limit).lean(),
  ]);

  const moderationCases: ModerationCase[] = cases.map((entry) => ({
    ...entry,
    _id: String(entry._id),
  })) as ModerationCase[];

  const warningCases: ModerationCase[] = warnings.map((warning) => ({
    _id: String(warning._id),
    guildId: warning.guildId,
    userId: warning.userId,
    moderatorId: warning.moderatorId,
    action: "warn",
    reason: warning.reason,
    details: null,
    proofUrl: warning.proofUrl ?? null,
    revoked: warning.revoked === true,
    createdAt: warning.createdAt,
  }));

  return moderationCases
    .concat(warningCases)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, limit);
}