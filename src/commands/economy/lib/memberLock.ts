/**
 * Per-member queue for balance-changing economy commands in this process.
 *
 * The store's own guards keep every single update atomic, but a few flows
 * check something first and act on it afterwards (does the member already
 * have this role? do they still own this item?). Two commands from the same
 * member landing together could both pass the check, e.g. buying a role
 * item twice and paying twice. Running one member's economy actions one at
 * a time closes that gap for everything handled by this bot process.
 *
 * Only the service call goes inside the lock, never a confirmation prompt,
 * so a queued command waits at most `waitMs` and then says so instead of
 * outliving Discord's 3-second reply window.
 */

const tails = new Map<string, Promise<void>>();

export const LOCK_WAIT_MS = 2000;

export type Locked<T> = { ok: true; value: T } | { ok: false; reason: "busy" };

export function memberKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

/** Run `fn` once every earlier action for this member has finished, or give up after `waitMs`. */
export async function withMemberLock<T>(guildId: string, userId: string, fn: () => Promise<T>, waitMs = LOCK_WAIT_MS): Promise<Locked<T>> {
  const key = memberKey(guildId, userId);
  const prev = tails.get(key) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>(resolve => { release = resolve; });
  const tail = prev.then(() => mine);
  tails.set(key, tail);
  let timer: NodeJS.Timeout | undefined;
  const waited = await Promise.race([
    prev.then(() => true),
    new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), Math.max(0, waitMs)); }),
  ]);
  clearTimeout(timer);
  try {
    if (!waited) return { ok: false, reason: "busy" };
    return { ok: true, value: await fn() };
  } finally {
    release();
    // Drop the entry once the queue for this member is empty, so the map never grows.
    void tail.then(() => { if (tails.get(key) === tail) tails.delete(key); });
  }
}

/** Members with an action queued or running (for tests). */
export function lockedMemberCount(): number {
  return tails.size;
}
