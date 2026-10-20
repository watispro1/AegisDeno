/**
 * Starboard Service
 *
 * Handles all MongoDB interactions for the Starboard plugin:
 *  - Guild configuration (channel, emoji, threshold, ignored lists)
 *  - Tracking which messages have already been posted to the starboard
 *  - Building the Discord embed for a starred message
 */

import {
  EmbedBuilder,
  type Message,
  type TextChannel,
  type NewsChannel,
  type ThreadChannel,
} from "discord.js";
import {
  StarboardConfigModel,
  StarboardEntryModel,
} from "../database/mongo";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StarboardConfig {
  guildId: string;
  channelId: string | null;
  emoji: string;
  threshold: number;
  selfStar: boolean;
  ignoredChannels: string[];
  ignoredRoles: string[];
  enabled: boolean;
}

// ─── Config helpers ───────────────────────────────────────────────────────────

/** Fetch the starboard config for a guild, creating defaults if it doesn't exist yet. */
export async function getStarboardConfig(guildId: string): Promise<StarboardConfig> {
  const doc = await StarboardConfigModel.findOne({ guildId }).lean();
  if (doc) return doc as StarboardConfig;

  // Return the defaults without persisting — a record is only saved when the
  // server owner actually configures something via /starboard setup.
  return {
    guildId,
    channelId: null,
    emoji: "⭐",
    threshold: 3,
    selfStar: false,
    ignoredChannels: [],
    ignoredRoles: [],
    enabled: true,
  };
}

/** Upsert a partial update to a guild's starboard configuration. */
export async function updateStarboardConfig(
  guildId: string,
  patch: Partial<Omit<StarboardConfig, "guildId">>,
): Promise<StarboardConfig> {
  const doc = await StarboardConfigModel.findOneAndUpdate(
    { guildId },
    { ...patch, updatedAt: new Date() },
    { upsert: true, new: true },
  ).lean();
  return doc as StarboardConfig;
}

// ─── Entry helpers ────────────────────────────────────────────────────────────

/** Check if a message has already been posted to the starboard. */
export async function getStarboardEntry(guildId: string, sourceMessageId: string) {
  return StarboardEntryModel.findOne({ guildId, sourceMessageId }).lean();
}

/** Create a new starboard entry after posting the embed. */
export async function createStarboardEntry(data: {
  guildId: string;
  sourceChannelId: string;
  sourceMessageId: string;
  authorId: string;
  starboardMessageId: string;
  starCount: number;
}) {
  return StarboardEntryModel.create(data);
}

/** Update the star count on an existing entry. */
export async function updateStarCount(
  guildId: string,
  sourceMessageId: string,
  starCount: number,
) {
  return StarboardEntryModel.findOneAndUpdate(
    { guildId, sourceMessageId },
    { starCount },
    { new: true },
  ).lean();
}

/** Return the most recent N starboard entries for a guild (for /starboard list). */
export async function listStarboardEntries(guildId: string, limit = 10) {
  return StarboardEntryModel.find({ guildId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

// ─── Embed builder ────────────────────────────────────────────────────────────

/** Build the Discord embed posted to the starboard channel. */
export function buildStarboardEmbed(
  message: Message,
  starCount: number,
  emoji: string,
): { content: string; embeds: EmbedBuilder[] } {
  const author = message.author;
  const channel = message.channel as TextChannel | NewsChannel | ThreadChannel;

  const embed = new EmbedBuilder()
    .setColor(0xffd700) // gold
    .setAuthor({
      name: author.tag,
      iconURL: author.displayAvatarURL({ size: 64 }),
    })
    .setDescription(message.content || null)
    .setTimestamp(message.createdAt)
    .setFooter({ text: `#${"name" in channel ? channel.name : "unknown"}  ·  ID: ${message.id}` });

  // Attach the first image attachment or embed image, if any
  const attachment = message.attachments.find((a) =>
    /\.(png|jpg|jpeg|gif|webp)$/i.test(a.name ?? ""),
  );
  if (attachment) embed.setImage(attachment.url);
  else if (message.embeds[0]?.image?.url) embed.setImage(message.embeds[0].image.url);

  const content = `${emoji} **${starCount}** — <#${message.channelId}> [Jump to message](${message.url})`;

  return { content, embeds: [embed] };
}

// ─── Reaction logic ───────────────────────────────────────────────────────────

/**
 * Core handler — called whenever a reaction is added or removed.
 *
 * @param message  The full (fetched) message that was reacted to.
 * @param guildId  The guild the reaction occurred in.
 * @param config   The guild's starboard config.
 * @param starboardChannel  The resolved TextChannel to post to.
 */
export async function handleStarReaction(
  message: Message,
  guildId: string,
  config: StarboardConfig,
  starboardChannel: TextChannel,
): Promise<void> {
  if (!config.channelId || !config.enabled) return;

  // Count reactions matching the configured emoji
  const reaction = message.reactions.cache.find(
    (r) => r.emoji.name === config.emoji || r.emoji.toString() === config.emoji,
  );
  const count = reaction ? reaction.count : 0;

  // Ignore self-stars if not allowed
  if (!config.selfStar && reaction) {
    const reactors = await reaction.users.fetch();
    const selfStarred = reactors.has(message.author.id);
    const effectiveCount = selfStarred ? count - 1 : count;
    if (effectiveCount < config.threshold) {
      return;
    }
  } else if (count < config.threshold) {
    return;
  }

  const existing = await getStarboardEntry(guildId, message.id);

  if (existing) {
    // Update the count on the already-posted embed
    const starboardMsg = await starboardChannel.messages
      .fetch(existing.starboardMessageId)
      .catch(() => null);

    if (starboardMsg) {
      const { content } = buildStarboardEmbed(message, count, config.emoji);
      await starboardMsg.edit({ content }).catch(() => null);
    }
    await updateStarCount(guildId, message.id, count);
  } else {
    // Post a new starboard embed
    const { content, embeds } = buildStarboardEmbed(message, count, config.emoji);
    const posted = await starboardChannel.send({ content, embeds }).catch(() => null);
    if (!posted) return;

    await createStarboardEntry({
      guildId,
      sourceChannelId: message.channelId,
      sourceMessageId: message.id,
      authorId: message.author.id,
      starboardMessageId: posted.id,
      starCount: count,
    });
  }
}
