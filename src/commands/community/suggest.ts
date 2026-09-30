import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { Command } from "../../types/discord";
import { createSuggestion } from "../../services/suggestions";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("suggest")
    .setDescription("Submit a suggestion for the server.")
    .addStringOption(opt =>
      opt.setName("suggestion").setDescription("Your suggestion").setRequired(true)
    ),

  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const content = interaction.options.getString("suggestion", true);
    const guildId = interaction.guildId!;

    const suggestion = await createSuggestion(guildId, interaction.user.id, content);

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle("💡 Suggestion Submitted")
      .setDescription(content)
      .setFooter({ text: `ID: ${suggestion.id}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });

    // Optional: send to a designated suggestions channel if configured
    // For now, we just reply to the user.
    await interaction.followUp({ content: `✅ Your suggestion has been recorded. ID: \`${suggestion.id}\``, ephemeral: true });
  },
};
