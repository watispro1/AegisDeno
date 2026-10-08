import "dotenv/config";
import { REST, Routes } from "discord.js";
import { loadCommands, commands } from "./commands/loader";
import { createClient, setupEvents } from "./bot/client";
import { initScheduler, shutdownScheduler } from "./services/schedulerRunner";
import { connectDatabase, closeDatabase } from "./database/mongo";
import { logger } from "./utils/logger";
import { startWebServer } from "./web/server";

const TOKEN           = process.env.DISCORD_TOKEN!;
const APPLICATION_ID  = process.env.DISCORD_APPLICATION_ID!;
const TEST_GUILD_ID   = process.env.DISCORD_TEST_GUILD_ID;

if (!TOKEN || !APPLICATION_ID) {
  logger.error("Missing DISCORD_TOKEN or DISCORD_APPLICATION_ID in .env");
  process.exit(1);
}

/**
 * Register slash commands in exactly one scope.
 *
 * Discord merges global and guild-scoped commands in the client, so registering
 * the same command in both scopes makes it appear twice in the slash menu. Only
 * one scope may hold commands at a time, so we always wipe the other one.
 */
async function registerCommands(): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  const commandData = Array.from(commands.values()).map(c => c.data.toJSON());

  if (TEST_GUILD_ID) {
    logger.info("Clearing global commands to prevent duplicates...");
    await rest.put(Routes.applicationCommands(APPLICATION_ID), { body: [] });
    logger.info(`Registering ${commandData.length} commands to test guild ${TEST_GUILD_ID}...`);
    await rest.put(Routes.applicationGuildCommands(APPLICATION_ID, TEST_GUILD_ID), { body: commandData });
    logger.info("Guild commands registered.");
  } else {
    const clearGuildIds = (process.env.DISCORD_CLEAR_GUILD_IDS ?? "")
      .split(",")
      .map(id => id.trim())
      .filter(Boolean);

    for (const guildId of clearGuildIds) {
      const existing = (await rest.get(
        Routes.applicationGuildCommands(APPLICATION_ID, guildId)
      )) as { body?: unknown[] };
      const body = existing.body;
      if (Array.isArray(body) && body.length > 0) {
        logger.info(`Clearing ${body.length} stale guild command(s) in ${guildId}...`);
        await rest.put(Routes.applicationGuildCommands(APPLICATION_ID, guildId), { body: [] });
      }
    }

    logger.info(`Registering ${commandData.length} commands globally...`);
    await rest.put(Routes.applicationCommands(APPLICATION_ID), { body: commandData });
    logger.info("Global commands registered (up to 1h propagation delay).");
  }
}

async function main(): Promise<void> {
  logger.info("\x1b[1m🛡️  Aegis Bot — Starting...\x1b[0m");

  // 1. Connect to Database first (essential for functionality)
  await connectDatabase();

  // 2. Load all command modules locally
  await loadCommands();

  // 3. Create client and start web server ASAP for health checks
  const client = createClient();
  setupEvents(client);
  startWebServer(client);

  // 4. Register slash commands (Network bound)
  // By doing this after startWebServer, we ensure the port is bound and healthy
  // while we wait for Discord's API to register commands.
  try {
    await registerCommands();
  } catch (err) {
    logger.error("Failed to register slash commands:", err);
    // Don't crash here; let the bot boot and just log the error. Commands might 
    // already be registered or it's a transient Discord API issue.
  }

  // 5. Init scheduler and Top.gg stats after login
  client.once("ready", async (c) => {
    await initScheduler(c).catch(err => logger.error("Scheduler init error:", err));
    const { initTopGG } = await import("./services/topgg");
    initTopGG(c);
  });

  // 6. Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    shutdownScheduler();
    closeDatabase();
    client.destroy();
    process.exit(0);
  };

  process.on("SIGINT",  () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("uncaughtException",  err => logger.error("Uncaught Exception:", err));
  process.on("unhandledRejection", err => logger.error("Unhandled Rejection:", err));

  // 7. Login
  await client.login(TOKEN);
}

main().catch(err => {
  logger.error("Fatal startup error:", err);
  process.exit(1);
});
