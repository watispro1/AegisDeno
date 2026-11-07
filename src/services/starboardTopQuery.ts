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

/** What a look-up of a starred message's text found. */
export type ExcerptLookup = { kind: "text"; text: string } | { kind: "gone" } | { kind: "unknown" };

/**
 * The excerpt to save for a look-up, or null to leave the entry alone. A
 * deleted message is saved as "" so later loads stop asking Discord for it.
 */
export function excerptToStore(found: ExcerptLookup): string | null {
  if (found.kind === "text") return storedExcerpt(found.text);
  if (found.kind === "gone") return "";
  return null;
}

type ExcerptSaver = (guildId: string, sourceMessageId: string, excerpt: string) => Promise<unknown>;

const saveExcerpt: ExcerptSaver = (guildId, sourceMessageId, excerpt) =>
  StarboardEntryModel.updateOne({ guildId: String(guildId), sourceMessageId }, { excerpt });

/**
 * Fills in excerpts for entries saved before excerpts were stored, using
 * `fetchText`. Found text, or "" for a deleted message, is saved so the next
 * look-up skips Discord; a hidden channel or failed request is left for later.
 */
export async function fillMissingExcerpts(
  guildId: string,
  entries: StarboardTopEntry[],
  fetchText: (channelId: string, messageId: string) => Promise<ExcerptLookup>,
  save: ExcerptSaver = saveExcerpt,
): Promise<StarboardTopEntry[]> {
  await Promise.all(entries.map(async (e) => {
    if (e.excerpt !== null && e.excerpt !== undefined) return;
    const found = await fetchText(e.sourceChannelId, e.sourceMessageId).catch((): ExcerptLookup => ({ kind: "unknown" }));
    const excerpt = excerptToStore(found);
    if (excerpt === null) return;
    e.excerpt = excerpt;
    await save(guildId, e.sourceMessageId, excerpt).catch(() => null);
  }));
  return entries;
}
