/**
 * Economy routes for AegisDB: account read, leaderboard, and transactions.
 */
import type { IncomingMessage } from "node:http";
import type { AegisDbEngine } from "./engine";
import type { EconomyRecord } from "./types";
import { isSnowflake, queryInt, readJsonObject, validateTransact } from "./validation";

export type SendJson = (status: number, data: unknown) => void;

function defaultAccount(guildId: string, userId: string): EconomyRecord {
  return { guild_id: guildId, user_id: userId, wallet: 0, bank: 0, bank_capacity: 5000, daily_streak: 0 };
}

/** Handles /api/guilds/:guildId/economy/... Returns false when the path is not an economy route. */
export async function handleEconomyRoute(
  req: IncomingMessage,
  pathname: string,
  query: URLSearchParams,
  db: AegisDbEngine,
  sendJson: SendJson,
): Promise<boolean> {
  const lb = pathname.match(/^\/api\/guilds\/([^/]+)\/economy\/leaderboard$/);
  if (lb && req.method === "GET") {
    const guildId = decodeURIComponent(lb[1]);
    if (!isSnowflake(guildId)) return (sendJson(400, { error: "guild id must be a Discord snowflake" }), true);
    const limit = queryInt(query.get("limit"), "limit", 10, 1, 100);
    if (!limit.ok) return (sendJson(400, { error: limit.error }), true);

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
    const leaderboard = list.slice(0, limit.value).map((item, idx) => ({ rank: idx + 1, ...item }));
    sendJson(200, { guild_id: guildId, count: leaderboard.length, leaderboard });
    return true;
  }

  const account = pathname.match(/^\/api\/guilds\/([^/]+)\/economy\/([^/]+)(\/transact)?$/);
  if (!account) return false;
  const guildId = decodeURIComponent(account[1]);
  const userId = decodeURIComponent(account[2]);
  if (!isSnowflake(guildId) || !isSnowflake(userId)) {
    sendJson(400, { error: "guild and user ids must be Discord snowflakes" });
    return true;
  }
  const key = `eco:${guildId}:${userId}`;

  if (!account[3] && req.method === "GET") {
    sendJson(200, (db.get("economy", key) as EconomyRecord | null) ?? defaultAccount(guildId, userId));
    return true;
  }

  if (account[3] && req.method === "POST") {
    const check = validateTransact(await readJsonObject(req));
    if (!check.ok) return (sendJson(400, { error: check.error }), true);
    const { kind, amount } = check.value;

    // Everything from here to the put is synchronous, so no other request can
    // interleave a read of the same balance. Work on a copy so a rejected
    // transaction never mutates the stored record.
    const stored = db.get("economy", key) as EconomyRecord | null;
    const record: EconomyRecord = { ...(stored ?? defaultAccount(guildId, userId)) };

    if (kind === "deposit") {
      if (amount <= 0) return (sendJson(400, { error: "Amount must be positive" }), true);
      if (record.wallet < amount) return (sendJson(400, { error: "Insufficient wallet funds" }), true);
      const space = Math.max(0, record.bank_capacity - record.bank);
      if (amount > space) return (sendJson(400, { error: "Exceeds bank capacity" }), true);
      record.wallet -= amount;
      record.bank += amount;
    } else if (kind === "withdraw") {
      if (amount <= 0) return (sendJson(400, { error: "Amount must be positive" }), true);
      if (record.bank < amount) return (sendJson(400, { error: "Insufficient bank funds" }), true);
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
    sendJson(200, record);
    return true;
  }

  return false;
}
