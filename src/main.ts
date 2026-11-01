import "dotenv/config";
import { REST, Routes } from "discord.js";
import { loadCommands, commands } from "./commands/loader";
import { createClient, setupEvents } from "./bot/client";
import { initScheduler, shutdownScheduler } from "./services/schedulerRunner";
import { connectDatabase, closeDatabase } from "./database/mongo";
import { logger } from "./utils/logger";
import { startWebServer } from "./web/server";
import { flushMemberActivity } from "./services/memberActivity";
import { statusMonitor } from "./services/statusMonitor";

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
  const commandNames = commandData.map(c => `/${c.name}`).join(", ");

  logger.info(`📝 Commands to register (${commandData.length}): ${commandNames}`);

  // Clear guild-scoped commands in test guild or specified guilds so commands never show up twice
  const clearGuildIds = new Set<string>();
  if (TEST_GUILD_ID) clearGuildIds.add(TEST_GUILD_ID);
  (process.env.DISCORD_CLEAR_GUILD_IDS ?? "")
    .split(",")
    .map(id => id.trim())
    .filter(Boolean)
    .forEach(id => clearGuildIds.add(id));

  for (const guildId of clearGuildIds) {
    try {
      const existing = (await rest.get(
        Routes.applicationGuildCommands(APPLICATION_ID, guildId)
      )) as unknown[];
      if (Array.isArray(existing) && existing.length > 0) {
        logger.info(`Clearing ${existing.length} duplicate guild command(s) in ${guildId}...`);
        await rest.put(Routes.applicationGuildCommands(APPLICATION_ID, guildId), { body: [] });
      }
    } catch (err) {
      logger.warn(`Could not clear duplicate guild commands for ${guildId}:`, err);
    }
  }

  // Register globally so every server receives exactly 1 copy of each command
  logger.info(`Registering ${commandData.length} commands globally...`);
  await rest.put(Routes.applicationCommands(APPLICATION_ID), { body: commandData });
  logger.info(`✅ Global commands registered (${commandData.length} total, no duplicates).`);
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
    statusMonitor().setRegistration(true, commands.size);
  } catch (err) {
    statusMonitor().setRegistration(false, commands.size);
    logger.error("Failed to register slash commands:", err);
    // Don't crash here; let the bot boot and just log the error. Commands might 
    // already be registered or it's a transient Discord API issue.
  }

  // 5. Init scheduler and Top.gg stats after login
  client.once("ready", async (c) => {
    await initScheduler(c).catch(err => logger.error("Scheduler init error:", err));
    const { initGiveawayScheduler } = await import("./commands/community/giveaway");
    await initGiveawayScheduler(c).catch(err => logger.error("Giveaway scheduler init error:", err));
    const { initTopGG } = await import("./services/topgg");
    initTopGG(c);
  });

  // 6. Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    shutdownScheduler();
    await flushMemberActivity().catch(err => logger.warn("Activity flush error:", err));
    await closeDatabase().catch(err => logger.error("Database shutdown error:", err));
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
