import express from "express";
import { Client } from "discord.js";
import { logger } from "../utils/logger";
import { styles } from "./theme";
import {
  renderHome,
  renderFeatures,
  renderCommands,
  renderDocs,
  renderNotFound,
  SiteConfig,
  Stats,
} from "./pages";
import { commands } from "../commands/loader";

const SITE_VERSION = "1.0.0";

function siteConfig(): SiteConfig {
  const appId = process.env.DISCORD_APPLICATION_ID;
  return {
    inviteUrl:
      process.env.BOT_INVITE_URL ||
      (appId
        ? `https://discord.com/oauth2/authorize?client_id=${appId}&scope=bot%20applications.commands`
        : "#"),
    supportUrl: process.env.SUPPORT_SERVER_URL || "",
    version: SITE_VERSION,
  };
}

function collectStats(client: Client | undefined): Stats {
  const guilds = Array.from(client?.guilds?.cache?.values() ?? []);
  return {
    guilds: guilds.length,
    users: guilds.reduce((acc, g) => acc + (g.memberCount ?? 0), 0),
    commands: commands.size,
    ping: Math.max(0, Math.round(client?.ws?.ping ?? 0)),
    uptime: client?.uptime ?? 0,
  };
}

export function startWebServer(client: Client) {
  const app = express();
  const PORT = process.env.PORT || 3000;
  const cfg = siteConfig();

  app.disable("x-powered-by");

  app.get("/assets/site.css", (_req, res) => {
    res.type("text/css").send(styles);
  });

  app.get("/health", (_req, res) => {
    const stats = collectStats(client);
    res.json({
      status: "ok",
      version: SITE_VERSION,
      uptime: stats.uptime,
      guilds: stats.guilds,
      users: stats.users,
      commands: stats.commands,
      gatewayPing: stats.ping,
    });
  });

  const send = (res: express.Response, html: string) => {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.type("html").send(html);
  };

  app.get("/", (_req, res) => send(res, renderHome(cfg, collectStats(client))));

  app.get("/features", (_req, res) => send(res, renderFeatures(cfg)));

  app.get("/commands", (_req, res) => send(res, renderCommands(cfg)));

  app.get("/docs", (_req, res) => send(res, renderDocs(cfg)));

  app.use((_req, res) => {
    res.status(404).send(renderNotFound(cfg));
  });

  app.listen(PORT, () => {
    logger.info(`🌐 Website listening on port ${PORT}`);
  });
}
