/**
 * Serialized, coalescing refreshes for one shared object (a poll or
 * suggestion message that many members click at once).
 *
 * Each click used to edit the message with the state *its own* write returned.
 * Edits finish in any order, so a slower, older edit could land last and the
 * message showed stale counts (or, for a poll, re-opened the "Closes in…"
 * text after the poll had been closed). Here refreshes for one key run one at
 * a time and each re-reads the latest state, so the last edit is always the
 * newest. A refresh that is still waiting to start already covers every
 * change before it, so further refreshes join it instead of queueing more
 * edits (this also keeps a busy poll under Discord's edit rate limit).
 */
interface Entry {
  promise: Promise<void>;
  started: boolean;
  coalesce: boolean;
}

const tails = new Map<string, Entry>();

/**
 * Run `task` after every earlier task for `key`. With `coalesce` (default), a
 * call made while another coalescing task for the key is still waiting to
 * start returns that task's promise instead of queueing a duplicate. Pass
 * `coalesce: false` for a task that must run itself (closing a poll).
 */
export function runLatest(key: string, task: () => Promise<void>, opts: { coalesce?: boolean } = {}): Promise<void> {
  const coalesce = opts.coalesce ?? true;
  const current = tails.get(key);
  if (coalesce && current && !current.started && current.coalesce) return current.promise;

  const previous = current?.promise ?? Promise.resolve();
  const entry: Entry = { promise: Promise.resolve(), started: false, coalesce };
  entry.promise = previous
    .catch(() => undefined)
    .then(() => {
      entry.started = true;
      return task();
    })
    .finally(() => {
      if (tails.get(key) === entry) tails.delete(key);
    });
  tails.set(key, entry);
  return entry.promise;
}

/** Keys with work queued or running (tests, diagnostics). */
export function pendingLatestKeys(): number {
  return tails.size;
}
