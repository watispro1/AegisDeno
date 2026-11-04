/**
 * In-memory cache of active Ghost Watch entries, kept in step with Mongo by a
 * one-minute sync, so message events can skip the database for the members
 * nobody is watching.
 */
import { WatchlistEntryModel } from "../database/mongo";
import { logger } from "../utils/logger";

export interface CachedWatch {
  moderatorId: string;
  events: string[];
  expiresAt: Date | null;
  alertChannelId?: string | null;
}

/** One row the periodic sync reads from Mongo. */
export interface WatchRow {
  guildId: string;
  targetId: string;
  moderatorId: string;
  events: string[];
  expiresAt?: Date | null;
  alertChannelId?: string | null;
}

type CacheMutation =
  | { kind: "upsert"; guildId: string; targetId: string; watch: CachedWatch }
  | { kind: "remove"; guildId: string; targetId: string; moderatorId: string };

let activeWatchKeys = new Set<string>(); // key: `${guildId}:${targetId}`
let watchCache = new Map<string, CachedWatch[]>(); // key: `${guildId}:${targetId}`
/**
 * Mutations made while a sync is reading Mongo. The sync's snapshot may
 * predate them, so they are replayed onto the rebuilt cache; without this a
 * watch added during the read was dropped (until the next sync a minute later)
 * and a removed one came back.
 */
let pendingMutations: CacheMutation[] | null = null;
let syncInFlight: Promise<void> | null = null;

function applyMutation(keys: Set<string>, cache: Map<string, CachedWatch[]>, m: CacheMutation): void {
  const key = `${m.guildId}:${m.targetId}`;
  const list = cache.get(key) ?? [];
  if (m.kind === "upsert") {
    const idx = list.findIndex(w => w.moderatorId === m.watch.moderatorId);
    if (idx >= 0) list[idx] = m.watch; else list.push(m.watch);
    cache.set(key, list);
    keys.add(key);
    return;
  }
  const filtered = list.filter(w => w.moderatorId !== m.moderatorId);
  if (filtered.length === 0) {
    keys.delete(key);
    cache.delete(key);
  } else {
    cache.set(key, filtered);
  }
}

function mutate(m: CacheMutation): void {
  applyMutation(activeWatchKeys, watchCache, m);
  pendingMutations?.push(m);
}

export function updateWatchCache(
  guildId: string,
  targetId: string,
  moderatorId: string,
  events: string[],
  expiresAt: Date | null,
  alertChannelId: string | null = null,
): void {
  mutate({ kind: "upsert", guildId, targetId, watch: { moderatorId, events, expiresAt, alertChannelId } });
}

export function removeWatchFromCache(
  guildId: string,
  targetId: string,
  moderatorId: string,
): void {
  mutate({ kind: "remove", guildId, targetId, moderatorId });
}

/** The cached watches for one member (a copy). Exposed for tests and diagnostics. */
export function cachedWatches(guildId: string, targetId: string): CachedWatch[] {
  return [...(watchCache.get(`${guildId}:${targetId}`) ?? [])];
}

async function loadActiveWatchRows(): Promise<WatchRow[]> {
  const now = new Date();
  const rows = await WatchlistEntryModel.find({
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  }).select("guildId targetId moderatorId events expiresAt alertChannelId").lean();
  return rows as unknown as WatchRow[];
}

/**
 * Rebuild the cache from Mongo. Concurrent calls share one read. Watches added
 * or removed while the read is in flight are replayed on top of it.
 */
export function syncActiveWatches(load: () => Promise<WatchRow[]> = loadActiveWatchRows): Promise<void> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    pendingMutations = [];
    try {
      const entries = await load();
      const keys = new Set<string>();
      const cache = new Map<string, CachedWatch[]>();
      for (const entry of entries) {
        applyMutation(keys, cache, {
          kind: "upsert",
          guildId: entry.guildId,
          targetId: entry.targetId,
          watch: {
            moderatorId: entry.moderatorId,
            events: entry.events,
            expiresAt: entry.expiresAt ?? null,
            alertChannelId: entry.alertChannelId ?? null,
          },
        });
      }
      for (const m of pendingMutations) applyMutation(keys, cache, m);
      activeWatchKeys = keys;
      watchCache = cache;
    } catch (err) {
      // Keep the cache we have; a failed read must not drop every watch.
      logger.warn("Failed to synchronize active ghost watches:", err);
    } finally {
      pendingMutations = null;
      syncInFlight = null;
    }
  })();
  return syncInFlight;
}

let syncTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the background sync (prunes expired watches, picks up changes made on
 * other instances). Called once the client is ready; idempotent. Not started
 * on import, so tests and scripts that import this module touch no database.
 */
export function startWatchlistSync(): void {
  if (syncTimer) return;
  void syncActiveWatches();
  syncTimer = setInterval(() => {
    void syncActiveWatches();
  }, 60_000);
  syncTimer.unref?.();
}

/** Unexpired watches on one member; prunes expired ones from the cache. */
export async function getWatches(guildId: string, targetId: string): Promise<CachedWatch[]> {
  const key = `${guildId}:${targetId}`;
  // Almost nobody is watched, so check the in-memory key set before Mongo.
  if (!activeWatchKeys.has(key)) {
    return [];
  }

  const cached = watchCache.get(key);
  if (cached) {
    const now = Date.now();
    const valid = cached.filter(w => !w.expiresAt || w.expiresAt.getTime() > now);
    if (valid.length !== cached.length) {
      if (valid.length === 0) {
        activeWatchKeys.delete(key);
        watchCache.delete(key);
      } else {
        watchCache.set(key, valid);
      }
    }
    return valid;
  }

  return [];
}
