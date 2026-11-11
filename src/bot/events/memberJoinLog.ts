/**
 * The "📥 Member Joined" log entry, with alt-account and returning-member hints.
 */
import type { Client, GuildMember } from "discord.js";
import { ModerationCaseModel, WarningModel } from "../../database/mongo";
import { getGuildConfig } from "../../services/configuration";
import { isLogCategoryOn, sendGuildLog } from "../../services/logging";
import { assessJoinRisk, joinLogColor } from "../../services/joinRisk";
import { NOT_REVOKED } from "../../services/warnings";
import { logger } from "../../utils/logger";

/** This user's earlier, non-revoked cases here by action, plus live warnings. Two indexed queries. */
async function priorRecord(guildId: string, userId: string): Promise<{ cases: Record<string, number>; warnings: number }> {
  const [groups, warnings] = await Promise.all([
    ModerationCaseModel.aggregate<{ _id: string; n: number }>([
      { $match: { guildId, userId, ...NOT_REVOKED } },
      { $group: { _id: "$action", n: { $sum: 1 } } },
    ]),
    WarningModel.countDocuments({ guildId, userId, ...NOT_REVOKED }),
  ]);
  const cases: Record<string, number> = {};
  for (const g of groups) cases[String(g._id)] = g.n;
  return { cases, warnings };
}

export async function logMemberJoin(client: Client, member: GuildMember): Promise<void> {
  const guildId = member.guild.id;
  // Skip the record lookup entirely when nobody would read the entry.
  const config = await getGuildConfig(guildId).catch(() => null);
  if (!config?.loggingEnabled || !config.loggingChannelId || !isLogCategoryOn(config.logCategories, "memberJoins")) return;

  const user = member.user;
  const prior = user.bot
    ? { cases: {}, warnings: 0 }
    : await priorRecord(guildId, user.id).catch((err) => {
        logger.debug(`Join log: prior record lookup failed in ${guildId}:`, err);
        return { cases: {}, warnings: 0 };
      });
  const risk = user.bot
    ? { level: "none" as const, hints: [] }
    : assessJoinRisk({
        accountCreatedAt: user.createdTimestamp,
        now: Date.now(),
        defaultAvatar: !user.avatar,
        username: user.username,
        priorCases: prior.cases,
        priorWarnings: prior.warnings,
      });

  const avatarUrl = user.displayAvatarURL?.();
  const created = Math.floor(user.createdTimestamp / 1000);
  await sendGuildLog(client, guildId, {
    title: user.bot ? "🤖 Bot Added" : "📥 Member Joined",
    color: joinLogColor(risk.level),
    description: `${user.tag ?? "Unknown User"} (<@${user.id}>) joined the server.`,
    thumbnail: avatarUrl ? { url: avatarUrl } : undefined,
    fields: [
      { name: "Account Created", value: `<t:${created}:D> (<t:${created}:R>)`, inline: true },
      { name: "Member Count", value: String(member.guild.memberCount), inline: true },
      { name: "User ID", value: user.id, inline: true },
      ...(risk.hints.length
        ? [{ name: risk.level === "high" ? "🚩 Worth a look" : "Heads-up", value: `${risk.hints.join("\n")}\n-# Hints only; nothing was done automatically. \`/infractions\` shows the full record.`.slice(0, 1024), inline: false }]
        : []),
    ],
  }, "memberJoins");
}
