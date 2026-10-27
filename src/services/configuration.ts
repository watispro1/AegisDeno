import { GuildConfigModel } from "../database/mongo";

export interface GuildConfig {
  guildId: string;
  prefix: string;
  language: string;
  loggingEnabled: boolean;
  loggingChannelId: string | null;
  /** Per-category audit log toggles keyed by category name; absent means default (on). */
  logCategories: Record<string, boolean> | null;
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
  logCategories: null,
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

const DISCORD_ID = /^\d{17,20}$/;
const LOG_CATEGORIES = new Set([
  "modActions", "memberJoins", "memberLeaves", "messageEdits",
  "messageDeletes", "roleChanges", "channelEvents",
]);
const ESCALATION_ACTIONS = new Set(["timeout", "kick", "ban"]);

function optionalId(value: unknown): string | null {
  return value === null || value === undefined ? null : DISCORD_ID.test(String(value)) ? String(value) : null;
}

function normalizeThresholds(value: unknown): GuildConfig["escalation"]["thresholds"] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const atWarnings = Number(item.atWarnings);
    const action = String(item.action);
    if (!Number.isInteger(atWarnings) || atWarnings < 1 || atWarnings > 100 || !ESCALATION_ACTIONS.has(action)) return [];
    const duration = Number(item.durationMinutes);
    return [{
      atWarnings,
      action: action as "timeout" | "kick" | "ban",
      ...(action === "timeout" && Number.isInteger(duration) && duration >= 1 && duration <= 28 * 24 * 60
        ? { durationMinutes: duration }
        : {}),
    }];
  });
}

function normalizeLogCategories(value: unknown): Record<string, boolean> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value)
    .filter(([key, val]) => LOG_CATEGORIES.has(key) && typeof val === "boolean")
    .map(([key, val]) => [key, val]));
}

function normalizeGuildConfig(guildId: string, source?: Partial<GuildConfig>): GuildConfig {
  const config = source ?? {};
  return {
    guildId,
    prefix: typeof config.prefix === "string" && config.prefix.length <= 16 ? config.prefix : DEFAULT_CONFIG.prefix,
    language: typeof config.language === "string" && config.language.length <= 10 ? config.language : DEFAULT_CONFIG.language,
    loggingEnabled: config.loggingEnabled === true,
    loggingChannelId: optionalId(config.loggingChannelId),
    logCategories: normalizeLogCategories(config.logCategories),
    welcomeEnabled: config.welcomeEnabled === true,
    welcomeChannelId: optionalId(config.welcomeChannelId),
    welcomeMessage: typeof config.welcomeMessage === "string" && config.welcomeMessage.length <= 1000 ? config.welcomeMessage : DEFAULT_CONFIG.welcomeMessage,
    welcomeRoleId: optionalId(config.welcomeRoleId),
    suggestionsChannelId: optionalId(config.suggestionsChannelId),
    escalation: {
      enabled: Boolean(config.escalation && typeof config.escalation === "object" && config.escalation.enabled === true),
      thresholds: normalizeThresholds(config.escalation && typeof config.escalation === "object" ? config.escalation.thresholds : []),
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
  const allowed = new Set([
    "prefix", "language", "loggingEnabled", "loggingChannelId", "logCategories",
    "welcomeEnabled", "welcomeChannelId", "welcomeMessage", "welcomeRoleId",
    "suggestionsChannelId", "escalation",
  ]);
  const safeUpdate = Object.fromEntries(Object.entries(partialConfig)
    .filter(([key]) => allowed.has(key))) as Partial<GuildConfig>;
  
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
