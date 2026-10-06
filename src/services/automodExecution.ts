import { Client, Message, GuildMember } from "discord.js";
import { getAutomodConfig } from "./automod";
import { addWarning } from "./warnings";
import { sendGuildLog } from "./logging";
import { logger } from "../utils/logger";

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
function isExempt(
  member: GuildMember | null,
  channelId: string,
  exemptRoleIds: string[],
  exemptChannelIds: string[]
): boolean {
  if (exemptChannelIds.includes(channelId)) return true;
  if (member && member.roles.cache.some(role => exemptRoleIds.includes(role.id))) return true;
  return false;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
async function handleAutomod(client: Client, message: Message): Promise<void> {
  if (!message.guildId || message.author.bot) return;

  let config;
  try {
    config = await getAutomodConfig(message.guildId);
  } catch (err) {
    logger.error(`Automod: failed to load config for guild ${message.guildId}`, err);
    return;
  }

  const member = message.member ?? await message.guild?.members.fetch(message.author.id).catch(() => null) ?? null;

  // Skip if the user or channel is on the safe-list
  if (isExempt(member, message.channelId, config.exemptRoleIds, config.exemptChannelIds)) return;

  let triggeredRule: { action: string } | null = null;
  let ruleName = "";

  // 1. Spam detection (rate limiter)
  if (config.spam.enabled) {
    const windowMs = config.spam.windowSeconds * 1000;
    if (recordAndCheckSpam(message.guildId, message.author.id, config.spam.maxMessages, windowMs)) {
      triggeredRule = config.spam;
      ruleName = "Spam Detection";
    }
  }

  // 2. Blocked Words
  if (!triggeredRule && config.words.enabled && config.words.list.length > 0) {
    const content = message.content.toLowerCase();
    if (config.words.list.some(word => content.includes(word.toLowerCase()))) {
      triggeredRule = config.words;
      ruleName = "Blocked Words";
    }
  }

  // 3. Mention Spam
  if (!triggeredRule && config.mentions.enabled) {
    if (message.mentions.users.size >= config.mentions.threshold) {
      triggeredRule = config.mentions;
      ruleName = "Mention Spam";
    }
  }

  // 4. Link Filtering
  if (!triggeredRule && config.links.enabled) {
    LINK_REGEX.lastIndex = 0; // Reset regex state (global flag)
    if (LINK_REGEX.test(message.content)) {
      triggeredRule = config.links;
      ruleName = "Link Filtering";
    }
  }

  if (!triggeredRule) return;

  await enforceAutomod(client, message, member, triggeredRule.action, ruleName);
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
    await message.delete().catch(err => {
      logger.warn(`Automod: failed to delete message ${message.id} in guild ${message.guildId}`, err);
    });
  }

  if (action === "warn") {
    try {
      await addWarning(
        message.guildId,
        message.author.id,
        client.user!.id,
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
        `\n**Content:**\n\`\`\`\n${message.content.substring(0, 400)}\`\`\``,
      ].join("\n"),
      fields: [{ name: "User ID", value: message.author.id, inline: true }],
    });
  } catch (err) {
    logger.error(`Automod: failed to send guild log for guild ${message.guildId}`, err);
  }
}

/** Handles both new messages and edited messages. */
export async function processAutomod(client: Client, message: Message): Promise<void> {
  await handleAutomod(client, message);
}

/** Call this from the messageUpdate event to also enforce rules on edits. */
export async function processAutomodEdit(client: Client, newMessage: Message): Promise<void> {
  // Fetch partial messages to get full content
  if (newMessage.partial) {
    try {
      await newMessage.fetch();
    } catch {
      return; // Can't fetch, skip
    }
  }
  await handleAutomod(client, newMessage);
}
