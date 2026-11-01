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

// Narrowed copies: TypeScript does not carry the process.exit() narrowing into main().
const TOKEN: string = RAW_TOKEN;
const APPLICATION_ID: string = RAW_APPLICATION_ID;

async function main(): Promise<void> {
  await loadCommands();

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  const commandData = Array.from(commands.values()).map(c => c.data.toJSON());

  // 1. Always register globally so any server with the bot receives commands
  logger.info(`Registering ${commandData.length} commands globally...`);
  await rest.put(Routes.applicationCommands(APPLICATION_ID), { body: commandData });
  logger.info("Global commands registered (propagating across Discord).");

  // 2. Clear any specifically requested stale guild IDs
  for (const guildId of (CLEAR_GUILD_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean)) {
    try {
      const existing = (await rest.get(
        Routes.applicationGuildCommands(APPLICATION_ID, guildId)
      )) as { body?: unknown[] };
      if (Array.isArray(existing.body) && existing.body.length > 0) {
        logger.info(`Clearing ${existing.body.length} stale guild command(s) in ${guildId}...`);
        await rest.put(Routes.applicationGuildCommands(APPLICATION_ID, guildId), { body: [] });
      }
    } catch (err) {
      logger.warn(`Could not clear stale commands in ${guildId}:`, err);
    }
  }

  // 3. Register directly to active guilds for instant availability (0s propagation delay)
  const targetGuildIds = new Set<string>();
  if (TEST_GUILD_ID) {
    targetGuildIds.add(TEST_GUILD_ID);
  }

  try {
    const guilds = (await rest.get(Routes.userGuilds())) as Array<{ id: string; name: string }>;
    if (Array.isArray(guilds)) {
      for (const g of guilds) {
        targetGuildIds.add(g.id);
      }
    }
  } catch (err) {
    logger.warn("Could not list current guilds via REST:", err);
  }

  for (const guildId of targetGuildIds) {
    try {
      logger.info(`Registering ${commandData.length} commands instantly to guild ${guildId}...`);
      await rest.put(Routes.applicationGuildCommands(APPLICATION_ID, guildId), { body: commandData });
    } catch (err) {
      logger.warn(`Failed to register instant commands for guild ${guildId}:`, err);
    }
  }

  logger.info(`✅ Deployment complete. Commands active globally and instantly in ${targetGuildIds.size} guild(s).`);
}

main().catch(err => {
  logger.error("Failed to deploy commands:", err);
  process.exit(1);
});
