/**
 * Small in-memory cache with a time-to-live, a size bound, and request
 * coalescing: concurrent misses for one key share a single load.
 *
 * Used for per-guild settings that are read on hot paths (every message or
 * reaction) and change rarely. Writers call `delete(key)` after saving, so a
 * change is visible at once in this process; the TTL bounds staleness for
 * anything that writes around the service functions.
 */
export class TtlCache<V> {
  private readonly entries = new Map<string, { value: V; expiresAt: number }>();
  private readonly loading = new Map<string, Promise<V>>();
  /** Bumped by delete/clear so a load that started before a write cannot repopulate stale data. */
  private generation = new Map<string, number>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 10_000,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): V | undefined {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (this.now() >= hit.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    if (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
  }

  delete(key: string): void {
    this.entries.delete(key);
    this.loading.delete(key);
    this.generation.set(key, (this.generation.get(key) ?? 0) + 1);
  }

  clear(): void {
    this.entries.clear();
    this.loading.clear();
    this.generation = new Map();
  }

  get size(): number {
    return this.entries.size;
  }

  /** Cached value, or the result of `load()` (stored unless the key was deleted meanwhile). */
  async getOrLoad(key: string, load: () => Promise<V>): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const inflight = this.loading.get(key);
    if (inflight) return inflight;

    const startGen = this.generation.get(key) ?? 0;
    const promise = load()
      .then((value) => {
        if ((this.generation.get(key) ?? 0) === startGen) this.set(key, value);
        return value;
      })
      .finally(() => {
        if (this.loading.get(key) === promise) this.loading.delete(key);
      });
    this.loading.set(key, promise);
    return promise;
  }
}
