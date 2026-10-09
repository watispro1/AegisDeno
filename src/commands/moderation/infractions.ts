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
import { getWarningsForUser, removeWarning } from "../../services/warnings";
import { getModerationCases } from "../../services/moderationCases";

const CASES_PER_PAGE = 5;
const WARNS_PER_PAGE = 5;

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

    await interaction.deferReply({ ephemeral });

    try {
      const [warnings, cases] = await Promise.all([
        getWarningsForUser(guildId, target.id),
        getModerationCases(guildId, target.id, 100),
      ]);

      const member = await interaction.guild?.members.fetch(target.id).catch(() => null);

      // Tally action types
      const actionCounts: Record<string, number> = {};
      for (const c of cases) {
        actionCounts[c.action] = (actionCounts[c.action] ?? 0) + 1;
      }
      const actionSummary = Object.entries(actionCounts)
        .map(([k, v]) => `\`${k}\` ×${v}`)
        .join("  ") || "None";

      let currentView: InfractionsView = "overview";
      let warnPage = 0;
      let casePage = 0;

      // ── Build overview embed ───────────────────────────────────────────────
      function buildOverviewEmbed(): EmbedBuilder {
        const recentWarn = warnings.at(-1);
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
            { name: "📋 Mod Cases",       value: `**${cases.length}**`, inline: true },
            { name: "🔍 Action Summary",  value: actionSummary, inline: false },
            {
              name: "📌 Latest Warning",
              value: recentWarn
                ? `\`${recentWarn.reason}\` — <t:${Math.floor(new Date(recentWarn.createdAt).getTime() / 1000)}:R>`
                : "None on record",
              inline: false,
            },
            {
              name: "📌 Latest Case",
              value: recentCase
                ? `\`${recentCase.action.toUpperCase()}\` — ${recentCase.reason} — <t:${Math.floor(new Date(recentCase.createdAt).getTime() / 1000)}:R>`
                : "None on record",
              inline: false,
            },
          )
          .setFooter({ text: `Viewed by ${interaction.user.tag}` })
          .setTimestamp();
      }

      // ── Build warnings page embed ─────────────────────────────────────────
      function buildWarningsEmbed(page: number): EmbedBuilder {
        const totalPages = Math.max(1, Math.ceil(warnings.length / WARNS_PER_PAGE));
        const slice = warnings.slice(page * WARNS_PER_PAGE, (page + 1) * WARNS_PER_PAGE);
        const lines = slice.length === 0
          ? ["✅ No warnings on record."]
          : slice.map((w, i) => {
              const ts = Math.floor(new Date(w.createdAt).getTime() / 1000);
              const id = String((w as any)._id).slice(-6);
              return `**${page * WARNS_PER_PAGE + i + 1}.** \`${w.reason}\`\n> Mod: <@${w.moderatorId}> • <t:${ts}:R> • ID: \`${id}\``;
            });
        return new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle(`⚠️ Warnings — ${target.tag}`)
          .setDescription(lines.join("\n\n"))
          .setFooter({ text: `Page ${page + 1}/${totalPages} • ${warnings.length} total warning(s)` })
          .setTimestamp();
      }

      // ── Build mod cases page embed ────────────────────────────────────────
      function buildCasesEmbed(page: number): EmbedBuilder {
        const totalPages = Math.max(1, Math.ceil(cases.length / CASES_PER_PAGE));
        const slice = cases.slice(page * CASES_PER_PAGE, (page + 1) * CASES_PER_PAGE);
        const ACTION_EMOJI: Record<string, string> = {
          ban: "🔨", kick: "👢", timeout: "⏱️", untimeout: "🔓",
          warn: "⚠️", unban: "✅", note: "📝",
        };
        const lines = slice.length === 0
          ? ["✅ No mod cases on record."]
          : slice.map((c, i) => {
              const ts  = Math.floor(new Date(c.createdAt).getTime() / 1000);
              const emo = ACTION_EMOJI[c.action] ?? "📋";
              return `**${page * CASES_PER_PAGE + i + 1}.** ${emo} \`${c.action.toUpperCase()}\`\n> ${c.reason}\n> Mod: <@${c.moderatorId}> • <t:${ts}:R>`;
            });
        return new EmbedBuilder()
          .setColor(0xE67E22)
          .setTitle(`📋 Mod Cases — ${target.tag}`)
          .setDescription(lines.join("\n\n"))
          .setFooter({ text: `Page ${page + 1}/${totalPages} • ${cases.length} total case(s)` })
          .setTimestamp();
      }

      // ── Build navigation row ──────────────────────────────────────────────
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
            .setLabel(`Cases (${cases.length})`)
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

      collector.on("collect", async (i) => {
        await i.deferUpdate();

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
        });
      });

      collector.on("end", async () => {
        await interaction.editReply({ components: [] }).catch(() => null);
      });

    } catch (err) {
      logger.error(`Failed to load infractions for ${target.id} in guild ${guildId}`, err);
      await interaction.editReply("❌ Failed to load infraction record. Please try again.");
    }
  },
};

export default command;
