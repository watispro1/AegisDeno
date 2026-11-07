/**
 * Keeps media Discord flagged off the starboard after a post exists: when the
 * source message is flagged late, and when Discord flags the starboard post
 * itself. An edit that fails falls back to deleting the post.
 */
import type { Message } from "discord.js";
import { getGuildConfig } from "./configuration";
import { channelIsNsfw, guardModeFor, summarizeFlaggedMedia, type MediaSafetyMode } from "./mediaSafety";
import { repostShowsMedia, stripEmbedMedia } from "./mediaSafetyRepost";
import { buildStarboardEmbed, flaggedSourceUrls } from "./starboard";
import { logger } from "../utils/logger";

/** The guard mode for a starboard channel in a guild, or null to post media as usual. */
export async function starboardGuardMode(guildId: string, starboardChannel: unknown): Promise<MediaSafetyMode | null> {
  const cfg = await getGuildConfig(guildId);
  return guardModeFor(cfg.mediaSafety, channelIsNsfw(starboardChannel));
}

async function editOrDelete(post: Message, edit: () => Promise<unknown>, what: string): Promise<"edited" | "deleted" | "failed"> {
  try {
    await edit();
    return "edited";
  } catch (err) {
    logger.warn(`Media safety: could not edit ${what} ${post.id}, deleting it instead:`, err);
    const gone = await post.delete().then(() => true, () => false);
    return gone ? "deleted" : "failed";
  }
}

/**
 * The source message's media is now flagged: rebuild the starboard post
 * without it, unless the post already leaves it out.
 */
export async function cleanStarboardRepost(
  source: Message,
  post: Message,
  starCount: number,
  emoji: string,
  mode: MediaSafetyMode,
): Promise<"edited" | "deleted" | "failed" | "unchanged"> {
  const urls = flaggedSourceUrls(source);
  if (!repostShowsMedia(post.embeds.map(e => e.data), urls)) return "unchanged";
  const rebuilt = buildStarboardEmbed(source, starCount, emoji, mode);
  return editOrDelete(post, () => post.edit({ embeds: rebuilt.embeds }), "starboard post");
}

/**
 * Discord flagged an embed on a post Aegis made: drop that embed's image and
 * thumbnail and say why. Returns "unchanged" when nothing on it is flagged.
 */
export async function cleanFlaggedOwnPost(post: Message): Promise<"edited" | "deleted" | "failed" | "unchanged"> {
  const summary = summarizeFlaggedMedia(post);
  const targets = summary.embeds.filter(i => post.embeds[i]?.image || post.embeds[i]?.thumbnail);
  if (!targets.length) return "unchanged";
  const embeds = post.embeds.map((e, i) => (targets.includes(i) ? stripEmbedMedia({ ...e.data }, summary.reasons) : e.data));
  return editOrDelete(post, () => post.edit({ embeds }), "flagged post");
}
