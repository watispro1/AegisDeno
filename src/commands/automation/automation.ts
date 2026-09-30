import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { Command } from "../../types/discord";
import { createTask, getTasksForGuild, deleteTask, TaskType } from "../../services/scheduler";

const parseDuration = (input: string): number | null => {
  const match = input.match(/^(\d+)([smhd])$/);
  if (!match) return null;
  const val = parseInt(match[1]);
  const unit = match[2];
  if (unit === "s") return val * 1000;
  if (unit === "m") return val * 60 * 1000;
  if (unit === "h") return val * 3600 * 1000;
  if (unit === "d") return val * 86400 * 1000;
  return null;
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
          opt.setName("message").setDescription("What to remind you about").setRequired(true)
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

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === "remind") {
      const durationStr = interaction.options.getString("in", true);
      const message     = interaction.options.getString("message", true);

      const ms = parseDuration(durationStr);
      if (!ms) {
        return interaction.reply({ content: "❌ Invalid duration format. Use 10m, 2h, 1d, etc.", ephemeral: true });
      }

      const executeAt = new Date(Date.now() + ms);
      const task = await createTask(guildId, interaction.channelId, interaction.user.id, "reminder", message, executeAt);

      // We need to re-init the scheduler locally if we want it to pick it up immediately, 
      // but since we exported `scheduleTask`, we should call it. 
      // However, it's easier to just let `createTask` export a way or we can call `scheduleTask` from here:
      const { scheduleTask } = require("../../services/schedulerRunner");
      scheduleTask(interaction.client, task);

      return interaction.reply(`✅ Reminder set for <t:${Math.floor(executeAt.getTime() / 1000)}:R>.\n**ID:** \`${task.id}\``);
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

      const { cancelTask } = require("../../services/schedulerRunner");
      cancelTask(id);
      await deleteTask(guildId, id);

      return interaction.reply(`✅ Task \`${id}\` has been cancelled.`);
    }
  },
};
