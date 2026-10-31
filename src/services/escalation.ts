import { auditReason } from "../utils/safeText";
import { Client, GuildMember } from "discord.js";
import { getGuildConfig, type GuildConfig } from "./configuration";
import { getTotalWarningCount } from "./warnings";
import { createModerationCase } from "./moderationCases";
import { sendGuildLog } from "./logging";
import { logger } from "../utils/logger";

type EscalationThreshold = GuildConfig["escalation"]["thresholds"][number];

/**
 * Pick the threshold that fires at exactly `totalWarnings` warnings, if any.
 * Thresholds only trigger on an exact match, so a user who jumps past a
 * threshold (e.g. bulk warnings) does not re-trigger lower ones.
 */
export function findEscalationThreshold(
  thresholds: readonly EscalationThreshold[],
  totalWarnings: number,
): EscalationThreshold | undefined {
  return thresholds
    .filter(t => t.atWarnings === totalWarnings)
    .sort((a, b) => b.atWarnings - a.atWarnings)[0];
}

/**
 * Earliest creation time a warning may have and still count toward
 * escalation, or null when warnings never expire.
 */
export function warningExpiryCutoff(warnExpiryDays: number | null | undefined, nowMs: number = Date.now()): Date | null {
  if (!warnExpiryDays || warnExpiryDays < 1) return null;
  return new Date(nowMs - warnExpiryDays * 86_400_000);
}

/**
 * After a warning is issued, check if any escalation thresholds are hit and
 * automatically apply the configured action (timeout / kick / ban).
 */
export async function checkEscalation(
  client: Client,
  guildId: string,
  userId: string,
  moderatorId: string,
): Promise<{ triggered: boolean; action?: string; atWarnings?: number }> {
  try {
    const config = await getGuildConfig(guildId);
    if (!config.escalation.enabled || config.escalation.thresholds.length === 0) {
      return { triggered: false };
    }

    // Only active warnings count: revoked ones never do, expired ones not once an expiry is set.
    const totalWarnings = await getTotalWarningCount(
      guildId,
      userId,
      warningExpiryCutoff(config.escalation.warnExpiryDays),
    );

    const threshold = findEscalationThreshold(config.escalation.thresholds, totalWarnings);

    if (!threshold) return { triggered: false };

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return { triggered: false };

    let member: GuildMember | null = null;
    try {
      member = await guild.members.fetch(userId);
    } catch {
      // User may have left the guild
    }

    const expiryNote = config.escalation.warnExpiryDays ? ` in the last ${config.escalation.warnExpiryDays} day(s)` : "";
    const reason = `Automated escalation: reached ${totalWarnings} active warning(s)${expiryNote}.`;

    if (threshold.action === "timeout" && member) {
      const durationMs = (threshold.durationMinutes ?? 60) * 60 * 1000;
      await member.timeout(durationMs, auditReason(reason));
      await createModerationCase({ guildId, userId, moderatorId, action: "timeout", reason, details: `Auto-escalation at ${totalWarnings} warnings. Duration: ${threshold.durationMinutes ?? 60}m` });
      await sendGuildLog(client, guildId, {
        title: "⚡ Auto-Escalation: Timeout",
        color: 0xFFA500,
        description: `**User:** <@${userId}>\n**Reason:** ${reason}\n**Duration:** ${threshold.durationMinutes ?? 60} minutes\n**Triggered at:** ${totalWarnings} warnings`,
      });
    } else if (threshold.action === "kick" && member) {
      await member.kick(auditReason(reason));
      await createModerationCase({ guildId, userId, moderatorId, action: "kick", reason, details: `Auto-escalation at ${totalWarnings} warnings` });
      await sendGuildLog(client, guildId, {
        title: "⚡ Auto-Escalation: Kick",
        color: 0xFF6B00,
        description: `**User:** <@${userId}>\n**Reason:** ${reason}\n**Triggered at:** ${totalWarnings} warnings`,
      });
    } else if (threshold.action === "ban") {
      await guild.bans.create(userId, { reason });
      await createModerationCase({ guildId, userId, moderatorId, action: "ban", reason, details: `Auto-escalation at ${totalWarnings} warnings` });
      await sendGuildLog(client, guildId, {
        title: "⚡ Auto-Escalation: Ban",
        color: 0xFF0000,
        description: `**User:** <@${userId}>\n**Reason:** ${reason}\n**Triggered at:** ${totalWarnings} warnings`,
      });
    }

    logger.info(`Escalation triggered for user ${userId} in guild ${guildId}: ${threshold.action} at ${totalWarnings} warnings`);
    return { triggered: true, action: threshold.action, atWarnings: totalWarnings };
  } catch (err) {
    logger.error(`Escalation check failed for user ${userId} in guild ${guildId}:`, err);
    return { triggered: false };
  }
}
