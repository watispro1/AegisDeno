import { scheduledPayloadPreview } from "../../services/scheduledPayload";
import { moduleEnabled, moduleOffMessage } from "../../services/moduleSwitches";
import { logger } from "../../utils/logger";
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, MessageFlags, type AutocompleteInteraction } from "discord.js";
import { taskIdSuggestions } from "../../utils/idSuggestions";
import { Command } from "../../types/discord";
import { createTask, getTasksForGuild, deleteTask, AUTOMATION_TASK_TYPES } from "../../services/scheduler";
import { scheduleTask, cancelTask, getActiveTaskIds } from "../../services/schedulerRunner";
import { parseFriendlyDuration, formatDurationLong } from "../../utils/duration";
import { memberPermsIn, postRefusal } from "../../utils/channelAccess";
import { requestConfirmation } from "../../utils/confirmation";
import { replyPagedList } from "../../utils/listPager";
import { botChannelProblem, dashboardRow, POST_EMBED_PERMISSIONS, replyError } from "../config/kit/setupKit";

const MAX_DELAY_MS = 28 * 24 * 60 * 60 * 1000;
/** A repeating message more often than this would just be spam. */
export const MIN_REPEAT_MS = 60_000;

/**
 * "10m", "2h", "1d", and compound or spelled-out forms like "1h30m" or
 * "2 days", from 1 second up to 28 days. Returns milliseconds or null. Pure.
 */
export function parseDelay(input: string): number | null {
  const seconds = parseFriendlyDuration(input);
  if (seconds === null) return null;
  const ms = seconds * 1000;
  return Number.isSafeInteger(ms) && ms > 0 && ms <= MAX_DELAY_MS ? ms : null;
}

/** One line per task for /automation list. Pure. */
export function taskLine(
  t: { id?: string; type: string; executeAt: Date | string; intervalMs?: number | null; channelId?: string | null; creatorId?: string; payload: string },
  active: boolean,
  showCreator: boolean,
): string {
  const icon = t.type === "reminder" ? "⏰" : t.intervalMs ? "🔁" : "📅";
  const when = `<t:${Math.floor(new Date(t.executeAt).getTime() / 1000)}:R>`;
  const every = t.intervalMs ? ` · every ${formatDurationLong(Math.round(t.intervalMs / 1000))}` : "";
  const where = t.type !== "reminder" && t.channelId ? ` · <#${t.channelId}>` : "";
  const who = showCreator && t.creatorId ? ` · by <@${t.creatorId}>` : "";
  const text = scheduledPayloadPreview(t.payload).replace(/\s+/g, " ");
  const preview = text.length > 60 ? `${text.slice(0, 60)}…` : text;
  return `${icon} **\`${t.id}\`** — ${when}${every}${where}${who}${active ? "" : " *(queued — pending timer restore)*"}\n*${preview}*`;
}

const DURATION_HELP = "Use a duration from 1 second to 28 days, such as `10m`, `2h`, `1h30m` or `1d`.";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("automation")
    .setDescription("Reminders and scheduled or repeating channel messages.")
    .addSubcommand(sub =>
      sub
        .setName("remind")
        .setDescription("Get a reminder in this channel after a delay.")
        .addStringOption(opt => opt.setName("in").setDescription("When, e.g. 10m, 2h, 1h30m or 1d (up to 28 days)").setRequired(true).setMaxLength(64))
        .addStringOption(opt => opt.setName("message").setDescription("What to remind you about").setRequired(true).setMaxLength(1000))
    )
    .addSubcommand(sub =>
      sub
        .setName("message")
        .setDescription("Post a message in a channel later (Manage Server).")
        .addStringOption(opt => opt.setName("in").setDescription("Delay up to 28 days, e.g. 10m, 2h, 1h30m, 1d").setRequired(true).setMaxLength(64))
        .addChannelOption(opt => opt.setName("channel").setDescription("Text channel that will receive the message").addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addStringOption(opt => opt.setName("message").setDescription("Message to post").setRequired(true).setMaxLength(1000))
    )
    .addSubcommand(sub =>
      sub
        .setName("list")
        .setDescription("List active reminders and scheduled messages (only you see it).")
        .addBooleanOption(opt => opt.setName("all").setDescription("Show every task in the server, not just yours (Manage Server)").setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName("cancel")
        .setDescription("Cancel a reminder or scheduled message.")
        .addStringOption(opt => opt.setName("id").setDescription("Task ID; start typing to pick one of your tasks").setRequired(true).setAutocomplete(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("repeat")
        .setDescription("Post a message in a channel over and over (Manage Server).")
        .addStringOption(opt => opt.setName("interval").setDescription("How often, 1 minute to 28 days, e.g. 30m, 6h, 1d").setRequired(true).setMaxLength(64))
        .addChannelOption(opt => opt.setName("channel").setDescription("Text channel that will receive the message").addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addStringOption(opt => opt.setName("message").setDescription("Message to post").setRequired(true).setMaxLength(1000))
    ),

  guildOnly: true,

  /** Suggests tasks the member may cancel: their own, or all of the server's with Manage Server. */
  autocomplete: async (interaction: AutocompleteInteraction) => {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== "id" || !interaction.guildId) { await interaction.respond([]).catch(() => null); return; }
    const canManageServer = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
    const tasks = await getTasksForGuild(interaction.guildId, canManageServer ? undefined : interaction.user.id, AUTOMATION_TASK_TYPES).catch(() => []);
    const rows = tasks.map(t => ({ id: t.id!, type: t.type, creatorId: t.creatorId, channelId: t.channelId, executeAt: t.executeAt, intervalMs: t.intervalMs, preview: scheduledPayloadPreview(t.payload) }));
    await interaction.respond(taskIdSuggestions(rows, String(focused.value ?? ""), { userId: interaction.user.id, canManageServer })).catch(() => null);
  },

  botPermissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const canManage = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;

    try {
      if (sub === "remind") {
        const ms = parseDelay(interaction.options.getString("in", true));
        const message = interaction.options.getString("message", true).trim();
        if (!ms) return await replyError(interaction, `❌ ${DURATION_HELP}`);
        if (!message) return await replyError(interaction, "❌ The reminder text can't be empty.");
        await interaction.deferReply();
        const executeAt = new Date(Date.now() + ms);
        const task = await createTask(guildId, interaction.channelId, interaction.user.id, "reminder", message, executeAt);
        scheduleTask(interaction.client, task);
        await interaction.editReply(`✅ Reminder set for <t:${Math.floor(executeAt.getTime() / 1000)}:R>.\n**ID:** \`${task.id}\` · cancel with \`/automation cancel\``);
        return;
      }

      if (sub === "message" || sub === "repeat") {
        if (!canManage) {
          return await replyError(interaction, `❌ Scheduling ${sub === "repeat" ? "a recurring" : "a channel"} message requires **Manage Server**.`);
        }
        if (!(await moduleEnabled(guildId, "scheduled"))) return await replyError(interaction, moduleOffMessage("scheduled"));

        const raw = interaction.options.getString(sub === "repeat" ? "interval" : "in", true);
        const ms = parseDelay(raw);
        const message = interaction.options.getString("message", true).trim();
        const selected = interaction.options.getChannel("channel", true);
        if (!ms) return await replyError(interaction, `❌ ${DURATION_HELP}`);
        if (sub === "repeat" && ms < MIN_REPEAT_MS) return await replyError(interaction, "❌ Repeat at most once a minute; a shorter interval would flood the channel.");
        if (!message) return await replyError(interaction, "❌ The message can't be empty.");
        if (selected.type !== undefined && selected.type !== ChannelType.GuildText) {
          return await replyError(interaction, "❌ Pick a regular text channel; scheduled messages can't be posted in that kind of channel.");
        }
        // Aegis posts on the member's behalf, so they must be able to post there themselves.
        const refusal = postRefusal(await memberPermsIn(interaction, selected.id), selected.id);
        if (refusal) return await replyError(interaction, `❌ ${refusal}`);
        const problem = await botChannelProblem(interaction.guild!, selected as never, POST_EMBED_PERMISSIONS);
        if (problem) return await replyError(interaction, problem);

        await interaction.deferReply();
        const executeAt = new Date(Date.now() + ms);
        const task = await createTask(guildId, selected.id, interaction.user.id, "scheduled", message, executeAt, sub === "repeat" ? ms : undefined);
        scheduleTask(interaction.client, task);
        const when = `<t:${Math.floor(executeAt.getTime() / 1000)}:R>`;
        await interaction.editReply({
          content: sub === "repeat"
            ? `✅ Recurring message scheduled for <#${selected.id}> starting ${when} (repeats every ${formatDurationLong(Math.round(ms / 1000))}).\n**ID:** \`${task.id}\``
            : `✅ Message scheduled for <#${selected.id}> ${when}.\n**ID:** \`${task.id}\``,
          components: [dashboardRow(guildId, "automations", "Manage on dashboard")],
        });
        return;
      }

      if (sub === "list") {
        const showAll = interaction.options.getBoolean("all") ?? false;
        if (showAll && !canManage) return await replyError(interaction, "❌ Viewing all server tasks requires **Manage Server**.");
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const tasks = await getTasksForGuild(guildId, showAll ? undefined : interaction.user.id, AUTOMATION_TASK_TYPES);
        const activeIds = new Set(getActiveTaskIds());
        await replyPagedList(interaction, {
          title: showAll ? `📋 All Active Tasks (${tasks.length})` : `📋 Your Active Tasks (${tasks.length})`,
          lines: tasks.map(t => taskLine(t, activeIds.has(t.id!), showAll)),
          empty: showAll ? "There are no active tasks in this server." : "You have no active tasks or reminders. Set one with `/automation remind`.",
          perPage: 10,
          ephemeral: true,
          note: "Cancel one with /automation cancel",
        });
        return;
      }

      if (sub === "cancel") {
        const id = interaction.options.getString("id", true).trim();
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const task = (await getTasksForGuild(guildId, undefined, AUTOMATION_TASK_TYPES)).find(t => t.id === id);
        if (!task) {
          await interaction.editReply(`❌ Task \`${id.slice(0, 40)}\` not found. Use \`/automation list\` to see your active tasks.`);
          return;
        }
        const isOwner = task.creatorId === interaction.user.id;
        if (!isOwner && !canManage) {
          await interaction.editReply("❌ You don't have permission to cancel someone else's task.");
          return;
        }
        // A one-off reminder of your own is cancelled straight away; anything else is confirmed first.
        if (!isOwner || task.intervalMs) {
          const answer = await requestConfirmation(interaction, {
            content: `🗑️ Cancel this task?\n${taskLine(task, true, true)}`,
            confirmLabel: "Cancel task",
          });
          if (answer !== "confirmed") return;
        }
        cancelTask(id);
        const deleted = await deleteTask(guildId, id);
        if (!deleted) logger.warn(`/automation cancel: DB delete returned false for task ${id} in guild ${guildId}`);
        await interaction.editReply({ content: `✅ Task \`${id}\` has been cancelled.`, components: [] });
        return;
      }
    } catch (err) {
      logger.error(`Failed to handle /automation ${sub} for guild ${guildId}`, err);
      await replyError(interaction, "❌ Something went wrong. Nothing was scheduled or cancelled; try again in a moment.");
    }
  },
};
