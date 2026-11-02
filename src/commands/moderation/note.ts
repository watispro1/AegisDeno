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

const PAGE_SIZE = 4;

/** A note ID is a Mongo ObjectId: 24 hex characters. */
export function isNoteId(value: string): boolean {
  return /^[0-9a-f]{24}$/i.test(value);
}

export function canDeleteNote(authorId: string, actorId: string, actorHasManageGuild: boolean): boolean {
  return authorId === actorId || actorHasManageGuild;
}

/** Autocomplete choices for /note delete: "a1b2c3d4 · <@user> · text…", newest first, max 25. */
export function noteIdSuggestions(rows: Array<{ id: string; userId: string; note: string; createdAt: Date }>, typed: string): Array<{ name: string; value: string }> {
  const q = typed.trim().toLowerCase();
  return rows
    .filter(r => !q || r.id.toLowerCase().includes(q) || r.userId.includes(q) || r.note.toLowerCase().includes(q))
    .slice(0, 25)
    .map(r => {
      const label = `${r.id.slice(-8)} · user ${r.userId} · ${r.createdAt.toISOString().slice(0, 10)} · ${r.note.replace(/\s+/g, " ")}`;
      return { name: label.length > 100 ? `${label.slice(0, 99)}…` : label, value: r.id };
    });
}

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

    // ── ADD via modal ─────────────────────────────────────────────────────────
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

    // ── VIEW with pagination + quick-delete buttons ───────────────────────────
    if (sub === "view") {
      const target = interaction.options.getUser("user", true);
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        let notes = await StaffNoteModel.find({ guildId, userId: target.id }).sort({ createdAt: -1 });
        let page = 0;

        const totalPages = () => Math.max(1, Math.ceil(notes.length / PAGE_SIZE));

        const buildEmbed = () => {
          const start = page * PAGE_SIZE;
          const pageNotes = notes.slice(start, start + PAGE_SIZE);

          const embed = new EmbedBuilder()
            .setColor(notes.length ? 0x5865F2 : 0x57F287)
            .setTitle(`📝 Staff Notes — ${target.tag}`)
            .setThumbnail(target.displayAvatarURL())
            .setTimestamp();

          if (notes.length === 0) {
            embed.setDescription("✅ No staff notes on record for this member.");
            embed.setFooter({ text: "Notes are staff-only and never visible to members." });
            return embed;
          }

          for (const n of pageNotes) {
            const ts = Math.floor(new Date(n.createdAt as Date).getTime() / 1000);
            embed.addFields({
              name: `🆔 \`${String(n._id).slice(-8).toUpperCase()}\` · <t:${ts}:f> · by <@${n.moderatorId}>`,
              value: n.note.slice(0, 1024),
            });
          }

          embed.setFooter({
            text: `${notes.length} note(s) total · Page ${page + 1}/${totalPages()} · Notes are staff-only`,
          });

          return embed;
        };

        const buildButtons = () => {
          const start = page * PAGE_SIZE;
          const pageNotes = notes.slice(start, start + PAGE_SIZE);

          const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId("note_prev")
              .setLabel("Previous")
              .setStyle(ButtonStyle.Secondary)
              .setEmoji("◀️")
              .setDisabled(page === 0),
            new ButtonBuilder()
              .setCustomId("note_next")
              .setLabel("Next")
              .setStyle(ButtonStyle.Secondary)
              .setEmoji("▶️")
              .setDisabled(page >= totalPages() - 1),
            new ButtonBuilder()
              .setCustomId("note_refresh")
              .setLabel("Refresh")
              .setStyle(ButtonStyle.Secondary)
              .setEmoji("🔄"),
          );

          const rows: ActionRowBuilder<ButtonBuilder>[] = [navRow];

          // Quick-delete buttons for notes on this page (max 4 to fit in a row)
          if (pageNotes.length > 0) {
            const deleteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
              ...pageNotes.slice(0, 4).map((n, idx) =>
                new ButtonBuilder()
                  .setCustomId(`note_del_${String(n._id)}`)
                  .setLabel(`Delete Note ${start + idx + 1}`)
                  .setStyle(ButtonStyle.Danger)
                  .setEmoji("🗑️")
              )
            );
            rows.push(deleteRow);
          }

          return rows;
        };

        const sent = await interaction.editReply({
          embeds: [buildEmbed()],
          components: notes.length > 0 ? buildButtons() : [],
        });

        if (notes.length === 0) return;

        const collector = sent.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 120_000,
          filter: (i) => i.user.id === interaction.user.id,
        });

        collector.on("collect", (i) => guardCollect("note", i, async () => {
          try {
            await i.deferUpdate().catch(() => null);

            if (i.customId === "note_prev") {
              page = Math.max(0, page - 1);
            } else if (i.customId === "note_next") {
              page = Math.min(totalPages() - 1, page + 1);
            } else if (i.customId === "note_refresh") {
              notes = await StaffNoteModel.find({ guildId, userId: target.id }).sort({ createdAt: -1 });
              page = 0;
            } else if (i.customId.startsWith("note_del_")) {
              const noteId = i.customId.replace("note_del_", "");
              const deleted = await StaffNoteModel.findOneAndDelete({ _id: noteId, guildId }).catch(() => null);
              if (deleted) {
                notes = await StaffNoteModel.find({ guildId, userId: target.id }).sort({ createdAt: -1 });
                if (page >= totalPages()) page = Math.max(0, totalPages() - 1);
                await i.followUp({ content: `✅ Note deleted.`, flags: MessageFlags.Ephemeral }).catch(() => null);
              } else {
                await i.followUp({ content: "❌ Note not found — it may have already been deleted.", flags: MessageFlags.Ephemeral }).catch(() => null);
              }
            }

            await i.editReply({
              embeds: [buildEmbed()],
              components: notes.length > 0 ? buildButtons() : [],
            }).catch(() => null);
          } catch (btnErr) {
            logger.warn("Error handling note button interaction", btnErr);
          }
        }));

        collector.on("end", async () => {
          await interaction.editReply({ components: [] }).catch(() => null);
        });
      } catch (err) {
        logger.error(`Failed to view notes for user ${target.id} in guild ${guildId}`, err);
        await interaction.editReply("❌ Failed to retrieve notes. Please try again.");
      }
      return;
    }

    // ── DELETE by ID ──────────────────────────────────────────────────────────
    if (sub === "delete") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const noteId = interaction.options.getString("id", true).trim();
        // An ID that isn't a Mongo ObjectId used to surface as a generic error.
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

    // ── CLEAR ALL ─────────────────────────────────────────────────────────────
    if (sub === "clear") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: "❌ Clearing all notes requires **Manage Server** permission.", flags: MessageFlags.Ephemeral });
      }

      const target = interaction.options.getUser("user", true);
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const count = await StaffNoteModel.countDocuments({ guildId, userId: target.id });

        if (count === 0) {
          await interaction.editReply(`📝 **${target.tag}** has no notes to clear.`);
          return;
        }

        // Confirmation before wiping
        const confirmEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle("⚠️ Clear All Notes")
          .setDescription(`This will permanently delete all **${count}** staff note(s) for ${target.tag}. This cannot be undone.`)
          .addFields({ name: "👤 Member", value: `${target.tag} (<@${target.id}>)`, inline: true })
          .setTimestamp();

        const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("note_clear_confirm")
            .setLabel(`Clear ${count} note(s)`)
            .setStyle(ButtonStyle.Danger)
            .setEmoji("🗑️"),
          new ButtonBuilder()
            .setCustomId("note_clear_cancel")
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("✖️"),
        );

        const prompt = await interaction.editReply({ embeds: [confirmEmbed], components: [confirmRow] });

        const collector = prompt.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 30_000,
          filter: (i) => i.user.id === interaction.user.id,
          max: 1,
        });

        collector.on("collect", (i) => guardCollect("note", i, async () => {
          try {
            if (i.customId === "note_clear_cancel") {
              await i.update({ content: "❌ Clear cancelled.", embeds: [], components: [] }).catch(() => null);
              return;
            }

            await i.deferUpdate().catch(() => null);
            const result = await StaffNoteModel.deleteMany({ guildId, userId: target.id });
            await i.editReply({
              content: null,
              embeds: [
                new EmbedBuilder()
                  .setColor(0x57F287)
                  .setTitle("🗑️ Notes Cleared")
                  .addFields(
                    { name: "👤 Member",   value: `${target.tag} (<@${target.id}>)`, inline: true },
                    { name: "🗑️ Deleted", value: `**${result.deletedCount}** note(s)`, inline: true },
                    { name: "🛡️ By",      value: `<@${interaction.user.id}>`, inline: true },
                  )
                  .setTimestamp(),
              ],
              components: [],
            }).catch(() => null);
          } catch (clearErr) {
            logger.warn("Error clearing notes", clearErr);
          }
        }));

        collector.on("end", async (_, stopReason) => {
          if (stopReason === "time") {
            await interaction.editReply({ content: "⏰ Confirmation timed out.", embeds: [], components: [] }).catch(() => null);
          }
        });
      } catch (err) {
        logger.error(`Failed to clear notes for user in guild ${guildId}`, err);
        await interaction.editReply("❌ Failed to clear notes. Please try again.");
      }
    }
  },
};

export default command;
