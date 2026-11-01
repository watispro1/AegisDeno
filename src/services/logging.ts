import { ActionRowBuilder, ButtonBuilder, Client, TextChannel, EmbedBuilder, EmbedData } from "discord.js";
import { getGuildConfig } from "./configuration";
import { logger } from "../utils/logger";
import { isObfuscatedChannel } from "../utils/channels";

/** Audit log categories that can be toggled per guild via /logging status. */
export type LogCategory =
  | "modActions"
  | "memberJoins"
  | "memberLeaves"
  | "messageEdits"
  | "messageDeletes"
  | "roleChanges"
  | "channelEvents";

export async function sendGuildLog(
  client: Client,
  guildId: string,
  embed: Omit<EmbedData, "timestamp">,
  category?: LogCategory,
  components?: ActionRowBuilder<ButtonBuilder>[],
): Promise<void> {
  try {
    const config = await getGuildConfig(guildId);
    if (!config.loggingEnabled || !config.loggingChannelId) return;

    // Per-category toggles default to enabled unless explicitly turned off.
    if (category && config.logCategories && config.logCategories[category] === false) return;

    // A category may have its own channel (set on the dashboard); otherwise the main log channel.
    const channelId = (category && config.logChannels?.[category]) || config.loggingChannelId;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !(channel instanceof TextChannel)) return;
    if (isObfuscatedChannel(channel)) {
      logger.warn(`Log channel ${channelId} in guild ${guildId} is hidden from Aegis (no View Channel); log entry skipped.`);
      return;
    }

    const built = new EmbedBuilder({
      ...embed,
      timestamp: new Date().toISOString(),
    });

    const payload = { embeds: [built], allowedMentions: { parse: [] as const } };
    await channel.send(components?.length ? { ...payload, components } : payload);
  } catch (error) {
    logger.error(`Failed to send log to guild ${guildId}:`, error);
  }
}
