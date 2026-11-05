/** Pure rules for /softban: message-deletion window, who can be softbanned, and the audit reasons. */
import { auditReason } from "../../../utils/safeText";

export const SOFTBAN_MIN_DAYS = 1;
export const SOFTBAN_MAX_DAYS = 7;
export const SOFTBAN_DEFAULT_DAYS = 1;

/** Seconds of messages to delete for `delete_messages` (1 to 7 days, default 1). */
export function softbanDeleteSeconds(days: number | null): number {
  const d = days === null || !Number.isInteger(days) ? SOFTBAN_DEFAULT_DAYS : Math.min(SOFTBAN_MAX_DAYS, Math.max(SOFTBAN_MIN_DAYS, days));
  return d * 86_400;
}

/**
 * Why this softban can't go ahead, or null. A member who is already banned is
 * refused: the unban half would lift their real ban.
 */
export function softbanBlock(input: { targetId: string; actorId: string; botId: string | null; ownerId: string | null; alreadyBanned: boolean }): string | null {
  if (input.targetId === input.actorId) return "❌ You cannot softban yourself.";
  if (input.botId && input.targetId === input.botId) return "❌ You cannot softban me.";
  if (input.ownerId && input.targetId === input.ownerId) return "❌ You cannot softban the server owner.";
  if (input.alreadyBanned) return "ℹ️ That user is already banned. A softban would lift their ban, so nothing was done.";
  return null;
}

export function softbanBanReason(reason: string, moderatorTag: string): string {
  return auditReason(`Softban: ${reason} | By ${moderatorTag}`);
}

export function softbanUnbanReason(moderatorTag: string): string {
  return auditReason(`Softban: lifting the ban, messages cleared | By ${moderatorTag}`);
}
