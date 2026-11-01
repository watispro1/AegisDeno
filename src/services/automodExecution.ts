import { getMemberTrust, getTrustConfig, subjectFromMember } from "./trustService";
import { linkFilterApplies, type TrustConfig } from "./trustEngine";
import { noteIncidentDeletes } from "./incidentHooks";
import { Client, Message, GuildMember, PermissionFlagsBits } from "discord.js";
import { codeBlock } from "../utils/safeText";
import { getAutomodConfig } from "./automod";
import { addWarning } from "./warnings";
import { sendGuildLog } from "./logging";
import { logger } from "../utils/logger";
import { AutomodHitModel } from "../database/mongo";

const LINK_REGEX = /https?:\/\/[^\s]+/gi;

// ─── In-memory spam rate limiter ─────────────────────────────────────────────
// Maps `guildId:userId` → timestamps of recent messages
const spamTracker = new Map<string, number[]>();

function recordAndCheckSpam(
  guildId: string,
  userId: string,
  maxMessages: number,
  windowMs: number
): boolean {
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  const timestamps = (spamTracker.get(key) ?? []).filter(t => t > windowStart);
  timestamps.push(now);
  spamTracker.set(key, timestamps);

  // Clean up old entries periodically to prevent memory leaks
  if (spamTracker.size > 5000) {
    for (const [k, ts] of spamTracker) {
      if (ts.every(t => t <= windowStart)) spamTracker.delete(k);
    }
  }

  return timestamps.length > maxMessages;
}

// ─── Exemption check ─────────────────────────────────────────────────────────
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

// ─── Main handler ─────────────────────────────────────────────────────────────
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

  // 1. Spam detection (rate limiter). Edits are not new messages: counting
  // them let a member who fixed a typo a few times trip the spam rule.
  if (config.spam.enabled && !isEdit) {
    const windowMs = config.spam.windowSeconds * 1000;
    if (recordAndCheckSpam(message.guildId, message.author.id, config.spam.maxMessages, windowMs)) {
      triggeredRule = config.spam;
      ruleName = "Spam Detection";
    }
  }

  // 2. Blocked Words (normalizes zero-width obfuscation and soft hyphens)
  if (!triggeredRule && config.words.enabled && config.words.list.length > 0) {
    const raw = message.content.toLowerCase();
    const normalized = raw.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "");
    if (config.words.list.some(w => {
      const needle = w.toLowerCase().trim();
      return needle && (raw.includes(needle) || normalized.includes(needle));
    })) {
      triggeredRule = config.words;
      ruleName = "Blocked Words";
    }
  }

  // 3. Mention Spam
  if (!triggeredRule && config.mentions.enabled) {
    if (mentionCount(message.mentions) >= config.mentions.threshold) {
      triggeredRule = config.mentions;
      ruleName = "Mention Spam";
    }
  }

  // 4. Link Filtering
  if (!triggeredRule && config.links.enabled) {
    LINK_REGEX.lastIndex = 0; // Reset regex state (global flag)
    if (LINK_REGEX.test(message.content) && await linkFilterAppliesTo(message)) {
      triggeredRule = config.links;
      ruleName = "Link Filtering";
    }
  }

  // 5. Caps and character flood filters
  if (!triggeredRule && config.caps?.enabled) {
    const letters = message.content.match(/[a-z]/gi) ?? [];
    const uppercase = letters.filter(letter => letter === letter.toUpperCase()).length;
    const percentage = letters.length ? (uppercase / letters.length) * 100 : 0;
    if (letters.length >= 8 && percentage >= (config.caps.threshold ?? 70)) {
      triggeredRule = config.caps;
      ruleName = "Excessive Caps";
    }

    if (!triggeredRule) {
      const runMatches = message.content.match(/(.)\1{4,}/gi) ?? [];
      if (runMatches.length > 0) {
        triggeredRule = config.caps;
        ruleName = "Character Flood";
      }
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
  };
  const ruleKey = ruleKeyMap[ruleName] ?? ruleName.toLowerCase();

  await enforceAutomod(client, message, member, triggeredRule.action, ruleName);

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
  ruleName: string
): Promise<void> {
  if (!message.guildId) return;

  logger.info(
    `Automod [${ruleName}] triggered on msg ${message.id} by ${message.author.id} in guild ${message.guildId} — action: ${action}`
  );

  // Delete the message for all enforcement actions
  if (action === "delete" || action === "warn" || action === "timeout") {
    const deleted = await message.delete().then(() => true).catch(err => {
      logger.warn(`Automod: failed to delete message ${message.id} in guild ${message.guildId}`, err);
      return false;
    });
    if (deleted) noteIncidentDeletes(message.guildId, 1, `automod (${ruleName})`, message.author.id);
  }

  if (action === "warn") {
    try {
      await addWarning(
        message.guildId,
        message.author.id,
        client.user?.id ?? "Aegis",
        `Automod violation: ${ruleName}`
      );
    } catch (err) {
      logger.error(`Automod: failed to add warning for user ${message.author.id} in guild ${message.guildId}`, err);
    }
  } else if (action === "timeout") {
    if (member?.moderatable) {
      await member.timeout(5 * 60 * 1000, `Automod violation: ${ruleName}`).catch(err => {
        logger.error(`Automod: failed to timeout user ${message.author.id} in guild ${message.guildId}`, err);
      });
    } else {
      logger.warn(`Automod: cannot timeout user ${message.author.id} in guild ${message.guildId} — not moderatable or member unavailable.`);
    }
  }

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
      fields: [{ name: "User ID", value: message.author.id, inline: true }],
    });
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
