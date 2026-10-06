import { Client, GuildMember } from "discord.js";
import { getGuildConfig } from "./configuration";
import { getTotalWarningCount } from "./warnings";
import { createModerationCase } from "./moderationCases";
import { sendGuildLog } from "./logging";
import { logger } from "../utils/logger";

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

    const totalWarnings = await getTotalWarningCount(guildId, userId);

    // Find the highest threshold that exactly matches the current warning count
    const threshold = config.escalation.thresholds
      .filter(t => t.atWarnings === totalWarnings)
      .sort((a, b) => b.atWarnings - a.atWarnings)[0];

    if (!threshold) return { triggered: false };

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return { triggered: false };

    let member: GuildMember | null = null;
    try {
      member = await guild.members.fetch(userId);
    } catch {
      // User may have left the guild
    }

    const reason = `Automated escalation: reached ${totalWarnings} warning(s).`;

    if (threshold.action === "timeout" && member) {
      const durationMs = (threshold.durationMinutes ?? 60) * 60 * 1000;
      await member.timeout(durationMs, reason);
      await createModerationCase({ guildId, userId, moderatorId, action: "timeout", reason, details: `Auto-escalation at ${totalWarnings} warnings. Duration: ${threshold.durationMinutes ?? 60}m` });
      await sendGuildLog(client, guildId, {
        title: "⚡ Auto-Escalation: Timeout",
        color: 0xFFA500,
        description: `**User:** <@${userId}>\n**Reason:** ${reason}\n**Duration:** ${threshold.durationMinutes ?? 60} minutes\n**Triggered at:** ${totalWarnings} warnings`,
      });
    } else if (threshold.action === "kick" && member) {
      await member.kick(reason);
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
