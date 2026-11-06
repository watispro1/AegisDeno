/**
 * Late content-scanning flags. Discord can flag media after a message is
 * sent, in a MessageUpdate. When that happens to a message Aegis already put
 * on the starboard, or to a starboard post itself, the media comes off the
 * post. This is not an edit log: uncached updates are never logged here, and
 * an uncached message is only fetched when it has a starboard post.
 */
import {
  Events,
  type Client,
  type Message,
  type PartialMessage,
} from "discord.js";
import { getStarboardConfig, getStarboardEntry, starboardEntryExists } from "../../services/starboard";
import { summarizeFlaggedMedia } from "../../services/mediaSafety";
import { cleanFlaggedOwnPost, cleanStarboardRepost, starboardGuardMode } from "../../services/starboardMediaGuard";
import { isObfuscatedChannel } from "../../utils/channels";
import { logger } from "../../utils/logger";
import { serializeByKey } from "../../utils/keyedQueue";

/** A post Aegis made in the starboard channel that Discord has now flagged. */
async function onOwnPost(message: Message): Promise<void> {
  if (!message.guildId || !summarizeFlaggedMedia(message).flagged) return;
  const config = await getStarboardConfig(message.guildId);
  if (!config.channelId || message.channelId !== config.channelId) return;
  if (!(await starboardGuardMode(message.guildId, message.channel))) return;
  const result = await cleanFlaggedOwnPost(message);
  if (result !== "unchanged") logger.info(`Media safety: starboard post ${message.id} in ${message.guildId} was flagged by Discord (${result}).`);
}

export async function onMediaUpdate(client: Client, newMessage: Message | PartialMessage): Promise<void> {
  const guildId = newMessage.guildId;
  if (!guildId) return;
  if (!newMessage.partial && newMessage.author?.id && newMessage.author.id === client.user?.id) {
    await onOwnPost(newMessage);
    return;
  }

  let message: Message;
  if (newMessage.partial) {
    // Only worth a fetch when this message has a starboard post to clean.
    if (!(await starboardEntryExists(guildId, newMessage.id))) return;
    const fetched = await newMessage.fetch().catch(() => null);
    if (!fetched) return;
    message = fetched;
  } else {
    message = newMessage;
  }
  if (!summarizeFlaggedMedia(message).flagged) return;

  const entry = await getStarboardEntry(guildId, message.id);
  if (!entry?.starboardMessageId) return;
  const config = await getStarboardConfig(guildId);
  const channelId = entry.starboardChannelId ?? config.channelId;
  const guild = client.guilds.cache.get(guildId);
  const channel = channelId ? guild?.channels.cache.get(channelId) : null;
  if (!channel || !channel.isTextBased() || isObfuscatedChannel(channel)) return;
  const mode = await starboardGuardMode(guildId, channel);
  if (!mode) return;
  const post = await channel.messages.fetch(entry.starboardMessageId).catch(() => null);
  if (!post) return;
  const result = await cleanStarboardRepost(message, post, entry.starCount ?? 0, config.emoji, mode);
  if (result !== "unchanged") logger.info(`Media safety: starboard post for ${message.id} in ${guildId} cleaned after a late flag (${result}).`);
}

export function registerMediaSafetyEvents(client: Client): void {
  client.on(Events.MessageUpdate, (_old, newMessage) => {
    // Same queue as star reactions, so a reaction and a flag never edit the post at once.
    serializeByKey(newMessage.id, () => onMediaUpdate(client, newMessage)).catch((err) =>
      logger.warn("Media safety update handler failed:", err),
    );
  });
}
