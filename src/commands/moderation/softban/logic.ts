/** Pure rules for /softban: message-deletion window, who can be softbanned, and the audit reasons. */
import { auditReason } from "../../../utils/safeText";
import { isUnknownBanError } from "../../../services/timedActions";

export const SOFTBAN_MIN_DAYS = 1;
export const SOFTBAN_MAX_DAYS = 7;
export const SOFTBAN_DEFAULT_DAYS = 1;

/** Seconds of messages to delete for `delete_messages` (1 to 7 days, default 1). */
export function softbanDeleteSeconds(days: number | null): number {
  const d = days === null || !Number.isInteger(days) ? SOFTBAN_DEFAULT_DAYS : Math.min(SOFTBAN_MAX_DAYS, Math.max(SOFTBAN_MIN_DAYS, days));
  return d * 86_400;
}

export type BanStatus = "banned" | "not_banned" | "unknown";

/**
 * Looks up whether the user is banned. Only Discord's Unknown Ban error means
 * "not banned"; any other failure (rate limit, outage, missing access) is
 * "unknown", so a real ban is never mistaken for none.
 */
export async function lookupBanStatus(fetchBan: () => Promise<unknown>): Promise<BanStatus> {
  try {
    const ban = await fetchBan();
    return ban ? "banned" : "unknown";
  } catch (err) {
    return isUnknownBanError(err) ? "not_banned" : "unknown";
  }
}

export const SOFTBAN_BAN_UNKNOWN = "⚠️ I couldn't check whether that user is already banned, so nothing was done. Try again in a moment.";
export const SOFTBAN_BANNED_DURING_CONFIRM = "ℹ️ That user was banned while you were confirming. Nothing was done.";

/**
 * Why this softban can't go ahead, or null. A member who is already banned is
 * refused: the unban half would lift their real ban. So is one whose ban
 * status couldn't be checked.
 */
export function softbanBlock(input: { targetId: string; actorId: string; botId: string | null; ownerId: string | null; banStatus: BanStatus }): string | null {
  if (input.targetId === input.actorId) return "❌ You cannot softban yourself.";
  if (input.botId && input.targetId === input.botId) return "❌ You cannot softban me.";
  if (input.ownerId && input.targetId === input.ownerId) return "❌ You cannot softban the server owner.";
  if (input.banStatus === "banned") return "ℹ️ That user is already banned. A softban would lift their ban, so nothing was done.";
  if (input.banStatus === "unknown") return SOFTBAN_BAN_UNKNOWN;
  return null;
}

/** Message for the re-check after confirmation, or null when the softban may go ahead. */
export function softbanRecheckBlock(banStatus: BanStatus): string | null {
  if (banStatus === "banned") return SOFTBAN_BANNED_DURING_CONFIRM;
  if (banStatus === "unknown") return SOFTBAN_BAN_UNKNOWN;
  return null;
}

export function softbanBanReason(reason: string, moderatorTag: string): string {
  return auditReason(`Softban: ${reason} | By ${moderatorTag}`);
}

export function softbanUnbanReason(moderatorTag: string): string {
  return auditReason(`Softban: lifting the ban, messages cleared | By ${moderatorTag}`);
}
