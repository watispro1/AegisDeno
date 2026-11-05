/** Pure checks used by the gateway event handlers in client.ts. */

/** An update this long after the message's edit time is not that edit arriving. */
export const RECENT_EDIT_MS = 5 * 60 * 1000;

/**
 * Whether a MessageUpdate is a real edit of the text. When the old message was
 * not cached we cannot compare the text, so the edit time decides: a message
 * never edited (or edited long ago) is being pinned, given a thread or a link
 * preview, not edited now. With no edit time to go on it counts as an edit
 * (the safe side for automod).
 */
export function isContentEdit(
  oldMessage: { partial?: boolean; content?: string | null },
  newMessage: { partial?: boolean; content?: string | null; editedTimestamp?: number | null },
  nowMs: number = Date.now(),
): boolean {
  if (newMessage.partial || typeof newMessage.content !== "string") return true;
  if (oldMessage.partial || typeof oldMessage.content !== "string") {
    const edited = newMessage.editedTimestamp;
    if (edited === undefined) return true;
    return edited !== null && nowMs - edited <= RECENT_EDIT_MS;
  }
  return oldMessage.content !== newMessage.content;
}

/** A member who finished screening this long after joining is not treated as new. */
export const WELCOME_ROLE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Whether a GuildMemberUpdate means the member just passed membership
 * screening and should get the welcome role. With the GuildMember partial on,
 * an uncached old member arrives with `pending` null, so a recent joiner who
 * is no longer pending and still lacks the role is treated as having just
 * passed screening.
 */
export function shouldAssignWelcomeRole(
  oldMember: { partial?: boolean; pending?: boolean | null },
  newMember: { pending: boolean; joinedTimestamp: number | null; hasRole: boolean },
  nowMs: number = Date.now(),
): boolean {
  if (newMember.pending || newMember.hasRole) return false;
  if (oldMember.pending === true) return true;
  if (!oldMember.partial) return false;
  return newMember.joinedTimestamp !== null && nowMs - newMember.joinedTimestamp <= WELCOME_ROLE_WINDOW_MS;
}
