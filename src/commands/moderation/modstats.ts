import { logger } from "../../utils/logger";
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { Command } from "../../types/discord";
import { getRecentCasesForGuild, getTopOffendersForGuild } from "../../services/moderationCases";
import { WarningModel } from "../../database/mongo";

const ACTION_EMOJI: Record<string, string> = {
  warn: "⚠️", kick: "👢", ban: "🔨", timeout: "⏱️",
  untimeout: "✅", unban: "✅", clearwarnings: "🗑️",
};

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("modstats")
    .setDescription("View a moderation activity dashboard for this server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    await interaction.deferReply({ ephemeral: true });

    try {
      const [recentCases, topOffenders, totalWarnings] = await Promise.all([
        getRecentCasesForGuild(guildId, 5),
        getTopOffendersForGuild(guildId, 5),
        WarningModel.countDocuments({ guildId }),
      ]);

      const totalCases = await import("../../database/mongo").then(m =>
        m.ModerationCaseModel.countDocuments({ guildId })
      );

      // ── Recent Cases ──────────────────────────────────────────────────────
      const recentLines = recentCases.length === 0
        ? ["*No moderation cases yet.*"]
        : recentCases.map(c => {
            const ts = Math.floor(new Date(c.createdAt).getTime() / 1000);
            return `${ACTION_EMOJI[c.action] ?? "📋"} <@${c.userId}> · **${c.action}** · <t:${ts}:R>`;
          });

      // ── Top Offenders ─────────────────────────────────────────────────────
      const offenderLines = topOffenders.length === 0
        ? ["*No cases recorded.*"]
        : topOffenders.map((o, i) => `${i + 1}. <@${o.userId}> — **${o.count}** case${o.count !== 1 ? "s" : ""}`);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🛡️ Moderation Dashboard — ${interaction.guild!.name}`)
        .addFields(
          {
            name: "📊 Overview",
            value: [
              `Total Cases: **${totalCases}**`,
              `Total Warnings: **${totalWarnings}**`,
            ].join("\n"),
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
        .setFooter({ text: "Use /modhistory <user> to see a member's full history." })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error(`Failed /modstats for guild ${guildId}:`, err);
      await interaction.editReply("❌ Failed to load moderation stats. Please try again.");
    }
  },
};
