import { guardCollect } from "../../utils/collectorGuard";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  Colors,
  MessageFlags,
} from "discord.js";
import { Command } from "../../types/discord";
import { WarningModel, ModerationCaseModel } from "../../database/mongo";
import { calculateTrustProfile, explainTrust, scoreBar, type TrustProfile } from "../../services/trustScore";
import { NOT_REVOKED } from "../../services/warnings";
import { getMemberActivity } from "../../services/memberActivity";

/** Case actions that count as infractions for the trust score. */
const INFRACTION_ACTIONS = ["timeout", "kick", "ban"];

// ─── Trust Score Engine ───────────────────────────────────────────────────────

async function computeTrustProfile(
  guildId: string,
  userId: string,
  accountCreatedAt: Date,
  joinedAt: Date | null
): Promise<TrustProfile> {
  // ── Parallelize Warning & Case counts ─────────────────────────────────────
  // Revoked warnings/cases (undone with the Undo button) don't count.
  const [warnings, cases, activity] = await Promise.all([
    WarningModel.countDocuments({ guildId, userId, ...NOT_REVOKED }),
    ModerationCaseModel.countDocuments({ guildId, userId, action: { $in: INFRACTION_ACTIONS }, revoked: { $ne: true } }),
    getMemberActivity(guildId, userId),
  ]);

  return calculateTrustProfile({
    accountCreatedAt,
    joinedAt,
    warnings,
    cases,
    messageCount: activity.messageCount,
    lastActiveAt: activity.lastActiveAt,
  });
}

// ─── Command ─────────────────────────────────────────────────────────────────

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("trustscore")
    .setDescription("View a member's Trust Score: account age, tenure, infractions and message activity.")
    .addUserOption(o => o.setName("user").setDescription("Member to evaluate (defaults to yourself)").setRequired(false))
    .addBooleanOption(o => o.setName("ephemeral").setDescription("Only show the response to you (default: true)").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const targetUser  = interaction.options.getUser("user") ?? interaction.user;
    const isEphemeral = interaction.options.getBoolean("ephemeral") ?? true;
    const guildId     = interaction.guildId!;

    await interaction.deferReply({ flags: isEphemeral ? MessageFlags.Ephemeral : undefined });

    // Fetch guild member for join date
    const member = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
    const joinedAt = member?.joinedAt ?? null;

    let currentProfile = await computeTrustProfile(
      guildId,
      targetUser.id,
      targetUser.createdAt,
      joinedAt
    );

    const buildMainEmbed = (p: TrustProfile) =>
      new EmbedBuilder()
        .setColor(p.color)
        .setAuthor({ name: `Trust Score — ${targetUser.tag}`, iconURL: targetUser.displayAvatarURL() })
        .setTitle(`${p.tier}  ·  ${p.score}/100`)
        .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
        .setDescription(
          `\`${scoreBar(p.score)}\` **${p.score}%**\n` +
          `> *Calculated from account age, server tenure, active warnings, infractions and message activity — no manual input.*`
        )
        .addFields(
          { name: "🧭 Why", value: explainTrust(p).map((line) => `• ${line}`).join("\n"), inline: false },
          { name: "📅 Account Age",   value: p.accountAgeLabel, inline: true },
          { name: "🏠 Server Tenure", value: p.tenureLabel, inline: true },
          { name: "💬 Messages",      value: `${p.counts.messages.toLocaleString("en-US")} · last ${p.lastActiveLabel}`, inline: true },
          { name: "⚠️ Active Warnings", value: `${p.counts.warnings}`, inline: true },
          { name: "📁 Infractions",   value: `${p.counts.cases}`, inline: true },
          { name: "🔢 Final Score",   value: `**${p.score}** / 100`, inline: true },
        )
        .setFooter({ text: `Requested by ${interaction.user.tag} • Trust Score v1.1` })
        .setTimestamp();

    const buildBreakdownEmbed = (p: TrustProfile) =>
      new EmbedBuilder()
        .setColor(p.color)
        .setTitle(`🔍 Score Breakdown — ${targetUser.tag}`)
        .setDescription("Each factor's contribution to the final trust score:")
        .addFields(
          {
            name: "📅 Account Age",
            value: `+${p.breakdown.accountAge} pts\n> ${p.accountAgeLabel} old (max 25 pts at 2 years)`,
            inline: false,
          },
          {
            name: "🏠 Server Tenure",
            value: `+${p.breakdown.serverTenure} pts\n> Member for ${p.tenureLabel} (max 25 pts at 1 year)`,
            inline: false,
          },
          {
            name: "⚠️ Warning Penalty",
            value: `${p.breakdown.warningPenalty} pts\n> ${p.counts.warnings} active warning(s) × −5 pts each (max −30)`,
            inline: false,
          },
          {
            name: "📁 Infraction Penalty",
            value: `${p.breakdown.casePenalty} pts\n> ${p.counts.cases} timeout/kick/ban case(s) × −4 pts each (max −20)`,
            inline: false,
          },
          {
            name: "🎖️ Veteran Bonus",
            value: `+${p.breakdown.bonus} pts\n> Long-tenure loyalty bonus (180d: +6 · 365d: +12 · 730d: +20)`,
            inline: false,
          },
          {
            name: "💬 Message Activity",
            value: `+${p.breakdown.activity} pts\n> ${p.counts.messages.toLocaleString("en-US")} message(s) (10: +2 · 50: +4 · 250: +7 · 1,000: +10), last active ${p.lastActiveLabel} (7d: +5 · 30d: +2)`,
            inline: false,
          },
          {
            name: "🏆 Total",
            value: `**${p.score} / 100** — ${p.tier}`,
            inline: false,
          },
        )
        .setFooter({ text: "Score updates live on each /trustscore call." })
        .setTimestamp();

    const buildButtonRow = (view: "main" | "breakdown") =>
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("ts_main")
          .setLabel("Overview")
          .setStyle(view === "main" ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setEmoji("🛡️")
          .setDisabled(view === "main"),
        new ButtonBuilder()
          .setCustomId("ts_breakdown")
          .setLabel("Score Breakdown")
          .setStyle(view === "breakdown" ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setEmoji("🔍")
          .setDisabled(view === "breakdown"),
        new ButtonBuilder()
          .setCustomId("ts_refresh")
          .setLabel("Refresh")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("🔄"),
      );

    let currentView: "main" | "breakdown" = "main";
    const sent = await interaction.editReply({
      embeds: [buildMainEmbed(currentProfile)],
      components: [buildButtonRow("main")],
    });

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 90_000,
      filter: (i) => i.memberPermissions?.has(PermissionFlagsBits.ModerateMembers) === true,
    });

    collector.on("collect", (i) => guardCollect("trustscore", i, async () => {
      await i.deferUpdate();
      if (i.customId === "ts_main") {
        currentView = "main";
        await interaction.editReply({ embeds: [buildMainEmbed(currentProfile)], components: [buildButtonRow("main")] });
      } else if (i.customId === "ts_breakdown") {
        currentView = "breakdown";
        await interaction.editReply({ embeds: [buildBreakdownEmbed(currentProfile)], components: [buildButtonRow("breakdown")] });
      } else if (i.customId === "ts_refresh") {
        // Re-compute live
        currentProfile = await computeTrustProfile(guildId, targetUser.id, targetUser.createdAt, joinedAt);
        const embed = currentView === "breakdown"
          ? buildBreakdownEmbed(currentProfile)
          : buildMainEmbed(currentProfile);
        await interaction.editReply({ embeds: [embed], components: [buildButtonRow(currentView)] });
      }
    }));

    collector.on("end", () => {
      interaction.editReply({ components: [] }).catch(() => null);
    });
  },
};

export default command;
