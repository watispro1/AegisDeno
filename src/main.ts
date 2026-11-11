import "dotenv/config";
import { Events, REST, Routes } from "discord.js";
import { loadCommands, commands } from "./commands/loader";
import { commandRegistrationData } from "./commands/registration";
import { createClient, setupEvents } from "./bot/client";
import { initScheduler, shutdownScheduler } from "./services/schedulerRunner";
import { connectDatabase, closeDatabase } from "./database/mongo";
import { logger } from "./utils/logger";
import { startWebServer } from "./web/server";
import { flushMemberActivity } from "./services/memberActivity";
import { statusMonitor } from "./services/statusMonitor";
import { createShutdown } from "./utils/shutdown";
import { shutdownGiveawayTimers } from "./services/giveawayService";

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
  const commandData = commandRegistrationData();
  const commandNames = commandData.map(c => `/${c.name}`).join(", ");

  logger.info(`commands to register (${commandData.length}): ${commandNames}`);

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
        logger.info(`clearing ${existing.length} guild command(s) in ${guildId}`);
        await rest.put(Routes.applicationGuildCommands(APPLICATION_ID, guildId), { body: [] });
      }
    } catch (err) {
      logger.warn(`could not clear guild commands for ${guildId}:`, err);
    }
  }

  logger.info(`registering ${commandData.length} commands globally`);
  await rest.put(Routes.applicationCommands(APPLICATION_ID), { body: commandData });
  logger.info(`registered ${commandData.length} global commands`);
}

async function main(): Promise<void> {
  logger.info("starting aegis");

  await connectDatabase();

  await loadCommands();

  // Start the web server before registering commands so Fly's health check
  // passes while Discord's API is slow.
  const client = createClient();
  setupEvents(client);
  startWebServer(client);

  try {
    await registerCommands();
    statusMonitor().setRegistration(true, commands.size);
  } catch (err) {
    statusMonitor().setRegistration(false, commands.size);
    logger.error("Failed to register slash commands:", err);
    // Keep booting: the commands are usually still registered from the last run.
  }

  // "ready" is deprecated in discord.js 14.22+; clientReady is the same event.
  client.once(Events.ClientReady, async (c) => {
    // Clear any leftover guild commands so they never duplicate with global commands
    try {
      const rest = new REST({ version: "10" }).setToken(TOKEN);
      for (const [guildId, guild] of c.guilds.cache) {
        const existing = (await rest.get(Routes.applicationGuildCommands(APPLICATION_ID, guildId)).catch(() => null)) as unknown[];
        if (Array.isArray(existing) && existing.length > 0) {
          logger.info(`clearing ${existing.length} duplicate guild command(s) in ${guild.name} (${guildId})`);
          await rest.put(Routes.applicationGuildCommands(APPLICATION_ID, guildId), { body: [] }).catch(() => null);
        }
      }
    } catch (err) {
      logger.debug("Automatic guild commands cleanup failed:", err);
    }

    await initScheduler(c).catch(err => logger.error("Scheduler init error:", err));
    const { initGiveawayScheduler } = await import("./commands/community/giveaway");
    await initGiveawayScheduler(c).catch(err => logger.error("Giveaway scheduler init error:", err));
    const { initTopGG } = await import("./services/topgg");
    initTopGG(c);
    const { startLowTrustSync } = await import("./services/lowTrustSync");
    startLowTrustSync(c);
  });

  // Order matters: stop timers first so nothing new starts, disconnect from
  // Discord so no more events arrive, then flush buffered writes and close Mongo.
  const shutdown = createShutdown({
    log: logger,
    steps: [
      { name: "scheduler", run: () => shutdownScheduler() },
      { name: "giveaway timers", run: () => shutdownGiveawayTimers() },
      { name: "discord client", run: () => client.destroy() },
      { name: "activity flush", run: () => flushMemberActivity() },
      { name: "database", run: () => closeDatabase() },
    ],
  });

  process.on("SIGINT",  () => { void shutdown("SIGINT"); });
  process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
  process.on("uncaughtException",  err => logger.error("Uncaught Exception:", err));
  process.on("unhandledRejection", err => logger.error("Unhandled Rejection:", err));

  await client.login(TOKEN);
}

main().catch(err => {
  logger.error("Fatal startup error:", err);
  process.exit(1);
});
