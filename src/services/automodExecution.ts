import { getMemberTrust, getTrustConfig, subjectFromMember } from "./trustService";
import { linkFilterApplies, type TrustConfig } from "./trustEngine";
import { noteIncidentDeletes } from "./incidentHooks";
import { markMessageDeletedByBot } from "./deletedMessages";
import { Client, Message, GuildMember, PermissionFlagsBits } from "discord.js";
import { codeBlock } from "../utils/safeText";
import { getAutomodConfig, type AutomodRule } from "./automod";
import { blockedInvite, blockedLinkHost, blockedWordHit, capsOrFlood, DuplicateTracker, emojiOrZalgo } from "./automodChecks";
import { addWarning } from "./warnings";
import { checkEscalation } from "./escalation";
import { addModerationCase } from "./moderationCases";
import { sendGuildLog } from "./logging";
import { logger } from "../utils/logger";
import { AutomodHitModel } from "../database/mongo";
import { PenaltyCooldown, SlidingWindowCounter, AUTOMOD_PENALTY_COOLDOWN_MS, type PenaltyDecision } from "./automodRate";


// In-memory message-rate counter (`guildId:userId`) and per-member penalty cooldown.
const spamCounter = new SlidingWindowCounter();
const penaltyCooldown = new PenaltyCooldown();

function recordAndCheckSpam(guildId: string, userId: string, maxMessages: number, windowMs: number): boolean {
  return spamCounter.record(`${guildId}:${userId}`, windowMs) > maxMessages;
}

const duplicateTracker = new DuplicateTracker();

// Exemption check
/**
 * Safe-listed channels and roles are exempt, and so is server staff with
 * Administrator or Manage Server (the same members Discord's own AutoMod
 * exempts), so automod never deletes or times out the people who configure it.
 */
export function isExempt(
  member: Pick<GuildMember, "permissions" | "roles"> | null,
  channelId: string,
  exemptRoleIds: string[],
  exemptChannelIds: string[]
): boolean {
  if (exemptChannelIds.includes(channelId)) return true;
  if (!member) return false;
  if (member.permissions?.has?.(PermissionFlagsBits.Administrator) || member.permissions?.has?.(PermissionFlagsBits.ManageGuild)) return true;
  if (member.roles.cache.some(role => exemptRoleIds.includes(role.id))) return true;
  return false;
}

/**
 * Per-rule exemptions: whether this one rule skips the member (by role) or the
 * channel. A thread counts as its parent channel too, the same as the
 * channel picker shows it.
 */
export function ruleExempt(
  rule: { exemptRoleIds?: string[]; exemptChannelIds?: string[] },
  member: Pick<GuildMember, "roles"> | null,
  channelIds: readonly string[],
): boolean {
  if (rule.exemptChannelIds?.length && channelIds.some(id => rule.exemptChannelIds!.includes(id))) return true;
  if (member && rule.exemptRoleIds?.length && member.roles.cache.some(role => rule.exemptRoleIds!.includes(role.id))) return true;
  return false;
}

/**
 * How many pings a message carries for the mention-spam rule: distinct users,
 * distinct roles, and @everyone/@here (counted once).
 */
/**
 * Opt-in Trust Score integration: when the server limits link filtering to
 * low-trust members, trusted members' links pass. Any lookup failure filters.
 */
async function linkFilterAppliesTo(message: Message): Promise<boolean> {
  if (!message.guild || !message.member) return true;
  try {
    const trust = await getTrustConfig(message.guild.id);
    if (!trust.enabled || !trust.linkFilterLowTrustOnly) return true;
    const result = await getMemberTrust(subjectFromMember(message.member), { preset: trust.preset });
    return linkFilterApplies(trust, result.score);
  } catch {
    return linkFilterApplies({ enabled: true, linkFilterLowTrustOnly: true } as TrustConfig, null);
  }
}

export function mentionCount(mentions: { users: { size: number }; roles: { size: number }; everyone: boolean }): number {
  return mentions.users.size + mentions.roles.size + (mentions.everyone ? 1 : 0);
}

/** Returns true when automod acted on the message (it is deleted or being deleted). */
async function handleAutomod(client: Client, message: Message, isEdit: boolean): Promise<boolean> {
  if (!message.guildId || message.author.bot) return false;

  let config;
  try {
    config = await getAutomodConfig(message.guildId);
  } catch (err) {
    logger.error(`Automod: failed to load config for guild ${message.guildId}`, err);
    return false;
  }

  const member = message.member ?? await message.guild?.members.fetch(message.author.id).catch(() => null) ?? null;

  // Skip if the user or channel is on the safe-list
  if (isExempt(member, message.channelId, config.exemptRoleIds, config.exemptChannelIds)) return false;

  let triggeredRule: { action: string } | null = null;
  let ruleName = "";
  const where = [message.channelId, message.channel && "parentId" in message.channel ? message.channel.parentId : null].filter((id): id is string => Boolean(id));
  const applies = (rule: AutomodRule) => !ruleExempt(rule, member, where);

  // Spam. Edits don't count, or fixing a typo a few times trips the rule.
  if (config.spam.enabled && !isEdit && applies(config.spam)) {
    const windowMs = config.spam.windowSeconds * 1000;
    if (recordAndCheckSpam(message.guildId, message.author.id, config.spam.maxMessages, windowMs)) {
      triggeredRule = config.spam;
      ruleName = "Spam Detection";
    }
  }

  // Repeated identical messages. Edits are skipped for the same reason as spam.
  if (!triggeredRule && config.duplicates.enabled && !isEdit && applies(config.duplicates)) {
    const windowMs = config.duplicates.windowSeconds * 1000;
    if (duplicateTracker.record(`${message.guildId}:${message.author.id}`, message.content, windowMs) > config.duplicates.maxRepeats) {
      triggeredRule = config.duplicates;
      ruleName = "Duplicate Messages";
    }
  }

  // Blocked words (zero-width characters and soft hyphens are stripped first)
  if (!triggeredRule && config.words.enabled && config.words.list.length > 0 && applies(config.words)) {
    if (blockedWordHit(config.words.list, message.content)) {
      triggeredRule = config.words;
      ruleName = "Blocked Words";
    }
  }

  // Mention spam
  if (!triggeredRule && config.mentions.enabled && applies(config.mentions)) {
    if (mentionCount(message.mentions) >= config.mentions.threshold) {
      triggeredRule = config.mentions;
      ruleName = "Mention Spam";
    }
  }

  // Discord invites to other servers (the server's own vanity invite and allow-listed codes pass)
  if (!triggeredRule && config.invites.enabled && applies(config.invites)) {
    if (blockedInvite(message.content, config.invites.allowedCodes, message.guild?.vanityURLCode ?? null)) {
      triggeredRule = config.invites;
      ruleName = "Invite Links";
    }
  }

  // Links (allow-listed domains and their subdomains pass)
  if (!triggeredRule && config.links.enabled && applies(config.links)) {
    if (blockedLinkHost(message.content, config.links.allowedDomains) && await linkFilterAppliesTo(message)) {
      triggeredRule = config.links;
      ruleName = "Link Filtering";
    }
  }

  // Caps and character floods
  if (!triggeredRule && config.caps?.enabled && applies(config.caps)) {
    const hit = capsOrFlood(message.content, config.caps.threshold);
    if (hit) {
      triggeredRule = config.caps;
      ruleName = hit;
    }
  }

  // Emoji walls and zalgo text
  if (!triggeredRule && config.emoji.enabled && applies(config.emoji)) {
    const hit = emojiOrZalgo(message.content, config.emoji);
    if (hit) {
      triggeredRule = config.emoji;
      ruleName = hit;
    }
  }

  if (!triggeredRule) return false;

  // Map the human-readable rule name to a short schema key for analytics
  const ruleKeyMap: Record<string, string> = {
    "Spam Detection":  "spam",
    "Blocked Words":   "words",
    "Mention Spam":    "mentions",
    "Link Filtering":  "links",
    "Excessive Caps":  "caps",
    "Character Flood": "caps",
    "Duplicate Messages": "duplicates",
    "Invite Links":    "invites",
    "Emoji Spam":      "emoji",
    "Zalgo Text":      "emoji",
  };
  const ruleKey = ruleKeyMap[ruleName] ?? ruleName.toLowerCase();

  // One burst gets one penalty and one log entry; repeats inside the cooldown are only deleted.
  // Keyed by action too, so a delete-only hit never stops a later timeout rule from acting.
  const decision = penaltyCooldown.decide(`${message.guildId}:${message.author.id}:${triggeredRule.action}`);
  await enforceAutomod(client, message, member, triggeredRule.action, ruleName, config.timeoutMinutes, decision);

  // Log the hit for /modreport analytics (fire-and-forget)
  AutomodHitModel.create({
    guildId:     message.guildId,
    userId:      message.author.id,
    channelId:   message.channelId,
    rule:        ruleKey,
    action:      triggeredRule.action,
    content:     message.content.slice(0, 200) || null,
    triggeredAt: new Date(),
  }).catch(err => logger.warn("Failed to log automod hit:", err));
  return triggeredRule.action === "delete" || triggeredRule.action === "warn" || triggeredRule.action === "timeout";
}

async function enforceAutomod(
  client: Client,
  message: Message,
  member: GuildMember | null,
  action: string,
  ruleName: string,
  timeoutMinutes: number,
  decision: PenaltyDecision = { punish: true, log: true, suppressed: 0 },
): Promise<void> {
  if (!message.guildId) return;

  const logLine = `Automod [${ruleName}] triggered on msg ${message.id} by ${message.author.id} in guild ${message.guildId}, action: ${action}`;
  if (decision.log) logger.info(logLine);
  else logger.debug(`${logLine} (within penalty cooldown: delete only)`);

  // Delete the message for all enforcement actions
  if (action === "delete" || action === "warn" || action === "timeout") {
    markMessageDeletedByBot(message.id);
    const deleted = await message.delete().then(() => true).catch(err => {
      logger.warn(`Automod: failed to delete message ${message.id} in guild ${message.guildId}`, err);
      return false;
    });
    if (deleted) noteIncidentDeletes(message.guildId, 1, `automod (${ruleName})`, message.author.id);
  }

  const botId = client.user?.id ?? "Aegis";
  const reason = `Automod violation: ${ruleName}`;
  let outcome = "";
  if (!decision.punish) {
    // Already warned or timed out for this burst a moment ago; the delete above is enough.
  } else if (action === "warn") {
    try {
      await addWarning(message.guildId, message.author.id, botId, reason);
      // Automod warnings count toward the escalation thresholds the same as /warn.
      const esc = await checkEscalation(client, message.guildId, message.author.id, botId);
      if (esc.triggered) outcome = `Escalation: ${esc.action} at ${esc.atWarnings} warnings`;
    } catch (err) {
      logger.error(`Automod: failed to add warning for user ${message.author.id} in guild ${message.guildId}`, err);
    }
  } else if (action === "timeout") {
    if (member?.isCommunicationDisabled?.()) {
      outcome = "Already timed out";
    } else if (member?.moderatable) {
      const ok = await member.timeout(timeoutMinutes * 60_000, reason).then(() => true).catch(err => {
        logger.error(`Automod: failed to timeout user ${message.author.id} in guild ${message.guildId}`, err);
        return false;
      });
      if (ok) {
        await addModerationCase({ guildId: message.guildId, userId: message.author.id, moderatorId: botId, action: "timeout", reason, details: `Automod, ${timeoutMinutes} minute(s)` });
        outcome = `Timed out for ${timeoutMinutes} minute(s)`;
      } else {
        outcome = "Timeout failed (check my Moderate Members permission and role position)";
      }
    } else {
      logger.warn(`Automod: cannot timeout user ${message.author.id} in guild ${message.guildId}: not moderatable or member unavailable.`);
      outcome = "Could not time out this member (role above mine or member unavailable)";
    }
  }

  if (!decision.log) return;
  const cooldownSeconds = Math.round(AUTOMOD_PENALTY_COOLDOWN_MS / 1000);
  const followUpNote = action === "warn" || action === "timeout"
    ? `Further hits by this member in the next ${cooldownSeconds}s are deleted without another ${action}.`
    : `Further hits by this member in the next ${cooldownSeconds}s are deleted without a log entry.`;
  try {
    await sendGuildLog(client, message.guildId, {
      title: "🛡️ Automod Triggered",
      color: 0xE74C3C,
      description: [
        `**User:** ${message.author.tag} (<@${message.author.id}>)`,
        `**Rule:** ${ruleName}`,
        `**Action:** \`${action}\``,
        `**Channel:** <#${message.channelId}>`,
        `\n**Content:**\n${codeBlock(message.content || "[no text]", 420)}`,
      ].join("\n"),
      fields: [
        { name: "User ID", value: message.author.id, inline: true },
        ...(outcome ? [{ name: "Result", value: outcome, inline: true }] : []),
        ...(decision.suppressed > 0 ? [{ name: "Folded in", value: `${decision.suppressed} earlier hit(s) during the last cooldown were deleted without a log entry`, inline: false }] : []),
      ],
      footer: { text: followUpNote },
    }, "modActions");
  } catch (err) {
    logger.error(`Automod: failed to send guild log for guild ${message.guildId}`, err);
  }
}

/** Handles both new messages and edited messages. */
export async function processAutomod(client: Client, message: Message): Promise<boolean> {
  return handleAutomod(client, message, false);
}

/** Call this from the messageUpdate event to also enforce rules on edits. */
export async function processAutomodEdit(client: Client, newMessage: Message): Promise<boolean> {
  // Fetch partial messages to get full content
  if (newMessage.partial) {
    try {
      await newMessage.fetch();
    } catch {
      return false; // Can't fetch, skip
    }
  }
  return handleAutomod(client, newMessage, true);
}
