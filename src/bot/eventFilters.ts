/** Pure checks used by the gateway event handlers in client.ts. */

/**
 * Whether a MessageUpdate is a real edit of the text. When the old message was
 * not cached we cannot compare, so it counts as an edit (the safe side for
 * automod).
 */
export function isContentEdit(
  oldMessage: { partial?: boolean; content?: string | null },
  newMessage: { partial?: boolean; content?: string | null; editedTimestamp?: number | null },
): boolean {
  if (oldMessage.partial || typeof oldMessage.content !== "string") return true;
  if (newMessage.partial || typeof newMessage.content !== "string") return true;
  return oldMessage.content !== newMessage.content;
}
