/** Health check and the small JSON API (stats, command catalog, Top.gg webhook). */
import express, { type Express } from "express";
import { logger } from "../utils/logger";
import { buildCatalog, catalogStats, getCommand } from "./catalog";
import { secretMatches } from "./securityHeaders";
import { createHealthCheck } from "./health";
import type { Stats } from "./pages";

export interface ApiRouteDeps {
  online: () => boolean;
  databaseReady: () => boolean;
  stats: () => Stats;
  version: string;
  startedAt: number;
}

export function registerApiRoutes(app: Express, deps: ApiRouteDeps): void {
  const health = createHealthCheck({ startedAt: deps.startedAt });

  app.get("/health", (_req, res) => {
    const stats = deps.stats();
    const reading = health(deps.online(), deps.databaseReady());
    res.setHeader("Cache-Control", "no-store");
    res.status(reading.httpStatus).json({
      status: reading.status,
      gateway: reading.gateway,
      database: reading.database,
      version: deps.version,
      uptime: Math.floor(stats.uptime / 1000),
      guilds: stats.guilds,
      users: stats.users,
      commands: stats.commands,
      gatewayPing: stats.ping,
    });
  });

  app.get("/api/stats", (_req, res) => {
    const stats = deps.stats();
    const cs = catalogStats();
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
    });
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
    const field = (v: unknown) => (typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? String(v).slice(0, 40).replace(/[^\w.-]/g, "") : "?");
    logger.info(`top.gg vote: user ${field(body.user)}, type ${field(body.type)}, weekend ${field(body.isWeekend)}, guild ${body.guild ? field(body.guild) : "none"}`);
    res.json({ status: "ok" });
  });

  app.get("/api/commands/:name", (req, res) => {
    const name = String(req.params.name ?? "").replace(/^\//, "").slice(0, 64);
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
