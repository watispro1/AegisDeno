/**
 * Wait for a promise, but no longer than `ms`.
 *
 * For interaction handlers that must answer Discord within 3 seconds but need
 * a database read first to choose *how* to answer (a modal can only be the
 * first response, so it cannot come after a defer). The original promise keeps
 * running after a timeout; callers can still await it once they have deferred.
 */
export type DeadlineResult<T> = { ok: true; value: T } | { ok: false };

export async function withinDeadline<T>(promise: Promise<T>, ms: number): Promise<DeadlineResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<DeadlineResult<T>>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false }), ms);
    timer.unref?.();
  });
  try {
    return await Promise.race([promise.then((value): DeadlineResult<T> => ({ ok: true, value })), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** How long a handler may spend before its first response; Discord allows 3 s. */
export const INTERACTION_RESPONSE_BUDGET_MS = 2_000;
