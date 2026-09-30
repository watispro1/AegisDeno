import "dotenv/config";
import { REST, Routes } from "discord.js";
import { loadCommands, commands } from "../src/commands/loader";
import { logger } from "../src/utils/logger";

const TOKEN = process.env.DISCORD_TOKEN;
const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;
const TEST_GUILD_ID = process.env.DISCORD_TEST_GUILD_ID;
const CLEAR_GUILD_IDS = process.env.DISCORD_CLEAR_GUILD_IDS;

if (!TOKEN || !APPLICATION_ID) {
  logger.error("Missing DISCORD_TOKEN or DISCORD_APPLICATION_ID in .env");
  process.exit(1);
}

async function main(): Promise<void> {
  await loadCommands();

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  const commandData = Array.from(commands.values()).map(c => c.data.toJSON());

  if (TEST_GUILD_ID) {
    logger.info("Clearing global commands to prevent duplicates...");
    await rest.put(Routes.applicationCommands(APPLICATION_ID), { body: [] });
    logger.info(`Registering ${commandData.length} commands to guild ${TEST_GUILD_ID}...`);
    await rest.put(Routes.applicationGuildCommands(APPLICATION_ID, TEST_GUILD_ID), { body: commandData });
    logger.info("Guild commands registered (instant).");
    return;
  }

  for (const guildId of (CLEAR_GUILD_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean)) {
    const existing = (await rest.get(
      Routes.applicationGuildCommands(APPLICATION_ID, guildId)
    )) as { body?: unknown[] };
    if (Array.isArray(existing.body) && existing.body.length > 0) {
      logger.info(`Clearing ${existing.body.length} stale guild command(s) in ${guildId}...`);
      await rest.put(Routes.applicationGuildCommands(APPLICATION_ID, guildId), { body: [] });
    }
  }

  logger.info(`Registering ${commandData.length} commands globally...`);
  await rest.put(Routes.applicationCommands(APPLICATION_ID), { body: commandData });
  logger.info("Global commands registered (up to 1h propagation delay).");
}

main().catch(err => {
  logger.error("Failed to deploy commands:", err);
  process.exit(1);
});
