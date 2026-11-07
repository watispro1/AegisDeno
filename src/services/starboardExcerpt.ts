/** Reads a starred message's text from Discord, for entries saved without an excerpt. */
import type { Guild } from "discord.js";
import { isObfuscatedChannel } from "../utils/channels";
import { messageExcerpt } from "./starboard";
import type { ExcerptLookup } from "./starboardTopQuery";

/** Discord errors that mean the message or its channel no longer exists. */
const GONE_CODES = new Set([10003, 10008]);

export function isGoneError(err: unknown): boolean {
  return typeof err === "object" && err !== null && GONE_CODES.has((err as { code?: unknown }).code as number);
}

/**
 * Returns a fetcher for fillMissingExcerpts. A deleted message or channel is
 * "gone" so it is recorded and not fetched again; a channel hidden from Aegis
 * or a failed request is "unknown" and is tried again on a later load.
 */
export function discordExcerptFetcher(guild: Guild): (channelId: string, messageId: string) => Promise<ExcerptLookup> {
  return async (channelId, messageId) => {
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return { kind: "gone" };
    if (isObfuscatedChannel(channel)) return { kind: "unknown" };
    if (!channel.isTextBased()) return { kind: "gone" };
    try {
      const message = await channel.messages.fetch(messageId);
      return { kind: "text", text: messageExcerpt(message) };
    } catch (err) {
      return isGoneError(err) ? { kind: "gone" } : { kind: "unknown" };
    }
  };
}
