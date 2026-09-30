import Database from "better-sqlite3";
import path from "path";
import { logger } from "../utils/logger";

const DB_PATH = path.resolve(process.cwd(), "data", "aegis.sqlite");

// Ensure data directory exists
import fs from "fs";
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS kv_store (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

// Prepared statements for performance
const stmtSet = db.prepare("INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)");
const stmtGet = db.prepare("SELECT value FROM kv_store WHERE key = ?");
const stmtDel = db.prepare("DELETE FROM kv_store WHERE key = ?");
const stmtList = db.prepare("SELECT key, value FROM kv_store WHERE key LIKE ? ESCAPE '\\'");

function encodeKey(keyArray: (string | number | bigint)[]): string {
  return keyArray.map(k => String(k)).join(":");
}

export const kv = {
  get: <T = unknown>(keyArray: (string | number | bigint)[]): { value: T | null } => {
    const key = encodeKey(keyArray);
    const row = stmtGet.get(key) as { value: string } | undefined;
    if (!row) return { value: null };
    try {
      return { value: JSON.parse(row.value) as T };
    } catch {
      return { value: null };
    }
  },

  set: (keyArray: (string | number | bigint)[], value: unknown): void => {
    const key = encodeKey(keyArray);
    stmtSet.run(key, JSON.stringify(value));
  },

  delete: (keyArray: (string | number | bigint)[]): void => {
    const key = encodeKey(keyArray);
    stmtDel.run(key);
  },

  /**
   * Returns all entries whose key starts with the given prefix.
   * e.g. kv.list(["warnings", "12345"]) returns all warnings for guild 12345.
   */
  list: <T = unknown>(prefixArray: (string | number | bigint)[]): Array<{ key: string[]; value: T }> => {
    const prefix = encodeKey(prefixArray);
    // Escape LIKE wildcards inside the prefix itself
    const escaped = prefix.replace(/[%_\\]/g, c => `\\${c}`);
    const rows = stmtList.all(`${escaped}%`) as { key: string; value: string }[];
    return rows.map(row => ({
      key: row.key.split(":"),
      value: JSON.parse(row.value) as T,
    }));
  },

  close: (): void => {
    logger.info("Closing database connection...");
    db.close();
  },
};

export function closeDatabase(): void {
  kv.close();
}
