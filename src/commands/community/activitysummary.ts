import { guardCollect } from "../../utils/collectorGuard";
import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from "discord.js";
import type { Command } from "../../types/discord";
import { getGuildActivitySummary } from "../../services/activitySummaryService";
import { COLORS, footer } from "../../utils/embedStyle";
import { ownsComponent } from "../shared/componentOwner";

/** Timeframes offered as buttons, in days. */
export const ACTIVITY_TIMEFRAMES = [1, 7, 30] as const;

/** The timeframe a button id stands for, or null for an unknown id. Pure. */
export function timeframeFromButton(customId: string): number | null {
  const m = /^act_tf_(\d+)$/.exec(customId);
  const days = m ? Number(m[1]) : NaN;
  return (ACTIVITY_TIMEFRAMES as readonly number[]).includes(days) ? days : null;
}

/** "last 24 hours" / "last 7 days". Pure. */
export function timeframeLabel(days: number): string {
  return days === 1 ? "last 24 hours" : `last ${days} days`;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("activitysummary")
    .setDescription("Staff digest: cases, warnings, tickets and suggestions over the last day, week or month.")
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
  // Declared so /help and the docs show who can use it; the check below stays as a second guard.
  userPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(interaction) {
    if (!interaction.guild) return;

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({ content: "❌ You need `Moderate Members` permission to view activity summaries.", flags: MessageFlags.Ephemeral });
      return;
    }

    const timeframe = interaction.options.getInteger("timeframe") || 7;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const buildEmbedAndButtons = async (days: number) => {
      const summary = await getGuildActivitySummary(interaction.guild!.id, days);

      const embed = new EmbedBuilder()
        .setTitle(`📊 Server Activity Digest — ${interaction.guild!.name}`)
        .setColor(COLORS.brand)
        .setDescription(`Activity for the **${timeframeLabel(days)}**. Open tickets and autoresponders are counted as of now.`)
        .addFields(
          { name: "🔨 Moderation Actions", value: `Total Cases: \`${summary.totalCases}\`\nWarnings Issued: \`${summary.totalWarnings}\``, inline: true },
          { name: "🎫 Support Tickets", value: `Open: \`${summary.openTickets}\`\nClosed Recently: \`${summary.closedTickets}\``, inline: true },
          { name: "🗳️ Community Suggestions", value: `Total: \`${summary.totalSuggestions}\`\nApproved: \`${summary.approvedSuggestions}\``, inline: true },
          { name: "🤖 Active Autoresponders", value: `Enabled: \`${summary.totalAutoResponders}\``, inline: true }
        )
        .setFooter(footer("Switch the timeframe with the buttons · /modstats for the full moderation view"))
        .setTimestamp();

      if (summary.recentCases.length > 0) {
        embed.addFields({
          name: "📈 Case Breakdown",
          value: summary.recentCases.map(c => `• **${c.action.toUpperCase()}:** ${c.count}`).join("\n").slice(0, 1024),
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
      idle: 120_000,
      filter: (i) => i.customId.startsWith("act_tf_"),
    });

    collector.on("collect", (i) => guardCollect("activitysummary", i, async () => {
      if (!(await ownsComponent(i, interaction.user.id, "activitysummary"))) return;
      const newDays = timeframeFromButton(i.customId) ?? 7;

      await i.deferUpdate();
      const updated = await buildEmbedAndButtons(newDays);
      await interaction.editReply({ embeds: [updated.embed], components: [updated.buttons] });
    }));

    collector.on("end", async () => {
      await interaction.editReply({ components: [] }).catch(() => null);
    });
  },
};

export default command;
