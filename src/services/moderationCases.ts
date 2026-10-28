import { ModerationCaseModel, WarningModel } from "../database/mongo";
import { logger } from "../utils/logger";

export type ModerationAction =
  | "warn"
  | "kick"
  | "ban"
  | "timeout"
  | "untimeout"
  | "unban"
  | "clearwarnings"
  | "purge"
  | "lock"
  | "unlock";

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

export async function addModerationCase(input: {
  guildId: string;
  userId: string;
  moderatorId: string;
  action: ModerationAction;
  reason: string;
  details?: string;
  proofUrl?: string | null;
}): Promise<string | null> {
  try {
    const doc = await ModerationCaseModel.create(input);
    return String(doc._id);
  } catch (error) {
    logger.error(`Failed to record ${input.action} case for user ${input.userId}:`, error);
    return null;
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
    return result !== null;
  } catch (error) {
    logger.error(`Failed to revoke case ${caseId} in guild ${guildId}:`, error);
    return false;
  }
}

// Alias used by the escalation service
export const createModerationCase = addModerationCase;

export async function getRecentCasesForGuild(
  guildId: string,
  limit = 20,
): Promise<ModerationCase[]> {
  const cases = await ModerationCaseModel.find({ guildId }).sort({ createdAt: -1 }).limit(limit);
  return cases.map(entry => ({ ...entry.toObject(), _id: String(entry._id) })) as ModerationCase[];
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
    ModerationCaseModel.find({ guildId, userId }).sort({ createdAt: -1 }).limit(limit),
    WarningModel.find({ guildId, userId }).sort({ createdAt: -1 }).limit(limit),
  ]);

  const moderationCases: ModerationCase[] = cases.map((entry) => ({
    ...entry.toObject(),
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