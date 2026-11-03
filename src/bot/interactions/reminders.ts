/**
 * Snooze buttons on delivered /remindme DMs.
 *
 * customId (unchanged): remindsnooze_<userId>_<minutes>
 */
import { MessageFlags, type ButtonInteraction } from "discord.js";
import type { ComponentRoute } from "./router";
import { encodePersonalReminder, parseReminderSnoozeCustomId } from "../../services/timedActions";
import { createTask, getTasksForCreator } from "../../services/scheduler";
import { scheduleTask } from "../../services/schedulerRunner";

/** Pending reminders a single user may hold (matches /remindme). */
const MAX_PENDING_REMINDERS_PER_USER = 25;

/**
 * Delivered reminders being snoozed right now. A quick double press used to
 * create two reminders, because the buttons are only removed after the first
 * snooze is saved.
 */
export const snoozingMessages = new Set<string>();

export const reminderRoutes: ComponentRoute[] = [
  {
    name: "reminder-snooze",
    match: /^remindsnooze_/,
    async handle(interaction) {
      if (!interaction.isButton()) return;
      const parsed = parseReminderSnoozeCustomId(interaction.customId);
      if (!parsed || parsed.userId !== interaction.user.id) {
        await interaction.reply({ content: "❌ This reminder is not yours to snooze.", flags: MessageFlags.Ephemeral });
        return;
      }

      const embed = interaction.message.embeds[0];
      const text = embed?.fields.find(f => f.name === "📝 Reminder")?.value?.trim();
      const sourceName = embed?.fields.find(f => f.name === "📌 From")?.value ?? "Direct Message";
      if (!text) {
        await interaction.reply({ content: "❌ I couldn't read this reminder to snooze it. Set a new one with `/remindme set`.", flags: MessageFlags.Ephemeral });
        return;
      }

      const lockKey = interaction.message.id;
      if (snoozingMessages.has(lockKey)) {
        await interaction.reply({ content: "💤 Already snoozing this reminder.", flags: MessageFlags.Ephemeral }).catch(() => null);
        return;
      }
      snoozingMessages.add(lockKey);
      try {
        await snooze(interaction, parsed.minutes, text, sourceName);
      } finally {
        snoozingMessages.delete(lockKey);
      }
    },
  },
];

async function snooze(interaction: ButtonInteraction, minutes: number, text: string, sourceName: string): Promise<void> {
      const pending = await getTasksForCreator(interaction.user.id, "personal_reminder");
      if (pending.length >= MAX_PENDING_REMINDERS_PER_USER) {
        await interaction.reply({
          content: `❌ You already have ${pending.length} pending reminders. Cancel one with \`/remindme cancel\` first.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const fireAt = new Date(Date.now() + minutes * 60_000);
      const task = await createTask(
        interaction.guildId ?? "dm",
        interaction.channelId,
        interaction.user.id,
        "personal_reminder",
        encodePersonalReminder({ text, inChannel: false, sourceName, setAt: Date.now() }),
        fireAt,
      );
      scheduleTask(interaction.client, task);

      // Snooze once per delivered reminder: drop the buttons from this message.
      await interaction.update({ components: [] }).catch(() => null);
      const ts = Math.floor(fireAt.getTime() / 1000);
      await interaction.followUp({
        content: `💤 Snoozed. I'll remind you again <t:${ts}:R>.`,
        flags: interaction.guildId ? MessageFlags.Ephemeral : undefined,
      }).catch(() => null);
}
