import { definePlugin } from "../definePlugin";
import { MessageFlags } from "discord.js";

/** Pending reminders a single user may hold (matches /remindme). */
const MAX_PENDING_REMINDERS_PER_USER = 25;

export const GeneralPlugin = definePlugin({
  name: "general",
  description: "General server utility, diagnostics, help manuals, and personal tools",
  version: "1.0.0",
  defaultConfig: {},
  customIdHandlers: [
    {
      // Snooze button on a delivered /remindme DM: `remindsnooze_<userId>_<minutes>`.
      pattern: /^remindsnooze_/,
      async handler(interaction) {
        if (!interaction.isButton()) return;
        const { parseReminderSnoozeCustomId, encodePersonalReminder } = await import("../../services/timedActions");
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

        const { createTask, getTasksForCreator } = await import("../../services/scheduler");
        const pending = await getTasksForCreator(interaction.user.id, "personal_reminder");
        if (pending.length >= MAX_PENDING_REMINDERS_PER_USER) {
          await interaction.reply({
            content: `❌ You already have ${pending.length} pending reminders. Cancel one with \`/remindme cancel\` first.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const fireAt = new Date(Date.now() + parsed.minutes * 60_000);
        const task = await createTask(
          interaction.guildId ?? "dm",
          interaction.channelId,
          interaction.user.id,
          "personal_reminder",
          encodePersonalReminder({ text, inChannel: false, sourceName, setAt: Date.now() }),
          fireAt,
        );
        const { scheduleTask } = await import("../../services/schedulerRunner");
        scheduleTask(interaction.client, task);

        // Snooze once per delivered reminder: drop the buttons from this message.
        await interaction.update({ components: [] }).catch(() => null);
        const ts = Math.floor(fireAt.getTime() / 1000);
        await interaction.followUp({
          content: `💤 Snoozed. I'll remind you again <t:${ts}:R>.`,
          flags: interaction.guildId ? MessageFlags.Ephemeral : undefined,
        }).catch(() => null);
      },
    },
  ],
});

export const ConfigPlugin = definePlugin({
  name: "config",
  description: "Guild configuration, custom prefixes, logging setup, and welcome automation",
  version: "1.0.0",
  defaultConfig: {},
});

export const AutoresponderPlugin = definePlugin({
  name: "autoresponder",
  description: "Automated trigger-and-response custom rules",
  version: "1.0.0",
  defaultConfig: {},
});
