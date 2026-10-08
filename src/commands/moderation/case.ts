import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} from "discord.js";
import type { Command } from "../../types/discord";
import { ModerationCaseModel } from "../../database/mongo";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("case")
    .setDescription("Moderation case lookup, reason edits, deletion, and log export.")
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName("view")
        .setDescription("View details of a specific moderation case.")
        .addStringOption(opt => opt.setName("case_id").setDescription("Database ID of the case").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("edit")
        .setDescription("Edit the reason on a moderation case.")
        .addStringOption(opt => opt.setName("case_id").setDescription("Database ID of the case").setRequired(true))
        .addStringOption(opt => opt.setName("reason").setDescription("New updated reason").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("delete")
        .setDescription("Delete a moderation case record.")
        .addStringOption(opt => opt.setName("case_id").setDescription("Database ID of the case").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("export")
        .setDescription("Export all guild moderation history as a JSON file.")
    ),

  category: "moderation",
  guildOnly: true,

  async execute(interaction) {
    if (!interaction.guild) return;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "view") {
      const caseId = interaction.options.getString("case_id", true);
      const record = await ModerationCaseModel.findOne({ guildId: interaction.guild.id, _id: caseId }).catch(() => null);

      if (!record) {
        await interaction.reply({ content: `❌ Moderation case \`${caseId}\` was not found.`, ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`📜 Moderation Case — ${caseId}`)
        .setColor(0x3498DB)
        .addFields(
          { name: "Target User", value: `<@${record.userId}> (\`${record.userId}\`)`, inline: true },
          { name: "Moderator", value: `<@${record.moderatorId}>`, inline: true },
          { name: "Action", value: `\`${record.action.toUpperCase()}\``, inline: true },
          { name: "Reason", value: record.reason, inline: false },
          { name: "Date", value: `<t:${Math.floor(record.createdAt.getTime() / 1000)}:F>`, inline: true }
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (subcommand === "edit") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
        await interaction.reply({ content: "❌ You need `Moderate Members` permission to edit cases.", ephemeral: true });
        return;
      }

      const caseId = interaction.options.getString("case_id", true);
      const newReason = interaction.options.getString("reason", true);

      const record = await ModerationCaseModel.findOneAndUpdate(
        { guildId: interaction.guild.id, _id: caseId },
        { $set: { reason: newReason } },
        { new: true }
      ).catch(() => null);

      if (!record) {
        await interaction.reply({ content: `❌ Case \`${caseId}\` not found.`, ephemeral: true });
      } else {
        await interaction.reply({ content: `✅ Updated reason for case \`${caseId}\` to: "${newReason}"`, ephemeral: true });
      }
      return;
    }

    if (subcommand === "delete") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: "❌ You need `Administrator` permission to delete moderation cases.", ephemeral: true });
        return;
      }

      const caseId = interaction.options.getString("case_id", true);
      const res = await ModerationCaseModel.deleteOne({ guildId: interaction.guild.id, _id: caseId }).catch(() => null);

      if (res && res.deletedCount > 0) {
        await interaction.reply({ content: `🗑️ Moderation case \`${caseId}\` deleted.`, ephemeral: true });
      } else {
        await interaction.reply({ content: `❌ Case \`${caseId}\` not found.`, ephemeral: true });
      }
      return;
    }

    if (subcommand === "export") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: "❌ You need `Manage Server` permission to export logs.", ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const cases = await ModerationCaseModel.find({ guildId: interaction.guild.id }).sort({ createdAt: -1 });
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
