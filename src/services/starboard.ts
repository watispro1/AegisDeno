/**
 * Starboard Service
 *
 * Handles all MongoDB interactions for the starboard:
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
import { effectiveStarCount, pickStarboardMedia } from "./communityLogic";
import { TtlCache } from "../utils/ttlCache";
import { channelDisplayName } from "../utils/channels";

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

/** Read on every reaction in every channel, so cached; updateStarboardConfig refreshes it. */
const configCache = new TtlCache<StarboardConfig>(60_000);

/** Fetch the starboard config for a guild, or the defaults if none is saved yet. */
export async function getStarboardConfig(guildId: string): Promise<StarboardConfig> {
  return structuredClone(await configCache.getOrLoad(guildId, () => loadStarboardConfig(guildId)));
}

async function loadStarboardConfig(guildId: string): Promise<StarboardConfig> {
  const doc = await StarboardConfigModel.findOne({ guildId })
    .select("-_id guildId channelId emoji threshold selfStar ignoredChannels ignoredRoles enabled")
    .lean();
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
  configCache.delete(guildId);
  const doc = await StarboardConfigModel.findOneAndUpdate(
    { guildId },
    { ...patch, updatedAt: new Date() },
    { upsert: true, new: true },
  ).lean();
  configCache.delete(guildId);
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
    .setTimestamp(message.createdAt)
    .setFooter({ text: `#${channelDisplayName(channel)}  ·  ID: ${message.id}` });

  // Pick the image to show (first non-spoiler image attachment, else an embed
  // image/thumbnail), list other files as links, and fall back to the source
  // embed's text when the message itself has none (bot posts, link previews).
  const media = pickStarboardMedia(
    message.content,
    [...message.attachments.values()].map((a) => ({
      url: a.url,
      name: a.name,
      contentType: a.contentType,
      spoiler: a.spoiler,
    })),
    message.embeds.map((e) => ({
      title: e.title,
      description: e.description,
      url: e.url,
      imageUrl: e.image?.url ?? null,
      thumbnailUrl: e.thumbnail?.url ?? null,
    })),
  );

  const text = (message.content || media.fallbackText || "").slice(0, 4096);
  if (text) embed.setDescription(text);
  if (media.imageUrl) embed.setImage(media.imageUrl);
  if (media.extraFiles.length) {
    const links: string[] = [];
    let used = 0;
    for (const f of media.extraFiles) {
      const line = `[${f.name.replace(/[[\]]/g, "")}](${f.url})`;
      if (used + line.length + 1 > 1000) { links.push(`…and ${media.extraFiles.length - links.length} more`); break; }
      links.push(line);
      used += line.length + 1;
    }
    embed.addFields({ name: "📎 Attachments", value: links.join("\n"), inline: false });
  }

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
  const rawCount = reaction ? reaction.count : 0;

  // The author's own star never counts (toward the threshold or the shown
  // total) unless self-starring is enabled.
  let authorReacted = false;
  if (!config.selfStar && reaction) {
    const reactors = await reaction.users.fetch().catch(() => null);
    authorReacted = Boolean(reactors?.has(message.author.id));
  }
  const count = effectiveStarCount(rawCount, authorReacted, config.selfStar);

  const existing = await getStarboardEntry(guildId, message.id);
  if (!existing && count < config.threshold) return;

  if (existing) {
    // Keep an already-posted entry's count accurate, even if it drops below the threshold.
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
