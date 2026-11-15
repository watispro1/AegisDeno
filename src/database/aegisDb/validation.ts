/**
 * Request validation for the AegisDB REST API. Every check returns either the
 * cleaned value or an error string; the router turns errors into HTTP 400.
 */
import type { IncomingMessage } from "node:http";

/** Moderation actions a case may record (the bot's ModerationAction type is derived from this). */
export const MODERATION_ACTIONS = [
  "warn",
  "kick",
  "ban",
  "softban",
  "temprole",
  "timeout",
  "untimeout",
  "unban",
  "clearwarnings",
  "purge",
  "lock",
  "unlock",
] as const;

export const ECONOMY_KINDS = ["deposit", "withdraw", "add_wallet", "set_wallet", "add_bank"] as const;

export const MAX_BODY_BYTES = 64 * 1024;
const MAX_REASON = 4000;
const MAX_TAG = 100;
const MAX_URL = 2048;

const SNOWFLAKE = /^\d{17,20}$/;
/** The bot's case id (a MongoDB ObjectId) or any short token with at least one non-digit. */
const CASE_REF = /^(?=.*[^0-9])[A-Za-z0-9_-]{1,64}$/;

export type Check<T> = { ok: true; value: T } | { ok: false; error: string };
const ok = <T>(value: T): Check<T> => ({ ok: true, value });
const bad = <T>(error: string): Check<T> => ({ ok: false, error });
const v = <T>(c: Check<T>): T | undefined => (c.ok ? c.value : undefined);

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function isSnowflake(v: unknown): v is string {
  return typeof v === "string" && SNOWFLAKE.test(v);
}

export function isCaseRef(v: unknown): v is string {
  return typeof v === "string" && CASE_REF.test(v);
}

export function isModerationAction(v: unknown): v is (typeof MODERATION_ACTIONS)[number] {
  return typeof v === "string" && (MODERATION_ACTIONS as readonly string[]).includes(v);
}

/** Reads a JSON object body of at most MAX_BODY_BYTES; throws HttpError (400/413). */
export function readJsonObject(req: IncomingMessage, limit = MAX_BODY_BYTES): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers["content-length"] ?? 0);
    if (Number.isFinite(declared) && declared > limit) {
      req.resume();
      reject(new HttpError(413, "body_too_large"));
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let failed = false;
    req.on("data", (chunk: Buffer) => {
      if (failed) return;
      size += chunk.length;
      if (size > limit) {
        failed = true;
        chunks.length = 0;
        reject(new HttpError(413, "body_too_large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (failed) return;
      const text = Buffer.concat(chunks).toString("utf8");
      if (!text.trim()) return resolve({});
      try {
        const parsed: unknown = JSON.parse(text);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          reject(new HttpError(400, "body must be a JSON object"));
          return;
        }
        resolve(parsed as Record<string, unknown>);
      } catch {
        reject(new HttpError(400, "invalid JSON body"));
      }
    });
    req.on("error", (err) => {
      if (!failed) reject(err);
    });
  });
}

function optString(v: unknown, name: string, max: number): Check<string | undefined> {
  if (v === undefined || v === null) return ok(undefined);
  if (typeof v !== "string" || v.length > max) return bad(`${name} must be a string of at most ${max} characters`);
  return ok(v);
}

/** Non-negative integer query parameter; absent means `fallback`. */
export function queryInt(raw: string | null, name: string, fallback: number, min: number, max?: number): Check<number> {
  if (raw === null || raw === "") return ok(fallback);
  if (!/^\d+$/.test(raw)) return bad(`${name} must be a non-negative integer`);
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < min) return bad(`${name} must be an integer >= ${min}`);
  return ok(max !== undefined ? Math.min(n, max) : n);
}

export interface CaseInput {
  case_ref?: string;
  target_id: string;
  target_tag?: string;
  mod_id: string;
  mod_tag?: string;
  action: (typeof MODERATION_ACTIONS)[number];
  reason: string;
  duration_ms?: number;
}

export function validateCaseInput(body: Record<string, unknown>): Check<CaseInput> {
  if (body.case_ref !== undefined && !isCaseRef(body.case_ref)) return bad("case_ref is invalid");
  if (!isSnowflake(body.target_id)) return bad("target_id must be a Discord snowflake");
  if (!isSnowflake(body.mod_id)) return bad("mod_id must be a Discord snowflake");
  if (!isModerationAction(body.action)) return bad(`action must be one of: ${MODERATION_ACTIONS.join(", ")}`);
  const reason = optString(body.reason ?? "", "reason", MAX_REASON);
  const targetTag = optString(body.target_tag, "target_tag", MAX_TAG);
  const modTag = optString(body.mod_tag, "mod_tag", MAX_TAG);
  for (const c of [reason, targetTag, modTag]) if (!c.ok) return bad(c.error);
  const d = body.duration_ms;
  if (d !== undefined && d !== null && !(Number.isSafeInteger(d) && (d as number) >= 0)) {
    return bad("duration_ms must be a non-negative integer");
  }
  return ok({
    case_ref: body.case_ref as string | undefined,
    target_id: body.target_id,
    target_tag: v(targetTag),
    mod_id: body.mod_id,
    mod_tag: v(modTag),
    action: body.action,
    reason: v(reason) ?? "",
    duration_ms: typeof d === "number" ? d : undefined,
  });
}

export interface CasePatch {
  reason?: string;
  revoked?: boolean;
  revoked_by?: string;
  revoked_reason?: string;
}

export function validateCasePatch(body: Record<string, unknown>): Check<CasePatch> {
  const reason = optString(body.reason, "reason", MAX_REASON);
  const revokedReason = optString(body.revoked_reason, "revoked_reason", MAX_REASON);
  if (!reason.ok) return bad(reason.error);
  if (!revokedReason.ok) return bad(revokedReason.error);
  if (body.revoked !== undefined && typeof body.revoked !== "boolean") return bad("revoked must be a boolean");
  if (body.revoked_by !== undefined && body.revoked_by !== null && !isSnowflake(body.revoked_by)) {
    return bad("revoked_by must be a Discord snowflake");
  }
  return ok({
    reason: reason.value,
    revoked: body.revoked as boolean | undefined,
    revoked_by: (body.revoked_by ?? undefined) as string | undefined,
    revoked_reason: revokedReason.value,
  });
}

export interface WarningInput {
  warn_ref?: string;
  user_id: string;
  mod_id: string;
  reason: string;
  severity: string;
  proof_url: string | null;
}

export function validateWarningInput(body: Record<string, unknown>): Check<WarningInput> {
  if (body.warn_ref !== undefined && !isCaseRef(body.warn_ref)) return bad("warn_ref is invalid");
  if (!isSnowflake(body.user_id)) return bad("user_id must be a Discord snowflake");
  if (!isSnowflake(body.mod_id)) return bad("mod_id must be a Discord snowflake");
  const reason = optString(body.reason ?? "", "reason", MAX_REASON);
  const severity = optString(body.severity, "severity", 32);
  const proof = optString(body.proof_url, "proof_url", MAX_URL);
  for (const c of [reason, severity, proof]) if (!c.ok) return bad(c.error);
  return ok({
    warn_ref: body.warn_ref as string | undefined,
    user_id: body.user_id,
    mod_id: body.mod_id,
    reason: v(reason) ?? "",
    severity: v(severity) ?? "standard",
    proof_url: v(proof) ?? null,
  });
}

export interface TransactInput {
  kind: (typeof ECONOMY_KINDS)[number];
  amount: number;
  description?: string;
}

export function validateTransact(body: Record<string, unknown>): Check<TransactInput> {
  if (typeof body.kind !== "string" || !(ECONOMY_KINDS as readonly string[]).includes(body.kind)) {
    return bad(`kind must be one of: ${ECONOMY_KINDS.join(", ")}`);
  }
  if (!Number.isSafeInteger(body.amount)) return bad("amount must be an integer");
  const description = optString(body.description, "description", 200);
  if (!description.ok) return bad(description.error);
  return ok({ kind: body.kind as TransactInput["kind"], amount: body.amount as number, description: description.value });
}
