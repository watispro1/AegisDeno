import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import type { Command } from "../../types/discord";
import { isValidObjectId } from "mongoose";
import { ModerationCaseModel, WarningModel } from "../../database/mongo";
import { sendGuildLog } from "../../services/logging";
import { editCaseReason } from "../../services/moderationCases";
import { MAX_CASES_BROWSABLE, pageInfo, stepPage } from "../../services/casePaging";
import { rankChoices, shortAge, type AutocompleteItem } from "../../utils/autocomplete";
import { requestConfirmation } from "../../utils/confirmation";

const MAX_EXPORT_CASES = 5_000;
/** How many recent cases the case_id autocomplete searches. */
export const CASE_AUTOCOMPLETE_SCAN = 200;

/** Shown when a case ID is malformed or unknown, pointing at where IDs come from. */
export function caseIdHelp(caseId: string, problem: "invalid" | "missing"): string {
  const shown = caseId.length > 40 ? `${caseId.slice(0, 40)}…` : caseId;
  return problem === "invalid"
    ? `❌ \`${shown}\` is not a case ID. Pick one from the list as you type, or find it with \`/case user\`.`
    : `❌ No case \`${shown}\` in this server. It may have been deleted or expired; \`/case user\` lists a member's cases.`;
}

/** One autocomplete entry for a case: action, reason and age, with the full ID as the value. */
export function caseChoice(
  record: { _id: unknown; action: string; reason?: string | null; userId: string; createdAt: Date | string },
  now = Date.now(),
): AutocompleteItem {
  const id = String(record._id);
  const reason = (record.reason || "No reason").replace(/\s+/g, " ");
  return {
    name: `${record.action.toUpperCase()} · ${shortAge(record.createdAt, now)} · ${reason.slice(0, 48)} · …${id.slice(-6)}`,
    value: id,
    keywords: `${record.userId} ${reason}`,
  };
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("case")
    .setDescription("Moderation case lookup, reason edits, deletion, and log export.")
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName("view")
        .setDescription("View details of a specific moderation case.")
        .addStringOption(opt => opt.setName("case_id").setDescription("Case ID; start typing to pick a recent case").setRequired(true).setAutocomplete(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("user")
        .setDescription("List recent moderation cases for a specific member.")
        .addUserOption(opt => opt.setName("user").setDescription("The member whose cases to list").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("edit")
        .setDescription("Edit the reason on a moderation case.")
        .addStringOption(opt => opt.setName("case_id").setDescription("Case ID; start typing to pick a recent case").setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName("reason").setDescription("New updated reason").setRequired(true).setMaxLength(512))
    )
    .addSubcommand(sub =>
      sub
        .setName("delete")
        .setDescription("Delete a moderation case record.")
        .addStringOption(opt => opt.setName("case_id").setDescription("Case ID; start typing to pick a recent case").setRequired(true).setAutocomplete(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("export")
        .setDescription("Export all guild moderation history as a JSON file.")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  category: "moderation",
  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ModerateMembers],

  async autocomplete(interaction) {
    // Autocomplete skips the executor's permission check, so check here:
    // case reasons are staff-only.
    if (!interaction.guildId || !interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.respond([]);
      return;
    }
    const focused = interaction.options.getFocused(true);
    if (focused.name !== "case_id") {
      await interaction.respond([]);
      return;
    }
    const records = await ModerationCaseModel.find({ guildId: interaction.guildId })
      .select("_id action reason userId createdAt")
      .sort({ createdAt: -1 })
      .limit(CASE_AUTOCOMPLETE_SCAN)
      .lean()
      .catch(() => []);
    const now = Date.now();
    await interaction.respond(rankChoices(records.map(r => caseChoice(r, now)), String(focused.value)));
  },

  async execute(interaction) {
    if (!interaction.guild) return;
    const subcommand = interaction.options.getSubcommand();

    const ACTION_ICONS: Record<string, string> = {
      ban: "🔨",
      unban: "↩️",
      kick: "👢",
      timeout: "⏱️",
      untimeout: "🔓",
      warn: "⚠️",
      purge: "🗑️",
      lock: "🔒",
      unlock: "🔓",
    };

    if (subcommand === "view") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
        await interaction.reply({ content: "❌ You need `Moderate Members` permission to view cases.", flags: MessageFlags.Ephemeral });
        return;
      }

      const caseId = interaction.options.getString("case_id", true);
      if (!isValidObjectId(caseId)) {
        await interaction.reply({ content: caseIdHelp(caseId, "invalid"), flags: MessageFlags.Ephemeral });
        return;
      }
      const record = await ModerationCaseModel.findOne({ guildId: interaction.guild.id, _id: caseId }).catch(() => null);

      if (!record) {
        await interaction.reply({ content: caseIdHelp(caseId, "missing"), flags: MessageFlags.Ephemeral });
        return;
      }

      const icon = ACTION_ICONS[record.action.toLowerCase()] ?? "📜";
      const embed = new EmbedBuilder()
        .setTitle(`${icon} Moderation Case #${caseId}`)
        .setColor(record.action === "ban" ? 0xED4245 : (record.action === "timeout" ? 0xFEE75C : 0x3498DB))
        .addFields(
          { name: "👤 Target User", value: `<@${record.userId}> (\`${record.userId}\`)`, inline: true },
          { name: "🛡️ Moderator",   value: `<@${record.moderatorId}>`, inline: true },
          { name: "⚖️ Action",      value: `\`${record.action.toUpperCase()}\``, inline: true },
          { name: "📝 Reason",      value: record.reason || "No reason provided", inline: false },
          ...(record.details ? [{ name: "ℹ️ Details", value: record.details, inline: false }] : []),
          ...(record.proofUrl ? [{ name: "📎 Proof", value: `[Attachment](${record.proofUrl})`, inline: false }] : []),
          ...(record.revoked ? [{
            name: "↩️ Revoked",
            value: `By ${record.revokedBy ? `<@${record.revokedBy}>` : "staff"}${record.revokedAt ? ` <t:${Math.floor(record.revokedAt.getTime() / 1000)}:R>` : ""}`,
            inline: false,
          }] : []),
          { name: "📅 Timestamp",   value: `<t:${Math.floor(record.createdAt.getTime() / 1000)}:F> (<t:${Math.floor(record.createdAt.getTime() / 1000)}:R>)`, inline: false }
        )
        .setFooter({ text: `Guild ID: ${interaction.guild.id}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (subcommand === "user") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
        await interaction.reply({ content: "❌ You need `Moderate Members` permission to view cases.", flags: MessageFlags.Ephemeral });
        return;
      }

      const user = interaction.options.getUser("user", true);
      const records = await ModerationCaseModel.find({ guildId: interaction.guild.id, userId: user.id })
        .sort({ createdAt: -1 })
        .limit(MAX_CASES_BROWSABLE)
        .lean();

      if (records.length === 0) {
        await interaction.reply({ content: `✅ No moderation cases found on record for **${user.tag}** (<@${user.id}>).`, flags: MessageFlags.Ephemeral });
        return;
      }

      const prevId = `case_prev_${interaction.id}`;
      const nextId = `case_next_${interaction.id}`;
      let page = 0;

      const render = (requested: number) => {
        const info = pageInfo(records.length, requested);
        const lines = records.slice(info.start, info.end).map((r, i) => {
          const icon = ACTION_ICONS[r.action.toLowerCase()] ?? "📜";
          const dateStr = `<t:${Math.floor(new Date(r.createdAt).getTime() / 1000)}:R>`;
          const flags = `${r.revoked ? " · *revoked*" : ""}${r.proofUrl ? " · 📎" : ""}`;
          return `**${info.start + i + 1}.** ${icon} \`${r.action.toUpperCase()}\` — ${r.reason} (${dateStr})\n└ *ID:* \`${String(r._id)}\` · *Mod:* <@${r.moderatorId}>${flags}`;
        });
        const embed = new EmbedBuilder()
          .setTitle(`📜 Case History for ${user.tag} (${records.length}${records.length >= MAX_CASES_BROWSABLE ? "+" : ""})`)
          .setThumbnail(user.displayAvatarURL())
          .setColor(0x5865F2)
          .setDescription(lines.join("\n\n"))
          .setFooter({ text: `Page ${info.page + 1}/${info.totalPages} · /case view case_id:<id> for details` })
          .setTimestamp();
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(prevId).setLabel("Prev").setEmoji("◀️").setStyle(ButtonStyle.Secondary).setDisabled(!info.hasPrev),
          new ButtonBuilder().setCustomId(nextId).setLabel("Next").setEmoji("▶️").setStyle(ButtonStyle.Secondary).setDisabled(!info.hasNext),
        );
        return { embeds: [embed], components: info.totalPages > 1 ? [row] : [] };
      };

      const first = render(page);
      const response = await interaction.reply({ ...first, flags: MessageFlags.Ephemeral, withResponse: true });
      if (first.components.length === 0) return;
      const message = response.resource?.message;
      if (!message) return;

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120_000,
        filter: (i) => i.user.id === interaction.user.id && (i.customId === prevId || i.customId === nextId),
      });
      collector.on("collect", async (i) => {
        page = stepPage(page, i.customId === nextId ? "next" : "prev", records.length);
        await i.update(render(page)).catch(() => null);
      });
      collector.on("end", () => {
        interaction.editReply({ components: [] }).catch(() => null);
      });
      return;
    }

    if (subcommand === "edit") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
        await interaction.reply({ content: "❌ You need `Moderate Members` permission to edit cases.", flags: MessageFlags.Ephemeral });
        return;
      }

      const caseId = interaction.options.getString("case_id", true);
      if (!isValidObjectId(caseId)) {
        await interaction.reply({ content: caseIdHelp(caseId, "invalid"), flags: MessageFlags.Ephemeral });
        return;
      }
      const newReason = interaction.options.getString("reason", true);

      // Acknowledge before the database write so a slow lookup never shows "This interaction failed".
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const edited = await editCaseReason(interaction.guild.id, caseId, newReason);

      if (!edited) {
        await interaction.editReply({ content: caseIdHelp(caseId, "missing") });
        return;
      }
      const warning = edited.kind === "warning";
      const targetId = edited.userId;
      const previous = { reason: edited.previousReason };
      await interaction.editReply({ content: `✅ Updated reason for ${warning ? "warning" : "case"} \`${caseId}\` to: "${newReason}"` });
      await sendGuildLog(interaction.client, interaction.guild.id, {
        title: "✏️ Case Reason Edited",
        color: 0x3498DB,
        description: `**${warning ? "Warning" : "Case"}:** \`${caseId}\`${targetId ? `\n**User:** <@${targetId}>` : ""}\n**Old reason:** ${previous?.reason ?? "Unknown"}\n**New reason:** ${newReason}\n**Edited by:** ${interaction.user.tag}`,
      }).catch(() => null);
      return;
    }

    if (subcommand === "delete") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "❌ You need `Administrator` permission to delete moderation cases.", flags: MessageFlags.Ephemeral });
        return;
      }

      const caseId = interaction.options.getString("case_id", true);
      if (!isValidObjectId(caseId)) {
        await interaction.reply({ content: caseIdHelp(caseId, "invalid"), flags: MessageFlags.Ephemeral });
        return;
      }
      // Acknowledge before the lookup; the confirmation then edits this ephemeral reply.
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const record = await ModerationCaseModel.findOne({ guildId: interaction.guild.id, _id: caseId }).lean().catch(() => null);
      if (!record) {
        await interaction.editReply({ content: caseIdHelp(caseId, "missing") });
        return;
      }

      const icon = ACTION_ICONS[record.action.toLowerCase()] ?? "📜";
      const answer = await requestConfirmation(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("Delete this case?")
            .setDescription(
              `${icon} \`${record.action.toUpperCase()}\` on <@${record.userId}> by <@${record.moderatorId}>, <t:${Math.floor(new Date(record.createdAt).getTime() / 1000)}:R>\n` +
              `**Reason:** ${(record.reason || "No reason provided").slice(0, 900)}\n\n` +
              "The record is removed for good. It does not undo the action itself.",
            )
            .setFooter({ text: `Case ${caseId}` }),
        ],
        confirmLabel: "Delete case",
      });
      if (answer !== "confirmed") return;

      const res = await ModerationCaseModel.deleteOne({ guildId: interaction.guild.id, _id: caseId }).catch(() => null);
      if (!res || res.deletedCount === 0) {
        await interaction.editReply({ content: caseIdHelp(caseId, "missing"), embeds: [] });
        return;
      }
      await interaction.editReply({ content: `🗑️ Case \`${caseId}\` deleted.`, embeds: [] });
      await sendGuildLog(interaction.client, interaction.guild.id, {
        title: "🗑️ Case Deleted",
        color: 0xED4245,
        description: `**Case:** \`${caseId}\`\n**Action:** ${record.action.toUpperCase()} on <@${record.userId}>\n**Reason was:** ${(record.reason || "None").slice(0, 500)}\n**Deleted by:** ${interaction.user.tag}`,
      }).catch(() => null);
      return;
    }

    if (subcommand === "export") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: "❌ You need `Manage Server` permission to export logs.", flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const cases = await ModerationCaseModel.find({ guildId: interaction.guild.id })
        .select("guildId userId moderatorId action reason details proofUrl revoked revokedBy revokedAt createdAt")
        .sort({ createdAt: -1 })
        .limit(MAX_EXPORT_CASES + 1)
        .lean();
      if (cases.length > MAX_EXPORT_CASES) {
        await interaction.editReply(
          `❌ This server has more than ${MAX_EXPORT_CASES.toLocaleString()} moderation cases. Narrow the export before trying again.`,
        );
        return;
      }
      const jsonData = JSON.stringify(cases, null, 2);
      const buffer = Buffer.from(jsonData, "utf-8");
      const attachment = new AttachmentBuilder(buffer, { name: `moderation-export-${interaction.guild.id}.json` });

      await interaction.editReply({
        content: `📊 Exported **${cases.length}** moderation case(s) for ${interaction.guild.name}.`,
        files: [attachment],
      });
      return;
    }
  },
};

export default command;
