/**
 * Write-Ahead Log (WAL) and snapshot persistence for AegisDB.
 *
 * Files use `ts-` names so this engine can never interleave with the Rust
 * service's binary `wal.log` / `snapshot.json` if both are pointed at one
 * directory. Appends are fsynced in small batches; snapshots are written to a
 * temp file, fsynced, renamed, and the directory fsynced before the WAL is cut.
 */
import fs from "node:fs";
import path from "node:path";
import type { CollectionName, WalEntry } from "./types";
import { logger } from "../../utils/logger";

export const TS_WAL_FILE = "ts-wal.jsonl";
export const TS_SNAPSHOT_FILE = "ts-snapshot.json";
export const TS_LOCK_FILE = "ts-aegis-db.lock";
/** A single WAL line longer than this is treated as corruption. */
export const MAX_WAL_LINE_BYTES = 16 * 1024 * 1024;
/** How long an append may wait for its fsync (batched with its neighbours). */
const SYNC_DELAY_MS = 20;

const OPS = new Set(["put", "delete"]);

function isWalEntry(v: unknown): v is WalEntry {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return OPS.has(e.op as string) && typeof e.col === "string" && typeof e.key === "string" &&
    (e.op === "delete" || e.val !== undefined);
}

export function fsyncDir(dir: string): void {
  let fd: number | null = null;
  try {
    fd = fs.openSync(dir, "r");
    fs.fsyncSync(fd);
  } catch {
    // Not supported on every platform (e.g. Windows); the rename is still atomic.
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
}

export interface ReplayResult {
  entries: WalEntry[];
  validBytes: number;
  fileBytes: number;
}

/** Parses a JSON-lines WAL, stopping at the first torn, oversized, or malformed line. */
export function parseWal(buf: Buffer): ReplayResult {
  const entries: WalEntry[] = [];
  let offset = 0;
  while (offset < buf.length) {
    const nl = buf.indexOf(0x0a, offset);
    if (nl === -1) break; // torn tail: the final line never got its newline
    if (nl - offset > MAX_WAL_LINE_BYTES) break;
    const line = buf.toString("utf8", offset, nl).trim();
    if (line) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        break;
      }
      if (!isWalEntry(parsed)) break;
      entries.push(parsed);
    }
    offset = nl + 1;
  }
  return { entries, validBytes: offset, fileBytes: buf.length };
}

export class WalStorage {
  private dir: string;
  private walPath: string;
  private snapshotPath: string;
  private fd: number | null = null;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(dir: string) {
    this.dir = dir;
    this.walPath = path.join(dir, TS_WAL_FILE);
    this.snapshotPath = path.join(dir, TS_SNAPSHOT_FILE);
    fs.mkdirSync(this.dir, { recursive: true });
  }

  private openFd(): number {
    if (this.fd === null) this.fd = fs.openSync(this.walPath, "a");
    return this.fd;
  }

  append(entry: WalEntry): void {
    const fd = this.openFd();
    fs.writeSync(fd, JSON.stringify(entry) + "\n");
    if (!this.syncTimer) {
      this.syncTimer = setTimeout(() => this.flush(), SYNC_DELAY_MS);
      this.syncTimer.unref?.();
    }
  }

  /** fsyncs every append made so far. */
  flush(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.fd === null) return;
    try {
      fs.fdatasyncSync(this.fd);
    } catch (err) {
      logger.error("AegisDB WAL fsync failed:", err);
    }
  }

  /** Replays the WAL and truncates it at the last intact line. */
  replay(): WalEntry[] {
    if (!fs.existsSync(this.walPath)) return [];
    const result = parseWal(fs.readFileSync(this.walPath));
    if (result.validBytes < result.fileBytes) {
      logger.warn(
        `AegisDB WAL has ${result.fileBytes - result.validBytes} unreadable trailing byte(s) after ${result.entries.length} entr(ies); truncating.`,
      );
      fs.truncateSync(this.walPath, result.validBytes);
      const fd = fs.openSync(this.walPath, "r+");
      try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    }
    return result.entries;
  }

  loadSnapshot(): Record<CollectionName, Record<string, unknown>> | null {
    if (!fs.existsSync(this.snapshotPath)) return null;
    const content = fs.readFileSync(this.snapshotPath, "utf8");
    // A snapshot only ever appears via an atomic rename, so a parse failure is
    // real corruption: refuse to start rather than silently start empty.
    return JSON.parse(content) as Record<CollectionName, Record<string, unknown>>;
  }

  saveSnapshot(data: Record<CollectionName, Record<string, unknown>>): void {
    fs.mkdirSync(this.dir, { recursive: true });
    this.flush();
    const tmp = `${this.snapshotPath}.tmp`;
    const fd = fs.openSync(tmp, "w");
    try {
      fs.writeSync(fd, JSON.stringify(data));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, this.snapshotPath);
    fsyncDir(this.dir);

    // Only now is the WAL redundant. Compaction runs synchronously, so no
    // append can land between the in-memory copy and this truncate.
    const walFd = this.openFd();
    fs.ftruncateSync(walFd, 0);
    fs.fsyncSync(walFd);
  }

  walSizeBytes(): number {
    try {
      if (this.fd !== null) return fs.fstatSync(this.fd).size;
      if (fs.existsSync(this.walPath)) return fs.statSync(this.walPath).size;
    } catch {
      // ignore
    }
    return 0;
  }

  close(): void {
    this.flush();
    if (this.fd !== null) {
      fs.closeSync(this.fd);
      this.fd = null;
    }
  }
}
