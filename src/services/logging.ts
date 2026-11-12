import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, Client, TextChannel, EmbedBuilder, EmbedData, PermissionFlagsBits } from "discord.js";
import { getGuildConfig } from "./configuration";
import { logger } from "../utils/logger";
import { isObfuscatedChannel } from "../utils/channels";
import { isLogCategoryOn } from "./logCategories";
import { logAttachmentPlan } from "./logFormat";

export { isLogCategoryOn };

/** Audit log categories that can be toggled per guild via /logging status. */
export type LogCategory =
  | "modActions"
  | "memberJoins"
  | "memberLeaves"
  | "messageEdits"
  | "messageDeletes"
  | "roleChanges"
  | "channelEvents"
  | "voiceEvents";

/** Posts an entry to the guild log. Resolves true when it was sent, false when logging is off, the channel is missing/hidden, or sending failed. */
export async function sendGuildLog(
  client: Client,
  guildId: string,
  embed: Omit<EmbedData, "timestamp">,
  category?: LogCategory,
  components?: ActionRowBuilder<ButtonBuilder>[],
  files?: AttachmentBuilder[],
): Promise<boolean> {
  try {
    const config = await getGuildConfig(guildId);
    if (!config.loggingEnabled || !config.loggingChannelId) return false;

    if (category && !isLogCategoryOn(config.logCategories, category)) return false;

    // A category may have its own channel (set on the dashboard); otherwise the main log channel.
    const channelId = (category && config.logChannels?.[category]) || config.loggingChannelId;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !(channel instanceof TextChannel)) return false;
    if (isObfuscatedChannel(channel)) {
      logger.warn(`Log channel ${channelId} in guild ${guildId} is hidden from Aegis (no View Channel); log entry skipped.`);
      return false;
    }

    const me = channel.guild.members.me;
    const plan = logAttachmentPlan(embed.description ?? "", files?.length ?? 0, Boolean(me && channel.permissionsFor(me)?.has(PermissionFlagsBits.AttachFiles)));
    const built = new EmbedBuilder({
      ...embed,
      ...(files?.length ? { description: plan.description } : {}),
      timestamp: new Date().toISOString(),
    });

    await channel.send({
      embeds: [built],
      allowedMentions: { parse: [] },
      ...(components?.length ? { components } : {}),
      ...(plan.attach ? { files } : {}),
    });
    return true;
  } catch (error) {
    logger.error(`Failed to send log to guild ${guildId}:`, error);
    return false;
  }
}
