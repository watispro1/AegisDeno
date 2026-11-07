/**
 * Tracking and deduplication for gateway events and deleted messages.
 *
 * Prevents:
 * 1. Duplicate logs when Discord gateway dispatches duplicate MESSAGE_DELETE,
 *    MESSAGE_CREATE, MESSAGE_UPDATE, GUILD_MEMBER_ADD or GUILD_MEMBER_REMOVE events.
 * 2. Redundant "Message Deleted" log when Automod or a moderation command already
 *    deleted and logged the message (e.g. "Automod Triggered").
 */

const handledDeleteIds = new Map<string, number>();
const handledEventKeys = new Map<string, number>();
const DELETE_DEDUPE_TTL_MS = 60_000;

/** Mark a message as intentionally deleted by the bot (e.g. automod or purge). */
export function markMessageDeletedByBot(messageId: string): void {
  handledDeleteIds.set(messageId, Date.now());
}

/**
 * Returns true if this message deletion should be logged in the audit log.
 * Returns false if it was already handled by the bot or was already logged recently.
 */
export function shouldLogMessageDelete(messageId: string): boolean {
  const lastHandled = handledDeleteIds.get(messageId);
  const now = Date.now();
  if (lastHandled !== undefined && now - lastHandled < DELETE_DEDUPE_TTL_MS) {
    return false;
  }
  handledDeleteIds.set(messageId, now);
  return true;
}

/**
 * Returns true if this event was already processed within ttlMs.
 * Drops gateway retransmissions and duplicate deliveries.
 */
export function isDuplicateEvent(type: string, id: string, ttlMs = 60_000): boolean {
  const key = `${type}:${id}`;
  const now = Date.now();
  const existing = handledEventKeys.get(key);
  if (existing !== undefined && now - existing < ttlMs) {
    return true;
  }
  handledEventKeys.set(key, now);
  return false;
}

/** Clear tracked IDs (used in tests). */
export function resetDeletedMessageTracker(): void {
  handledDeleteIds.clear();
  handledEventKeys.clear();
}

const sweepInterval = setInterval(() => {
  const now = Date.now();
  for (const [id, ts] of handledDeleteIds) {
    if (now - ts > DELETE_DEDUPE_TTL_MS) {
      handledDeleteIds.delete(id);
    }
  }
  for (const [key, ts] of handledEventKeys) {
    if (now - ts > DELETE_DEDUPE_TTL_MS) {
      handledEventKeys.delete(key);
    }
  }
}, 60_000);
sweepInterval.unref?.();
