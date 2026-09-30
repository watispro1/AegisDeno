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

async function registerCommands(): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  const commandData = Array.from(commands.values()).map(c => c.data.toJSON());

  if (TEST_GUILD_ID) {
    logger.info(`Clearing global commands to prevent duplicates...`);
    await rest.put(Routes.applicationCommands(APPLICATION_ID), { body: [] });
    logger.info(`Registering ${commandData.length} commands to test guild ${TEST_GUILD_ID}...`);
    await rest.put(Routes.applicationGuildCommands(APPLICATION_ID, TEST_GUILD_ID), { body: commandData });
    logger.info("Guild commands registered.");
  } else {
    logger.info(`Registering ${commandData.length} commands globally...`);
    await rest.put(Routes.applicationCommands(APPLICATION_ID), { body: commandData });
    logger.info("Global commands registered (up to 1h propagation delay).");
  }
}

async function main(): Promise<void> {
  logger.info("\x1b[1m🛡️  Aegis Bot — Starting...\x1b[0m");

  // 1. Load all command modules
  await loadCommands();

  // 2. Register slash commands with Discord
  await registerCommands();

  // 3. Create and configure the client
  await connectDatabase();
  const client = createClient();
  setupEvents(client);
  startWebServer(client);

  // 4. Init scheduler after login
  client.once("ready", async (c) => {
    await initScheduler(c).catch(err => logger.error("Scheduler init error:", err));
  });

  // 5. Graceful shutdown
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

  // 6. Login
  await client.login(TOKEN);
}

main().catch(err => {
  logger.error("Fatal startup error:", err);
  process.exit(1);
});
