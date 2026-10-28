import { logger } from "../../utils/logger";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import { Command } from "../../types/discord";
import { createTask, getTasksForCreator, deleteTaskForCreator } from "../../services/scheduler";
import { scheduleTask, cancelTask } from "../../services/schedulerRunner";
import { encodePersonalReminder, decodePersonalReminder } from "../../services/timedActions";
import { parseDuration, formatDuration } from "../../utils/duration";

const MIN_REMINDER_SECONDS = 10;
const MAX_REMINDER_DAYS = 365;
const MAX_REMINDER_SECONDS = MAX_REMINDER_DAYS * 86400;
/** Pending reminders a single user may hold; they are persisted, so keep it bounded. */
const MAX_PENDING_PER_USER = 25;

function reminderText(payload: string): string {
  return decodePersonalReminder(payload)?.text ?? "(unreadable reminder)";
}

function preview(text: string, max = 60): string {
  return text.length > max ? text.substring(0, max) + "…" : text;
}

// ─── Command ─────────────────────────────────────────────────────────────────

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
          opt.setName("duration").setDescription("When to remind you (e.g. 30m, 2h, 1d, 1w)").setRequired(true).setAutocomplete(true)
        )
        .addBooleanOption(opt =>
          opt.setName("channel_reminder").setDescription("Also ping you in this channel (default: DM only)").setRequired(false)
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

    // ── list ────────────────────────────────────────────────────────────────
    if (sub === "list") {
      const reminders = await getTasksForCreator(interaction.user.id, "personal_reminder");
      if (reminders.length === 0) {
        return interaction.reply({ content: "You have no pending reminders.", flags: MessageFlags.Ephemeral });
      }

      const lines = reminders.slice(0, 15).map(t => {
        const ts = Math.floor(new Date(t.executeAt).getTime() / 1000);
        return `⏰ **\`${t.id}\`** — <t:${ts}:R>\n*${preview(reminderText(t.payload))}*`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`📋 Your Reminders (${reminders.length})`)
        .setDescription(lines.join("\n\n"))
        .setFooter({ text: reminders.length > 15 ? `Showing 15 of ${reminders.length}. Cancel with /remindme cancel.` : "Cancel with /remindme cancel." })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // ── cancel ──────────────────────────────────────────────────────────────
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

    // ── set ─────────────────────────────────────────────────────────────────
    const text        = interaction.options.getString("reminder", true);
    const durationRaw = interaction.options.getString("duration", true);
    const inChannel   = interaction.options.getBoolean("channel_reminder") ?? false;

    const durationSec = parseDuration(durationRaw);
    if (!durationSec || durationSec < MIN_REMINDER_SECONDS) {
      return interaction.reply({
        content: "❌ Invalid duration. Use formats like `30m`, `2h`, `1d`. Minimum is 10 seconds.",
        flags: MessageFlags.Ephemeral,
      });
    }
    if (durationSec > MAX_REMINDER_SECONDS) {
      return interaction.reply({
        content: `❌ Reminders cannot be set more than ${MAX_REMINDER_DAYS} days ahead.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const pending = await getTasksForCreator(interaction.user.id, "personal_reminder");
    if (pending.length >= MAX_PENDING_PER_USER) {
      return interaction.reply({
        content: `❌ You already have ${pending.length} pending reminders. Cancel one with \`/remindme cancel\` first.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const setAt  = Date.now();
    const fireAt = new Date(setAt + durationSec * 1000);
    const fireTs = Math.floor(fireAt.getTime() / 1000);

    let taskId: string;
    try {
      const task = await createTask(
        interaction.guildId ?? "dm",
        interaction.channelId,
        interaction.user.id,
        "personal_reminder",
        encodePersonalReminder({
          text,
          inChannel,
          sourceName: interaction.guild?.name ?? "Direct Message",
          setAt,
        }),
        fireAt,
      );
      scheduleTask(interaction.client, task);
      taskId = task.id!;
    } catch (err) {
      logger.error(`Failed to save reminder for user ${interaction.user.id}`, err);
      return interaction.reply({
        content: "❌ Couldn't save your reminder. Please try again in a moment.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const confirmEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("⏰ Reminder Set!")
      .setDescription(`I'll remind you <t:${fireTs}:R> (at <t:${fireTs}:f>).`)
      .addFields(
        { name: "📝 Reminder", value: text, inline: false },
        { name: "⏳ Duration", value: formatDuration(durationSec), inline: true },
        { name: "🔔 Delivery",  value: inChannel ? "DM + Channel Ping" : "DM only", inline: true },
      )
      .setFooter({ text: `ID: ${taskId} · You can close this. I'll DM you when the time comes.` })
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

    const presets = [
      { name: "10 minutes", value: "10m" },
      { name: "30 minutes", value: "30m" },
      { name: "1 hour", value: "1h" },
      { name: "2 hours", value: "2h" },
      { name: "4 hours", value: "4h" },
      { name: "8 hours", value: "8h" },
      { name: "12 hours", value: "12h" },
      { name: "1 day (tomorrow)", value: "1d" },
      { name: "3 days", value: "3d" },
      { name: "1 week", value: "1w" },
    ];
    const filtered = presets.filter(p => !focused || p.name.toLowerCase().includes(focused) || p.value.toLowerCase().includes(focused));
    await interaction.respond(filtered.slice(0, 10).map(p => ({ name: `${p.value} (${p.name})`, value: p.value })));
  },
};

export default command;
