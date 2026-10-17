import { Client, TextChannel, EmbedBuilder, EmbedData } from "discord.js";
import { getGuildConfig } from "./configuration";
import { logger } from "../utils/logger";

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
): Promise<void> {
  try {
    const config = await getGuildConfig(guildId);
    if (!config.loggingEnabled || !config.loggingChannelId) return;

    // Per-category toggles default to enabled unless explicitly turned off.
    if (category && config.logCategories && config.logCategories[category] === false) return;

    const channel = await client.channels.fetch(config.loggingChannelId).catch(() => null);
    if (!channel || !(channel instanceof TextChannel)) return;

    const built = new EmbedBuilder({
      ...embed,
      timestamp: new Date().toISOString(),
    });

    await channel.send({ embeds: [built] });
  } catch (error) {
    logger.error(`Failed to send log to guild ${guildId}:`, error);
  }
}
