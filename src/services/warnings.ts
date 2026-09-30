import { WarningModel } from "../database/mongo";

export interface Warning {
  _id: string; // Using MongoDB's built in id as string or actual field if we want
  guildId: string;
  userId: string;
  moderatorId: string;
  reason: string;
  createdAt: Date;
}

export async function addWarning(
  guildId: string,
  userId: string,
  moderatorId: string,
  reason: string
): Promise<Warning> {
  const warning = await WarningModel.create({
    guildId,
    userId,
    moderatorId,
    reason,
  });
  return warning.toObject() as unknown as Warning;
}

export async function getWarningsForUser(guildId: string, userId: string): Promise<Warning[]> {
  const warnings = await WarningModel.find({ guildId, userId }).sort({ createdAt: -1 });
  return warnings.map(w => w.toObject()) as unknown as Warning[];
}

export async function clearWarningsForUser(guildId: string, userId: string): Promise<number> {
  const result = await WarningModel.deleteMany({ guildId, userId });
  return result.deletedCount || 0;
}

export async function getTotalWarningCount(guildId: string, userId: string): Promise<number> {
  return await WarningModel.countDocuments({ guildId, userId });
}
