import "dotenv/config";
import { REST, Routes } from "discord.js";
import { loadCommands, commands } from "../src/commands/loader";
import { logger } from "../src/utils/logger";

const RAW_TOKEN = process.env.DISCORD_TOKEN;
const RAW_APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;
const TEST_GUILD_ID = process.env.DISCORD_TEST_GUILD_ID;
const CLEAR_GUILD_IDS = process.env.DISCORD_CLEAR_GUILD_IDS;

if (!RAW_TOKEN || !RAW_APPLICATION_ID) {
  logger.error("Missing DISCORD_TOKEN or DISCORD_APPLICATION_ID in .env");
  process.exit(1);
}

const TOKEN: string = RAW_TOKEN;
const APPLICATION_ID: string = RAW_APPLICATION_ID;

const args = process.argv.slice(2);
const cleanGuildsOnly = args.includes("--clean-guilds") || args.includes("-c");
const guildOnly = args.includes("--guild-only") || args.includes("-g");

async function main(): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  // Mode 1: Clean guild-scoped commands to eliminate duplicates
  if (cleanGuildsOnly) {
    logger.info("🧹 Cleaning all guild-scoped commands to remove duplicate commands...");
    const guildIds = new Set<string>();
    if (TEST_GUILD_ID) guildIds.add(TEST_GUILD_ID);
    if (CLEAR_GUILD_IDS) {
      CLEAR_GUILD_IDS.split(",").map(s => s.trim()).filter(Boolean).forEach(id => guildIds.add(id));
    }

    try {
      const guilds = (await rest.get(Routes.userGuilds())) as Array<{ id: string; name: string }>;
      if (Array.isArray(guilds)) {
        guilds.forEach(g => guildIds.add(g.id));
      }
    } catch (err) {
      logger.warn("Could not list current guilds via REST:", err);
    }

    for (const guildId of guildIds) {
      try {
        const existing = (await rest.get(Routes.applicationGuildCommands(APPLICATION_ID, guildId))) as unknown[];
        if (Array.isArray(existing) && existing.length > 0) {
          logger.info(`Clearing ${existing.length} guild command(s) in guild ${guildId}...`);
          await rest.put(Routes.applicationGuildCommands(APPLICATION_ID, guildId), { body: [] });
        }
      } catch (err) {
        logger.warn(`Could not clear commands in guild ${guildId}:`, err);
      }
    }

    logger.info("✅ Finished clearing guild commands. Exactly 1 copy (global) will now display in Discord!");
    return;
  }

  await loadCommands();
  const commandData = Array.from(commands.values()).map(c => c.data.toJSON());

  // Mode 2: Guild-only deployment (for isolated dev servers)
  if (guildOnly) {
    if (!TEST_GUILD_ID) {
      logger.error("Missing DISCORD_TEST_GUILD_ID in .env for --guild-only deployment.");
      process.exit(1);
    }
    logger.info("Clearing global commands to prevent duplicate entries...");
    await rest.put(Routes.applicationCommands(APPLICATION_ID), { body: [] });
    logger.info(`Registering ${commandData.length} commands to test guild ${TEST_GUILD_ID}...`);
    await rest.put(Routes.applicationGuildCommands(APPLICATION_ID, TEST_GUILD_ID), { body: commandData });
    logger.info(`✅ Instant guild commands registered in guild ${TEST_GUILD_ID}.`);
    return;
  }

  // Mode 3: Standard Global Deployment (Default)
  // Registers globally and wipes guild-scoped commands so every server gets EXACTLY ONE copy of each command.
  logger.info(`Registering ${commandData.length} commands globally...`);
  await rest.put(Routes.applicationCommands(APPLICATION_ID), { body: commandData });
  logger.info(`✅ Global commands registered (${commandData.length} total).`);

  // Automatically wipe guild-scoped commands in active guilds to prevent 2x duplicates!
  logger.info("Wiping stale guild-scoped commands to prevent duplicate entries in slash menus...");
  const guildIdsToClean = new Set<string>();
  if (TEST_GUILD_ID) guildIdsToClean.add(TEST_GUILD_ID);
  if (CLEAR_GUILD_IDS) {
    CLEAR_GUILD_IDS.split(",").map(s => s.trim()).filter(Boolean).forEach(id => guildIdsToClean.add(id));
  }

  try {
    const guilds = (await rest.get(Routes.userGuilds())) as Array<{ id: string; name: string }>;
    if (Array.isArray(guilds)) {
      guilds.forEach(g => guildIdsToClean.add(g.id));
    }
  } catch (err) {
    logger.warn("Could not list current guilds via REST:", err);
  }

  for (const guildId of guildIdsToClean) {
    try {
      const existing = (await rest.get(Routes.applicationGuildCommands(APPLICATION_ID, guildId))) as unknown[];
      if (Array.isArray(existing) && existing.length > 0) {
        logger.info(`Clearing ${existing.length} duplicate guild command(s) in guild ${guildId}...`);
        await rest.put(Routes.applicationGuildCommands(APPLICATION_ID, guildId), { body: [] });
      }
    } catch (err) {
      logger.warn(`Could not clear duplicate commands in guild ${guildId}:`, err);
    }
  }

  logger.info("✅ Deployment complete. All commands are active globally with zero duplicates!");
}

main().catch(err => {
  logger.error("Failed to deploy commands:", err);
  process.exit(1);
});
