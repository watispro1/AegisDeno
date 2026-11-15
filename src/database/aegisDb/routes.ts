/**
 * REST API route dispatcher for AegisDB.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AegisDbEngine } from "./engine";
import type { AegisDbConfig, CaseRecord, EconomyRecord, WarningRecord } from "./types";

export function handleAegisDbRequest(
  req: IncomingMessage,
  res: ServerResponse,
  db: AegisDbEngine,
  config: AegisDbConfig,
): void {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-aegis-secret");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const rawUrl = req.url ?? "/";
  const [pathname, search] = rawUrl.split("?");
  const query = new URLSearchParams(search ?? "");

  const sendJson = (status: number, data: unknown) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(data));
  };

  // Public Health
  if (pathname === "/health" && req.method === "GET") {
    sendJson(200, {
      status: "ok",
      service: "aegis-db",
      version: "0.1.0",
      uptime_seconds: (db.stats().uptime_seconds as number) ?? 0,
    });
    return;
  }

  if ((pathname === "/metrics" || pathname === "/api/db/stats") && req.method === "GET") {
    sendJson(200, db.stats());
    return;
  }

  // Auth check for /api/ routes
  if (config.secret) {
    const provided = (req.headers["x-aegis-secret"] as string) ||
      (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : "");
    if (provided !== config.secret) {
      sendJson(401, { error: "unauthorized" });
      return;
    }
  }

  // Parse JSON body helper
  const readBody = async <T>(): Promise<T> => {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        try {
          resolve(body ? JSON.parse(body) as T : {} as T);
        } catch (err) {
          reject(err);
        }
      });
      req.on("error", reject);
    });
  };

  void (async () => {
    try {
      // 1. POST /api/db/compact
      if (pathname === "/api/db/compact" && req.method === "POST") {
        sendJson(200, db.compact());
        return;
      }

      // 2. Guild Config: /api/guilds/:guildId/config
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
          const body = await readBody<Record<string, unknown>>();
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

      // 3. Moderation Cases
      // List cases: GET /api/guilds/:guildId/cases
      const casesListMatch = pathname.match(/^\/api\/guilds\/([^/]+)\/cases$/);
      if (casesListMatch && req.method === "GET") {
        const guildId = decodeURIComponent(casesListMatch[1]);
        const prefix = `case:${guildId}:`;
        const all = db.prefixScan("cases", prefix);
        let list = all.map(([, val]) => val as CaseRecord);

        const uid = query.get("user_id");
        if (uid) list = list.filter((c) => c.target_id === uid);

        const act = query.get("action");
        if (act) list = list.filter((c) => c.action.toLowerCase() === act.toLowerCase());

        list.sort((a, b) => b.case_id - a.case_id);

        const total = list.length;
        const skip = Number(query.get("skip")) || 0;
        const limit = Math.min(200, Math.max(1, Number(query.get("limit")) || 50));
        const paginated = list.slice(skip, skip + limit);

        sendJson(200, { guild_id: guildId, total, skip, limit, cases: paginated });
        return;
      }

      // Create case: POST /api/guilds/:guildId/cases
      if (casesListMatch && req.method === "POST") {
        const guildId = decodeURIComponent(casesListMatch[1]);
        const body = await readBody<Record<string, unknown>>();
        const prefix = `case:${guildId}:`;
        const existing = db.prefixScan("cases", prefix);
        const maxId = existing.reduce((max, [, v]) => Math.max(max, (v as CaseRecord).case_id || 0), 0);
        const nextId = maxId + 1;
        const key = `case:${guildId}:${nextId}`;

        const record: CaseRecord = {
          case_id: nextId,
          guild_id: guildId,
          target_id: String(body.target_id ?? ""),
          target_tag: typeof body.target_tag === "string" ? body.target_tag : undefined,
          mod_id: String(body.mod_id ?? ""),
          mod_tag: typeof body.mod_tag === "string" ? body.mod_tag : undefined,
          action: String(body.action ?? "warn"),
          reason: String(body.reason ?? ""),
          created_at: Date.now(),
          duration_ms: typeof body.duration_ms === "number" ? body.duration_ms : undefined,
          revoked: false,
        };

        db.put("cases", key, record);
        sendJson(201, record);
        return;
      }

      // Single case: GET / PATCH /api/guilds/:guildId/cases/:caseId
      const singleCaseMatch = pathname.match(/^\/api\/guilds\/([^/]+)\/cases\/([^/]+)$/);
      if (singleCaseMatch) {
        const guildId = decodeURIComponent(singleCaseMatch[1]);
        const caseId = decodeURIComponent(singleCaseMatch[2]);
        const key = `case:${guildId}:${caseId}`;

        if (req.method === "GET") {
          const val = db.get("cases", key);
          if (val) sendJson(200, val);
          else sendJson(404, { error: "Case not found" });
          return;
        }

        if (req.method === "PATCH") {
          const val = db.get("cases", key) as CaseRecord | null;
          if (!val) {
            sendJson(404, { error: "Case not found" });
            return;
          }
          const body = await readBody<Record<string, unknown>>();
          if (typeof body.reason === "string") val.reason = body.reason;
          if (typeof body.revoked === "boolean") {
            val.revoked = body.revoked;
            val.revoked_by = typeof body.revoked_by === "string" ? body.revoked_by : undefined;
            val.revoked_reason = typeof body.revoked_reason === "string" ? body.revoked_reason : undefined;
          }
          db.put("cases", key, val);
          sendJson(200, val);
          return;
        }
      }

      // 4. Warnings: /api/guilds/:guildId/warnings
      const warningsPostMatch = pathname.match(/^\/api\/guilds\/([^/]+)\/warnings$/);
      if (warningsPostMatch && req.method === "POST") {
        const guildId = decodeURIComponent(warningsPostMatch[1]);
        const body = await readBody<Record<string, unknown>>();
        const warnId = `w_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const userId = String(body.user_id ?? "");
        const key = `warn:${guildId}:${userId}:${warnId}`;

        const record: WarningRecord = {
          warn_id: warnId,
          guild_id: guildId,
          user_id: userId,
          mod_id: String(body.mod_id ?? ""),
          reason: String(body.reason ?? ""),
          severity: String(body.severity ?? "standard"),
          created_at: Date.now(),
          active: true,
          proof_url: typeof body.proof_url === "string" ? body.proof_url : null,
        };

        db.put("warnings", key, record);
        sendJson(201, record);
        return;
      }

      // 5. Economy Leaderboard: /api/guilds/:guildId/economy/leaderboard
      const ecoLbMatch = pathname.match(/^\/api\/guilds\/([^/]+)\/economy\/leaderboard$/);
      if (ecoLbMatch && req.method === "GET") {
        const guildId = decodeURIComponent(ecoLbMatch[1]);
        const prefix = `eco:${guildId}:`;
        const all = db.prefixScan("economy", prefix);
        const limit = Math.min(100, Math.max(1, Number(query.get("limit")) || 10));

        const list = all.map(([, val]) => {
          const rec = val as EconomyRecord;
          return {
            user_id: rec.user_id,
            wallet: rec.wallet || 0,
            bank: rec.bank || 0,
            net_worth: (rec.wallet || 0) + (rec.bank || 0),
          };
        });

        list.sort((a, b) => b.net_worth - a.net_worth);
        const leaderboard = list.slice(0, limit).map((item, idx) => ({ rank: idx + 1, ...item }));

        sendJson(200, { guild_id: guildId, count: leaderboard.length, leaderboard });
        return;
      }

      // Economy Account: /api/guilds/:guildId/economy/:userId
      const ecoMatch = pathname.match(/^\/api\/guilds\/([^/]+)\/economy\/([^/]+)$/);
      if (ecoMatch && req.method === "GET") {
        const guildId = decodeURIComponent(ecoMatch[1]);
        const userId = decodeURIComponent(ecoMatch[2]);
        const key = `eco:${guildId}:${userId}`;
        const val = db.get("economy", key) as EconomyRecord | null;
        if (val) {
          sendJson(200, val);
        } else {
          sendJson(200, {
            guild_id: guildId,
            user_id: userId,
            wallet: 0,
            bank: 0,
            bank_capacity: 5000,
            daily_streak: 0,
          });
        }
        return;
      }

      // Economy transact: /api/guilds/:guildId/economy/:userId/transact
      const ecoTransactMatch = pathname.match(/^\/api\/guilds\/([^/]+)\/economy\/([^/]+)\/transact$/);
      if (ecoTransactMatch && req.method === "POST") {
        const guildId = decodeURIComponent(ecoTransactMatch[1]);
        const userId = decodeURIComponent(ecoTransactMatch[2]);
        const key = `eco:${guildId}:${userId}`;
        const body = await readBody<{ kind: string; amount: number; description?: string }>();

        let record = (db.get("economy", key) as EconomyRecord | null) ?? {
          guild_id: guildId,
          user_id: userId,
          wallet: 0,
          bank: 0,
          bank_capacity: 5000,
          daily_streak: 0,
        };

        const amt = Number(body.amount) || 0;
        if (body.kind === "deposit") {
          if (amt <= 0) return sendJson(400, { error: "Amount must be positive" });
          if (record.wallet < amt) return sendJson(400, { error: "Insufficient wallet funds" });
          const space = Math.max(0, record.bank_capacity - record.bank);
          if (amt > space) return sendJson(400, { error: "Exceeds bank capacity" });
          record.wallet -= amt;
          record.bank += amt;
        } else if (body.kind === "withdraw") {
          if (amt <= 0) return sendJson(400, { error: "Amount must be positive" });
          if (record.bank < amt) return sendJson(400, { error: "Insufficient bank funds" });
          record.bank -= amt;
          record.wallet += amt;
        } else if (body.kind === "add_wallet") {
          record.wallet = Math.max(0, record.wallet + amt);
        } else if (body.kind === "set_wallet") {
          record.wallet = Math.max(0, amt);
        } else if (body.kind === "add_bank") {
          record.bank = Math.max(0, record.bank + amt);
        }

        db.put("economy", key, record);
        sendJson(200, record);
        return;
      }

      sendJson(404, { error: "Not found" });
    } catch (err) {
      sendJson(500, { error: String(err) });
    }
  })();
}
