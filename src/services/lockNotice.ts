/** Pure helpers for the notice /lock posts inside locked channels. */

/** Max length of a moderator's custom lock message. */
export const LOCK_MESSAGE_MAX = 1000;

export interface LockNoticeInput {
  reason: string;
  /** Optional custom message from the moderator, shown above the reason. */
  customMessage?: string | null;
  /** Discord timestamp markup for the auto-unlock, or null for none. */
  autoUnlockText?: string | null;
}

export function buildLockNoticeText({ reason, customMessage, autoUnlockText }: LockNoticeInput): string {
  const parts: string[] = [];
  const msg = customMessage?.trim();
  if (msg) parts.push(msg.slice(0, LOCK_MESSAGE_MAX), "");
  parts.push(`**Reason:** ${reason}`);
  if (autoUnlockText) parts.push(`**Auto-unlock:** ${autoUnlockText}`);
  return parts.join("\n");
}

/** Whether to post a notice in the locked channel. */
export function shouldPostLockNotice(targetChannelId: string, invokedInChannelId: string | null, hasCustomMessage: boolean): boolean {
  return hasCustomMessage || targetChannelId !== invokedInChannelId;
}
