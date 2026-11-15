/**
 * In-memory BTreeMap/Map database engine with WAL durability.
 */
import { TS_LOCK_FILE, WalStorage } from "./wal";
import { DirLock } from "./dirLock";
import type { CollectionName, WalEntry } from "./types";
import { logger } from "../../utils/logger";

const VALID_COLLECTIONS: CollectionName[] = [
  "guild_configs",
  "cases",
  "warnings",
  "economy",
  "starboard",
  "tickets",
  "reminders",
];

export class AegisDbEngine {
  private collections = new Map<CollectionName, Map<string, unknown>>();
  private wal: WalStorage;
  private startedAt = Date.now();
  private autoCompactTimer: ReturnType<typeof setInterval> | null = null;
  private lock: DirLock;
  private closed = false;

  /** Throws DirLockError when another live engine holds `dataPath`. */
  constructor(dataPath = "./data/aegis-db") {
    this.lock = DirLock.acquire(dataPath, TS_LOCK_FILE);
    try {
      this.wal = new WalStorage(dataPath);
      for (const name of VALID_COLLECTIONS) {
        this.collections.set(name, new Map());
      }
      this.recover();
    } catch (err) {
      this.lock.release();
      throw err;
    }
    this.startAutoCompact();
  }

  private recover(): void {
    // 1. Load snapshot
    const snap = this.wal.loadSnapshot();
    if (snap) {
      for (const [colName, entries] of Object.entries(snap)) {
        const col = this.collections.get(colName as CollectionName);
        if (col && typeof entries === "object" && entries !== null) {
          for (const [key, val] of Object.entries(entries)) {
            col.set(key, val);
          }
        }
      }
    }

    // 2. Replay WAL entries
    const entries = this.wal.replay();
    for (const e of entries) {
      const col = this.collections.get(e.col);
      if (!col) continue;
      if (e.op === "put" && e.val !== undefined) {
        col.set(e.key, e.val);
      } else if (e.op === "delete") {
        col.delete(e.key);
      }
    }

    logger.debug(`AegisDB recovered ${this.totalDocuments()} document(s) from snapshot + ${entries.length} WAL op(s).`);
  }

  private startAutoCompact(): void {
    // Auto-compact every 5 minutes
    this.autoCompactTimer = setInterval(() => {
      try {
        this.compact();
      } catch (err) {
        logger.debug("AegisDB auto-compact error:", err);
      }
    }, 5 * 60_000);
    if (this.autoCompactTimer.unref) this.autoCompactTimer.unref();
  }

  get(colName: CollectionName, key: string): unknown | null {
    const col = this.collections.get(colName);
    return col?.get(key) ?? null;
  }

  put(colName: CollectionName, key: string, val: unknown): void {
    if (this.closed) throw new Error("AegisDB engine is closed");
    const col = this.collections.get(colName);
    if (!col) throw new Error(`Unknown collection: ${colName}`);
    col.set(key, val);
    const entry: WalEntry = { ts: Date.now(), op: "put", col: colName, key, val };
    this.wal.append(entry);
  }

  delete(colName: CollectionName, key: string): boolean {
    if (this.closed) throw new Error("AegisDB engine is closed");
    const col = this.collections.get(colName);
    if (!col) return false;
    const deleted = col.delete(key);
    if (deleted) {
      const entry: WalEntry = { ts: Date.now(), op: "delete", col: colName, key };
      this.wal.append(entry);
    }
    return deleted;
  }

  prefixScan(colName: CollectionName, prefix: string): Array<[string, unknown]> {
    const col = this.collections.get(colName);
    if (!col) return [];
    const results: Array<[string, unknown]> = [];
    for (const [key, val] of col.entries()) {
      if (key.startsWith(prefix)) {
        results.push([key, val]);
      }
    }
    return results;
  }

  compact(): { status: string; message: string } {
    const data: Record<string, Record<string, unknown>> = {};
    for (const [name, col] of this.collections.entries()) {
      const records: Record<string, unknown> = {};
      for (const [k, v] of col.entries()) {
        records[k] = v;
      }
      data[name] = records;
    }
    this.wal.saveSnapshot(data as Record<CollectionName, Record<string, unknown>>);
    return { status: "success", message: "compacted" };
  }

  totalDocuments(): number {
    let count = 0;
    for (const col of this.collections.values()) {
      count += col.size;
    }
    return count;
  }

  stats(): Record<string, unknown> {
    const collectionsObj: Record<string, number> = {};
    for (const [name, col] of this.collections.entries()) {
      collectionsObj[name] = col.size;
    }
    return {
      status: "ok",
      service: "aegis-db",
      engine: "typescript-native",
      total_documents: this.totalDocuments(),
      collections_count: this.collections.size,
      collections: collectionsObj,
      wal_size_bytes: this.wal.walSizeBytes(),
      uptime_seconds: Math.floor((Date.now() - this.startedAt) / 1000),
    };
  }

  isClosed(): boolean {
    return this.closed;
  }

  /** Checkpoints, closes the WAL, and releases the data-directory lock. Idempotent. */
  close(): void {
    if (this.closed) return;
    if (this.autoCompactTimer) {
      clearInterval(this.autoCompactTimer);
      this.autoCompactTimer = null;
    }
    try {
      this.compact();
    } catch (err) {
      logger.error("AegisDB final compaction failed (WAL kept for replay):", err);
    }
    this.closed = true;
    this.wal.close();
    this.lock.release();
  }
}
