import { ModerationCaseModel, WarningModel } from "../database/mongo";
import { logger } from "../utils/logger";

export type ModerationAction =
  | "warn"
  | "kick"
  | "ban"
  | "timeout"
  | "untimeout"
  | "unban"
  | "clearwarnings";

export interface ModerationCase {
  _id: string;
  guildId: string;
  userId: string;
  moderatorId: string;
  action: ModerationAction;
  reason: string;
  details: string | null;
  createdAt: Date;
}

export async function addModerationCase(input: {
  guildId: string;
  userId: string;
  moderatorId: string;
  action: ModerationAction;
  reason: string;
  details?: string;
}): Promise<void> {
  try {
    await ModerationCaseModel.create(input);
  } catch (error) {
    logger.error(`Failed to record ${input.action} case for user ${input.userId}:`, error);
  }
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
    createdAt: warning.createdAt,
  }));

  return moderationCases
    .concat(warningCases)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, limit);
}