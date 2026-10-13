import { BetaFeedbackModel, BetaProgramModel } from "../database/mongo";

export const BETA_FEATURES = {
  "beta-feedback": {
    label: "Beta feedback",
    description: "Tester-only structured feedback collection and staff review.",
  },
  "experimental-automod": {
    label: "Experimental AutoMod",
    description: "Reserved gate for upcoming experimental AutoMod behavior.",
  },
  "command-lab": {
    label: "Command Lab",
    description: "Reserved gate for upcoming experimental command workflows.",
  },
} as const;

export type BetaFeatureKey = keyof typeof BETA_FEATURES;

export interface BetaProgram {
  guildId: string;
  testerIds: string[];
  enabledFeatures: BetaFeatureKey[];
}

function normalize(guildId: string, source?: { testerIds?: unknown; enabledFeatures?: unknown }): BetaProgram {
  return {
    guildId,
    testerIds: Array.isArray(source?.testerIds)
      ? [...new Set(source.testerIds.filter((id): id is string => typeof id === "string" && Boolean(id)))]
      : [],
    enabledFeatures: (Array.isArray(source?.enabledFeatures) ? source.enabledFeatures : ["beta-feedback"])
      .filter((feature): feature is BetaFeatureKey => typeof feature === "string" && feature in BETA_FEATURES),
  };
}

export async function getBetaProgram(guildId: string): Promise<BetaProgram> {
  const doc = await BetaProgramModel.findOne({ guildId }).lean();
  return normalize(guildId, doc ?? undefined);
}

export async function setTester(guildId: string, userId: string, enabled: boolean, updatedBy: string): Promise<BetaProgram> {
  const operator = enabled ? "$addToSet" : "$pull";
  const doc = await BetaProgramModel.findOneAndUpdate(
    { guildId },
    { [operator]: { testerIds: userId }, $set: { updatedBy, updatedAt: new Date() }, $setOnInsert: { enabledFeatures: ["beta-feedback"] } },
    { new: true, upsert: true },
  ).lean();
  return normalize(guildId, doc ?? undefined);
}

export async function setFeature(guildId: string, feature: BetaFeatureKey, enabled: boolean, updatedBy: string): Promise<BetaProgram> {
  const operator = enabled ? "$addToSet" : "$pull";
  const doc = await BetaProgramModel.findOneAndUpdate(
    { guildId },
    { [operator]: { enabledFeatures: feature }, $set: { updatedBy, updatedAt: new Date() } },
    { new: true, upsert: true },
  ).lean();
  return normalize(guildId, doc ?? undefined);
}

export async function canUseBetaFeature(guildId: string, userId: string, feature: BetaFeatureKey): Promise<boolean> {
  const program = await getBetaProgram(guildId);
  return program.testerIds.includes(userId) && program.enabledFeatures.includes(feature);
}

/** Runtime gate for guild-wide beta behavior, independent of an individual tester. */
export async function isBetaFeatureEnabled(guildId: string, feature: BetaFeatureKey): Promise<boolean> {
  return (await getBetaProgram(guildId)).enabledFeatures.includes(feature);
}

export async function createBetaFeedback(input: { guildId: string; authorId: string; feature: BetaFeatureKey; content: string }): Promise<string> {
  const id = crypto.randomUUID();
  await BetaFeedbackModel.create({ id, ...input });
  return id;
}

export async function getRecentBetaFeedback(guildId: string, limit = 10) {
  return BetaFeedbackModel.find({ guildId }).sort({ createdAt: -1 }).limit(limit).lean();
}
