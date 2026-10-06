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
  welcomeRoleId: string | null;
  suggestionsChannelId: string | null;
  escalation: {
    enabled: boolean;
    thresholds: Array<{ atWarnings: number; action: "timeout" | "kick" | "ban"; durationMinutes?: number }>;
  };
}

const DEFAULT_CONFIG: Omit<GuildConfig, "guildId"> = {
  prefix: "!",
  language: "en",
  loggingEnabled: false,
  loggingChannelId: null,
  welcomeEnabled: false,
  welcomeChannelId: null,
  welcomeMessage: "Welcome {user} to **{server}**! You are member #{member_count}.",
  welcomeRoleId: null,
  suggestionsChannelId: null,
  escalation: {
    enabled: false,
    thresholds: [],
  },
};

function normalizeGuildConfig(guildId: string, source?: Partial<GuildConfig>): GuildConfig {
  const config = source ?? {};
  return {
    guildId,
    prefix: config.prefix ?? DEFAULT_CONFIG.prefix,
    language: config.language ?? DEFAULT_CONFIG.language,
    loggingEnabled: config.loggingEnabled ?? DEFAULT_CONFIG.loggingEnabled,
    loggingChannelId: config.loggingChannelId ?? DEFAULT_CONFIG.loggingChannelId,
    welcomeEnabled: config.welcomeEnabled ?? DEFAULT_CONFIG.welcomeEnabled,
    welcomeChannelId: config.welcomeChannelId ?? DEFAULT_CONFIG.welcomeChannelId,
    welcomeMessage: config.welcomeMessage ?? DEFAULT_CONFIG.welcomeMessage,
    welcomeRoleId: config.welcomeRoleId ?? DEFAULT_CONFIG.welcomeRoleId,
    suggestionsChannelId: config.suggestionsChannelId ?? DEFAULT_CONFIG.suggestionsChannelId,
    escalation: {
      enabled: (config.escalation as any)?.enabled ?? false,
      thresholds: (config.escalation as any)?.thresholds ?? [],
    },
  };
}

export async function getGuildConfig(guildId: string): Promise<GuildConfig> {
  const doc = await GuildConfigModel.findOne({ guildId });
  if (!doc) {
    return normalizeGuildConfig(guildId);
  }
  const { _id, __v, ...config } = doc.toObject() as Partial<GuildConfig> & { _id?: unknown; __v?: unknown };
  return normalizeGuildConfig(guildId, config);
}

export async function updateGuildConfig(
  guildId: string,
  partialConfig: Partial<Omit<GuildConfig, "guildId">>
): Promise<GuildConfig> {
  // Strip any accidental mongoose internals from the update payload
  const { _id, __v, ...safeUpdate } = partialConfig as any;
  
  const updated = await GuildConfigModel.findOneAndUpdate(
    { guildId },
    { $set: safeUpdate },
    { new: true, upsert: true }
  );
  
  if (!updated) {
    return normalizeGuildConfig(guildId, safeUpdate);
  }
  
  const { _id: resId, __v: resV, ...config } = updated.toObject() as Partial<GuildConfig> & { _id?: unknown; __v?: unknown };
  return normalizeGuildConfig(guildId, config);
}

export async function resetGuildConfig(guildId: string): Promise<void> {
  await GuildConfigModel.deleteOne({ guildId });
}
