/** Reads a starred message's text from Discord, for entries saved without an excerpt. */
import type { Guild } from "discord.js";
import { isObfuscatedChannel } from "../utils/channels";
import { messageExcerpt } from "./starboard";

/**
 * Returns a fetcher for fillMissingExcerpts. Channels Aegis cannot see, or
 * that are not text channels, give null without a request.
 */
export function discordExcerptFetcher(guild: Guild): (channelId: string, messageId: string) => Promise<string | null> {
  return async (channelId, messageId) => {
    const channel = guild.channels.cache.get(channelId);
    if (!channel || isObfuscatedChannel(channel) || !channel.isTextBased()) return null;
    const message = await channel.messages.fetch(messageId).catch(() => null);
    return message ? messageExcerpt(message) : null;
  };
}
