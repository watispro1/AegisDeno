import { GuildConfigModel } from "../database/mongo";

export interface GuildConfig {
  guildId: string;
  prefix: string;
  language: string;
  loggingEnabled: boolean;
  loggingChannelId: string | null;
  welcomeEnabled: boolean;
  welcomeChannelId: string | null;
  welcomeMessage: string;
}

const DEFAULT_CONFIG: Omit<GuildConfig, "guildId"> = {
  prefix: "!",
  language: "en",
  loggingEnabled: false,
  loggingChannelId: null,
  welcomeEnabled: false,
  welcomeChannelId: null,
  welcomeMessage: "Welcome {user} to **{server}**! You are member #{member_count}.",
};

export async function getGuildConfig(guildId: string): Promise<GuildConfig> {
  const doc = await GuildConfigModel.findOne({ guildId });
  if (!doc) {
    return { ...DEFAULT_CONFIG, guildId };
  }
  return doc.toObject() as GuildConfig;
}

export async function updateGuildConfig(
  guildId: string,
  partialConfig: Partial<GuildConfig>
): Promise<GuildConfig> {
  const updated = await GuildConfigModel.findOneAndUpdate(
    { guildId },
    { $set: partialConfig },
    { new: true, upsert: true }
  );
  return updated.toObject() as GuildConfig;
}

export async function resetGuildConfig(guildId: string): Promise<void> {
  await GuildConfigModel.deleteOne({ guildId });
}
