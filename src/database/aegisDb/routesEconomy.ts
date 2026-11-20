/**
 * Economy routes for AegisDB: account read, leaderboard, and transactions.
 * The logic lives in operations.ts so the in-process client can call it too.
 */
import type { IncomingMessage } from "node:http";
import type { AegisDbEngine } from "./engine";
import * as ops from "./operations";
import { readJsonObject } from "./validation";

export type SendJson = (status: number, data: unknown) => void;

/** Handles /api/guilds/:guildId/economy/... Returns false when the path is not an economy route. */
export async function handleEconomyRoute(
  req: IncomingMessage,
  pathname: string,
  query: URLSearchParams,
  db: AegisDbEngine,
  sendJson: SendJson,
): Promise<boolean> {
  const send = (r: ops.OpResult) => (sendJson(r.status, r.body), true);

  const lb = pathname.match(/^\/api\/guilds\/([^/]+)\/economy\/leaderboard$/);
  if (lb && req.method === "GET") return send(ops.leaderboard(db, decodeURIComponent(lb[1]), query.get("limit")));

  const account = pathname.match(/^\/api\/guilds\/([^/]+)\/economy\/([^/]+)(\/transact)?$/);
  if (!account) return false;
  const guildId = decodeURIComponent(account[1]);
  const userId = decodeURIComponent(account[2]);

  if (!account[3] && req.method === "GET") return send(ops.getEconomy(db, guildId, userId));
  if (account[3] && req.method === "POST") {
    const body = await readJsonObject(req);
    return send(ops.transactEconomy(db, guildId, userId, body));
  }
  return false;
}
