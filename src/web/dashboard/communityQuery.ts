/**
 * Pure helpers behind the Giveaways, Polls and Suggestions pages: query-string
 * parsing, the Mongo match and pipeline for the suggestion list, the matching
 * in-memory sort, and poll tallies with percentages. Kept free of Discord and
 * Mongo so they can be unit tested.
 */
import { escapeRegex } from "../../utils/mongoSafe";
import { tallyPoll, type PollVotes } from "../../services/communityLogic";
import type { SuggestionFilter, SuggestionRow } from "./moduleData";
import { parseSuggestionFilter } from "./moduleValidation";

/* Suggestions: search, sort and status */

export type SuggestionSort = "newest" | "oldest" | "up" | "down";
export const SUGGESTION_SORTS: readonly SuggestionSort[] = ["newest", "oldest", "up", "down"];
export const SUGGESTION_SORT_LABELS: Record<SuggestionSort, string> = {
  newest: "Newest first", oldest: "Oldest first", up: "Most upvoted", down: "Most downvoted",
};
export const SUGGESTION_SEARCH_MAX = 100;

export interface SuggestionQuery {
  filter: SuggestionFilter;
  page: number;
  /** Plain text to look for in the suggestion body; empty means no search. */
  q: string;
  sort: SuggestionSort;
}

/**
 * The search box value. Only a single string counts (a repeated `q` or a
 * bracketed object is ignored); control characters are dropped and the
 * result is trimmed and capped.
 */
export function suggestionSearchText(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, SUGGESTION_SEARCH_MAX);
}

export function parseSuggestionSort(raw: unknown): SuggestionSort {
  return typeof raw === "string" && (SUGGESTION_SORTS as readonly string[]).includes(raw) ? raw as SuggestionSort : "newest";
}

/** Everything the Suggestions page reads from its query string, validated. */
export function parseSuggestionQuery(query: Record<string, unknown>): SuggestionQuery {
  const { filter, page } = parseSuggestionFilter(query);
  return { filter, page, q: suggestionSearchText(query.q), sort: parseSuggestionSort(query.sort) };
}

/**
 * The query string for a link on the Suggestions page. Defaults are left out
 * so the plain page keeps its short URL.
 */
export function suggestionQueryString(q: Pick<SuggestionQuery, "filter" | "q" | "sort">, page = 1): string {
  const params = new URLSearchParams();
  params.set("status", q.filter);
  if (q.q) params.set("q", q.q);
  if (q.sort !== "newest") params.set("sort", q.sort);
  if (page > 1) params.set("page", String(page));
  return `?${params.toString()}`;
}

const OPEN_STATUSES = ["pending", "considered"];

/**
 * The Mongo filter for one server's suggestions. The status comes from a fixed
 * list and the search text is regex-escaped, so nothing the visitor typed can
 * become an operator or a pattern.
 */
export function suggestionMatch(guildId: string, filter: SuggestionFilter, q: string): Record<string, unknown> {
  const match: Record<string, unknown> = { guildId };
  if (filter === "open") match.status = { $in: OPEN_STATUSES };
  else if (filter !== "all") match.status = filter;
  const text = suggestionSearchText(q);
  if (text) match.content = { $regex: escapeRegex(text), $options: "i" };
  return match;
}

/** Sort stage for each order. Ties fall back to newest first, then _id, so paging is stable. */
export function suggestionSortStage(sort: SuggestionSort): Record<string, 1 | -1> {
  switch (sort) {
    case "oldest": return { createdAt: 1, _id: 1 };
    case "up": return { upCount: -1, createdAt: -1, _id: -1 };
    case "down": return { downCount: -1, createdAt: -1, _id: -1 };
    default: return { createdAt: -1, _id: -1 };
  }
}

/** Aggregation pipeline for one page of suggestions. Vote counts are the lengths of the voter arrays. */
export function suggestionPipeline(match: Record<string, unknown>, sort: SuggestionSort, page: number, perPage: number): Array<Record<string, unknown>> {
  const stages: Array<Record<string, unknown>> = [{ $match: match }];
  if (sort === "up" || sort === "down") {
    stages.push({ $addFields: {
      upCount: { $size: { $ifNull: ["$upvotes", []] } },
      downCount: { $size: { $ifNull: ["$downvotes", []] } },
    } });
  }
  stages.push({ $sort: suggestionSortStage(sort) }, { $skip: (Math.max(1, page) - 1) * perPage }, { $limit: perPage });
  return stages;
}

/** The in-memory equivalent of suggestionMatch + suggestionSortStage (tests and previews). */
export function filterAndSortSuggestions(rows: readonly SuggestionRow[], q: Pick<SuggestionQuery, "filter" | "q" | "sort">): SuggestionRow[] {
  const text = suggestionSearchText(q.q).toLowerCase();
  const kept = rows.filter(s =>
    (q.filter === "all" ? true : q.filter === "open" ? OPEN_STATUSES.includes(s.status) : s.status === q.filter)
    && (!text || s.content.toLowerCase().includes(text)));
  const newest = (a: SuggestionRow, b: SuggestionRow) => b.createdAt.getTime() - a.createdAt.getTime();
  const order: Record<SuggestionSort, (a: SuggestionRow, b: SuggestionRow) => number> = {
    newest,
    oldest: (a, b) => -newest(a, b),
    up: (a, b) => b.up - a.up || newest(a, b),
    down: (a, b) => b.down - a.down || newest(a, b),
  };
  return [...kept].sort(order[q.sort]);
}

/* Polls */

export const POLLS_SHOWN = 25;

export interface PollOptionView { label: string; votes: number; percent: number }

export interface PollRow {
  messageId: string;
  channelId: string;
  creatorId: string;
  question: string;
  options: PollOptionView[];
  totalVotes: number;
  voters: number;
  multiselect: boolean;
  anonymous: boolean;
  ended: boolean;
  createdAt: Date;
  endsAt: Date | null;
}

/** Share of all votes, rounded to a whole percent the same way the poll embed's bars are. */
export function pollPercent(votes: number, total: number): number {
  if (!Number.isFinite(votes) || !Number.isFinite(total) || total <= 0 || votes <= 0) return 0;
  return Math.min(100, Math.round((votes / total) * 100));
}

export function formatPollPercent(percent: number): string {
  return `${Math.max(0, Math.min(100, Math.round(percent)))}%`;
}

/** Vote counts and percentages per option from a stored poll's `votes` map. */
export function pollOptionViews(options: readonly string[], votes: PollVotes | null | undefined): { options: PollOptionView[]; totalVotes: number; voters: number } {
  const { counts, totalVotes, voters } = tallyPoll(votes ?? {}, options.length);
  return {
    options: options.map((label, i) => ({ label, votes: counts[i], percent: pollPercent(counts[i], totalVotes) })),
    totalVotes,
    voters,
  };
}

/** A stored poll document (as read with .lean()) shaped for the page. */
export function toPollRow(d: Record<string, unknown>): PollRow {
  const options = Array.isArray(d.options) ? d.options.map(o => String(o)) : [];
  const tally = pollOptionViews(options, (d.votes && typeof d.votes === "object" ? d.votes : {}) as PollVotes);
  return {
    messageId: String(d.messageId ?? ""),
    channelId: String(d.channelId ?? ""),
    creatorId: String(d.creatorId ?? ""),
    question: String(d.question ?? ""),
    ...tally,
    multiselect: d.multiselect === true,
    anonymous: d.anonymous === true,
    ended: d.ended === true,
    createdAt: new Date((d.createdAt as Date | string | number | undefined) ?? 0),
    endsAt: d.endsAt ? new Date(d.endsAt as Date | string | number) : null,
  };
}

/**
 * Channels whose polls the viewer may see: ones Aegis can see and, when the
 * viewer's own access is known, ones the viewer can open too.
 */
export function pollChannelIds(aegisChannelIds: Iterable<string>, hidden: ReadonlySet<string>, viewerChannelIds: ReadonlySet<string> | null): string[] {
  return [...new Set(aegisChannelIds)].filter(id => !hidden.has(id) && (viewerChannelIds === null || viewerChannelIds.has(id)));
}

/** Drops polls posted outside the allowed channels. */
export function visiblePolls(rows: readonly PollRow[], allowedChannelIds: readonly string[]): PollRow[] {
  const allowed = new Set(allowedChannelIds);
  return rows.filter(p => allowed.has(p.channelId));
}

/** Link to a message in Discord, or null when any ID is not a snowflake. */
export function messageJumpUrl(guildId: string, channelId: string, messageId: string): string | null {
  const ok = (id: string) => /^\d{17,20}$/.test(id);
  return ok(guildId) && ok(channelId) && ok(messageId) ? `https://discord.com/channels/${guildId}/${channelId}/${messageId}` : null;
}

/* Giveaways */

/** The Cancel form must carry its confirm tick; anything else is refused. */
export function cancelConfirmed(body: Record<string, unknown>): boolean {
  return body.confirm === "yes";
}
