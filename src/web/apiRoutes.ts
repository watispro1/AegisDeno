/** Health check and the small JSON API (stats, command catalog, Top.gg webhook). */
import express, { type Express } from "express";
import { logger } from "../utils/logger";
import { buildCatalog, catalogStats, getCommand } from "./catalog";
import { secretMatches } from "./securityHeaders";
import { createHealthCheck } from "./health";
import { mirrorQueueStats } from "../services/aegisMirror";
import { getRustClient } from "../database/rustClient";
import { getAegisDbEngine } from "../database/aegisDb";
import { isAuthorized } from "../database/aegisDb/auth";
import type { Stats } from "./pages";

export interface ApiRouteDeps {
  online: () => boolean;
  databaseReady: () => boolean;
  stats: () => Stats;
  version: string;
  startedAt: number;
}

/**
 * Cached AegisDB health probe: updated every 15 s, never blocks a request.
 * Started by the web server (startWebServer), not by route registration, so
 * registering routes in tests leaves no timers or network calls behind.
 */
let rustBackendUp = false;
let rustProbeTimer: ReturnType<typeof setInterval> | null = null;

export function startBackendProbe(): void {
  if (rustProbeTimer) return;
  const probe = async () => {
    rustBackendUp = await getRustClient().ping().catch(() => false);
  };
  void probe();
  rustProbeTimer = setInterval(() => void probe(), 15_000);
  rustProbeTimer.unref?.();
}

export function stopBackendProbe(): void {
  if (rustProbeTimer) clearInterval(rustProbeTimer);
  rustProbeTimer = null;
}

/** Whether the AegisDB store answers: the embedded engine is open, or the last probe of the remote one succeeded. */
export function backendHealthy(): boolean {
  return rustBackendUp || getAegisDbEngine() !== null;
}

export function registerApiRoutes(app: Express, deps: ApiRouteDeps): void {
  const health = createHealthCheck({ startedAt: deps.startedAt });

  app.get("/health", (_req, res) => {
    const stats = deps.stats();
    const isUp = backendHealthy();
    const reading = health(deps.online(), deps.databaseReady(), isUp);
    res.setHeader("Cache-Control", "no-store");
    res.status(reading.httpStatus).json({
      status: reading.status,
      gateway: reading.gateway,
      database: reading.database,
      rustBackend: reading.rustBackend,
      version: deps.version,
      uptime: Math.floor(stats.uptime / 1000),
      guilds: stats.guilds,
      users: stats.users,
      commands: stats.commands,
      gatewayPing: stats.ping,
      // AegisDB write-mirror backlog: counts only. Mongo stays the source of truth.
      aegisDbMirror: mirrorQueueStats(),
    });
  });

  app.get("/api/stats", (_req, res) => {
    const stats = deps.stats();
    const cs = catalogStats();
    const isUp = backendHealthy();
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Robots-Tag", "noindex");
    res.json({
      online: deps.online(),
      version: deps.version,
      ping: stats.ping,
      uptime: Math.floor(stats.uptime / 1000),
      guilds: stats.guilds,
      users: stats.users,
      commands: stats.commands,
      catalog: cs,
      rustBackend: { healthy: isUp },
    });
  });

  // Public callers get only { ok, healthy }; the full engine stats need the
  // admin secret (AEGIS_BACKEND_SECRET) in x-aegis-secret or a Bearer header.
  // No CORS header: this is not meant to be read from other origins.
  app.get("/api/backend/stats", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex");
    const secret = process.env.AEGIS_BACKEND_SECRET ?? "";
    if (!isAuthorized(req.headers, secret)) {
      res.json({ ok: true, healthy: backendHealthy() });
      return;
    }
    const engine = getAegisDbEngine();
    if (engine) {
      res.json({ ok: true, healthy: true, ...engine.stats() });
      return;
    }
    try {
      const data = await getRustClient().stats();
      res.json({ ok: true, healthy: true, ...data });
    } catch (err) {
      logger.debug("AegisDB stats probe failed:", err);
      res.status(503).json({ ok: false, healthy: false, error: "backend_unavailable" });
    }
  });

  app.get("/api/commands", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Robots-Tag", "noindex");
    res.json({ commands: buildCatalog() });
  });

  // Top.gg sends a small JSON object; bound parsing prevents unauthenticated
  // requests from consuming unbounded memory before the shared-secret check.
  app.post("/api/topgg/webhook", express.json({ limit: "16kb" }), (req, res) => {
    const auth = process.env.TOPGG_WEBHOOK_AUTH;
    if (!auth) {
      logger.warn("Rejected Top.gg webhook because TOPGG_WEBHOOK_AUTH is not configured.");
      res.status(503).json({ error: "webhook_not_configured" });
      return;
    }
    if (!secretMatches(req.headers.authorization, auth)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
    const field = (v: unknown) =>
      typeof v === "string" || typeof v === "number" || typeof v === "boolean"
        ? String(v).slice(0, 40).replace(/[^\w.-]/g, "")
        : "?";
    logger.info(
      `top.gg vote: user ${field(body.user)}, type ${field(body.type)}, weekend ${field(body.isWeekend)}, guild ${body.guild ? field(body.guild) : "none"}`,
    );
    res.json({ status: "ok" });
  });

  app.get("/api/commands/:name", (req, res) => {
    const name = String(req.params.name ?? "")
      .replace(/^\//, "")
      .slice(0, 64);
    const found = getCommand(name);

    if (!found) {
      res.setHeader("Cache-Control", "no-store");
      res.status(404).json({ error: "unknown_command", name: name.replace(/[^a-z0-9_-]/gi, "") });
      return;
    }

    res.setHeader("Cache-Control", "public, max-age=600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Robots-Tag", "noindex");
    res.json({
      name: found.name,
      description: found.description,
      category: found.category,
      guildOnly: found.guildOnly,
      permissions: {
        declared: found.declaredPermissions,
        enforced: found.enforcedPermissions,
        bot: found.botPermissions,
        botFeatures: found.featurePermissions,
      },
      options: found.options,
      subcommands: found.subcommands,
    });
  });
}
