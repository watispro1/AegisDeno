/**
 * Pure selection logic for /purge. The command maps discord.js messages to
 * PurgeCandidate objects so this file can be unit-tested without Discord.
 */

export type PurgeFilterMode = "all" | "bots" | "humans" | "links" | "images" | "embeds" | "keyword" | "attachments" | "invites" | "mentions" | "stickers";

/** Every mode, in the order /purge offers them. */
export const PURGE_FILTER_MODES: readonly PurgeFilterMode[] = ["all", "bots", "humans", "links", "invites", "images", "attachments", "embeds", "mentions", "stickers", "keyword"];

/** Purges of more matches than this show a preview and need a confirm click. */
export const PURGE_CONFIRM_ABOVE = 10;

/** Whether a purge of `count` matches must be confirmed first. `forcePreview` always asks. */
export function needsPurgeConfirmation(count: number, forcePreview: boolean, threshold = PURGE_CONFIRM_ABOVE): boolean {
  return forcePreview || count > threshold;
}

/** Discord refuses to bulk-delete messages older than 14 days. Keep a 1-minute safety margin. */
export const BULK_DELETE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000 - 60_000;

/** Discord's bulk-delete endpoint takes 2–100 messages per call. */
export const BULK_DELETE_CHUNK = 100;

export interface PurgeCandidate {
  id: string;
  authorId: string;
  authorBot: boolean;
  content: string;
  attachmentCount: number;
  embedCount: number;
  /** True when any embed carries an image or thumbnail (e.g. a pasted image link). */
  hasImageEmbed: boolean;
  /** User, role and @everyone mentions in the message. */
  mentionCount?: number;
  stickerCount?: number;
  pinned: boolean;
  createdTimestamp: number;
}

export interface PurgeCriteria {
  mode: PurgeFilterMode;
  /** Only messages from this user. */
  userId?: string | null;
  /** Only messages containing this text (case-insensitive). Applies on top of any mode. */
  contains?: string | null;
  /** Leave pinned messages alone (default true). */
  skipPinned?: boolean;
  /** Only messages sent after this message ID (exclusive). */
  afterId?: string | null;
}

/** Whether snowflake `id` is newer than `afterId`. Invalid IDs never match. */
export function isAfterSnowflake(id: string, afterId: string): boolean {
  try {
    return BigInt(id) > BigInt(afterId);
  } catch {
    return false;
  }
}

const LINK_REGEX = /(?:https?:\/\/|discord\.gg\/|www\.)\S+/i;
const INVITE_REGEX = /(?:discord(?:app)?\.(?:gg|com\/invite)|dsc\.gg)\/[\w-]+/i;

export function isBulkDeletable(createdTimestamp: number, nowMs: number): boolean {
  return nowMs - createdTimestamp < BULK_DELETE_MAX_AGE_MS;
}

/** Whether a message matches the filters, ignoring its age. */
export function matchesPurgeCriteria(msg: PurgeCandidate, criteria: PurgeCriteria): boolean {
  if ((criteria.skipPinned ?? true) && msg.pinned) return false;
  if (criteria.userId && msg.authorId !== criteria.userId) return false;
  if (criteria.afterId && !isAfterSnowflake(msg.id, criteria.afterId)) return false;

  const needle = criteria.contains?.trim().toLowerCase();
  if (needle && !msg.content.toLowerCase().includes(needle)) return false;

  switch (criteria.mode) {
    case "bots":    return msg.authorBot;
    case "humans":  return !msg.authorBot;
    case "links":   return LINK_REGEX.test(msg.content);
    case "images":  return msg.attachmentCount > 0 || msg.hasImageEmbed;
    case "embeds":  return msg.embedCount > 0;
    case "keyword": return Boolean(needle);
    case "attachments": return msg.attachmentCount > 0;
    case "invites": return INVITE_REGEX.test(msg.content);
    case "mentions": return (msg.mentionCount ?? 0) > 0;
    case "stickers": return (msg.stickerCount ?? 0) > 0;
    default:        return true;
  }
}

export interface PurgePlan<T extends PurgeCandidate> {
  /** Matching messages young enough to bulk-delete, newest first, capped at `amount`. */
  toDelete: T[];
  /** Matching messages skipped because they are 14 days old or older. */
  tooOld: number;
  /** Pinned messages that would otherwise have matched. */
  pinnedSkipped: number;
}

/**
 * Pick which scanned messages to delete. `scanned` must be newest first, as
 * Discord returns them.
 */
export function planPurge<T extends PurgeCandidate>(
  scanned: readonly T[],
  criteria: PurgeCriteria,
  amount: number,
  nowMs: number,
): PurgePlan<T> {
  const toDelete: T[] = [];
  let tooOld = 0;
  let pinnedSkipped = 0;

  for (const msg of scanned) {
    if (toDelete.length >= amount) break;
    if (!matchesPurgeCriteria(msg, criteria)) {
      if (msg.pinned && (criteria.skipPinned ?? true) && matchesPurgeCriteria(msg, { ...criteria, skipPinned: false })) {
        pinnedSkipped++;
      }
      continue;
    }
    if (!isBulkDeletable(msg.createdTimestamp, nowMs)) {
      tooOld++;
      continue;
    }
    toDelete.push(msg);
  }

  return { toDelete, tooOld, pinnedSkipped };
}

/** Split into Discord-sized bulk-delete batches. */
export function chunk<T>(items: readonly T[], size = BULK_DELETE_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface PurgeSummary {
  total: number;
  bots: number;
  humans: number;
  withAttachments: number;
  withLinks: number;
  /** Top authors by count, most first. */
  topAuthors: Array<{ authorId: string; count: number }>;
  otherAuthors: number;
}

/** Who and what a purge removed, for the result card and the log. Pure. */
export function summarizePurge(messages: readonly PurgeCandidate[], topN = 5): PurgeSummary {
  const byAuthor = new Map<string, number>();
  let bots = 0, withAttachments = 0, withLinks = 0;
  for (const m of messages) {
    byAuthor.set(m.authorId, (byAuthor.get(m.authorId) ?? 0) + 1);
    if (m.authorBot) bots++;
    if (m.attachmentCount > 0) withAttachments++;
    if (LINK_REGEX.test(m.content)) withLinks++;
  }
  const sorted = [...byAuthor.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    total: messages.length,
    bots,
    humans: messages.length - bots,
    withAttachments,
    withLinks,
    topAuthors: sorted.slice(0, topN).map(([authorId, count]) => ({ authorId, count })),
    otherAuthors: Math.max(0, sorted.length - topN),
  };
}

/** "<@1> ×12 · <@2> ×3 · +4 others\n15 human · 0 bot · 2 with files · 1 with links". */
export function purgeSummaryText(summary: PurgeSummary): string {
  if (summary.total === 0) return "Nothing deleted.";
  const authors = summary.topAuthors.map(a => `<@${a.authorId}> ×${a.count}`).join(" · ")
    + (summary.otherAuthors ? ` · +${summary.otherAuthors} other${summary.otherAuthors === 1 ? "" : "s"}` : "");
  const kinds = [`${summary.humans} human`, `${summary.bots} bot`, summary.withAttachments ? `${summary.withAttachments} with files` : "", summary.withLinks ? `${summary.withLinks} with links` : ""]
    .filter(Boolean).join(" · ");
  return `${authors}\n${kinds}`;
}
