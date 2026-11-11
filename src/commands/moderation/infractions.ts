import { guardCollect } from "../../utils/collectorGuard";
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
import { getWarningsForUser } from "../../services/warnings";
import { ModerationCaseModel } from "../../database/mongo";
import { truncate } from "../../utils/safeText";

const CASES_PER_PAGE = 5;
const WARNS_PER_PAGE = 5;
/** Cases loaded for paging; the overview shows the true total from a count. */
export const INFRACTION_CASES_LOADED = 100;

/**
 * A reason shown on one line: whitespace collapsed, cut to `max`, and with
 * backticks swapped for a look-alike so a reason containing ` cannot break the
 * surrounding Markdown.
 */
export function reasonLine(reason: string | null | undefined, max = 200): string {
  const text = String(reason ?? "").replace(/\s+/g, " ").trim() || "No reason provided";
  return truncate(text.replace(/`/g, "ˋ"), max);
}

/** "`ban` ×2  `timeout` ×1", counting revoked cases separately so undone actions don't read as live ones. */
export function actionSummary(cases: ReadonlyArray<{ action: string; revoked?: boolean | null }>): string {
  const live: Record<string, number> = {};
  let revoked = 0;
  for (const c of cases) {
    if (c.revoked) { revoked++; continue; }
    live[c.action] = (live[c.action] ?? 0) + 1;
  }
  const parts = Object.entries(live).sort((a, b) => b[1] - a[1]).map(([k, v]) => `\`${k}\` ×${v}`);
  if (revoked) parts.push(`(${revoked} revoked)`);
  return parts.join("  ") || "None";
}

type InfractionsView = "overview" | "warnings" | "cases";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("infractions")
    .setDescription("View the complete moderation record for a member.")
    .addUserOption(opt =>
      opt.setName("user").setDescription("The member to inspect").setRequired(true)
    )
    .addBooleanOption(opt =>
      opt.setName("ephemeral").setDescription("Show only to you (default: false)").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const target    = interaction.options.getUser("user", true);
    const ephemeral = interaction.options.getBoolean("ephemeral") ?? false;
    const guildId   = interaction.guildId!;

    await interaction.deferReply({ flags: ephemeral ? MessageFlags.Ephemeral : undefined });

    try {
      // Cases come from the case log only; warnings have their own tab and
      // count. (Before, warnings were merged into "Mod Cases" and counted twice.)
      const [warnings, cases, caseTotal] = await Promise.all([
        getWarningsForUser(guildId, target.id),
        ModerationCaseModel.find({ guildId, userId: target.id })
          .select("_id action reason moderatorId revoked createdAt")
          .sort({ createdAt: -1 })
          .limit(INFRACTION_CASES_LOADED)
          .lean(),
        ModerationCaseModel.countDocuments({ guildId, userId: target.id }),
      ]);

      const member = await interaction.guild?.members.fetch(target.id).catch(() => null);

      const summary = actionSummary(cases) + (caseTotal > cases.length ? ` (newest ${cases.length} of ${caseTotal})` : "");
      const caseCountText = caseTotal > cases.length ? `${caseTotal} (newest ${cases.length} listed)` : String(caseTotal);

      let currentView: InfractionsView = "overview";
      let warnPage = 0;
      let casePage = 0;

      function buildOverviewEmbed(): EmbedBuilder {
        const recentWarn = warnings.at(0);
        const recentCase = cases.at(0);
        return new EmbedBuilder()
          .setColor(warnings.length === 0 && cases.length === 0 ? 0x57F287 : 0xED4245)
          .setTitle(`📂 Infraction Record — ${target.tag}`)
          .setThumbnail(target.displayAvatarURL({ size: 256 }))
          .addFields(
            { name: "👤 User",            value: `<@${target.id}> (\`${target.id}\`)`, inline: false },
            { name: "📅 Account Created", value: `<t:${Math.floor(target.createdTimestamp / 1000)}:D>`, inline: true },
            { name: "📥 Joined Server",   value: member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : "Unknown", inline: true },
            { name: "⚠️ Warnings",        value: `**${warnings.length}**`, inline: true },
            { name: "📋 Mod Cases",       value: `**${caseCountText}**`, inline: true },
            { name: "🔍 Action Summary",  value: truncate(summary, 1024), inline: false },
            {
              name: "📌 Latest Warning",
              value: recentWarn
                ? `\`${reasonLine(recentWarn.reason, 300)}\` — <t:${Math.floor(new Date(recentWarn.createdAt).getTime() / 1000)}:R>`
                : "None on record",
              inline: false,
            },
            {
              name: "📌 Latest Case",
              value: recentCase
                ? `\`${recentCase.action.toUpperCase()}\` — ${reasonLine(recentCase.reason, 300)} — <t:${Math.floor(new Date(recentCase.createdAt).getTime() / 1000)}:R>${recentCase.revoked ? " *(revoked)*" : ""}`
                : "None on record",
              inline: false,
            },
          )
          .setFooter({ text: `Viewed by ${interaction.user.tag}` })
          .setTimestamp();
      }

      function buildWarningsEmbed(page: number): EmbedBuilder {
        const totalPages = Math.max(1, Math.ceil(warnings.length / WARNS_PER_PAGE));
        const slice = warnings.slice(page * WARNS_PER_PAGE, (page + 1) * WARNS_PER_PAGE);
        const lines = slice.length === 0
          ? ["✅ No warnings on record."]
          : slice.map((w, i) => {
              const ts = Math.floor(new Date(w.createdAt).getTime() / 1000);
              // The full ID, so it can be pasted into /case edit (which also edits warnings).
              const id = String(w._id);
              return `**${page * WARNS_PER_PAGE + i + 1}.** \`${reasonLine(w.reason)}\`\n> Mod: <@${w.moderatorId}> • <t:${ts}:R> • ID: \`${id}\``;
            });
        return new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle(`⚠️ Warnings — ${target.tag}`)
          .setDescription(lines.join("\n\n"))
          .setFooter({ text: `Page ${page + 1}/${totalPages} • ${warnings.length} total warning(s)` })
          .setTimestamp();
      }

      function buildCasesEmbed(page: number): EmbedBuilder {
        const totalPages = Math.max(1, Math.ceil(cases.length / CASES_PER_PAGE));
        const slice = cases.slice(page * CASES_PER_PAGE, (page + 1) * CASES_PER_PAGE);
        const ACTION_EMOJI: Record<string, string> = {
          ban: "🔨", softban: "🧹", kick: "👢", timeout: "⏱️", untimeout: "🔓", temprole: "🏷️",
          warn: "⚠️", unban: "✅", note: "📝",
        };
        const lines = slice.length === 0
          ? ["✅ No mod cases on record."]
          : slice.map((c, i) => {
              const ts  = Math.floor(new Date(c.createdAt).getTime() / 1000);
              const emo = ACTION_EMOJI[c.action] ?? "📋";
              return `**${page * CASES_PER_PAGE + i + 1}.** ${emo} \`${c.action.toUpperCase()}\`${c.revoked ? " *(revoked)*" : ""}\n> ${reasonLine(c.reason)}\n> Mod: <@${c.moderatorId}> • <t:${ts}:R> • ID: \`${String(c._id)}\``;
            });
        return new EmbedBuilder()
          .setColor(0xE67E22)
          .setTitle(`📋 Mod Cases — ${target.tag}`)
          .setDescription(lines.join("\n\n"))
          .setFooter({ text: `Page ${page + 1}/${totalPages} • ${caseCountText} case(s) • /case view case_id:<id> for details` })
          .setTimestamp();
      }

      function buildNavRow(view: InfractionsView, wPage: number, cPage: number): ActionRowBuilder<ButtonBuilder> {
        const warnPages = Math.max(1, Math.ceil(warnings.length / WARNS_PER_PAGE));
        const casePages = Math.max(1, Math.ceil(cases.length / CASES_PER_PAGE));

        return new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("inf_overview")
            .setLabel("Overview")
            .setStyle(view === "overview" ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setEmoji("📂"),
          new ButtonBuilder()
            .setCustomId("inf_warns")
            .setLabel(`Warnings (${warnings.length})`)
            .setStyle(view === "warnings" ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setEmoji("⚠️"),
          new ButtonBuilder()
            .setCustomId("inf_cases")
            .setLabel(`Cases (${caseTotal})`)
            .setStyle(view === "cases" ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setEmoji("📋"),
          new ButtonBuilder()
            .setCustomId("inf_prev")
            .setLabel("◀")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(
              view === "overview" ||
              (view === "warnings" && wPage === 0) ||
              (view === "cases" && cPage === 0)
            ),
          new ButtonBuilder()
            .setCustomId("inf_next")
            .setLabel("▶")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(
              view === "overview" ||
              (view === "warnings" && wPage >= warnPages - 1) ||
              (view === "cases" && cPage >= casePages - 1)
            ),
        );
      }

      const sent = await interaction.editReply({
        embeds: [buildOverviewEmbed()],
        components: [buildNavRow("overview", warnPage, casePage)],
      });

      const collector = sent.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120_000,
        filter: (i) => i.memberPermissions?.has(PermissionFlagsBits.ModerateMembers) === true,
      });

      collector.on("collect", (i) => guardCollect("infractions", i, async () => {
        try {
          await i.deferUpdate().catch(() => null);

          if (i.customId === "inf_overview") {
            currentView = "overview";
          } else if (i.customId === "inf_warns") {
            currentView = "warnings";
            warnPage = 0;
          } else if (i.customId === "inf_cases") {
            currentView = "cases";
            casePage = 0;
          } else if (i.customId === "inf_prev") {
            if (currentView === "warnings" && warnPage > 0) warnPage--;
            if (currentView === "cases"    && casePage > 0) casePage--;
          } else if (i.customId === "inf_next") {
            const warnPages = Math.ceil(warnings.length / WARNS_PER_PAGE);
            const casePages = Math.ceil(cases.length / CASES_PER_PAGE);
            if (currentView === "warnings" && warnPage < warnPages - 1) warnPage++;
            if (currentView === "cases"    && casePage < casePages - 1) casePage++;
          }

          const embed =
            currentView === "overview" ? buildOverviewEmbed()
            : currentView === "warnings" ? buildWarningsEmbed(warnPage)
            : buildCasesEmbed(casePage);

          await interaction.editReply({
            embeds: [embed],
            components: [buildNavRow(currentView, warnPage, casePage)],
          }).catch(() => null);
        } catch (colErr) {
          logger.warn("Infractions collector error", colErr);
        }
      }));

      collector.on("end", async () => {
        await interaction.editReply({ components: [] }).catch(() => null);
      });

    } catch (err) {
      logger.error(`Failed to load infractions for ${target.id} in guild ${guildId}`, err);
      await interaction.editReply("❌ Failed to load infraction record. Please try again.").catch(() => null);
    }
  },
};

export default command;
