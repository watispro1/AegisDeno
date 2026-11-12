import { logger } from "../../utils/logger";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import { Command } from "../../types/discord";
import { getTasksForCreator, deleteTaskForCreator, updateTaskForCreator } from "../../services/scheduler";
import { planReminderEdit } from "../../services/reminderEdit";
import { scheduleTask, cancelTask } from "../../services/schedulerRunner";
import { encodePersonalReminder, decodePersonalReminder, type ReminderRepeat } from "../../services/timedActions";
import { parseFriendlyDuration, formatDurationLong } from "../../utils/duration";
import { createPersonalReminder, MAX_PENDING_PER_USER, REMINDER_BOUNDS, REMINDER_DURATION_PRESETS, reminderListLine } from "../../services/personalReminders";
import { buildDurationSuggestions } from "../../utils/moderationPresets";
import { replyPagedList } from "../../utils/listPager";
import { COLORS, footer } from "../../utils/embedStyle";

function reminderText(payload: string): string {
  return decodePersonalReminder(payload)?.text ?? "(unreadable reminder)";
}

function preview(text: string, max = 60): string {
  return text.length > max ? text.substring(0, max) + "…" : text;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("remindme")
    .setDescription("Personal reminders that Aegis will DM you, even across restarts.")
    .addSubcommand(sub =>
      sub
        .setName("set")
        .setDescription("Set a personal reminder that Aegis will DM you after the specified time.")
        .addStringOption(opt =>
          opt.setName("reminder").setDescription("What should I remind you about?").setRequired(true).setMaxLength(512)
        )
        .addStringOption(opt =>
          opt.setName("duration").setDescription("When to remind you (e.g. 30m, 2h, 1d 12h, 2 weeks)").setRequired(true).setAutocomplete(true)
        )
        .addBooleanOption(opt =>
          opt.setName("channel_reminder").setDescription("Also ping you in this channel (default: DM only)").setRequired(false)
        )
        .addStringOption(opt =>
          opt
            .setName("repeat")
            .setDescription("Repeat the reminder after it fires (default: once)")
            .setRequired(false)
            .addChoices(
              { name: "Once", value: "none" },
              { name: "Daily", value: "daily" },
              { name: "Weekly", value: "weekly" },
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("edit")
        .setDescription("Change a pending reminder's text, time or repeat.")
        .addStringOption(opt =>
          opt.setName("id").setDescription("Reminder ID (from /remindme list)").setRequired(true).setAutocomplete(true)
        )
        .addStringOption(opt =>
          opt.setName("reminder").setDescription("New text").setRequired(false).setMaxLength(512)
        )
        .addStringOption(opt =>
          opt.setName("duration").setDescription("New time, counted from now (e.g. 30m, 2h, 1d)").setRequired(false).setAutocomplete(true)
        )
        .addStringOption(opt =>
          opt
            .setName("repeat")
            .setDescription("Repeat after it fires")
            .setRequired(false)
            .addChoices(
              { name: "Once", value: "none" },
              { name: "Daily", value: "daily" },
              { name: "Weekly", value: "weekly" },
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName("list").setDescription("List your pending reminders.")
    )
    .addSubcommand(sub =>
      sub
        .setName("cancel")
        .setDescription("Cancel one of your pending reminders.")
        .addStringOption(opt =>
          opt.setName("id").setDescription("Reminder ID (from /remindme list)").setRequired(true).setAutocomplete(true)
        )
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();

    // list
    if (sub === "list") {
      const reminders = await getTasksForCreator(interaction.user.id, "personal_reminder");
      if (reminders.length === 0) {
        return interaction.reply({ content: "You have no pending reminders.", flags: MessageFlags.Ephemeral });
      }

      await replyPagedList(interaction, {
        title: `📋 Your Reminders (${reminders.length}/${MAX_PENDING_PER_USER})`,
        lines: [...reminders].sort((a, b) => new Date(a.executeAt).getTime() - new Date(b.executeAt).getTime()).map(reminderListLine),
        perPage: 8,
        note: "Change one with /remindme edit, or cancel it with /remindme cancel",
        ephemeral: true,
      });
      return;
    }

    // edit
    if (sub === "edit") {
      const id = interaction.options.getString("id", true).trim();
      const task = (await getTasksForCreator(interaction.user.id, "personal_reminder")).find(t => t.id === id);
      const current = task ? decodePersonalReminder(task.payload) : null;
      if (!task || !current) {
        return interaction.reply({ content: `❌ Reminder \`${id}\` not found. Use \`/remindme list\` to see your reminders.`, flags: MessageFlags.Ephemeral });
      }
      const durationRaw = interaction.options.getString("duration");
      const durationSec = durationRaw === null ? null : parseFriendlyDuration(durationRaw) ?? 0;
      const repeatRaw = interaction.options.getString("repeat");
      const plan = planReminderEdit(current, {
        text: interaction.options.getString("reminder"),
        durationSec,
        repeat: repeatRaw === "none" || repeatRaw === "daily" || repeatRaw === "weekly" ? repeatRaw : null,
      });
      if (!plan.ok) return interaction.reply({ content: `❌ ${plan.error}`, flags: MessageFlags.Ephemeral });
      const updated = await updateTaskForCreator(interaction.user.id, "personal_reminder", id, {
        payload: encodePersonalReminder(plan.payload),
        ...(plan.executeAt ? { executeAt: plan.executeAt } : {}),
        ...(plan.intervalMs !== undefined ? { intervalMs: plan.intervalMs } : {}),
      });
      if (!updated) {
        return interaction.reply({ content: "❌ That reminder fired or was cancelled while you were editing it.", flags: MessageFlags.Ephemeral });
      }
      cancelTask(id);
      scheduleTask(interaction.client, updated);
      const ts = Math.floor(updated.executeAt.getTime() / 1000);
      return interaction.reply({
        content: `✅ Reminder \`${id}\` updated (${plan.changes.join(", ")}). It fires <t:${ts}:R>${plan.payload.repeat ? `, then ${plan.payload.repeat}` : ""}.\n*${preview(plan.payload.text)}*`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // cancel
    if (sub === "cancel") {
      const id = interaction.options.getString("id", true).trim();
      const deleted = await deleteTaskForCreator(interaction.user.id, "personal_reminder", id);
      if (!deleted) {
        return interaction.reply({
          content: `❌ Reminder \`${id}\` not found. Use \`/remindme list\` to see your reminders.`,
          flags: MessageFlags.Ephemeral,
        });
      }
      cancelTask(id);
      return interaction.reply({ content: `✅ Reminder \`${id}\` cancelled.`, flags: MessageFlags.Ephemeral });
    }

    // set
    const text        = interaction.options.getString("reminder", true);
    const durationRaw = interaction.options.getString("duration", true);
    const inChannel   = interaction.options.getBoolean("channel_reminder") ?? false;
    const repeatRaw   = interaction.options.getString("repeat");
    const repeat: ReminderRepeat | undefined = repeatRaw === "daily" || repeatRaw === "weekly" ? repeatRaw : undefined;
    const durationSec = parseFriendlyDuration(durationRaw) ?? 0;

    let result: Awaited<ReturnType<typeof createPersonalReminder>>;
    try {
      result = await createPersonalReminder(interaction.client, {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        guildName: interaction.guild?.name ?? null,
        channelId: interaction.channelId,
        text,
        durationSec,
        inChannel,
        repeat,
      });
    } catch (err) {
      logger.error(`Failed to save reminder for user ${interaction.user.id}`, err);
      return interaction.reply({ content: "❌ Couldn't save your reminder. Please try again in a moment.", flags: MessageFlags.Ephemeral });
    }
    if (!result.ok) return interaction.reply({ content: `❌ ${result.error}`, flags: MessageFlags.Ephemeral });

    const fireTs = Math.floor(result.fireAt.getTime() / 1000);
    const confirmEmbed = new EmbedBuilder()
      .setColor(COLORS.brand)
      .setTitle("⏰ Reminder Set!")
      .setDescription(`I'll remind you <t:${fireTs}:R> (at <t:${fireTs}:f>).`)
      .addFields(
        { name: "📝 Reminder", value: text, inline: false },
        { name: "⏳ Duration", value: formatDurationLong(durationSec), inline: true },
        { name: "🔔 Delivery",  value: inChannel ? "DM + Channel Ping" : "DM only", inline: true },
        { name: "🔁 Repeats",   value: repeat ? (repeat === "daily" ? "Daily" : "Weekly") : "Once", inline: true },
      )
      .setFooter(footer(`ID: ${result.task.id} · You can close this. I'll DM you when the time comes.`))
      .setTimestamp();

    await interaction.reply({ embeds: [confirmEmbed], flags: MessageFlags.Ephemeral });
  },

  async autocomplete(interaction) {
    const focusedOpt = interaction.options.getFocused(true);
    const focused = focusedOpt.value.trim().toLowerCase();

    if (focusedOpt.name === "id") {
      const reminders = await getTasksForCreator(interaction.user.id, "personal_reminder").catch(() => []);
      const choices = reminders
        .map(t => ({ id: t.id!, text: reminderText(t.payload) }))
        .filter(r => !focused || r.id.includes(focused) || r.text.toLowerCase().includes(focused))
        .slice(0, 25)
        .map(r => ({ name: preview(`${r.text} (${r.id.slice(-6)})`, 100), value: r.id }));
      await interaction.respond(choices);
      return;
    }

    await interaction.respond(buildDurationSuggestions(focusedOpt.value, REMINDER_DURATION_PRESETS, REMINDER_BOUNDS));
  },
};

export default command;
