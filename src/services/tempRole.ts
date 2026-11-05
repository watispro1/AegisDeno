/**
 * Temporary roles (`/temprole`): a persisted `temprole_remove` task takes the
 * role off when it runs out. The task's creatorId is the member who holds the
 * role and the payload names the role, so every pending removal for a member
 * can be found, replaced or cancelled.
 */
import type { Client } from "discord.js";
import { createTask, deleteTask, getTasksForGuild, type ScheduledTask } from "./scheduler";
import { cancelTask, scheduleTask } from "./schedulerRunner";
import { decideTempRoleExpiry, decodeTempRole, encodeTempRole, isUnknownMemberError, type TempRolePayload } from "./tempRoleLogic";
import { sendGuildLog } from "./logging";
import { logger } from "../utils/logger";
import { auditReason } from "../utils/safeText";
import { formatDurationLong } from "../utils/duration";

export interface PendingTempRole {
  taskId: string;
  userId: string;
  executeAt: Date;
  payload: TempRolePayload;
}

function toPending(task: ScheduledTask): PendingTempRole | null {
  const payload = decodeTempRole(task.payload);
  return payload ? { taskId: task.id!, userId: task.creatorId, executeAt: task.executeAt, payload } : null;
}

/** Pending temporary roles in a guild, soonest first; only one member's when userId is given. */
export async function listTempRoles(guildId: string, userId?: string): Promise<PendingTempRole[]> {
  const tasks = await getTasksForGuild(guildId, userId, ["temprole_remove"]);
  return tasks.map(toPending).filter((p): p is PendingTempRole => p !== null);
}

/** The latest pending removal of one role from one member, or null. */
export async function findTempRole(guildId: string, userId: string, roleId: string): Promise<PendingTempRole | null> {
  const matches = (await listTempRoles(guildId, userId)).filter(p => p.payload.roleId === roleId);
  return matches.length ? matches[matches.length - 1] : null;
}

/** Cancel every pending removal of one role from one member. Returns how many were cancelled. */
export async function clearTempRole(guildId: string, userId: string, roleId: string): Promise<number> {
  const matches = (await listTempRoles(guildId, userId)).filter(p => p.payload.roleId === roleId);
  let cleared = 0;
  for (const m of matches) {
    cancelTask(m.taskId);
    if (await deleteTask(guildId, m.taskId)) cleared++;
  }
  return cleared;
}

export async function scheduleTempRoleRemoval(
  client: Client,
  input: { guildId: string; channelId: string; userId: string; executeAt: Date; payload: TempRolePayload },
): Promise<void> {
  const task = await createTask(input.guildId, input.channelId, input.userId, "temprole_remove", encodeTempRole(input.payload), input.executeAt);
  scheduleTask(client, task);
}

/**
 * Take an expired temporary role off. Throws only when the guild is not
 * available or Discord refuses the edit, so the scheduler's retry path runs.
 */
export async function performTempRoleRemoval(client: Client, task: ScheduledTask): Promise<void> {
  const payload = decodeTempRole(task.payload);
  if (!payload) {
    logger.warn(`Task ${task.id}: unreadable temporary role payload; removing task.`);
    return;
  }
  const guild = client.guilds.cache.get(task.guildId);
  const role = guild ? guild.roles.cache.get(payload.roleId) ?? await guild.roles.fetch(payload.roleId).catch(() => null) : null;

  let member = null;
  if (guild && role) {
    try {
      member = await guild.members.fetch({ user: task.creatorId, force: true });
    } catch (err) {
      // Only "Unknown Member" means they left; anything else is retried.
      if (!isUnknownMemberError(err)) throw err;
    }
  }
  // A cold cache can leave members.me empty; fetch it so the hierarchy check isn't read as 0.
  const me = guild ? guild.members.me ?? await guild.members.fetchMe() : null;
  const botTop = me?.roles.highest.position ?? 0;

  const decision = decideTempRoleExpiry({
    guildAvailable: Boolean(guild),
    roleExists: Boolean(role),
    memberFound: member !== null,
    memberHasRole: Boolean(member?.roles.cache.has(payload.roleId)),
    roleBelowBot: role ? role.position < botTop : false,
  });

  if (decision === "retry") throw new Error(`Guild ${task.guildId} is not available for temporary role removal.`);
  if (decision === "skip-role-deleted" || decision === "skip-member-left" || decision === "skip-not-present") {
    logger.debug(`Task ${task.id}: temporary role ${payload.roleId} for ${task.creatorId} not removed (${decision}).`);
    return;
  }
  if (decision === "skip-unmanageable") {
    await sendGuildLog(client, task.guildId, {
      title: "⚠️ Temporary Role Not Removed",
      color: 0xFEE75C,
      description: `**User:** <@${task.creatorId}>\n**Role:** <@&${payload.roleId}>\nThe role is now at or above my highest role, so I couldn't take it off. Remove it by hand.`,
    }, "modActions").catch(err => logger.warn(`Task ${task.id}: temprole warning log failed`, err));
    return;
  }

  await member!.roles.remove(payload.roleId, auditReason(`Temporary role expired${payload.caseId ? ` (case ${payload.caseId})` : ""} | Given by ${payload.moderatorTag}`));
  await sendGuildLog(client, task.guildId, {
    title: "⏲️ Temporary Role Expired",
    color: 0x57F287,
    description: `**User:** ${member!.user.tag} (<@${task.creatorId}>)\n**Role:** <@&${payload.roleId}>\n**Length:** ${formatDurationLong(payload.durationSeconds)}\n**Given by:** ${payload.moderatorTag}${payload.caseId ? `\n**Case:** \`${payload.caseId}\`` : ""}`,
  }, "modActions").catch(err => logger.warn(`Task ${task.id}: temprole expiry log failed`, err));
}
