/** Mongo reads for /starboard top and the dashboard's "Top posts" list. */
import type { PipelineStage } from "mongoose";
import { StarboardEntryModel } from "../database/mongo";
import {
  STARBOARD_TOP_AUTHORS,
  STARBOARD_TOP_LIMIT,
  compareAuthors,
  compareTopEntries,
  periodStart,
  storedExcerpt,
  type StarboardTopAuthor,
  type StarboardTopEntry,
  type StarboardTopPeriod,
} from "./starboardTop";

export interface StarboardTopQuery {
  period: StarboardTopPeriod;
  authorId?: string | null;
  limit?: number;
  now?: Date;
}

/** The Mongo filter for a guild, period and optional author. */
export function topFilter(guildId: string, q: StarboardTopQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = { guildId: String(guildId) };
  if (q.authorId) filter.authorId = String(q.authorId);
  const start = periodStart(q.period, q.now);
  if (start) filter.createdAt = { $gte: start };
  return filter;
}

function toEntry(doc: Record<string, unknown>): StarboardTopEntry {
  return {
    sourceChannelId: String(doc.sourceChannelId ?? ""),
    sourceMessageId: String(doc.sourceMessageId ?? ""),
    authorId: String(doc.authorId ?? ""),
    starboardMessageId: String(doc.starboardMessageId ?? ""),
    starboardChannelId: typeof doc.starboardChannelId === "string" ? doc.starboardChannelId : null,
    starCount: Number(doc.starCount ?? 0),
    excerpt: typeof doc.excerpt === "string" ? doc.excerpt : null,
    createdAt: doc.createdAt ? new Date(doc.createdAt as string) : new Date(0),
  };
}

/**
 * Top entries by star count. Served by the { guildId, starCount, createdAt }
 * index (or the author variant), so Mongo reads at most `limit` matches in order.
 */
export async function findTopStarboardEntries(guildId: string, q: StarboardTopQuery): Promise<StarboardTopEntry[]> {
  const limit = Math.max(1, Math.min(q.limit ?? STARBOARD_TOP_LIMIT, 25));
  const docs = await StarboardEntryModel.find(topFilter(guildId, q))
    .select("-_id sourceChannelId sourceMessageId authorId starboardMessageId starboardChannelId starCount excerpt createdAt")
    .sort({ starCount: -1, createdAt: 1 })
    .limit(limit)
    .lean();
  return (docs as Record<string, unknown>[]).map(toEntry).sort(compareTopEntries);
}

/** Members with the most total stars in the period. */
export async function findTopStarboardAuthors(guildId: string, q: StarboardTopQuery, limit = STARBOARD_TOP_AUTHORS): Promise<StarboardTopAuthor[]> {
  const pipeline: PipelineStage[] = [
    { $match: topFilter(guildId, q) },
    { $group: { _id: "$authorId", stars: { $sum: "$starCount" }, posts: { $sum: 1 } } },
    { $sort: { stars: -1, posts: -1, _id: 1 } },
    { $limit: limit },
  ];
  const rows = await StarboardEntryModel.aggregate<{ _id: string; stars: number; posts: number }>(pipeline);
  return rows.map(r => ({ authorId: String(r._id), stars: Number(r.stars) || 0, posts: Number(r.posts) || 0 })).sort(compareAuthors);
}

/**
 * Fills in excerpts for entries saved before excerpts were stored, using
 * `fetchText` (which returns null for a channel Aegis cannot see or a deleted
 * message). Found text is saved so the next look-up skips Discord.
 */
export async function fillMissingExcerpts(
  guildId: string,
  entries: StarboardTopEntry[],
  fetchText: (channelId: string, messageId: string) => Promise<string | null>,
): Promise<StarboardTopEntry[]> {
  await Promise.all(entries.map(async (e) => {
    if (e.excerpt !== null && e.excerpt !== undefined) return;
    const text = await fetchText(e.sourceChannelId, e.sourceMessageId).catch(() => null);
    if (text === null) return;
    e.excerpt = storedExcerpt(text);
    await StarboardEntryModel.updateOne({ guildId: String(guildId), sourceMessageId: e.sourceMessageId }, { excerpt: e.excerpt }).catch(() => null);
  }));
  return entries;
}
