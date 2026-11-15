import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  REST,
  Routes,
  MessageFlags,
} from "discord.js";
import { truncate } from "../../utils/safeText";
import { Command } from "../../types/discord";
import { BOT_OWNER_IDS } from "../../config/env";
import { loadCommands, commands } from "../loader";
import { commandRegistrationData } from "../registration";
import { logger } from "../../utils/logger";
import { requestConfirmation } from "../../utils/confirmation";

/** What a sync will register and clear, for the confirmation prompt. Pure. */
export function syncPlan(guildOnly: boolean, targetGuildId: string | null | undefined): { register: string; clear: string } {
  if (guildOnly && targetGuildId) return { register: `guild \`${targetGuildId}\` (instant)`, clear: "all **global** commands (so they don't show twice)" };
  return { register: "global (up to 1 hour to appear)", clear: targetGuildId ? `the commands registered to guild \`${targetGuildId}\`` : "nothing" };
}

const TOKEN          = process.env.DISCORD_TOKEN!;
const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID!;
const TEST_GUILD_ID  = process.env.DISCORD_TEST_GUILD_ID;

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("sync")
    .setDescription("Reload and re-register every slash command without a restart (bot owners only; asks to confirm).")
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
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guildOnly = interaction.options.getBoolean("guild_only") ?? false;
    const targetGuildId = TEST_GUILD_ID || interaction.guildId;

    if (!TOKEN || !APPLICATION_ID) {
      await interaction.editReply("❌ `DISCORD_TOKEN` or `DISCORD_APPLICATION_ID` isn't set, so commands can't be registered from here.");
      return;
    }
    if (guildOnly && !targetGuildId) {
      await interaction.editReply("❌ `guild_only` needs a server: run this in one, or set `DISCORD_TEST_GUILD_ID`.");
      return;
    }
    // Registering also clears the other scope, which can make commands vanish for a while.
    const plan = syncPlan(guildOnly, targetGuildId);
    const answer = await requestConfirmation(interaction, {
      content: `🔄 Reload commands from disk and register them to **${plan.register}**?\nThis also clears ${plan.clear}.`,
      confirmLabel: "Sync commands",
    });
    if (answer !== "confirmed") return;

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

      interaction.client.commands.clear();
      for (const [name, cmd] of commands) {
        interaction.client.commands.set(name, cmd);
      }

      const rest = new REST({ version: "10" }).setToken(TOKEN);
      const commandData = commandRegistrationData();

      let registeredScope: string;

      if (guildOnly && targetGuildId) {
        // Clear global commands first or they show up twice
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
            value: truncate(Array.from(commands.keys()).map(n => `\`/${n}\``).join(", "), 1024) || "None",
          },
        )
        .setFooter({ text: `Synced by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ content: "", embeds: [embed] });

    } catch (error) {
      logger.error("[SYNC] Failed to sync commands:", error);
      await interaction.editReply({
        content: `❌ Sync failed: \`${error instanceof Error ? error.message : String(error)}\``,
      });
    }
  },
};

export default command;
