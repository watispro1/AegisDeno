import { Client, TextChannel, EmbedBuilder, EmbedData } from "discord.js";
import { getGuildConfig } from "./configuration";
import { logger } from "../utils/logger";

export async function sendGuildLog(
  client: Client,
  guildId: string,
  embed: Omit<EmbedData, "timestamp">
): Promise<void> {
  try {
    const config = await getGuildConfig(guildId);
    if (!config.loggingEnabled || !config.loggingChannelId) return;

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
