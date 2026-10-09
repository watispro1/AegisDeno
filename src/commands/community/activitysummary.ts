import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
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

    let timeframe = interaction.options.getInteger("timeframe") || 7;
    await interaction.deferReply({ ephemeral: true });

    const buildEmbedAndButtons = async (days: number) => {
      const summary = await getGuildActivitySummary(interaction.guild!.id, days);

      const embed = new EmbedBuilder()
        .setTitle(`📊 Server Activity Digest — ${interaction.guild!.name}`)
        .setColor(0x3498DB)
        .setDescription(`Activity metrics summary for the **last ${days} day(s)**.`)
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

      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("act_tf_1")
          .setLabel("Last 24 Hours")
          .setStyle(days === 1 ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setEmoji("⚡"),
        new ButtonBuilder()
          .setCustomId("act_tf_7")
          .setLabel("Last 7 Days")
          .setStyle(days === 7 ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setEmoji("📅"),
        new ButtonBuilder()
          .setCustomId("act_tf_30")
          .setLabel("Last 30 Days")
          .setStyle(days === 30 ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setEmoji("📊")
      );

      return { embed, buttons };
    };

    const initial = await buildEmbedAndButtons(timeframe);
    const sent = await interaction.editReply({ embeds: [initial.embed], components: [initial.buttons] });

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
      filter: (i) => i.user.id === interaction.user.id,
    });

    collector.on("collect", async (i) => {
      let newDays = 7;
      if (i.customId === "act_tf_1") newDays = 1;
      if (i.customId === "act_tf_7") newDays = 7;
      if (i.customId === "act_tf_30") newDays = 30;

      await i.deferUpdate();
      const updated = await buildEmbedAndButtons(newDays);
      await interaction.editReply({ embeds: [updated.embed], components: [updated.buttons] });
    });

    collector.on("end", async () => {
      await interaction.editReply({ components: [] }).catch(() => null);
    });
  },
};

export default command;
