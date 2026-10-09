import { logger } from "../../utils/logger";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { Command } from "../../types/discord";
import { getRecentCasesForGuild, getTopOffendersForGuild } from "../../services/moderationCases";
import { WarningModel, ModerationCaseModel } from "../../database/mongo";

const ACTION_EMOJI: Record<string, string> = {
  warn: "⚠️", kick: "👢", ban: "🔨", timeout: "⏱️",
  untimeout: "✅", unban: "✅", clearwarnings: "🗑️",
};

const ACTION_COLOR = {
  "7d": 0x5865F2,
  "30d": 0x9B59B6,
} as const;

type Period = "7d" | "30d";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("modstats")
    .setDescription("View an interactive moderation activity dashboard for this server.")
    .addStringOption(opt =>
      opt
        .setName("period")
        .setDescription("Time period for stats (default: 7 days)")
        .setRequired(false)
        .addChoices(
          { name: "Last 7 days", value: "7d" },
          { name: "Last 30 days", value: "30d" },
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const initialPeriod = (interaction.options.getString("period") ?? "7d") as Period;
    await interaction.deferReply({ ephemeral: true });

    const buildEmbed = async (period: Period) => {
      const days = period === "7d" ? 7 : 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [recentCases, topOffenders, totalWarnings, totalCases, periodCases, banCount, kickCount, timeoutCount] = await Promise.all([
        getRecentCasesForGuild(guildId, 5),
        getTopOffendersForGuild(guildId, 5),
        WarningModel.countDocuments({ guildId }),
        ModerationCaseModel.countDocuments({ guildId }),
        ModerationCaseModel.countDocuments({ guildId, createdAt: { $gte: since } }),
        ModerationCaseModel.countDocuments({ guildId, action: "ban" }),
        ModerationCaseModel.countDocuments({ guildId, action: "kick" }),
        ModerationCaseModel.countDocuments({ guildId, action: "timeout" }),
      ]);

      const recentLines = recentCases.length === 0
        ? ["*No moderation cases yet.*"]
        : recentCases.map(c => {
            const ts = Math.floor(new Date(c.createdAt).getTime() / 1000);
            return `${ACTION_EMOJI[c.action] ?? "📋"} <@${c.userId}> · **${c.action}** · <t:${ts}:R>`;
          });

      const offenderLines = topOffenders.length === 0
        ? ["*No cases recorded.*"]
        : topOffenders.map((o, i) => `${i + 1}. <@${o.userId}> — **${o.count}** case${o.count !== 1 ? "s" : ""}`);

      return new EmbedBuilder()
        .setColor(ACTION_COLOR[period])
        .setTitle(`🛡️ Moderation Dashboard — ${interaction.guild!.name}`)
        .setDescription(`Showing stats for the **last ${days} days**`)
        .addFields(
          {
            name: "📊 All-Time Overview",
            value: [
              `Total Cases: **${totalCases}**`,
              `Total Warnings: **${totalWarnings}**`,
              `Bans: **${banCount}** | Kicks: **${kickCount}** | Timeouts: **${timeoutCount}**`,
            ].join("\n"),
            inline: false,
          },
          {
            name: `📆 Activity (Last ${days} Days)`,
            value: `Cases in period: **${periodCases}**`,
            inline: false,
          },
          {
            name: "🕐 Recent Actions (last 5)",
            value: recentLines.join("\n"),
            inline: false,
          },
          {
            name: "🔝 Most Actioned Members",
            value: offenderLines.join("\n"),
            inline: false,
          },
        )
        .setFooter({ text: `Use /modhistory <user> for member history • Period: ${period}` })
        .setTimestamp();
    };

    const buildButtons = (period: Period) => new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("modstats_7d")
        .setLabel("Last 7 Days")
        .setStyle(period === "7d" ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setEmoji("📅"),
      new ButtonBuilder()
        .setCustomId("modstats_30d")
        .setLabel("Last 30 Days")
        .setStyle(period === "30d" ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setEmoji("📆"),
      new ButtonBuilder()
        .setCustomId("modstats_refresh")
        .setLabel("Refresh")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🔄"),
    );

    let currentPeriod = initialPeriod;
    const embed = await buildEmbed(currentPeriod);
    const sent = await interaction.editReply({ embeds: [embed], components: [buildButtons(currentPeriod)] });

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
      filter: (i) => i.user.id === interaction.user.id,
    });

    collector.on("collect", async (i) => {
      await i.deferUpdate();
      if (i.customId === "modstats_7d") currentPeriod = "7d";
      else if (i.customId === "modstats_30d") currentPeriod = "30d";
      // modstats_refresh keeps the same period
      const updated = await buildEmbed(currentPeriod);
      await i.editReply({ embeds: [updated], components: [buildButtons(currentPeriod)] });
    });

    collector.on("end", async () => {
      await interaction.editReply({ components: [] }).catch(() => null);
    });
  },
};

export default command;
