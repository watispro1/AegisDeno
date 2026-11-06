/** Runs tasks that share a key one at a time, in arrival order; different keys run in parallel. */
const inFlight = new Map<string, Promise<void>>();

export function serializeByKey(key: string, task: () => Promise<void>): Promise<void> {
  const previous = inFlight.get(key) ?? Promise.resolve();
  const next = previous.then(task, task);
  const tracked = next.catch(() => undefined).finally(() => {
    if (inFlight.get(key) === tracked) inFlight.delete(key);
  });
  inFlight.set(key, tracked);
  return next;
}
