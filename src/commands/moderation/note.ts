import { logger } from "../../utils/logger";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { Command } from "../../types/discord";
import { StaffNoteModel } from "../../database/mongo";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("note")
    .setDescription("Add, view, or delete private staff notes on a member.")
    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("Add a private staff note to a member.")
        .addUserOption(opt =>
          opt.setName("user").setDescription("The member to annotate").setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName("note").setDescription("The note content").setRequired(true).setMaxLength(1000)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("view")
        .setDescription("View all staff notes for a member.")
        .addUserOption(opt =>
          opt.setName("user").setDescription("The member to look up").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("delete")
        .setDescription("Delete a specific staff note by its ID.")
        .addStringOption(opt =>
          opt.setName("id").setDescription("The note ID to delete (from /note view)").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("clear")
        .setDescription("Clear ALL staff notes for a member.")
        .addUserOption(opt =>
          opt.setName("user").setDescription("The member whose notes to clear").setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    await interaction.deferReply({ ephemeral: true });

    try {
      if (sub === "add") {
        const target = interaction.options.getUser("user", true);
        const noteText = interaction.options.getString("note", true);

        if (target.bot) {
          await interaction.editReply("❌ You cannot add notes to bots.");
          return;
        }

        const created = await StaffNoteModel.create({
          guildId,
          userId: target.id,
          moderatorId: interaction.user.id,
          note: noteText,
        });

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("📝 Staff Note Added")
          .setThumbnail(target.displayAvatarURL())
          .addFields(
            { name: "👤 Member", value: `${target.tag} (<@${target.id}>)`, inline: false },
            { name: "📋 Note", value: noteText, inline: false },
            { name: "🛡️ Added By", value: interaction.user.tag, inline: true },
            { name: "🆔 Note ID", value: `\`${String(created._id)}\``, inline: true },
          )
          .setFooter({ text: "Notes are staff-only and never visible to members." })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } else if (sub === "view") {
        const target = interaction.options.getUser("user", true);
        const notes = await StaffNoteModel.find({ guildId, userId: target.id }).sort({ createdAt: -1 }).limit(15);

        if (notes.length === 0) {
          await interaction.editReply(`📝 No staff notes found for **${target.tag}**.`);
          return;
        }

        const noteLines = notes.map((n, idx) => {
          const ts = Math.floor(new Date(n.createdAt as Date).getTime() / 1000);
          return `**${idx + 1}.** <t:${ts}:R> by <@${n.moderatorId}>\n> ${n.note}\n> \`ID: ${String(n._id)}\``;
        });

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(`📝 Staff Notes — ${target.tag}`)
          .setThumbnail(target.displayAvatarURL())
          .setDescription(noteLines.join("\n\n").slice(0, 4000))
          .setFooter({ text: `${notes.length} note(s) found. Notes are staff-only.` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } else if (sub === "delete") {
        const noteId = interaction.options.getString("id", true);
        const deleted = await StaffNoteModel.findOneAndDelete({ _id: noteId, guildId });

        if (!deleted) {
          await interaction.editReply("❌ Note not found — it may already be deleted or belong to a different server.");
          return;
        }

        await interaction.editReply(`✅ Note \`${noteId}\` deleted by <@${interaction.user.id}>.`);
      } else if (sub === "clear") {
        const target = interaction.options.getUser("user", true);

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          await interaction.editReply("❌ Clearing all notes requires **Manage Server** permission.");
          return;
        }

        const result = await StaffNoteModel.deleteMany({ guildId, userId: target.id });
        await interaction.editReply(`🗑️ Cleared **${result.deletedCount}** note(s) for **${target.tag}**.`);
      }
    } catch (err) {
      logger.error(`Failed to handle /note ${sub} in guild ${guildId}`, err);
      await interaction.editReply("❌ An error occurred. Please try again.");
    }
  },
};

export default command;
