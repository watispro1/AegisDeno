/**
 * Pure helpers for the community commands (giveaways, polls, suggestions,
 * starboard, welcome). Kept free of Discord and Mongo imports so they can be
 * unit-tested directly.
 */

import { randomInt } from "node:crypto";

// ─── Giveaways ───────────────────────────────────────────────────────────────

/** Random integer in [0, max). Injectable so draws can be tested deterministically. */
export type RandomIntFn = (max: number) => number;

export const MIN_BOOSTER_MULTIPLIER = 1;
export const MAX_BOOSTER_MULTIPLIER = 10;

/** Number of tickets an entrant gets: boosters get `multiplier`, everyone else one. */
export function entryWeight(userId: string, boosterIds: ReadonlySet<string>, multiplier: number): number {
  const m = Math.min(MAX_BOOSTER_MULTIPLIER, Math.max(MIN_BOOSTER_MULTIPLIER, Math.floor(multiplier || 1)));
  return boosterIds.has(userId) ? m : 1;
}

/**
 * Draw up to `count` distinct winners. Each entrant's chance on every draw is
 * proportional to their weight (booster bonus); a winner is removed before the
 * next draw so nobody wins twice. `exclude` drops previous winners on reroll.
 */
export function pickWeightedWinners(
  entrants: readonly string[],
  count: number,
  options: {
    boosterIds?: readonly string[];
    multiplier?: number;
    exclude?: readonly string[];
    rand?: RandomIntFn;
  } = {},
): string[] {
  const rand = options.rand ?? randomInt;
  const boosters = new Set(options.boosterIds ?? []);
  const excluded = new Set(options.exclude ?? []);
  const multiplier = options.multiplier ?? 1;

  const pool = [...new Set(entrants)]
    .filter(id => !excluded.has(id))
    .map(id => ({ id, weight: entryWeight(id, boosters, multiplier) }));

  const winners: string[] = [];
  const target = Math.max(0, Math.floor(count));
  while (winners.length < target && pool.length > 0) {
    const total = pool.reduce((sum, e) => sum + e.weight, 0);
    let ticket = rand(total);
    let idx = 0;
    for (; idx < pool.length; idx++) {
      if (ticket < pool[idx].weight) break;
      ticket -= pool[idx].weight;
    }
    const [won] = pool.splice(Math.min(idx, pool.length - 1), 1);
    winners.push(won.id);
  }
  return winners;
}

// ─── Polls ───────────────────────────────────────────────────────────────────

export const MAX_POLL_OPTIONS = 10;

/** Vote state: user ID → indices of the options they picked. */
export type PollVotes = Record<string, number[]>;

/**
 * Apply one button press to a user's current choices. Pressing a picked option
 * removes it; single-choice polls replace any previous pick.
 */
export function applyPollVote(
  current: readonly number[],
  optionIndex: number,
  multiselect: boolean,
): { choices: number[]; added: boolean } {
  if (current.includes(optionIndex)) {
    return { choices: current.filter(i => i !== optionIndex), added: false };
  }
  if (!multiselect) return { choices: [optionIndex], added: true };
  return { choices: [...current, optionIndex].sort((a, b) => a - b), added: true };
}

/**
 * Filter that matches a poll only while a user's stored picks are exactly
 * `current`, for compare-and-set vote updates. Missing, null and empty all mean
 * "no picks" (an empty array is never stored, but older documents may hold one).
 */
export function pollVoteGuard(userId: string, current: readonly number[]): Record<string, unknown> {
  const key = `votes.${userId}`;
  return current.length === 0 ? { [key]: { $in: [null, []] } } : { [key]: [...current] };
}

/** Discord's limit on an embed description. */
export const EMBED_DESCRIPTION_LIMIT = 4096;

/**
 * The closed-poll results text. Every option and its count is always shown;
 * if voter lists would push it past Discord's limit, fewer voters are listed
 * per option (with "+N more") until it fits, rather than cutting options off.
 */
export function renderPollResultsText(
  poll: { options: readonly string[]; anonymous: boolean; votes: Readonly<Record<string, readonly number[]>> },
  counts: readonly number[],
  totalVotes: number,
  verdict: string,
  emojis: readonly string[],
  limit = EMBED_DESCRIPTION_LIMIT,
): string {
  const voterIds = poll.options.map((_, i) =>
    poll.anonymous ? [] : Object.entries(poll.votes).filter(([, picks]) => picks.includes(i)).map(([uid]) => uid),
  );

  const build = (maxShown: number): string => {
    const lines = poll.options.map((opt, i) => {
      let line = `${emojis[i]} **${opt}** — ${counts[i]} vote${counts[i] !== 1 ? "s" : ""}\n\`${buildResultBar(counts[i], totalVotes)}\``;
      const who = voterIds[i];
      if (who.length > 0) {
        const shown = who.slice(0, maxShown).map((uid) => `<@${uid}>`);
        const rest = who.length - shown.length;
        const tail = rest > 0 ? `${shown.length ? " " : ""}+${rest} ${shown.length ? "more" : `voter${rest !== 1 ? "s" : ""}`}` : "";
        line += `\n${shown.join(" ")}${tail}`;
      }
      return line;
    });
    return `${verdict}\n\n${lines.join("\n\n")}`;
  };

  for (const maxShown of [15, 10, 5, 3, 1, 0]) {
    const text = build(maxShown);
    if (text.length <= limit) return text;
  }
  // Options alone cannot exceed the limit with today's caps (10 options of 80
  // characters), but never send Discord an invalid embed.
  return build(0).slice(0, limit);
}

export interface PollTally {
  /** Votes per option, by index. */
  counts: number[];
  /** Total option picks (a multi-select voter counts once per option). */
  totalVotes: number;
  /** Distinct users with at least one pick. */
  voters: number;
}

export function tallyPoll(votes: PollVotes, optionCount: number): PollTally {
  const counts = new Array<number>(optionCount).fill(0);
  let voters = 0;
  for (const choices of Object.values(votes)) {
    const valid = [...new Set(choices)].filter(i => Number.isInteger(i) && i >= 0 && i < optionCount);
    if (valid.length === 0) continue;
    voters++;
    for (const i of valid) counts[i]++;
  }
  return { counts, totalVotes: counts.reduce((a, b) => a + b, 0), voters };
}

/** Indices of the leading option(s); empty when nobody voted. Ties return all leaders. */
export function pollLeaders(counts: readonly number[]): number[] {
  const max = Math.max(0, ...counts);
  if (max === 0) return [];
  return counts.flatMap((c, i) => (c === max ? [i] : []));
}

/** Ten-cell text bar, e.g. `██████░░░░ 60%`. Percent is of `total`. */
export function buildResultBar(votes: number, total: number, width = 10): string {
  if (total <= 0) return `${"░".repeat(width)} 0%`;
  const pct = Math.round((votes / total) * 100);
  const filled = Math.min(width, Math.max(0, Math.round((pct / 100) * width)));
  return "█".repeat(filled) + "░".repeat(width - filled) + ` ${pct}%`;
}

// ─── Suggestions ─────────────────────────────────────────────────────────────

export type SuggestionStatus = "pending" | "approved" | "rejected" | "considered" | "archived";
export type SuggestionReviewAction = "approve" | "deny" | "consider";

export const REVIEW_TARGET: Record<SuggestionReviewAction, "approved" | "rejected" | "considered"> = {
  approve: "approved",
  deny: "rejected",
  consider: "considered",
};

/**
 * Whether a review action may move a suggestion from `current`. Approved,
 * rejected and archived are final; "consider" on an already-considered
 * suggestion is a no-op.
 */
export function reviewTransition(
  current: SuggestionStatus,
  action: SuggestionReviewAction,
): { ok: true; next: "approved" | "rejected" | "considered" } | { ok: false; reason: "final" | "unchanged" } {
  if (current === "approved" || current === "rejected" || current === "archived") return { ok: false, reason: "final" };
  const next = REVIEW_TARGET[action];
  if (current === next) return { ok: false, reason: "unchanged" };
  return { ok: true, next };
}

/** Voting stays open only while a suggestion is pending or under consideration. */
export function isSuggestionOpen(status: SuggestionStatus): boolean {
  return status === "pending" || status === "considered";
}

// ─── Starboard ───────────────────────────────────────────────────────────────

/**
 * Stars that count toward the threshold. When self-starring is off, the
 * author's own reaction is not counted.
 */
/** Whether a reaction's emoji is the configured starboard emoji (unicode name or `<:custom:id>` form). */
export function starEmojiMatches(configured: string, emojiName: string | null, emojiString: string): boolean {
  return (emojiName ?? emojiString) === configured || emojiString === configured;
}

export function effectiveStarCount(rawCount: number, authorReacted: boolean, selfStarAllowed: boolean): number {
  const n = Math.max(0, rawCount);
  return !selfStarAllowed && authorReacted ? Math.max(0, n - 1) : n;
}

export interface MediaAttachment {
  url: string;
  name?: string | null;
  contentType?: string | null;
  spoiler?: boolean;
}

export interface MediaEmbed {
  title?: string | null;
  description?: string | null;
  url?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
}

export interface StarboardMedia {
  /** Image to show in the starboard embed, if any. */
  imageUrl: string | null;
  /** Other files (videos, documents, extra images) to list as links. */
  extraFiles: { name: string; url: string }[];
  /** Text to use when the message has no content of its own (from its first embed). */
  fallbackText: string | null;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif)$/i;

export function isImageAttachment(a: MediaAttachment): boolean {
  if (a.contentType) return a.contentType.toLowerCase().startsWith("image/");
  const path = (a.name ?? a.url).split("?")[0];
  return IMAGE_EXT.test(path);
}

/**
 * Decide what a starboard post shows for a message's attachments and embeds:
 * the first non-spoiler image attachment wins, then an embed image or
 * thumbnail; everything else is listed as a link.
 */
export function pickStarboardMedia(
  content: string | null | undefined,
  attachments: readonly MediaAttachment[],
  embeds: readonly MediaEmbed[],
): StarboardMedia {
  let imageUrl: string | null = null;
  const extraFiles: { name: string; url: string }[] = [];

  for (const a of attachments) {
    if (!imageUrl && !a.spoiler && isImageAttachment(a)) {
      imageUrl = a.url;
      continue;
    }
    extraFiles.push({ name: a.spoiler ? `SPOILER: ${a.name ?? "file"}` : (a.name ?? "file"), url: a.url });
  }

  if (!imageUrl) {
    for (const e of embeds) {
      const url = e.imageUrl ?? e.thumbnailUrl ?? null;
      if (url) { imageUrl = url; break; }
    }
  }

  let fallbackText: string | null = null;
  if (!content?.trim()) {
    const e = embeds.find(x => x.title || x.description);
    if (e) {
      const title = e.title ? (e.url ? `**[${e.title}](${e.url})**` : `**${e.title}**`) : "";
      fallbackText = [title, e.description ?? ""].filter(Boolean).join("\n").slice(0, 4000) || null;
    }
  }

  return { imageUrl, extraFiles, fallbackText };
}

// ─── Welcome ─────────────────────────────────────────────────────────────────

export const WELCOME_VARIABLES = ["{user}", "{username}", "{server}", "{count}", "{member_count}", "{memberCount}"] as const;

export interface WelcomeContext {
  userId: string;
  username: string;
  serverName: string;
  memberCount: number | null;
}

/** Fill `{user}`, `{username}`, `{server}` and `{count}` (aliases `{member_count}`, `{memberCount}`). */
export function renderWelcomeTemplate(template: string, ctx: WelcomeContext): string {
  const count = ctx.memberCount == null ? "?" : String(ctx.memberCount);
  const values: Record<string, string> = {
    user: `<@${ctx.userId}>`,
    username: ctx.username,
    server: ctx.serverName,
    count,
    member_count: count,
    memberCount: count,
  };
  // Single pass, so a username or server name containing "{server}" is not re-expanded.
  return template.replace(/\{(user|username|server|count|member_count|memberCount)\}/g, (_, key: string) => values[key]);
}
