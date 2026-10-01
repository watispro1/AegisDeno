import { Client, Message, TextChannel } from "discord.js";
import { getAutomodConfig } from "./automod";
import { addWarning } from "./warnings";
import { sendGuildLog } from "./logging";
import { logger } from "../utils/logger";

const LINK_REGEX = /https?:\/\/[^\s]+/gi;

export async function processAutomod(client: Client, message: Message): Promise<void> {
  if (!message.guildId || message.author.bot) return;

  const config = await getAutomodConfig(message.guildId);

  let triggeredRule: { action: string } | null = null;
  let ruleName = "";

  // 1. Blocked Words
  if (config.words.enabled && config.words.list.length > 0) {
    const content = message.content.toLowerCase();
    if (config.words.list.some(word => content.includes(word.toLowerCase()))) {
      triggeredRule = config.words;
      ruleName = "Blocked Words";
    }
  }

  // 2. Mention Spam
  if (!triggeredRule && config.mentions.enabled) {
    if (message.mentions.users.size >= config.mentions.threshold) {
      triggeredRule = config.mentions;
      ruleName = "Mention Spam";
    }
  }

  // 3. Link Filtering
  if (!triggeredRule && config.links.enabled) {
    LINK_REGEX.lastIndex = 0; // Reset regex state
    if (LINK_REGEX.test(message.content)) {
      triggeredRule = config.links;
      ruleName = "Link Filtering";
    }
  }

  if (!triggeredRule) return;

  const action = triggeredRule.action;

  // Delete the message for delete/warn/timeout actions
  if (action === "delete" || action === "warn" || action === "timeout") {
    await message.delete().catch(() => null);
  }

  if (action === "warn") {
    await addWarning(
      message.guildId,
      message.author.id,
      client.user!.id,
      `Automod violation: ${ruleName}`
    );
  } else if (action === "timeout") {
    const member = message.member;
    if (member?.moderatable) {
      await member.timeout(5 * 60 * 1000, `Automod violation: ${ruleName}`).catch(() => null);
    }
  }

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
}
