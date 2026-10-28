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
  MessageFlags,
} from "discord.js";
import { Command } from "../../types/discord";
import { ModerationCaseModel, WarningModel, AutomodHitModel } from "../../database/mongo";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Period = "day" | "week";

function periodMs(p: Period): number {
  return p === "day" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
}

function periodLabel(p: Period): string {
  return p === "day" ? "Last 24 Hours" : "Last 7 Days";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Builds a compact inline ASCII bar for a count vs max. */
function miniBar(count: number, max: number, width = 8): string {
  const filled = max === 0 ? 0 : Math.round((count / max) * width);
  return "▰".repeat(Math.max(0, filled)) + "▱".repeat(Math.max(0, width - filled));
}

// ─── Report Sections ──────────────────────────────────────────────────────────

async function buildSummaryEmbed(guildId: string, period: Period, guild: { name: string }): Promise<EmbedBuilder> {
  const since = new Date(Date.now() - periodMs(period));

  const [totalCases, totalWarnings, totalAutomodHits] = await Promise.all([
    ModerationCaseModel.countDocuments({ guildId, createdAt: { $gte: since } }),
    WarningModel.countDocuments({ guildId, createdAt: { $gte: since } }),
    AutomodHitModel.countDocuments({ guildId, triggeredAt: { $gte: since } }),
  ]);

  // Action breakdown
  const actionGroups = await ModerationCaseModel.aggregate([
    { $match: { guildId, createdAt: { $gte: since } } },
    { $group: { _id: "$action", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const actionEmoji: Record<string, string> = {
    ban: "🔨", kick: "👢", timeout: "⏱️", warn: "⚠️", unban: "✅",
    lock: "🔒", unlock: "🔓", purge: "🗑️", note: "📝",
  };

  const actionLines = actionGroups
    .slice(0, 6)
    .map(a => `${actionEmoji[a._id] ?? "▪️"} **${capitalize(a._id)}**: ${a.count}`)
    .join("\n") || "*No actions taken*";

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({ name: `Mod Report — ${guild.name}`, iconURL: undefined })
    .setTitle(`📰 Moderation Report — ${periodLabel(period)}`)
    .setDescription(`> *Automatically compiled from live moderation data. No manual input required.*`)
    .addFields(
      { name: "📊 Activity Overview", value: [
        `🗂️ **Total Cases:**    ${totalCases}`,
        `⚠️ **Warnings Issued:** ${totalWarnings}`,
        `🤖 **AutoMod Hits:**   ${totalAutomodHits}`,
      ].join("\n"), inline: false },
      { name: "🔧 Action Breakdown", value: actionLines, inline: true },
    )
    .setFooter({ text: `Period: ${periodLabel(period)} • Use the buttons to explore sections` })
    .setTimestamp();

  return embed;
}

async function buildTopOffendersEmbed(guildId: string, period: Period): Promise<EmbedBuilder> {
  const since = new Date(Date.now() - periodMs(period));

  const offenders = await ModerationCaseModel.aggregate([
    { $match: { guildId, createdAt: { $gte: since } } },
    { $group: { _id: "$userId", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 8 },
  ]);

  const maxCount = offenders[0]?.count ?? 0;

  const lines = offenders.length === 0
    ? ["*No infractions in this period — great moderation!* 🎉"]
    : offenders.map((o, i) =>
        `**${i + 1}.** <@${o._id}> — **${o.count}** action(s)\n\`${miniBar(o.count, maxCount)}\``
      );

  return new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle(`🚨 Top Offenders — ${periodLabel(period)}`)
    .setDescription(lines.join("\n\n"))
    .setFooter({ text: "Ranked by total moderation cases in the period" })
    .setTimestamp();
}

async function buildTopModeratorsEmbed(guildId: string, period: Period): Promise<EmbedBuilder> {
  const since = new Date(Date.now() - periodMs(period));

  const moderators = await ModerationCaseModel.aggregate([
    { $match: { guildId, createdAt: { $gte: since } } },
    { $group: { _id: "$moderatorId", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 8 },
  ]);

  const maxCount = moderators[0]?.count ?? 0;

  const lines = moderators.length === 0
    ? ["*No moderation activity in this period.*"]
    : moderators.map((m, i) => {
        const medal = ["🥇", "🥈", "🥉"][i] ?? `**${i + 1}.**`;
        return `${medal} <@${m._id}> — **${m.count}** action(s)\n\`${miniBar(m.count, maxCount)}\``;
      });

  return new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle(`🛡️ Most Active Moderators — ${periodLabel(period)}`)
    .setDescription(lines.join("\n\n"))
    .setFooter({ text: "Ranked by moderation actions taken in the period" })
    .setTimestamp();
}

async function buildAutomodEmbed(guildId: string, period: Period): Promise<EmbedBuilder> {
  const since = new Date(Date.now() - periodMs(period));

  const [ruleBreakdown, topUsers, totalHits] = await Promise.all([
    AutomodHitModel.aggregate([
      { $match: { guildId, triggeredAt: { $gte: since } } },
      { $group: { _id: "$rule", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    AutomodHitModel.aggregate([
      { $match: { guildId, triggeredAt: { $gte: since } } },
      { $group: { _id: "$userId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    AutomodHitModel.countDocuments({ guildId, triggeredAt: { $gte: since } }),
  ]);

  const ruleEmoji: Record<string, string> = {
    words: "🚫", links: "🔗", mentions: "📢", spam: "💬", caps: "🔡",
  };

  const maxRuleCount = ruleBreakdown[0]?.count ?? 0;
  const ruleLines = ruleBreakdown.length === 0
    ? "*No automod hits in this period.*"
    : ruleBreakdown
        .map(r => `${ruleEmoji[r._id] ?? "▪️"} **${capitalize(r._id)}**: ${r.count} hit(s)\n\`${miniBar(r.count, maxRuleCount)}\``)
        .join("\n");

  const userLines = topUsers.length === 0
    ? "*No repeat offenders.*"
    : topUsers.map((u, i) => `**${i + 1}.** <@${u._id}> — ${u.count} hit(s)`).join("\n");

  return new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle(`🤖 AutoMod Analytics — ${periodLabel(period)}`)
    .addFields(
      { name: `📊 Total Hits: ${totalHits}`, value: ruleLines, inline: false },
      { name: "👤 Most Flagged Users", value: userLines, inline: false },
    )
    .setFooter({ text: "AutoMod hit logs are recorded for each enforcement action" })
    .setTimestamp();
}

// ─── Command ─────────────────────────────────────────────────────────────────

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("modreport")
    .setDescription("Generate an interactive moderation digest with analytics, top offenders, and AutoMod trends.")
    .addStringOption(o =>
      o.setName("period")
        .setDescription("Report period (default: last 7 days)")
        .addChoices(
          { name: "📅 Last 24 Hours", value: "day" },
          { name: "📆 Last 7 Days",   value: "week" },
        )
    )
    .addBooleanOption(o =>
      o.setName("ephemeral")
        .setDescription("Only show the report to you (default: true)")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const period      = (interaction.options.getString("period") ?? "week") as Period;
    const isEphemeral = interaction.options.getBoolean("ephemeral") ?? true;
    const guildId     = interaction.guildId!;
    const guild       = interaction.guild!;

    await interaction.deferReply({ flags: isEphemeral ? MessageFlags.Ephemeral : undefined });

    type Section = "summary" | "offenders" | "moderators" | "automod";
    let currentSection: Section = "summary";
    const embedCache = new Map<Section, EmbedBuilder>();

    const buildRow = (active: Section) => {
      const btn = (id: Section, label: string, emoji: string) =>
        new ButtonBuilder()
          .setCustomId(`mr_${id}`)
          .setLabel(label)
          .setStyle(active === id ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setEmoji(emoji)
          .setDisabled(active === id);

      return new ActionRowBuilder<ButtonBuilder>().addComponents(
        btn("summary",    "Overview",      "📰"),
        btn("offenders",  "Top Offenders", "🚨"),
        btn("moderators", "Moderators",    "🛡️"),
        btn("automod",    "AutoMod",       "🤖"),
        new ButtonBuilder()
          .setCustomId("mr_refresh")
          .setLabel("Refresh")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("🔄"),
      );
    };

    const getEmbed = async (section: Section, forceRefresh = false): Promise<EmbedBuilder> => {
      if (!forceRefresh && embedCache.has(section)) {
        return embedCache.get(section)!;
      }
      let emb: EmbedBuilder;
      switch (section) {
        case "summary":    emb = await buildSummaryEmbed(guildId, period, { name: guild.name }); break;
        case "offenders":  emb = await buildTopOffendersEmbed(guildId, period); break;
        case "moderators": emb = await buildTopModeratorsEmbed(guildId, period); break;
        case "automod":    emb = await buildAutomodEmbed(guildId, period); break;
        default:           emb = await buildSummaryEmbed(guildId, period, { name: guild.name }); break;
      }
      embedCache.set(section, emb);
      return emb;
    };

    try {
      const initialEmbed = await getEmbed("summary");
      const sent = await interaction.editReply({
        embeds: [initialEmbed],
        components: [buildRow("summary")],
      });

      const collector = sent.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120_000,
        filter: (i) => i.memberPermissions?.has(PermissionFlagsBits.ModerateMembers) === true,
      });

      collector.on("collect", async (i) => {
        await i.deferUpdate();
        if (i.customId === "mr_refresh") {
          embedCache.clear();
          const refreshed = await getEmbed(currentSection, true);
          await interaction.editReply({ embeds: [refreshed], components: [buildRow(currentSection)] });
          return;
        }

        const sectionMap: Record<string, Section> = {
          mr_summary:    "summary",
          mr_offenders:  "offenders",
          mr_moderators: "moderators",
          mr_automod:    "automod",
        };
        const newSection = sectionMap[i.customId];
        if (!newSection) return;
        currentSection = newSection;
        const embed = await getEmbed(currentSection);
        await interaction.editReply({ embeds: [embed], components: [buildRow(currentSection)] });
      });

      collector.on("end", () => {
        interaction.editReply({ components: [] }).catch(() => null);
      });
    } catch (err) {
      logger.error("modreport failed", err);
      await interaction.editReply("❌ Failed to generate the moderation report. Please try again.");
    }
  },
};

export default command;
