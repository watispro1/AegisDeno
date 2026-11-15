/**
 * REST API route dispatcher for AegisDB.
 *
 * Server-to-server only: no CORS headers are sent, so browsers on other
 * origins cannot call it. Everything except `/health` and the redacted
 * `/metrics` needs the admin secret. Bodies are capped at 64 KB and every id,
 * action, and amount is validated (400 on failure).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AegisDbEngine } from "./engine";
import type { AegisDbConfig, CaseRecord, WarningRecord } from "./types";
import { isAuthorized, isDevEnvironment } from "./auth";
import { handleEconomyRoute } from "./routesEconomy";
import {
  HttpError,
  isCaseRef,
  isModerationAction,
  isSnowflake,
  queryInt,
  readJsonObject,
  validateCaseInput,
  validateCasePatch,
  validateWarningInput,
} from "./validation";

/** Finds a case by numeric AegisDB id or by the bot's own case reference (Mongo _id). */
function resolveCase(db: AegisDbEngine, guildId: string, caseId: string): [string, CaseRecord] | null {
  if (/^\d+$/.test(caseId)) {
    const key = `case:${guildId}:${Number(caseId)}`;
    const val = db.get("cases", key) as CaseRecord | null;
    return val ? [key, val] : null;
  }
  if (!isCaseRef(caseId)) return null;
  for (const [key, val] of db.prefixScan("cases", `case:${guildId}:`)) {
    if ((val as CaseRecord).case_ref === caseId) return [key, val as CaseRecord];
  }
  return null;
}

export function handleAegisDbRequest(
  req: IncomingMessage,
  res: ServerResponse,
  db: AegisDbEngine,
  config: AegisDbConfig,
): void {
  const rawUrl = req.url ?? "/";
  const [pathname, search] = rawUrl.split("?");
  const query = new URLSearchParams(search ?? "");
  const authorized = isAuthorized(req.headers, config.secret, isDevEnvironment());

  const sendJson = (status: number, data: unknown) => {
    if (res.headersSent) return;
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(data));
  };

  if (pathname === "/health" && req.method === "GET") {
    sendJson(200, {
      status: "ok",
      service: "aegis-db",
      version: "0.1.0",
      uptime_seconds: (db.stats().uptime_seconds as number) ?? 0,
    });
    return;
  }

  // Public callers learn only that the service is up; full metrics need the secret.
  if (pathname === "/metrics" && req.method === "GET") {
    sendJson(200, authorized ? db.stats() : { healthy: true });
    return;
  }

  if (!authorized) {
    req.resume();
    sendJson(401, { error: "unauthorized" });
    return;
  }

  void (async () => {
    try {
      if (pathname === "/api/db/stats" && req.method === "GET") {
        sendJson(200, db.stats());
        return;
      }
      if (pathname === "/api/db/compact" && req.method === "POST") {
        sendJson(200, db.compact());
        return;
      }

      const guildMatch = pathname.match(/^\/api\/guilds\/([^/]+)\//);
      if (guildMatch && !isSnowflake(decodeURIComponent(guildMatch[1]))) {
        sendJson(400, { error: "guild id must be a Discord snowflake" });
        return;
      }

      // Guild config: /api/guilds/:guildId/config
      const guildCfgMatch = pathname.match(/^\/api\/guilds\/([^/]+)\/config$/);
      if (guildCfgMatch) {
        const guildId = decodeURIComponent(guildCfgMatch[1]);
        const key = `cfg:${guildId}`;
        if (req.method === "GET") {
          const val = db.get("guild_configs", key);
          if (val) sendJson(200, val);
          else sendJson(404, { error: "Guild config not found" });
          return;
        }
        if (req.method === "PUT") {
          const body = await readJsonObject(req);
          db.put("guild_configs", key, body);
          sendJson(200, body);
          return;
        }
        if (req.method === "DELETE") {
          db.delete("guild_configs", key);
          sendJson(200, { status: "deleted", guild_id: guildId });
          return;
        }
      }

      // Cases list / create: /api/guilds/:guildId/cases
      const casesListMatch = pathname.match(/^\/api\/guilds\/([^/]+)\/cases$/);
      if (casesListMatch && req.method === "GET") {
        const guildId = decodeURIComponent(casesListMatch[1]);
        const uid = query.get("user_id");
        const act = query.get("action");
        if (uid !== null && !isSnowflake(uid)) return sendJson(400, { error: "user_id must be a Discord snowflake" });
        if (act !== null && !isModerationAction(act.toLowerCase())) return sendJson(400, { error: "unknown action" });
        const skip = queryInt(query.get("skip"), "skip", 0, 0);
        const limit = queryInt(query.get("limit"), "limit", 50, 1, 200);
        if (!skip.ok) return sendJson(400, { error: skip.error });
        if (!limit.ok) return sendJson(400, { error: limit.error });

        let list = db.prefixScan("cases", `case:${guildId}:`).map(([, val]) => val as CaseRecord);
        if (uid) list = list.filter((c) => c.target_id === uid);
        if (act) list = list.filter((c) => c.action.toLowerCase() === act.toLowerCase());
        list.sort((a, b) => b.case_id - a.case_id);
        const cases = list.slice(skip.value, skip.value + limit.value);
        sendJson(200, { guild_id: guildId, total: list.length, skip: skip.value, limit: limit.value, cases });
        return;
      }

      if (casesListMatch && req.method === "POST") {
        const guildId = decodeURIComponent(casesListMatch[1]);
        const check = validateCaseInput(await readJsonObject(req));
        if (!check.ok) return sendJson(400, { error: check.error });
        const input = check.value;

        // From here to the put is synchronous: no other request can allocate
        // the same id in between.
        const existing = db.prefixScan("cases", `case:${guildId}:`).map(([, v]) => v as CaseRecord);
        if (input.case_ref) {
          const dup = existing.find((c) => c.case_ref === input.case_ref);
          if (dup) return sendJson(200, dup); // idempotent retry
        }
        const nextId = existing.reduce((max, c) => Math.max(max, c.case_id || 0), 0) + 1;
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
        db.put("cases", `case:${guildId}:${nextId}`, record);
        sendJson(201, record);
        return;
      }

      // Single case: GET / PATCH /api/guilds/:guildId/cases/:caseId (number or case_ref)
      const singleCaseMatch = pathname.match(/^\/api\/guilds\/([^/]+)\/cases\/([^/]+)$/);
      if (singleCaseMatch && (req.method === "GET" || req.method === "PATCH")) {
        const guildId = decodeURIComponent(singleCaseMatch[1]);
        const caseId = decodeURIComponent(singleCaseMatch[2]);
        if (!/^\d+$/.test(caseId) && !isCaseRef(caseId)) return sendJson(400, { error: "invalid case id" });

        if (req.method === "GET") {
          const found = resolveCase(db, guildId, caseId);
          if (found) sendJson(200, found[1]);
          else sendJson(404, { error: "Case not found" });
          return;
        }

        // Read the body first, then resolve + modify + write synchronously.
        const check = validateCasePatch(await readJsonObject(req));
        if (!check.ok) return sendJson(400, { error: check.error });
        const found = resolveCase(db, guildId, caseId);
        if (!found) return sendJson(404, { error: "Case not found" });
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
        sendJson(200, next);
        return;
      }

      // Warnings: POST /api/guilds/:guildId/warnings
      const warningsPostMatch = pathname.match(/^\/api\/guilds\/([^/]+)\/warnings$/);
      if (warningsPostMatch && req.method === "POST") {
        const guildId = decodeURIComponent(warningsPostMatch[1]);
        const check = validateWarningInput(await readJsonObject(req));
        if (!check.ok) return sendJson(400, { error: check.error });
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
        sendJson(201, record);
        return;
      }

      if (await handleEconomyRoute(req, pathname, query, db, sendJson)) return;

      sendJson(404, { error: "Not found" });
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.status === 413) res.setHeader("Connection", "close");
        sendJson(err.status, { error: err.message });
        return;
      }
      sendJson(500, { error: "internal_error" });
    }
  })();
}
