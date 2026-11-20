/**
 * AegisDB operations as plain functions.
 *
 * Both the HTTP router (routes.ts / routesEconomy.ts) and the in-process
 * client (rustClient.ts, when this process owns the engine) call these, so the
 * bot never makes a loopback HTTP request to itself. Each returns the HTTP
 * status and JSON body the REST API would answer with.
 *
 * Every function is synchronous from validation to the last write: the engine
 * is single-writer (one process holds the data-directory lock) and JavaScript
 * runs one function at a time, so no other request can interleave.
 */
import type { AegisDbEngine } from "./engine";
import type { CaseRecord, EconomyRecord, WarningRecord } from "./types";
import {
  isCaseRef,
  isModerationAction,
  isSnowflake,
  queryInt,
  validateCaseInput,
  validateCasePatch,
  validateTransact,
  validateWarningInput,
} from "./validation";

export interface OpResult<T = unknown> {
  status: number;
  body: T;
}

const res = <T>(status: number, body: T): OpResult<T> => ({ status, body });
const badRequest = (error: string): OpResult<{ error: string }> => res(400, { error });

// ── Case keys ───────────────────────────────────────────────────────────────

/** `cases` collection: the case record. */
export const caseKey = (guildId: string, id: number): string => `case:${guildId}:${id}`;
/** `counters` collection: the highest case id allocated in the guild. */
export const caseCounterKey = (guildId: string): string => `case:${guildId}`;
/** `case_refs` collection: the bot's case reference (Mongo _id) → numeric case id. */
export const caseRefKey = (guildId: string, ref: string): string => `case_ref:${guildId}:${ref}`;

/**
 * Seeds the guild's case counter and case_ref index from a one-time scan when
 * the counter is missing (data written before the index existed). Once the
 * counter exists this is a single map lookup and never scans again.
 */
export function ensureCaseIndex(db: AegisDbEngine, guildId: string): void {
  if (db.get("counters", caseCounterKey(guildId)) !== null) return;
  let max = 0;
  for (const [, val] of db.prefixScan("cases", `case:${guildId}:`)) {
    const c = val as CaseRecord;
    const id = Number(c.case_id) || 0;
    if (id > max) max = id;
    if (c.case_ref && db.get("case_refs", caseRefKey(guildId, c.case_ref)) === null) {
      db.put("case_refs", caseRefKey(guildId, c.case_ref), id);
    }
  }
  // Written last: if the process dies mid-backfill the next call scans again.
  db.put("counters", caseCounterKey(guildId), max);
}

/** Finds a case by numeric AegisDB id or by the bot's case reference, without scanning. */
export function resolveCase(db: AegisDbEngine, guildId: string, caseId: string): [string, CaseRecord] | null {
  if (/^\d+$/.test(caseId)) {
    const key = caseKey(guildId, Number(caseId));
    const val = db.get("cases", key) as CaseRecord | null;
    return val ? [key, val] : null;
  }
  if (!isCaseRef(caseId)) return null;
  ensureCaseIndex(db, guildId);
  const id = db.get("case_refs", caseRefKey(guildId, caseId));
  if (typeof id !== "number") return null;
  const key = caseKey(guildId, id);
  const val = db.get("cases", key) as CaseRecord | null;
  // A ref whose case never landed (crash between the two writes) is no match.
  return val && val.case_ref === caseId ? [key, val] : null;
}

// ── Service ─────────────────────────────────────────────────────────────────

export function health(db: AegisDbEngine): OpResult {
  return res(200, {
    status: "ok",
    service: "aegis-db",
    version: "0.1.0",
    uptime_seconds: (db.stats().uptime_seconds as number) ?? 0,
  });
}

export const stats = (db: AegisDbEngine): OpResult => res(200, db.stats());
export const compact = (db: AegisDbEngine): OpResult => res(200, db.compact());

// ── Guild config ────────────────────────────────────────────────────────────

export function getGuildConfig(db: AegisDbEngine, guildId: string): OpResult {
  if (!isSnowflake(guildId)) return badRequest("guild id must be a Discord snowflake");
  const val = db.get("guild_configs", `cfg:${guildId}`);
  return val ? res(200, val) : res(404, { error: "Guild config not found" });
}

export function putGuildConfig(db: AegisDbEngine, guildId: string, body: Record<string, unknown>): OpResult {
  if (!isSnowflake(guildId)) return badRequest("guild id must be a Discord snowflake");
  db.put("guild_configs", `cfg:${guildId}`, body);
  return res(200, body);
}

export function deleteGuildConfig(db: AegisDbEngine, guildId: string): OpResult {
  if (!isSnowflake(guildId)) return badRequest("guild id must be a Discord snowflake");
  db.delete("guild_configs", `cfg:${guildId}`);
  return res(200, { status: "deleted", guild_id: guildId });
}

// ── Cases ───────────────────────────────────────────────────────────────────

export interface CaseListQuery {
  user_id?: string | null;
  action?: string | null;
  skip?: string | null;
  limit?: string | null;
}

export function listCases(db: AegisDbEngine, guildId: string, query: CaseListQuery = {}): OpResult {
  if (!isSnowflake(guildId)) return badRequest("guild id must be a Discord snowflake");
  const uid = query.user_id ?? null;
  const act = query.action ?? null;
  if (uid !== null && !isSnowflake(uid)) return badRequest("user_id must be a Discord snowflake");
  if (act !== null && !isModerationAction(act.toLowerCase())) return badRequest("unknown action");
  const skip = queryInt(query.skip ?? null, "skip", 0, 0);
  const limit = queryInt(query.limit ?? null, "limit", 50, 1, 200);
  if (!skip.ok) return badRequest(skip.error);
  if (!limit.ok) return badRequest(limit.error);

  let list = db.prefixScan("cases", `case:${guildId}:`).map(([, val]) => val as CaseRecord);
  if (uid) list = list.filter((c) => c.target_id === uid);
  if (act) list = list.filter((c) => c.action.toLowerCase() === act.toLowerCase());
  list.sort((a, b) => b.case_id - a.case_id);
  const cases = list.slice(skip.value, skip.value + limit.value);
  return res(200, { guild_id: guildId, total: list.length, skip: skip.value, limit: limit.value, cases });
}

/**
 * Records a case. Ids come from the guild's counter (O(1)); a `case_ref` seen
 * before returns the existing case with 200, so retries are idempotent.
 */
export function createCase(db: AegisDbEngine, guildId: string, body: Record<string, unknown>): OpResult {
  if (!isSnowflake(guildId)) return badRequest("guild id must be a Discord snowflake");
  const check = validateCaseInput(body);
  if (!check.ok) return badRequest(check.error);
  const input = check.value;

  ensureCaseIndex(db, guildId);
  if (input.case_ref) {
    const dup = resolveCase(db, guildId, input.case_ref);
    if (dup) return res(200, dup[1]);
  }

  let nextId = db.increment("counters", caseCounterKey(guildId));
  // Defensive: never overwrite an existing case if the counter ever lagged.
  while (db.get("cases", caseKey(guildId, nextId)) !== null) {
    nextId = db.increment("counters", caseCounterKey(guildId));
  }

  const record: CaseRecord = {
    case_id: nextId,
    ...(input.case_ref ? { case_ref: input.case_ref } : {}),
    guild_id: guildId,
    target_id: input.target_id,
    target_tag: input.target_tag,
    mod_id: input.mod_id,
    mod_tag: input.mod_tag,
    action: input.action,
    reason: input.reason,
    created_at: Date.now(),
    duration_ms: input.duration_ms,
    revoked: false,
  };
  // Ref first: a crash between the writes leaves a dangling ref (ignored by
  // resolveCase), never a case that a retry could duplicate.
  if (input.case_ref) db.put("case_refs", caseRefKey(guildId, input.case_ref), nextId);
  db.put("cases", caseKey(guildId, nextId), record);
  return res(201, record);
}

export function getCase(db: AegisDbEngine, guildId: string, caseId: string): OpResult {
  if (!isSnowflake(guildId)) return badRequest("guild id must be a Discord snowflake");
  if (!/^\d+$/.test(caseId) && !isCaseRef(caseId)) return badRequest("invalid case id");
  const found = resolveCase(db, guildId, caseId);
  return found ? res(200, found[1]) : res(404, { error: "Case not found" });
}

export function patchCase(db: AegisDbEngine, guildId: string, caseId: string, body: Record<string, unknown>): OpResult {
  if (!isSnowflake(guildId)) return badRequest("guild id must be a Discord snowflake");
  if (!/^\d+$/.test(caseId) && !isCaseRef(caseId)) return badRequest("invalid case id");
  const check = validateCasePatch(body);
  if (!check.ok) return badRequest(check.error);
  const found = resolveCase(db, guildId, caseId);
  if (!found) return res(404, { error: "Case not found" });
  const [key, current] = found;
  const patch = check.value;
  const next: CaseRecord = { ...current };
  if (patch.reason !== undefined) next.reason = patch.reason;
  if (patch.revoked !== undefined) {
    next.revoked = patch.revoked;
    next.revoked_by = patch.revoked_by;
    next.revoked_reason = patch.revoked_reason;
  }
  db.put("cases", key, next);
  return res(200, next);
}

// ── Warnings ────────────────────────────────────────────────────────────────

export function createWarning(db: AegisDbEngine, guildId: string, body: Record<string, unknown>): OpResult {
  if (!isSnowflake(guildId)) return badRequest("guild id must be a Discord snowflake");
  const check = validateWarningInput(body);
  if (!check.ok) return badRequest(check.error);
  const { warn_ref: warnRef, ...input } = check.value;
  // A caller-supplied ref makes the key deterministic, so retries overwrite.
  const warnId = warnRef ?? `w_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const record: WarningRecord = {
    warn_id: warnId,
    guild_id: guildId,
    ...input,
    created_at: Date.now(),
    active: true,
  };
  db.put("warnings", `warn:${guildId}:${input.user_id}:${warnId}`, record);
  return res(201, record);
}

// ── Economy ─────────────────────────────────────────────────────────────────

function defaultAccount(guildId: string, userId: string): EconomyRecord {
  return { guild_id: guildId, user_id: userId, wallet: 0, bank: 0, bank_capacity: 5000, daily_streak: 0 };
}

export function leaderboard(db: AegisDbEngine, guildId: string, rawLimit: string | null = null): OpResult {
  if (!isSnowflake(guildId)) return badRequest("guild id must be a Discord snowflake");
  const limit = queryInt(rawLimit, "limit", 10, 1, 100);
  if (!limit.ok) return badRequest(limit.error);
  const list = db.prefixScan("economy", `eco:${guildId}:`).map(([, val]) => {
    const rec = val as EconomyRecord;
    return {
      user_id: rec.user_id,
      wallet: rec.wallet || 0,
      bank: rec.bank || 0,
      net_worth: (rec.wallet || 0) + (rec.bank || 0),
    };
  });
  list.sort((a, b) => b.net_worth - a.net_worth);
  const top = list.slice(0, limit.value).map((item, idx) => ({ rank: idx + 1, ...item }));
  return res(200, { guild_id: guildId, count: top.length, leaderboard: top });
}

export function getEconomy(db: AegisDbEngine, guildId: string, userId: string): OpResult {
  if (!isSnowflake(guildId) || !isSnowflake(userId)) return badRequest("guild and user ids must be Discord snowflakes");
  return res(200, (db.get("economy", `eco:${guildId}:${userId}`) as EconomyRecord | null) ?? defaultAccount(guildId, userId));
}

export function transactEconomy(db: AegisDbEngine, guildId: string, userId: string, body: Record<string, unknown>): OpResult {
  if (!isSnowflake(guildId) || !isSnowflake(userId)) return badRequest("guild and user ids must be Discord snowflakes");
  const check = validateTransact(body);
  if (!check.ok) return badRequest(check.error);
  const { kind, amount } = check.value;
  const key = `eco:${guildId}:${userId}`;

  // Work on a copy so a rejected transaction never mutates the stored record.
  const stored = db.get("economy", key) as EconomyRecord | null;
  const record: EconomyRecord = { ...(stored ?? defaultAccount(guildId, userId)) };

  if (kind === "deposit") {
    if (amount <= 0) return badRequest("Amount must be positive");
    if (record.wallet < amount) return badRequest("Insufficient wallet funds");
    const space = Math.max(0, record.bank_capacity - record.bank);
    if (amount > space) return badRequest("Exceeds bank capacity");
    record.wallet -= amount;
    record.bank += amount;
  } else if (kind === "withdraw") {
    if (amount <= 0) return badRequest("Amount must be positive");
    if (record.bank < amount) return badRequest("Insufficient bank funds");
    record.bank -= amount;
    record.wallet += amount;
  } else if (kind === "add_wallet") {
    record.wallet = Math.max(0, record.wallet + amount);
  } else if (kind === "set_wallet") {
    record.wallet = Math.max(0, amount);
  } else if (kind === "add_bank") {
    record.bank = Math.max(0, record.bank + amount);
  }

  db.put("economy", key, record);
  return res(200, record);
}
