/**
 * Starboard reaction listener.
 *
 * Needs the GuildMessageReactions intent, plus the Message, Channel and
 * Reaction partials so reactions on messages sent before the bot started (not
 * in the cache) are still delivered.
 */
import {
  Events,
  type Client,
  type Message,
  type MessageReaction,
  type PartialMessageReaction,
  type TextChannel,
} from "discord.js";
import { getStarboardConfig, handleStarReaction } from "../../services/starboard";
import { starEmojiMatches } from "../../services/communityLogic";
import { logger } from "../../utils/logger";
import { isObfuscatedChannel } from "../../utils/channels";
import { serializeByKey } from "../../utils/keyedQueue";
import { starboardGuardMode, cleanFlaggedOwnPost } from "../../services/starboardMediaGuard";
import { registerMediaSafetyEvents } from "./mediaSafety";

/**
 * Reactions on one message are handled one at a time (serializeByKey). Without
 * this, two stars landing together both see "no entry yet" and the message is
 * posted twice. Late media flags on the same message share the queue.
 */
export { serializeByKey };

async function onStarReaction(reaction: MessageReaction | PartialMessageReaction): Promise<void> {
  // A removed reaction whose count reached zero can no longer be fetched; the
  // message still can, and its count must still be updated on the starboard.
  if (reaction.partial) await reaction.fetch().catch(() => null);

  const message = reaction.message.partial
    ? await reaction.message.fetch().catch(() => null)
    : reaction.message;
  if (!message || !message.guild) return;

  const guildId = message.guild.id;
  const config = await getStarboardConfig(guildId);
  if (!config.enabled || !config.channelId) return;
  if (!starEmojiMatches(config.emoji, reaction.emoji.name, reaction.emoji.toString())) return;
  if (!message.author || message.author.bot) return;
  if (config.ignoredChannels.includes(message.channelId)) return;

  if (config.ignoredRoles.length) {
    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    if (member?.roles.cache.some((r) => config.ignoredRoles.includes(r.id))) return;
  }

  const starboardChannel = message.guild.channels.cache.get(config.channelId) as TextChannel | undefined;
  if (!starboardChannel || !starboardChannel.isTextBased() || isObfuscatedChannel(starboardChannel)) return;

  const guard = await starboardGuardMode(guildId, starboardChannel);
  const posted = await handleStarReaction(message as Message, guildId, config, starboardChannel, guard);
  // Discord may already have flagged the image on the post Aegis just made.
  if (posted && guard) await cleanFlaggedOwnPost(posted);
}

function listener(reaction: MessageReaction | PartialMessageReaction): void {
  serializeByKey(reaction.message.id, () => onStarReaction(reaction)).catch((err) =>
    logger.error("Starboard reaction handler failed:", err),
  );
}

export function registerStarboardEvents(client: Client): void {
  client.on(Events.MessageReactionAdd, listener);
  client.on(Events.MessageReactionRemove, listener);
  registerMediaSafetyEvents(client);
}
