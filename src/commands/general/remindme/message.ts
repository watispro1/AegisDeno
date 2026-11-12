/**
 * "Remind Me About This" (right-click a message → Apps): asks when, with an
 * optional note, then sets a /remindme reminder whose DM links back to the
 * message. Same limits and storage as /remindme set.
 */
import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type MessageContextMenuCommandInteraction,
} from "discord.js";
import { createPersonalReminder, messageReminderText } from "../../../services/personalReminders";
import { parseFriendlyDuration, formatDurationLong } from "../../../utils/duration";
import { scopedModalId } from "../../../utils/modal";
import { logger } from "../../../utils/logger";

export const REMIND_MODAL_WAIT_MS = 300_000;

export async function remindAboutMessage(interaction: MessageContextMenuCommandInteraction): Promise<void> {
  const message = interaction.targetMessage;
  const modalId = scopedModalId("remindmsg", interaction.id);
  const modal = new ModalBuilder()
    .setCustomId(modalId)
    .setTitle("Remind me about this message")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("when").setLabel("When? (e.g. 30m, 2h, 1d 12h, 1 week)").setStyle(TextInputStyle.Short)
          .setRequired(true).setMaxLength(40).setValue("1h"),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("note").setLabel("Note (optional)").setStyle(TextInputStyle.Paragraph)
          .setRequired(false).setMaxLength(400).setPlaceholder("Leave empty to use the message's first line"),
      ),
    );
  await interaction.showModal(modal);

  const submit = await interaction.awaitModalSubmit({
    time: REMIND_MODAL_WAIT_MS,
    filter: (m) => m.user.id === interaction.user.id && m.customId === modalId,
  }).catch(() => null);
  if (!submit) return;

  const whenRaw = submit.fields.getTextInputValue("when");
  const durationSec = parseFriendlyDuration(whenRaw) ?? 0;
  const text = messageReminderText(submit.fields.getTextInputValue("note"), {
    content: message.content ?? "",
    authorTag: message.author.tag,
    attachments: message.attachments.size,
  });

  try {
    const result = await createPersonalReminder(interaction.client, {
      userId: interaction.user.id,
      guildId: interaction.guildId,
      guildName: interaction.guild?.name ?? null,
      channelId: interaction.channelId,
      text,
      durationSec,
      inChannel: false,
      jumpUrl: message.url,
    });
    if (!result.ok) {
      await submit.reply({ content: `❌ ${result.error}`, flags: MessageFlags.Ephemeral });
      return;
    }
    const ts = Math.floor(result.fireAt.getTime() / 1000);
    await submit.reply({
      content: `⏰ I'll DM you about [this message](${message.url}) <t:${ts}:R> (in ${formatDurationLong(durationSec)}).\n-# ${text.replace(/\n/g, " ").slice(0, 200)} · ID \`${result.task.id}\` · see /remindme list`,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  } catch (err) {
    logger.error(`Failed to save message reminder for user ${interaction.user.id}`, err);
    await submit.reply({ content: "❌ Couldn't save your reminder. Please try again in a moment.", flags: MessageFlags.Ephemeral }).catch(() => null);
  }
}
