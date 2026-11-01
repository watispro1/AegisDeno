/**
 * The public status feed: starts the heartbeat monitor, builds the status
 * payload and serves it as /api/status. Split out of server.ts.
 */
import type { Express } from "express";
import type { Client } from "discord.js";
import { buildStatusPayload, type StatusPayload } from "./statusData";
import { loadNotices } from "./statusNotices";
import { databaseConnected, statusMonitor } from "../services/statusMonitor";
import type { Stats } from "./pages";

export function registerStatusRoutes(app: Express, o: { online: () => boolean; stats: () => Stats; client: Client | undefined; version: string; startedAt: number }): () => Promise<StatusPayload> {
  const { client, online } = o;
  const collectStats = (_c: unknown) => o.stats();
  const SITE_VERSION = o.version;
  const STARTED_AT = o.startedAt;
  // Heartbeat samples for the status page's uptime history (memory + capped Mongo).
  const monitor = statusMonitor(() => ({ gateway: online(), ping: Math.max(0, Math.round(client?.ws?.ping ?? 0)) }));
  monitor.start().then(() => monitor.tick()).catch(() => undefined);
  const statusPayload = async (): Promise<StatusPayload> => {
    const stats = collectStats(client);
    return buildStatusPayload({
      nowMs: Date.now(),
      online: online(),
      ping: stats.ping,
      guilds: stats.guilds,
      shards: Number((client?.ws as { shards?: { size?: number } } | undefined)?.shards?.size ?? 1) || 1,
      memoryRss: process.memoryUsage().rss,
      version: SITE_VERSION,
      startedAt: STARTED_AT,
      commands: stats.commands,
      dbConnected: databaseConnected(),
      dbLatency: monitor.lastDbLatency(),
      registration: monitor.registration(),
      samples: monitor.samples(),
      notices: await loadNotices().catch(() => []),
    });
  };

  // Public status as JSON: states, counts and times only (no hostnames, env or error text).
  app.get("/api/status", async (_req, res, next) => {
    try {
      const payload = await statusPayload();
      res.setHeader("Cache-Control", "public, max-age=15, stale-while-revalidate=30");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("X-Robots-Tag", "noindex");
      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  return statusPayload;
}
