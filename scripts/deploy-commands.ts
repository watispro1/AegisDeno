import { validateEnv, config } from "../src/config/env.ts";
import { loadCommands, commands } from "../src/commands/loader.ts";
import { createBot } from "../src/bot/createBot.ts";

async function deploy() {
  validateEnv();
  await loadCommands();
  
  const bot = createBot();

  const commandData = Array.from(commands.values()).map(cmd => ({
    name: cmd.name,
    description: cmd.description,
    options: cmd.options,
  }));

  console.log(`Deploying ${commandData.length} commands...`);
  
  if (config.DISCORD_TEST_GUILD_ID) {
    await bot.helpers.upsertGuildApplicationCommands(
      config.DISCORD_TEST_GUILD_ID,
      commandData
    );
    console.log(`Successfully deployed commands to guild ${config.DISCORD_TEST_GUILD_ID}.`);
  } else {
    await bot.helpers.upsertGlobalApplicationCommands(commandData);
    console.log("Successfully deployed global commands.");
  }
}

deploy().catch((err) => {
  console.error("Failed to deploy commands:", err);
  Deno.exit(1);
});
