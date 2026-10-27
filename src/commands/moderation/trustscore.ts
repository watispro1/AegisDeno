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
} from "discord.js";
import { Command } from "../../types/discord";
import { WarningModel, ModerationCaseModel } from "../../database/mongo";

// ─── Trust Score Engine ───────────────────────────────────────────────────────

interface TrustBreakdown {
  accountAge:      number;  // 0–25
  serverTenure:    number;  // 0–25
  warningPenalty:  number;  // 0–(-30)
  casePenalty:     number;  // 0–(-20)
  bonus:           number;  // 0–20  (long tenure bonus)
  total:           number;  // 0–100
}

interface TrustProfile {
  score:      number;
  tier:       "🟢 Trusted" | "🔵 Established" | "🟡 Caution" | "🟠 Elevated Risk" | "🔴 High Risk";
  color:      number;
  breakdown:  TrustBreakdown;
  accountAgeLabel: string;
  tenureLabel:     string;
}

/** Convert a millisecond duration to a human-readable label. */
function fmtAge(ms: number): string {
  const days = Math.floor(ms / 86_400_000);
  if (days < 1) return "< 1 day";
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  const years = Math.floor(days / 365);
  const rem   = Math.floor((days % 365) / 30);
  return rem > 0 ? `${years}y ${rem}mo` : `${years}y`;
}

/** Returns a filled/empty bar of given width (1–10). */
function scoreBar(score: number): string {
  const filled = Math.round(score / 10);
  return "█".repeat(Math.max(0, filled)) + "░".repeat(Math.max(0, 10 - filled));
}

async function computeTrustProfile(
  guildId: string,
  userId: string,
  accountCreatedAt: Date,
  joinedAt: Date | null
): Promise<TrustProfile> {
  const now = Date.now();

  // ── Account Age: 0–25 pts (max at 2+ years) ─────────────────────────────
  const accountMs     = now - accountCreatedAt.getTime();
  const accountDays   = accountMs / 86_400_000;
  const accountScore  = Math.min(25, Math.round((accountDays / 730) * 25)); // 730d = 2yr

  // ── Server Tenure: 0–25 pts (max at 1+ year) ────────────────────────────
  const tenureMs     = joinedAt ? now - joinedAt.getTime() : 0;
  const tenureDays   = tenureMs / 86_400_000;
  const tenureScore  = Math.min(25, Math.round((tenureDays / 365) * 25));

  // ── Parallelize Warning & Case counts ─────────────────────────────────────
  const [warnings, cases] = await Promise.all([
    WarningModel.countDocuments({ guildId, userId }),
    ModerationCaseModel.countDocuments({ guildId, userId }),
  ]);

  const warnPenalty = -Math.min(30, warnings * 5);
  const casePenalty = -Math.min(20, cases * 4);

  // ── Veteran Bonus: up to +20 for 2+ year tenure ─────────────────────────
  const bonus = tenureDays >= 730 ? 20
              : tenureDays >= 365 ? 12
              : tenureDays >= 180 ? 6
              : 0;

  const raw   = accountScore + tenureScore + warnPenalty + casePenalty + bonus;
  const total = Math.max(0, Math.min(100, raw));

  const tier: TrustProfile["tier"] =
    total >= 80 ? "🟢 Trusted"
  : total >= 60 ? "🔵 Established"
  : total >= 40 ? "🟡 Caution"
  : total >= 20 ? "🟠 Elevated Risk"
  :               "🔴 High Risk";

  const color =
    total >= 80 ? 0x57F287
  : total >= 60 ? 0x5865F2
  : total >= 40 ? 0xFEE75C
  : total >= 20 ? 0xFFA500
  :               0xED4245;

  return {
    score: total,
    tier,
    color,
    breakdown: {
      accountAge:     accountScore,
      serverTenure:   tenureScore,
      warningPenalty: warnPenalty,
      casePenalty,
      bonus,
      total,
    },
    accountAgeLabel: fmtAge(accountMs),
    tenureLabel:     joinedAt ? fmtAge(tenureMs) : "Unknown",
  };
}

// ─── Command ─────────────────────────────────────────────────────────────────

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("trustscore")
    .setDescription("View a member's automated Trust Score — risk rating based on age, tenure, and infractions.")
    .addUserOption(o => o.setName("user").setDescription("Member to evaluate (defaults to yourself)").setRequired(false))
    .addBooleanOption(o => o.setName("ephemeral").setDescription("Only show the response to you (default: true)").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const targetUser  = interaction.options.getUser("user") ?? interaction.user;
    const isEphemeral = interaction.options.getBoolean("ephemeral") ?? true;
    const guildId     = interaction.guildId!;

    await interaction.deferReply({ ephemeral: isEphemeral });

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
          `> *This score is automatically calculated from account age, server tenure, warnings, and moderation cases — no manual input.*`
        )
        .addFields(
          { name: "📅 Account Age",   value: p.accountAgeLabel, inline: true },
          { name: "🏠 Server Tenure", value: p.tenureLabel, inline: true },
          { name: "⚠️ Warnings",      value: `${-p.breakdown.warningPenalty / 5 | 0}`, inline: true },
          { name: "📁 Cases",         value: `${-p.breakdown.casePenalty / 4 | 0}`, inline: true },
          { name: "🎖️ Veteran Bonus", value: p.breakdown.bonus > 0 ? `+${p.breakdown.bonus} pts` : "None", inline: true },
          { name: "🔢 Final Score",   value: `**${p.score}** / 100`, inline: true },
        )
        .setFooter({ text: `Requested by ${interaction.user.tag} • Trust Score v1.0` })
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
            value: `${p.breakdown.warningPenalty} pts\n> ${-p.breakdown.warningPenalty / 5 | 0} warning(s) × −5 pts each (max −30)`,
            inline: false,
          },
          {
            name: "📁 Case Penalty",
            value: `${p.breakdown.casePenalty} pts\n> ${-p.breakdown.casePenalty / 4 | 0} case(s) × −4 pts each (max −20)`,
            inline: false,
          },
          {
            name: "🎖️ Veteran Bonus",
            value: `+${p.breakdown.bonus} pts\n> Long-tenure loyalty bonus (180d: +6 · 365d: +12 · 730d: +20)`,
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

    collector.on("collect", async (i) => {
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
    });

    collector.on("end", () => {
      interaction.editReply({ components: [] }).catch(() => null);
    });
  },
};

export default command;
