import { logger } from "../../utils/logger";
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, TextChannel } from "discord.js";
import { Command } from "../../types/discord";
import { createTask, getTasksForGuild, deleteTask } from "../../services/scheduler";
import { scheduleTask, cancelTask, getActiveTaskIds } from "../../services/schedulerRunner";

const MAX_REMINDER_MS = 28 * 24 * 60 * 60 * 1000;

const parseDuration = (input: string): number | null => {
  const match = input.trim().toLowerCase().match(/^(\d+)([smhd])$/);
  if (!match) return null;
  const val = parseInt(match[1], 10);
  const unit = match[2];
  const multiplier = unit === "s" ? 1000 : unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  const duration = val * multiplier;
  return Number.isSafeInteger(duration) && duration > 0 && duration <= MAX_REMINDER_MS ? duration : null;
};

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("automation")
    .setDescription("Manage scheduled tasks and reminders.")
    .addSubcommand(sub =>
      sub
        .setName("remind")
        .setDescription("Set a reminder.")
        .addStringOption(opt =>
          opt.setName("in").setDescription("Duration (e.g., 10m, 2h, 1d)").setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName("message").setDescription("What to remind you about").setRequired(true).setMaxLength(1000)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("message")
        .setDescription("Schedule a message to a channel (Manage Server required).")
        .addStringOption(opt =>
          opt.setName("in").setDescription("Delay up to 28 days (e.g., 10m, 2h, 1d)").setRequired(true)
        )
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Channel that will receive the message").setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName("message").setDescription("Message to schedule").setRequired(true).setMaxLength(1000)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("list")
        .setDescription("List active reminders and tasks.")
        .addBooleanOption(opt =>
          opt.setName("all").setDescription("Show all guild tasks (Manage Server required)").setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("cancel")
        .setDescription("Cancel an active task.")
        .addStringOption(opt =>
          opt.setName("id").setDescription("Task ID to cancel").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("repeat")
        .setDescription("Schedule a recurring message to a channel (Manage Server required).")
        .addStringOption(opt =>
          opt.setName("interval").setDescription("Interval up to 28 days (e.g., 10m, 2h, 1d)").setRequired(true)
        )
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Channel that will receive the message").setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName("message").setDescription("Message to schedule").setRequired(true).setMaxLength(1000)
        )
    ),

  guildOnly: true,
  botPermissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    await interaction.deferReply({ ephemeral: sub !== "remind" && sub !== "message" && sub !== "repeat" });

    try {
      // ── remind ────────────────────────────────────────────────────────────
      if (sub === "remind") {
        const durationStr = interaction.options.getString("in", true);
        const message     = interaction.options.getString("message", true);

        const ms = parseDuration(durationStr);
        if (!ms) {
          await interaction.editReply("❌ Use a duration from 1 second to 28 days, such as `10m`, `2h`, or `1d`.");
          return;
        }

        const executeAt = new Date(Date.now() + ms);
        const task = await createTask(guildId, interaction.channelId, interaction.user.id, "reminder", message, executeAt);
        scheduleTask(interaction.client, task);

        await interaction.editReply(
          `✅ Reminder set for <t:${Math.floor(executeAt.getTime() / 1000)}:R>.\n**ID:** \`${task.id}\``
        );
        return;
      }

      // ── message ───────────────────────────────────────────────────────────
      if (sub === "message") {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          await interaction.editReply("❌ Scheduling a channel message requires **Manage Server**.");
          return;
        }

        const durationStr = interaction.options.getString("in", true);
        const message     = interaction.options.getString("message", true);
        const selected    = interaction.options.getChannel("channel", true);
        const duration    = parseDuration(durationStr);

        if (!duration) {
          await interaction.editReply("❌ Use a duration from 1 second to 28 days, such as `10m`, `2h`, or `1d`.");
          return;
        }

        const channel = await interaction.guild!.channels.fetch(selected.id).catch(() => null);
        const me = interaction.guild!.members.me;

        if (
          !(channel instanceof TextChannel) ||
          !me ||
          !channel.permissionsFor(me).has([
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
          ])
        ) {
          await interaction.editReply("❌ Choose a text channel where I can view, send messages, and embed links.");
          return;
        }

        const executeAt = new Date(Date.now() + duration);
        const task = await createTask(guildId, channel.id, interaction.user.id, "scheduled", message, executeAt);
        scheduleTask(interaction.client, task);

        await interaction.editReply(
          `✅ Message scheduled for <#${channel.id}> <t:${Math.floor(executeAt.getTime() / 1000)}:R>.\n**ID:** \`${task.id}\``
        );
        return;
      }

      // ── repeat ────────────────────────────────────────────────────────────
      if (sub === "repeat") {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          await interaction.editReply("❌ Scheduling a recurring message requires **Manage Server**.");
          return;
        }

        const intervalStr = interaction.options.getString("interval", true);
        const message     = interaction.options.getString("message", true);
        const selected    = interaction.options.getChannel("channel", true);
        const interval    = parseDuration(intervalStr);

        if (!interval) {
          await interaction.editReply("❌ Use an interval from 1 second to 28 days, such as `10m`, `2h`, or `1d`.");
          return;
        }

        const channel = await interaction.guild!.channels.fetch(selected.id).catch(() => null);
        const me = interaction.guild!.members.me;

        if (
          !(channel instanceof TextChannel) ||
          !me ||
          !channel.permissionsFor(me).has([
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
          ])
        ) {
          await interaction.editReply("❌ Choose a text channel where I can view, send messages, and embed links.");
          return;
        }

        const executeAt = new Date(Date.now() + interval);
        const task = await createTask(guildId, channel.id, interaction.user.id, "scheduled", message, executeAt, interval);
        scheduleTask(interaction.client, task);

        await interaction.editReply(
          `✅ Recurring message scheduled for <#${channel.id}> starting <t:${Math.floor(executeAt.getTime() / 1000)}:R> (repeats every ${intervalStr}).\n**ID:** \`${task.id}\``
        );
        return;
      }

      // ── list ──────────────────────────────────────────────────────────────
      if (sub === "list") {
        const showAll = interaction.options.getBoolean("all") ?? false;

        if (showAll && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          await interaction.editReply("❌ Viewing all guild tasks requires **Manage Server**.");
          return;
        }

        const creatorFilter = showAll ? undefined : interaction.user.id;
        const tasks = await getTasksForGuild(guildId, creatorFilter);
        const activeIds = new Set(getActiveTaskIds());

        if (tasks.length === 0) {
          await interaction.editReply(showAll ? "There are no active tasks in this server." : "You have no active tasks or reminders.");
          return;
        }

        const taskLines = tasks.slice(0, 15).map(t => {
          const icon      = t.type === "reminder" ? "⏰" : "📅";
          const status    = activeIds.has(t.id!) ? "" : " *(queued — pending timer restore)*";
          const timestamp = `<t:${Math.floor(new Date(t.executeAt).getTime() / 1000)}:R>`;
          const preview   = t.payload.length > 60 ? t.payload.substring(0, 60) + "…" : t.payload;
          return `${icon} **\`${t.id}\`** — ${timestamp}${status}\n*${preview}*`;
        });

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(showAll ? `📋 All Active Tasks (${tasks.length})` : `📋 Your Active Tasks (${tasks.length})`)
          .setDescription(taskLines.join("\n\n"))
          .setFooter(tasks.length > 15 ? { text: `Showing 15 of ${tasks.length} tasks.` } : null)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // ── cancel ────────────────────────────────────────────────────────────
      if (sub === "cancel") {
        const id = interaction.options.getString("id", true).trim();

        const currentTasks = await getTasksForGuild(guildId);
        const task = currentTasks.find(t => t.id === id);

        if (!task) {
          await interaction.editReply(`❌ Task \`${id}\` not found. Use \`/automation list\` to see your active tasks.`);
          return;
        }

        const isOwner = task.creatorId === interaction.user.id;
        const hasManage = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;

        if (!isOwner && !hasManage) {
          await interaction.editReply("❌ You don't have permission to cancel someone else's task.");
          return;
        }

        cancelTask(id);
        const deleted = await deleteTask(guildId, id);

        if (!deleted) {
          logger.warn(`/automation cancel: DB delete returned false for task ${id} in guild ${guildId}`);
        }

        await interaction.editReply(`✅ Task \`${id}\` has been cancelled.`);
        return;
      }
    } catch (err) {
      logger.error(`Failed to handle /automation ${sub} for guild ${guildId}`, err);
      await interaction.editReply("❌ Something went wrong. Please try again.");
    }
  },
};
