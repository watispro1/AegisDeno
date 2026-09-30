import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { Command } from "../../types/discord";

const OWNER_ID = "123456789012345678"; // Replace with your actual ID

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("developer")
    .setDescription("Developer-only commands.")
    .addSubcommand(sub =>
      sub.setName("eval").setDescription("Evaluate raw JavaScript code")
        .addStringOption(opt => opt.setName("code").setDescription("Code to execute").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("stats").setDescription("View advanced bot statistics")
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    // Basic owner check
    if (interaction.user.id !== OWNER_ID && process.env.DISCORD_OWNER_ID !== interaction.user.id) {
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

    if (sub === "eval") {
      const code = interaction.options.getString("code", true);
      try {
        let result = await eval(`(async () => { ${code} })()`);
        if (typeof result !== "string") {
          result = require("util").inspect(result, { depth: 1 });
        }
        return interaction.reply({ content: `**Result:**\n\`\`\`js\n${String(result).substring(0, 1900)}\n\`\`\``, ephemeral: true });
      } catch (err) {
        return interaction.reply({ content: `**Error:**\n\`\`\`js\n${String(err)}\n\`\`\``, ephemeral: true });
      }
    }
  },
};
