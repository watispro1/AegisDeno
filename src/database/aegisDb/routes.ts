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
import type { AegisDbConfig } from "./types";
import { isAuthorized, isDevEnvironment } from "./auth";
import { handleEconomyRoute } from "./routesEconomy";
import * as ops from "./operations";
import { HttpError, isSnowflake, readJsonObject } from "./validation";

/** Re-exported for callers that used the router's helper. */
export const resolveCase = ops.resolveCase;

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
  const send = (r: ops.OpResult) => sendJson(r.status, r.body);

  if (pathname === "/health" && req.method === "GET") {
    send(ops.health(db));
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
      if (pathname === "/api/db/stats" && req.method === "GET") return send(ops.stats(db));
      if (pathname === "/api/db/compact" && req.method === "POST") return send(ops.compact(db));

      const guildMatch = pathname.match(/^\/api\/guilds\/([^/]+)\//);
      if (guildMatch && !isSnowflake(decodeURIComponent(guildMatch[1]))) {
        sendJson(400, { error: "guild id must be a Discord snowflake" });
        return;
      }

      // Guild config: /api/guilds/:guildId/config
      const guildCfgMatch = pathname.match(/^\/api\/guilds\/([^/]+)\/config$/);
      if (guildCfgMatch) {
        const guildId = decodeURIComponent(guildCfgMatch[1]);
        if (req.method === "GET") return send(ops.getGuildConfig(db, guildId));
        if (req.method === "PUT") return send(ops.putGuildConfig(db, guildId, await readJsonObject(req)));
        if (req.method === "DELETE") return send(ops.deleteGuildConfig(db, guildId));
      }

      // Cases list / create: /api/guilds/:guildId/cases
      const casesListMatch = pathname.match(/^\/api\/guilds\/([^/]+)\/cases$/);
      if (casesListMatch && req.method === "GET") {
        return send(ops.listCases(db, decodeURIComponent(casesListMatch[1]), {
          user_id: query.get("user_id"),
          action: query.get("action"),
          skip: query.get("skip"),
          limit: query.get("limit"),
        }));
      }
      if (casesListMatch && req.method === "POST") {
        // Read the body first; the create itself is synchronous.
        const body = await readJsonObject(req);
        return send(ops.createCase(db, decodeURIComponent(casesListMatch[1]), body));
      }

      // Single case: GET / PATCH /api/guilds/:guildId/cases/:caseId (number or case_ref)
      const singleCaseMatch = pathname.match(/^\/api\/guilds\/([^/]+)\/cases\/([^/]+)$/);
      if (singleCaseMatch && (req.method === "GET" || req.method === "PATCH")) {
        const guildId = decodeURIComponent(singleCaseMatch[1]);
        const caseId = decodeURIComponent(singleCaseMatch[2]);
        if (req.method === "GET") return send(ops.getCase(db, guildId, caseId));
        const body = await readJsonObject(req);
        return send(ops.patchCase(db, guildId, caseId, body));
      }

      // Warnings: POST /api/guilds/:guildId/warnings
      const warningsPostMatch = pathname.match(/^\/api\/guilds\/([^/]+)\/warnings$/);
      if (warningsPostMatch && req.method === "POST") {
        const body = await readJsonObject(req);
        return send(ops.createWarning(db, decodeURIComponent(warningsPostMatch[1]), body));
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
