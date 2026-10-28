/**
 * Pure selection logic for /purge. The command maps discord.js messages to
 * PurgeCandidate objects so this file can be unit-tested without Discord.
 */

export type PurgeFilterMode = "all" | "bots" | "humans" | "links" | "images" | "embeds" | "keyword";

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
}

const LINK_REGEX = /(?:https?:\/\/|discord\.gg\/|www\.)\S+/i;

export function isBulkDeletable(createdTimestamp: number, nowMs: number): boolean {
  return nowMs - createdTimestamp < BULK_DELETE_MAX_AGE_MS;
}

/** Whether a message matches the filters, ignoring its age. */
export function matchesPurgeCriteria(msg: PurgeCandidate, criteria: PurgeCriteria): boolean {
  if ((criteria.skipPinned ?? true) && msg.pinned) return false;
  if (criteria.userId && msg.authorId !== criteria.userId) return false;

  const needle = criteria.contains?.trim().toLowerCase();
  if (needle && !msg.content.toLowerCase().includes(needle)) return false;

  switch (criteria.mode) {
    case "bots":    return msg.authorBot;
    case "humans":  return !msg.authorBot;
    case "links":   return LINK_REGEX.test(msg.content);
    case "images":  return msg.attachmentCount > 0 || msg.hasImageEmbed;
    case "embeds":  return msg.embedCount > 0;
    case "keyword": return Boolean(needle);
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
