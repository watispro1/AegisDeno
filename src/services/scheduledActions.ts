/** What the scheduler does for reminders, channel unlocks and timed unbans (split from schedulerRunner.ts). */
import { decodeScheduledPayload } from "./scheduledPayload";
import { buildEmbedFromSpec } from "./embedSpec";
import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { ScheduledTask } from "./scheduler";
import {
  afterTaskFailure,
  decodeTimedUnban,
  isUnknownBanError,
  shouldLiftTimedBan,
  decodeChannelUnlock,
  decodePersonalReminder,
  nextTimerDelay,
  reminderSnoozeCustomId,
  SNOOZE_OPTIONS_MINUTES,
} from "./timedActions";
import { sendGuildLog } from "./logging";
import { isSendableChannel, isObfuscatedChannel } from "../utils/channels";
import { logger } from "../utils/logger";
import { auditReason } from "../utils/safeText";
import { formatDurationLong } from "../utils/duration";
import { addModerationCase } from "./moderationCases";

/**
 * Deliver a `/remindme` reminder: DM the user, and optionally ping them in the
 * channel the reminder was set from. Delivery failures are swallowed (as before
 * persistence was added) so a user with closed DMs is not retried and spammed.
 */
export async function deliverPersonalReminder(client: Client, task: ScheduledTask): Promise<void> {
  const payload = decodePersonalReminder(task.payload);
  if (!payload) {
    logger.warn(`Task ${task.id}: unreadable personal reminder payload — removing task.`);
    return;
  }

  try {
    const dmEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("⏰ Reminder!")
      .setDescription(`You asked me to remind you about:\n\n**${payload.text}**`)
      .addFields(
        { name: "📝 Reminder", value: payload.text.slice(0, 1024) },
        { name: "⏳ Set",  value: `<t:${Math.floor(payload.setAt / 1000)}:R>` },
        { name: "📌 From", value: payload.sourceName },
      )
      .setFooter({
        text: payload.repeat
          ? `Repeats ${payload.repeat} · ID ${task.id} · stop with /remindme cancel`
          : "Set with /remindme",
      })
      .setTimestamp();

    const snoozeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...SNOOZE_OPTIONS_MINUTES.map(min =>
        new ButtonBuilder()
          .setCustomId(reminderSnoozeCustomId(task.creatorId, min))
          .setLabel(min >= 60 ? `Snooze ${min / 60}h` : `Snooze ${min}m`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("💤"),
      ),
    );

    const user = await client.users.fetch(task.creatorId).catch(() => null);
    if (user) {
      await user.send({ embeds: [dmEmbed], components: [snoozeRow] }).catch(() => null);
    }

    if (payload.inChannel) {
      const channel = await client.channels.fetch(task.channelId).catch(() => null);
      if (isSendableChannel(channel)) {
        await channel.send({
          content: `<@${task.creatorId}> ⏰ **Reminder:** ${payload.text}`,
          allowedMentions: { users: [task.creatorId] },
        }).catch(() => null);
      }
    }
  } catch (err) {
    logger.warn(`Reminder delivery failed for user ${task.creatorId}`, err);
  }
}

/**
 * Lift a timed `/lock channel` lock. Throws if the permission edit fails so the
 * normal retry path runs; a missing channel just drops the task.
 */
export async function performChannelUnlock(client: Client, task: ScheduledTask): Promise<void> {
  const { moderatorTag, durationMinutes } = decodeChannelUnlock(task.payload);
  const channel = await client.channels.fetch(task.channelId).catch(() => null);

  if (!channel || channel.isDMBased() || channel.isThread() || !("permissionOverwrites" in channel)) {
    logger.warn(`Task ${task.id}: unlock target ${task.channelId} is gone or not lockable — removing task.`);
    return;
  }
  if (channel.guild.id !== task.guildId) {
    logger.error(`Task ${task.id}: unlock target ${task.channelId} is not in guild ${task.guildId} — removing task.`);
    return;
  }
  if (isObfuscatedChannel(channel)) {
    // Its overwrites are a placeholder; editing them would clobber the real ones.
    // Throw so the normal retry path runs in case View Channel is given back.
    throw new Error(`Unlock target ${task.channelId} is hidden from Aegis (no View Channel); not editing its permissions.`);
  }

  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SendMessages: null });

  await sendGuildLog(client, task.guildId, {
    title: "🔓 Auto-Unlock",
    color: 0x57F287,
    description: `**Channel:** <#${channel.id}> was automatically unlocked after ${durationMinutes} minute(s).\n**Original Moderator:** ${moderatorTag}`,
  }).catch(err => logger.warn(`Task ${task.id}: auto-unlock log failed`, err));

  if (isSendableChannel(channel)) {
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle("🔓 Channel Unlocked")
          .setDescription(`This channel has been automatically unlocked after a ${durationMinutes}-minute lockdown.`)
          .setTimestamp(),
      ],
    }).catch(() => null);
  }
}

/**
 * Lift a `/ban duration:` ban. The task's creatorId is the banned user. A ban
 * that is already gone (unbanned by hand) just drops the task; a failure to
 * unban throws so the normal retry path runs.
 */
export async function performTimedUnban(client: Client, task: ScheduledTask): Promise<void> {
  const payload = decodeTimedUnban(task.payload);
  const guild = client.guilds.cache.get(task.guildId);
  if (!guild) {
    // Not cached yet (outage, boot) or the bot was removed: retry rather than
    // drop it, so a temporary ban never silently becomes permanent.
    throw new Error(`Guild ${task.guildId} is not available for timed unban.`);
  }
  const userId = task.creatorId;
  // Only Discord's "Unknown Ban" means the ban is already gone. Any other
  // lookup error (outage, rate limit) throws, so the retry path runs instead
  // of the task being dropped and the ban becoming permanent.
  let ban;
  try {
    ban = await guild.bans.fetch({ user: userId, force: true });
  } catch (err) {
    if (isUnknownBanError(err)) return;
    throw err;
  }
  if (!shouldLiftTimedBan(ban.reason, payload.banRef)) {
    // The member was unbanned and banned again outside Aegis: that newer ban is not ours to lift.
    logger.info(`Task ${task.id}: ban on ${userId} in ${guild.id} is not the temporary ban this task was for; leaving it.`);
    return;
  }
  const reason = `Temporary ban expired${payload.caseId ? ` (case ${payload.caseId})` : ""}`;
  await guild.members.unban(userId, auditReason(`${reason} | Banned by ${payload.moderatorTag}`));
  await addModerationCase({
    guildId: guild.id,
    userId,
    moderatorId: client.user?.id ?? payload.moderatorId,
    action: "unban",
    reason,
    details: `Automatic unban after ${formatDurationLong(payload.durationSeconds)}`,
  }).catch(() => null);
  await sendGuildLog(client, guild.id, {
    title: "⏲️ Temporary Ban Expired",
    color: 0x57F287,
    description: `**User:** ${ban.user.tag} (<@${userId}>)\n**Ban length:** ${formatDurationLong(payload.durationSeconds)}\n**Originally banned by:** ${payload.moderatorTag}${payload.caseId ? `\n**Case:** \`${payload.caseId}\`` : ""}`,
  }).catch(err => logger.warn(`Task ${task.id}: timed-unban log failed`, err));
}

