/** The longer /note subcommands: the paged view and clear-all with confirmation. */
import { guardCollect } from "../../../utils/collectorGuard";
import { logger } from "../../../utils/logger";
import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from "discord.js";
import { StaffNoteModel } from "../../../database/mongo";
import { PAGE_SIZE } from "./logic";

export async function noteView(interaction: ChatInputCommandInteraction, guildId: string): Promise<unknown> {
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

export async function noteClear(interaction: ChatInputCommandInteraction, guildId: string): Promise<unknown> {
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
