import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { Command } from "../../types/discord";
import { BOT_OWNER_IDS } from "../../config/env";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("developer")
    .setDescription("Developer-only commands.")
    .addSubcommand(sub =>
      sub.setName("stats").setDescription("View advanced bot statistics")
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    if (!BOT_OWNER_IDS.has(interaction.user.id)) {
      return interaction.reply({ content: "❌ You do not have permission to use developer commands.", ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "stats") {
      const mem = process.memoryUsage();
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle("🔧 Developer Stats")
        .addFields(
          { name: "Heap Total", value: `${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`, inline: true },
          { name: "Heap Used", value: `${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`, inline: true },
          { name: "RSS", value: `${(mem.rss / 1024 / 1024).toFixed(2)} MB`, inline: true },
          { name: "Uptime", value: `${Math.floor(process.uptime())}s`, inline: true },
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

  },
};
