/**
 * Write-Ahead Log (WAL) and snapshot persistence for AegisDB.
 */
import fs from "node:fs";
import path from "node:path";
import type { CollectionName, WalEntry } from "./types";

export class WalStorage {
  private dir: string;
  private walPath: string;
  private snapshotPath: string;

  constructor(dir: string) {
    this.dir = dir;
    this.walPath = path.join(dir, "wal.log");
    this.snapshotPath = path.join(dir, "snapshot.json");
    this.ensureDir();
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
  }

  append(entry: WalEntry): void {
    this.ensureDir();
    const line = JSON.stringify(entry) + "\n";
    fs.appendFileSync(this.walPath, line, "utf8");
  }

  replay(): WalEntry[] {
    if (!fs.existsSync(this.walPath)) return [];
    try {
      const content = fs.readFileSync(this.walPath, "utf8");
      const lines = content.split("\n");
      const entries: WalEntry[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          entries.push(JSON.parse(trimmed) as WalEntry);
        } catch {
          // Ignore incomplete/corrupted tail write
        }
      }
      return entries;
    } catch {
      return [];
    }
  }

  loadSnapshot(): Record<CollectionName, Record<string, unknown>> | null {
    if (!fs.existsSync(this.snapshotPath)) return null;
    try {
      const content = fs.readFileSync(this.snapshotPath, "utf8");
      return JSON.parse(content) as Record<CollectionName, Record<string, unknown>>;
    } catch {
      return null;
    }
  }

  saveSnapshot(data: Record<CollectionName, Record<string, unknown>>): void {
    this.ensureDir();
    const tmp = `${this.snapshotPath}.tmp.${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tmp, this.snapshotPath);

    // Truncate WAL after snapshot is safely committed
    try {
      fs.writeFileSync(this.walPath, "", "utf8");
    } catch {
      // WAL truncate failure is non-fatal
    }
  }

  walSizeBytes(): number {
    try {
      if (fs.existsSync(this.walPath)) {
        return fs.statSync(this.walPath).size;
      }
    } catch {
      // ignore
    }
    return 0;
  }
}
