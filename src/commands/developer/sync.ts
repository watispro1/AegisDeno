import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  REST,
  Routes,
} from "discord.js";
import { Command } from "../../types/discord";
import { BOT_OWNER_IDS } from "../../config/env";
import { loadCommands, commands } from "../loader";
import { logger } from "../../utils/logger";

const TOKEN          = process.env.DISCORD_TOKEN!;
const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID!;
const TEST_GUILD_ID  = process.env.DISCORD_TEST_GUILD_ID;

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("sync")
    .setDescription("Force re-register all slash commands without restarting the bot. (Developer only)")
    .addBooleanOption(opt =>
      opt
        .setName("guild_only")
        .setDescription("Register to the current guild only (instant). Default: false = global (up to 1hr delay).")
        .setRequired(false)
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    if (!BOT_OWNER_IDS.has(interaction.user.id)) {
      return interaction.reply({
        content: "❌ You do not have permission to use developer commands.",
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const guildOnly = interaction.options.getBoolean("guild_only") ?? false;
    const targetGuildId = TEST_GUILD_ID || interaction.guildId;

    try {
      // Reload all commands from disk, clearing module cache
      const before = commands.size;
      
      // Clear Node.js require cache for command files so new/changed files are picked up
      const commandsDir = require("path").join(__dirname, "..");
      for (const key of Object.keys(require.cache)) {
        if (key.startsWith(commandsDir)) {
          delete require.cache[key];
        }
      }

      await loadCommands();
      const after = commands.size;

      // Update client.commands collection
      interaction.client.commands.clear();
      for (const [name, cmd] of commands) {
        interaction.client.commands.set(name, cmd);
      }

      // Re-register with Discord
      const rest = new REST({ version: "10" }).setToken(TOKEN);
      const commandData = Array.from(commands.values()).map(c => c.data.toJSON());

      let registeredScope: string;

      if (guildOnly && targetGuildId) {
        // Clear global first to avoid duplicates
        await rest.put(Routes.applicationCommands(APPLICATION_ID), { body: [] });
        await rest.put(Routes.applicationGuildCommands(APPLICATION_ID, targetGuildId), { body: commandData });
        registeredScope = `Guild \`${targetGuildId}\` (instant)`;
        logger.info(`[SYNC] Re-registered ${commandData.length} commands to guild ${targetGuildId}`);
      } else {
        // Clear any guild-scoped commands if we have a test guild set
        if (targetGuildId) {
          await rest.put(Routes.applicationGuildCommands(APPLICATION_ID, targetGuildId), { body: [] });
        }
        await rest.put(Routes.applicationCommands(APPLICATION_ID), { body: commandData });
        registeredScope = "Global (up to 1 hour propagation)";
        logger.info(`[SYNC] Re-registered ${commandData.length} commands globally`);
      }

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle("✅ Commands Synced")
        .addFields(
          { name: "Commands Before", value: `\`${before}\``, inline: true },
          { name: "Commands After",  value: `\`${after}\``,  inline: true },
          { name: "Scope",           value: registeredScope,  inline: false },
          {
            name: "Commands Registered",
            value: Array.from(commands.keys()).map(n => `\`/${n}\``).join(", ") || "None",
          },
        )
        .setFooter({ text: `Synced by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error: any) {
      logger.error("[SYNC] Failed to sync commands:", error);
      await interaction.editReply({
        content: `❌ Sync failed: \`${error?.message ?? String(error)}\``,
      });
    }
  },
};

export default command;
