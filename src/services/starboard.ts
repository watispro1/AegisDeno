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
import { softFail } from "../utils/softFail";
import { storedExcerpt } from "./starboardTop";
import { attachmentFlagReasons, embedFlagReasons, type MediaSafetyMode } from "./mediaSafety";
import { HIDDEN_MEDIA_FIELD, guardStarboardMedia, hiddenMediaFieldValue, repostShowsMedia } from "./mediaSafetyRepost";

// Types

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

// Config helpers

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

  // Not persisted: a record is only saved once /starboard setup runs.
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

// Entry helpers

/** Check if a message has already been posted to the starboard. */
export async function getStarboardEntry(guildId: string, sourceMessageId: string) {
  return StarboardEntryModel.findOne({ guildId, sourceMessageId }).lean();
}

/** Whether a message has a starboard post, without loading the entry. */
export async function starboardEntryExists(guildId: string, sourceMessageId: string): Promise<boolean> {
  return Boolean(await StarboardEntryModel.exists({ guildId, sourceMessageId }));
}

/** Create a new starboard entry after posting the embed. */
export async function createStarboardEntry(data: {
  guildId: string;
  sourceChannelId: string;
  sourceMessageId: string;
  authorId: string;
  starboardMessageId: string;
  starboardChannelId?: string | null;
  starCount: number;
  excerpt?: string | null;
}) {
  return StarboardEntryModel.create(data);
}

/** Update the star count on an existing entry. */
export async function updateStarCount(
  guildId: string,
  sourceMessageId: string,
  starCount: number,
  excerpt?: string,
) {
  return StarboardEntryModel.findOneAndUpdate(
    { guildId, sourceMessageId },
    excerpt === undefined ? { starCount } : { starCount, excerpt },
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

// Embed builder

/**
 * Build the Discord embed posted to the starboard channel. With a guard mode,
 * media Discord flagged is left out and listed under "Hidden media" instead.
 */
export function buildStarboardEmbed(
  message: Message,
  starCount: number,
  emoji: string,
  guard: MediaSafetyMode | null = null,
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
  const guarded = guardStarboardMedia(
    [...message.attachments.values()].map((a) => ({
      url: a.url,
      name: a.name,
      contentType: a.contentType,
      spoiler: a.spoiler,
      reasons: attachmentFlagReasons(a),
    })),
    message.embeds.map((e) => ({
      title: e.title,
      description: e.description,
      url: e.url,
      imageUrl: e.image?.url ?? null,
      thumbnailUrl: e.thumbnail?.url ?? null,
      reasons: embedFlagReasons(e),
    })),
    guard,
  );
  const media = pickStarboardMedia(message.content, guarded.attachments, guarded.embeds);

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
  if (guarded.notes.length) {
    embed.addFields({ name: HIDDEN_MEDIA_FIELD, value: hiddenMediaFieldValue(guarded.notes), inline: false });
  }

  const content = `${emoji} **${starCount}** — <#${message.channelId}> [Jump to message](${message.url})`;

  return { content, embeds: [embed] };
}

/** The text /starboard top shows for a message: its content, else its first embed's text. */
export function messageExcerpt(message: Pick<Message, "content" | "embeds">): string {
  const embed = message.embeds[0];
  return storedExcerpt(message.content || embed?.description || embed?.title || "");
}

// Reaction logic

/**
 * Runs on every reaction add or remove. `message` must already be fetched
 * (not partial).
 */
export async function handleStarReaction(
  message: Message,
  guildId: string,
  config: StarboardConfig,
  starboardChannel: TextChannel,
  guard: MediaSafetyMode | null = null,
): Promise<Message | null> {
  if (!config.channelId || !config.enabled) return null;

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
  if (!existing && count < config.threshold) return null;

  if (existing) {
    // Keep an already-posted entry's count accurate, even if it drops below the threshold.
    const starboardMsg = await starboardChannel.messages
      .fetch(existing.starboardMessageId)
      .catch(() => null);

    if (starboardMsg) {
      const built = buildStarboardEmbed(message, count, config.emoji, guard);
      // Media flagged since the post was made comes off it with this edit.
      const flagged = guard ? flaggedSourceUrls(message) : [];
      const reEmbed = flagged.length > 0 && repostShowsMedia(starboardMsg.embeds.map((e) => e.data), flagged);
      await starboardMsg.edit(reEmbed ? { content: built.content, embeds: built.embeds } : { content: built.content }).catch(() => null);
    }
    await updateStarCount(guildId, message.id, count, existing.excerpt ? undefined : messageExcerpt(message));
    return null;
  } else {
    const { content, embeds } = buildStarboardEmbed(message, count, config.emoji, guard);
    const posted = await starboardChannel.send({ content, embeds }).catch(softFail(`Starboard post in guild ${guildId}`));
    if (!posted) return null;

    await createStarboardEntry({
      guildId,
      sourceChannelId: message.channelId,
      sourceMessageId: message.id,
      authorId: message.author.id,
      starboardMessageId: posted.id,
      starboardChannelId: starboardChannel.id,
      starCount: count,
      excerpt: messageExcerpt(message),
    });
    return posted;
  }
}

/** URLs of the flagged attachments and embed media on a message. */
export function flaggedSourceUrls(message: Pick<Message, "attachments" | "embeds">): string[] {
  const urls: (string | null | undefined)[] = [];
  for (const a of message.attachments.values()) if (attachmentFlagReasons(a).length) urls.push(a.url);
  for (const e of message.embeds) if (embedFlagReasons(e).length) urls.push(e.image?.url, e.thumbnail?.url);
  return urls.filter((u): u is string => typeof u === "string" && u.length > 0);
}
