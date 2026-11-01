/**
 * Channel locking shared by /lock (and reusable elsewhere): which channels may
 * be locked, applying or lifting the @everyone Send Messages overwrite, the
 * persisted auto-unlock, the lock notice, and the duration options.
 * Split out of commands/moderation/lock.ts to keep that file readable.
 */
import { ChannelType, EmbedBuilder, type Client, type Guild, type GuildBasedChannel } from "discord.js";
import { parseFriendlyDuration } from "../utils/duration";
import { logger } from "../utils/logger";
import { createTask, deleteTask, getTasksForChannel } from "./scheduler";
import { scheduleTask, cancelTask } from "./schedulerRunner";
import { encodeChannelUnlock } from "./timedActions";
import { isObfuscatedChannel } from "../utils/channels";

export type LockableChannel = Extract<GuildBasedChannel, { permissionOverwrites: unknown }>;

/**
 * A channel Aegis may lock. Obfuscated channels (Aegis lacks View Channel) are
 * never lockable: their overwrites are a placeholder, and editing them would
 * clobber the channel's real permissions.
 */
export function isLockable(ch: GuildBasedChannel | null | undefined): ch is LockableChannel {
  return Boolean(ch && !isObfuscatedChannel(ch) && !ch.isThread() && ch.type !== ChannelType.GuildCategory && "permissionOverwrites" in ch);
}

/** Channels inside a category that a lock applies to. */
export function categoryChildren(guild: Guild, categoryId: string): LockableChannel[] {
  return [...guild.channels.cache.values()]
    .filter((ch): ch is LockableChannel => ch.parentId === categoryId && isLockable(ch))
    .sort((a, b) => ("position" in a && "position" in b ? a.position - b.position : 0));
}

/**
 * Lock or unlock one channel, replace any pending auto-unlock, and (when
 * locking with a duration) persist a new one on the scheduler.
 * Returns the auto-unlock markup, "None", or a warning string.
 */
export async function applyLock(
  client: Client,
  guild: Guild,
  channel: LockableChannel,
  isLocking: boolean,
  durationMinutes: number,
  moderator: { id: string; tag: string },
): Promise<string> {
  await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: isLocking ? false : null });
  await clearPendingUnlocks(guild.id, channel.id);

  if (!isLocking || durationMinutes <= 0) return "None";
  const unlockAt = new Date(Date.now() + durationMinutes * 60_000);
  try {
    // Persisted so a restart or deploy can't leave the channel locked forever.
    const task = await createTask(
      guild.id,
      channel.id,
      moderator.id,
      "channel_unlock",
      encodeChannelUnlock({ moderatorTag: moderator.tag, durationMinutes }),
      unlockAt,
    );
    scheduleTask(client, task);
    return `<t:${Math.floor(unlockAt.getTime() / 1000)}:R>`;
  } catch (err) {
    logger.error(`Failed to schedule auto-unlock for channel ${channel.id} in guild ${guild.id}`, err);
    return "⚠️ Could not be scheduled — use /lock unlock";
  }
}

export async function postLockNotice(channel: LockableChannel, text: string, moderatorTag: string): Promise<void> {
  if (!("send" in channel) || typeof channel.send !== "function") return;
  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle("🔒 This channel has been locked")
        .setDescription(text)
        .setFooter({ text: `Locked by ${moderatorTag}` })
        .setTimestamp(),
    ],
  }).catch(() => null);
}

/** Cancel and remove every pending persisted auto-unlock for a channel. */
export async function clearPendingUnlocks(guildId: string, channelId: string): Promise<void> {
  const pending = await getTasksForChannel(guildId, channelId, "channel_unlock");
  for (const task of pending) {
    cancelTask(task.id!);
    await deleteTask(guildId, task.id!);
  }
}

/** Longest auto-unlock the friendly duration option accepts (the scheduler keeps it across restarts). */
export const MAX_LOCK_MINUTES = 7 * 24 * 60;

/**
 * The auto-unlock length in minutes from /lock's two options. duration_minutes
 * (0–1440) keeps working; duration takes "90m", "6h", "1d 12h" up to 7 days.
 * Giving both is refused so nobody is surprised by which one won.
 */
export function lockDurationMinutes(minutes: number | null, text: string | null): { minutes: number } | { error: string } {
  const raw = (text ?? "").trim();
  if (raw && minutes !== null && minutes !== 0) return { error: "Use either `duration` or `duration_minutes`, not both." };
  if (!raw) return { minutes: Math.max(0, minutes ?? 0) };
  if (raw === "0") return { minutes: 0 };
  const seconds = parseFriendlyDuration(raw);
  if (seconds === null) return { error: "I couldn't read that duration. Try `90m`, `6h` or `1d 12h`." };
  const m = Math.round(seconds / 60);
  if (m < 1) return { error: "The auto-unlock needs to be at least 1 minute." };
  if (m > MAX_LOCK_MINUTES) return { error: "Auto-unlock can be at most 7 days. Leave it blank to lock until someone runs `/lock unlock`." };
  return { minutes: m };
}
