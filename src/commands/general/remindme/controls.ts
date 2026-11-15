/**
 * The buttons under a fresh `/remindme set` confirmation: push the reminder
 * back (snooze it before it fires), cancel it, or jump to where it was set.
 * The delivered DM keeps its own snooze buttons (remindsnooze_…); these only
 * live on the private confirmation, through a collector, so they need no
 * persistent route. The plans are pure and unit-tested.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  type ChatInputCommandInteraction,
  type Message,
} from "discord.js";
import { deleteTaskForCreator, updateTaskForCreator } from "../../../services/scheduler";
import { cancelTask, scheduleTask } from "../../../services/schedulerRunner";
import { REMINDER_BOUNDS, safeJumpUrl } from "../../../services/personalReminders";
import { guardCollect } from "../../../utils/collectorGuard";

/** How far each "Later" press pushes a pending reminder back, in minutes. */
export const PUSH_BACK_MINUTES = 60;
/** How long the confirmation's buttons keep working after the last press. */
export const REMIND_CONTROLS_IDLE_MS = 300_000;

/**
 * Link to where a reminder was set: the newest message in that channel when
 * it was set (the conversation it was about). Null when there is none. Pure.
 */
export function reminderJumpUrl(guildId: string | null, channelId: string | null, lastMessageId: string | null | undefined): string | undefined {
  if (!channelId || !lastMessageId) return undefined;
  return safeJumpUrl(`https://discord.com/channels/${guildId ?? "@me"}/${channelId}/${lastMessageId}`);
}

/** The new fire time after pushing back by `minutes`, or why it can't move. Pure. */
export function pushBackPlan(executeAtMs: number, nowMs: number, minutes: number, maxSeconds = REMINDER_BOUNDS.maxSeconds): { ok: true; at: Date } | { ok: false; error: string } {
  const base = Math.max(executeAtMs, nowMs);
  const at = base + minutes * 60_000;
  if (at - nowMs > maxSeconds * 1000) return { ok: false, error: `Reminders can't be more than ${Math.round(maxSeconds / 86_400)} days ahead.` };
  return { ok: true, at: new Date(at) };
}

export function reminderControlIds(taskId: string) {
  return { later: `remindme_later_${taskId}`, cancel: `remindme_cancel_${taskId}` } as const;
}

/** Later (+1h) · Cancel · Jump to where it was set. */
export function reminderControlRow(taskId: string, jumpUrl: string | undefined, disabled = false): ActionRowBuilder<ButtonBuilder> {
  const ids = reminderControlIds(taskId);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(ids.later).setLabel(`Later (+${PUSH_BACK_MINUTES / 60}h)`).setEmoji("💤").setStyle(ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(ids.cancel).setLabel("Cancel reminder").setEmoji("🗑️").setStyle(ButtonStyle.Danger).setDisabled(disabled),
  );
  if (jumpUrl) row.addComponents(new ButtonBuilder().setLabel("Jump to where you set it").setStyle(ButtonStyle.Link).setURL(jumpUrl));
  return row;
}

/** Keep the confirmation's buttons live until they idle out, then leave only the link. */
export function runReminderControls(interaction: ChatInputCommandInteraction, message: Message, taskId: string, firstFireAt: Date, jumpUrl: string | undefined): void {
  const ids = reminderControlIds(taskId);
  let fireAt = firstFireAt;
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    idle: REMIND_CONTROLS_IDLE_MS,
    filter: (i) => i.user.id === interaction.user.id && (i.customId === ids.later || i.customId === ids.cancel),
  });
  collector.on("collect", (i) => guardCollect("remindme", i, async () => {
    if (i.customId === ids.cancel) {
      const deleted = await deleteTaskForCreator(interaction.user.id, "personal_reminder", taskId);
      if (deleted) cancelTask(taskId);
      collector.stop("done");
      await i.update({
        content: deleted ? `🗑️ Reminder \`${taskId}\` cancelled.` : "This reminder already fired or was cancelled.",
        embeds: [], components: [],
      });
      return;
    }
    const plan = pushBackPlan(fireAt.getTime(), Date.now(), PUSH_BACK_MINUTES);
    if (!plan.ok) {
      await i.reply({ content: `❌ ${plan.error}`, flags: MessageFlags.Ephemeral });
      return;
    }
    const updated = await updateTaskForCreator(interaction.user.id, "personal_reminder", taskId, { executeAt: plan.at });
    if (!updated) {
      collector.stop("done");
      await i.update({ content: "This reminder already fired or was cancelled.", embeds: [], components: [] });
      return;
    }
    cancelTask(taskId);
    scheduleTask(interaction.client, updated);
    fireAt = updated.executeAt;
    const ts = Math.floor(updated.executeAt.getTime() / 1000);
    const embed = i.message.embeds[0];
    await i.update({
      content: `💤 Pushed back. It now fires <t:${ts}:R>.`,
      ...(embed ? { embeds: [{ ...embed.toJSON(), description: `I'll remind you <t:${ts}:R> (at <t:${ts}:f>).` }] } : {}),
    });
  }));
  collector.on("end", (_c, reason) => {
    if (reason === "done") return;
    interaction.editReply({ components: jumpUrl ? [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setLabel("Jump to where you set it").setStyle(ButtonStyle.Link).setURL(jumpUrl),
    )] : [] }).catch(() => null);
  });
}
