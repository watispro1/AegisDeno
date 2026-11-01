/**
 * Lifting a ban, shared by `/unban` (after its confirmation step) and the web
 * dashboard's "revoke and unban". Unbans in Discord, records an `unban` case
 * and posts it to the guild's log channel.
 */
import type { Guild } from "discord.js";
import { logger } from "../utils/logger";
import { sendGuildLog } from "./logging";
import { addModerationCase } from "./moderationCases";
import { clearTimedUnbans } from "./tempBan";
import { auditReason } from "../utils/safeText";

export type UnbanResult =
  | { ok: true; caseId: string | null; banReason: string; userTag: string }
  | { ok: false; reason: "not_banned" | "failed" };

export async function unbanMember(
  guild: Guild,
  userId: string,
  moderator: { id: string; tag: string },
  reason: string,
  opts: { via?: string } = {},
): Promise<UnbanResult> {
  const ban = await guild.bans.fetch(userId).catch(() => null);
  if (!ban) return { ok: false, reason: "not_banned" };
  const banReason = ban.reason ?? "No reason recorded.";
  try {
    await guild.members.unban(userId, auditReason(`${reason} | Unbanned by ${moderator.tag}`));
  } catch (err) {
    logger.error(`Failed to unban user ${userId} in guild ${guild.id}`, err);
    return { ok: false, reason: "failed" };
  }

  // A pending automatic unban from a temporary ban is now moot.
  await clearTimedUnbans(guild.id, userId).catch(err => logger.warn(`Could not clear timed unban for ${userId} in ${guild.id}`, err));

  const caseId = await addModerationCase({
    guildId: guild.id,
    userId,
    moderatorId: moderator.id,
    action: "unban",
    reason,
    details: `Original ban reason: ${banReason.slice(0, 200)}`,
  });

  await sendGuildLog(guild.client, guild.id, {
    title: "🔓 User Unbanned",
    color: 0x57F287,
    description:
      `**User:** ${ban.user.tag} (<@${userId}>)\n**Ban Reason:** ${banReason.slice(0, 300)}\n**Unban Reason:** ${reason}\n` +
      `**Moderator:** ${moderator.tag}${opts.via ? ` ${opts.via}` : ""}`,
  }).catch(() => null);

  return { ok: true, caseId, banReason, userTag: ban.user.tag };
}
