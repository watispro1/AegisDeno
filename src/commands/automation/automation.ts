import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, TextChannel } from "discord.js";
import { Command } from "../../types/discord";
import { createTask, getTasksForGuild, deleteTask } from "../../services/scheduler";
import { scheduleTask, cancelTask } from "../../services/schedulerRunner";

const MAX_REMINDER_MS = 28 * 24 * 60 * 60 * 1000;

const parseDuration = (input: string): number | null => {
  const match = input.trim().toLowerCase().match(/^(\d+)([smhd])$/);
  if (!match) return null;
  const val = parseInt(match[1]);
  const unit = match[2];
  const multiplier = unit === "s" ? 1000 : unit === "m" ? 60 * 1000 : unit === "h" ? 3600 * 1000 : 86400 * 1000;
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
        .setDescription("List your active reminders and tasks.")
    )
    .addSubcommand(sub =>
      sub
        .setName("cancel")
        .setDescription("Cancel an active task.")
        .addStringOption(opt =>
          opt.setName("id").setDescription("Task ID to cancel").setRequired(true)
        )
    ),

  guildOnly: true,
  botPermissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === "remind") {
      const durationStr = interaction.options.getString("in", true);
      const message     = interaction.options.getString("message", true);

      const ms = parseDuration(durationStr);
      if (!ms) {
        return interaction.reply({ content: "❌ Use a duration from 1 second to 28 days, such as `10m`, `2h`, or `1d`.", ephemeral: true });
      }

      const executeAt = new Date(Date.now() + ms);
      const task = await createTask(guildId, interaction.channelId, interaction.user.id, "reminder", message, executeAt);

      scheduleTask(interaction.client, task);

      return interaction.reply(`✅ Reminder set for <t:${Math.floor(executeAt.getTime() / 1000)}:R>.\n**ID:** \`${task.id}\``);
    }

    if (sub === "message") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: "❌ Scheduling a channel message requires Manage Server.", ephemeral: true });
      }

      const durationStr = interaction.options.getString("in", true);
      const message = interaction.options.getString("message", true);
      const selected = interaction.options.getChannel("channel", true);
      const duration = parseDuration(durationStr);
      if (!duration) {
        return interaction.reply({ content: "❌ Use a duration from 1 second to 28 days, such as \`10m\`, \`2h\`, or \`1d\`.", ephemeral: true });
      }

      const channel = await interaction.guild!.channels.fetch(selected.id).catch(() => null);
      const me = interaction.guild!.members.me;
      if (!(channel instanceof TextChannel) || !me || !channel.permissionsFor(me).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
        return interaction.reply({ content: "❌ Choose a text channel where I can view, send messages, and embed links.", ephemeral: true });
      }

      const executeAt = new Date(Date.now() + duration);
      const task = await createTask(guildId, channel.id, interaction.user.id, "scheduled", message, executeAt);
      scheduleTask(interaction.client, task);
      return interaction.reply(`✅ Message scheduled for <#${channel.id}> <t:${Math.floor(executeAt.getTime() / 1000)}:R>.\n**ID:** \`${task.id}\``);
    }

    if (sub === "list") {
      const tasks = await getTasksForGuild(guildId, interaction.user.id);
      if (tasks.length === 0) {
        return interaction.reply({ content: "You have no active tasks or reminders.", ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("Your Active Tasks")
        .setDescription(
          tasks.map(t => `**\`${t.id}\`** — <t:${Math.floor(new Date(t.executeAt).getTime() / 1000)}:R>\n*${t.payload}*`).join("\n\n")
        );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === "cancel") {
      const id = interaction.options.getString("id", true);
      const currentTasks = await getTasksForGuild(guildId);
      const task = currentTasks.find((t) => t.id === id);

      if (!task) {
        return interaction.reply({ content: "❌ Task not found.", ephemeral: true });
      }
      if (task.creatorId !== interaction.user.id && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: "❌ You don't have permission to cancel someone else's task.", ephemeral: true });
      }

      cancelTask(id);
      await deleteTask(guildId, id);

      return interaction.reply(`✅ Task \`${id}\` has been cancelled.`);
    }
  },
};
