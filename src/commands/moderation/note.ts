import { logger } from "../../utils/logger";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  type AutocompleteInteraction,
} from "discord.js";
import { scopedModalId } from "../../utils/modal";
import { requestConfirmation } from "../../utils/confirmation";
import { Command } from "../../types/discord";
import { StaffNoteModel } from "../../database/mongo";
import { isNoteId, canDeleteNote, noteIdSuggestions } from "./note/logic";
import { noteView, noteClear } from "./note/subcommands";
export { isNoteId, canDeleteNote, noteIdSuggestions } from "./note/logic";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("note")
    .setDescription("Manage private staff notes attached to members.")
    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("Open a form to add a staff note to a member.")
        .addUserOption(opt =>
          opt.setName("user").setDescription("The member to annotate").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("view")
        .setDescription("View all staff notes for a member with pagination.")
        .addUserOption(opt =>
          opt.setName("user").setDescription("The member to look up").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("delete")
        .setDescription("Delete a specific staff note by ID.")
        .addStringOption(opt =>
          opt.setName("id").setDescription("The note ID (from /note view); suggestions as you type").setRequired(true).setAutocomplete(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("clear")
        .setDescription("Clear ALL staff notes for a member (requires Manage Server).")
        .addUserOption(opt =>
          opt.setName("user").setDescription("The member whose notes to clear").setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ModerateMembers],

  /** Suggests this server's newest notes for /note delete, matched by ID or text. */
  autocomplete: async (interaction: AutocompleteInteraction) => {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== "id" || !interaction.guildId) { await interaction.respond([]); return; }
    const rows = await StaffNoteModel.find({ guildId: interaction.guildId }).sort({ createdAt: -1 }).limit(100)
      .select("_id userId note createdAt").lean().catch(() => []);
    await interaction.respond(noteIdSuggestions(rows.map(r => ({ id: String(r._id), userId: r.userId, note: r.note, createdAt: new Date(r.createdAt) })), String(focused.value ?? "")))
      .catch(() => null);
  },

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    // add (modal)
    if (sub === "add") {
      const target = interaction.options.getUser("user", true);

      if (target.bot) {
        return interaction.reply({ content: "❌ You cannot add notes to bots.", flags: MessageFlags.Ephemeral });
      }

      const modal = new ModalBuilder()
        .setCustomId(scopedModalId(`note_add_modal_${target.id}`, interaction.id))
        .setTitle(`Add Note — ${target.username}`);

      const noteInput = new TextInputBuilder()
        .setCustomId("note_content")
        .setLabel("Note content (staff-only, never visible to member)")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(1000)
        .setRequired(true)
        .setPlaceholder("Describe the observation, incident, or context…");

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(noteInput));
      await interaction.showModal(modal);

      const modalResponse = await interaction.awaitModalSubmit({
        time: 300_000,
        filter: (m) => m.user.id === interaction.user.id && m.customId === scopedModalId(`note_add_modal_${target.id}`, interaction.id),
      }).catch(() => null);

      if (!modalResponse) return;
      await modalResponse.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const noteText = modalResponse.fields.getTextInputValue("note_content");

        const created = await StaffNoteModel.create({
          guildId,
          userId: target.id,
          moderatorId: interaction.user.id,
          note: noteText,
        });

        await modalResponse.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865F2)
              .setTitle("📝 Staff Note Added")
              .setThumbnail(target.displayAvatarURL())
              .addFields(
                { name: "👤 Member",    value: `${target.tag} (<@${target.id}>)`, inline: false },
                { name: "📋 Note",      value: noteText, inline: false },
                { name: "🛡️ Added By", value: interaction.user.tag, inline: true },
                { name: "🆔 Note ID",  value: `\`${String(created._id)}\``, inline: true },
              )
              .setFooter({ text: "Notes are only visible to staff. Members never see them." })
              .setTimestamp(),
          ],
        });
      } catch (err) {
        logger.error(`Failed to add note for user ${target.id} in guild ${guildId}`, err);
        await modalResponse.editReply("❌ Failed to save the note. Please try again.");
      }
      return;
    }

    // view, paged, with delete buttons
    if (sub === "view") { await noteView(interaction, guildId); return; }

    // delete by ID
    if (sub === "delete") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const noteId = interaction.options.getString("id", true).trim();
        if (!isNoteId(noteId)) {
          await interaction.editReply("❌ That isn't a note ID. Pick one from the suggestions, or copy it from `/note view`.");
          return;
        }
        const existing = await StaffNoteModel.findOne({ _id: noteId, guildId }).select("moderatorId").lean();
        if (!existing) {
          await interaction.editReply("❌ Note not found — it may already be deleted or belong to a different server.");
          return;
        }
        // Moderators delete their own notes; anyone else's needs Manage Server (like /note clear).
        if (!canDeleteNote(existing.moderatorId, interaction.user.id, interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) === true)) {
          await interaction.editReply("❌ That note was written by another moderator. Deleting someone else's note needs **Manage Server**.");
          return;
        }
        // Deleting a note can't be undone: confirm first (3.7.0 QoL).
        const confirmed = await requestConfirmation(interaction, { content: `Delete note \`${noteId}\`? This can't be undone.`, confirmLabel: "Delete note" });
        if (confirmed !== "confirmed") return;
        const deleted = await StaffNoteModel.findOneAndDelete({ _id: noteId, guildId });
        if (!deleted) {
          await interaction.editReply({ content: "❌ Note not found — it was deleted a moment ago.", components: [] });
          return;
        }

        await interaction.editReply({
          content: "",
          components: [],
          embeds: [
            new EmbedBuilder()
              .setColor(0x57F287)
              .setTitle("🗑️ Note Deleted")
              .addFields(
                { name: "🆔 Note ID",    value: `\`${noteId}\``, inline: true },
                { name: "🛡️ Deleted By", value: `<@${interaction.user.id}>`, inline: true },
                { name: "📋 Content",    value: (deleted.note as string).slice(0, 512), inline: false },
              )
              .setTimestamp(),
          ],
        });
      } catch (err) {
        logger.error(`Failed to delete note in guild ${guildId}`, err);
        await interaction.editReply("❌ Failed to delete the note. Ensure the ID is correct.");
      }
      return;
    }

    // Clear all
    if (sub === "clear") { await noteClear(interaction, guildId); return; }
  },
};

export default command;
