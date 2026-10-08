import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/discord";
import { getGuildActivitySummary } from "../../services/activitySummaryService";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("activitysummary")
    .setDescription("View server moderation and community activity summary metrics.")
    .setDMPermission(false)
    .addIntegerOption(opt =>
      opt
        .setName("timeframe")
        .setDescription("Timeframe in days (1, 7, or 30)")
        .setRequired(false)
        .addChoices(
          { name: "Last 24 Hours", value: 1 },
          { name: "Last 7 Days", value: 7 },
          { name: "Last 30 Days", value: 30 }
        )
    ),

  category: "community",
  guildOnly: true,

  async execute(interaction) {
    if (!interaction.guild) return;

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({ content: "❌ You need `Moderate Members` permission to view activity summaries.", ephemeral: true });
      return;
    }

    const timeframe = interaction.options.getInteger("timeframe") || 7;
    await interaction.deferReply({ ephemeral: true });

    const summary = await getGuildActivitySummary(interaction.guild.id, timeframe);

    const embed = new EmbedBuilder()
      .setTitle(`📊 Server Activity Digest — ${interaction.guild.name}`)
      .setColor(0x3498DB)
      .setDescription(`Activity metrics summary for the **last ${timeframe} day(s)**.`)
      .addFields(
        { name: "🔨 Moderation Actions", value: `Total Cases: \`${summary.totalCases}\`\nWarnings Issued: \`${summary.totalWarnings}\``, inline: true },
        { name: "🎫 Support Tickets", value: `Open: \`${summary.openTickets}\`\nClosed Recently: \`${summary.closedTickets}\``, inline: true },
        { name: "🗳️ Community Suggestions", value: `Total: \`${summary.totalSuggestions}\`\nApproved: \`${summary.approvedSuggestions}\``, inline: true },
        { name: "🤖 Active Autoresponders", value: `Enabled: \`${summary.totalAutoResponders}\``, inline: true }
      )
      .setTimestamp();

    if (summary.recentCases.length > 0) {
      embed.addFields({
        name: "📈 Case Breakdown",
        value: summary.recentCases.map(c => `• **${c.action.toUpperCase()}:** ${c.count}`).join("\n"),
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
