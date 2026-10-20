/**
 * Starboard Plugin
 *
 * Listens for messageReactionAdd / messageReactionRemove Discord events and
 * automatically reposts highly-reacted messages to a dedicated starboard channel.
 *
 * Configuration (per guild, via /starboard):
 *   channelId       — where to post starred messages
 *   emoji           — the emoji that triggers starring (default ⭐)
 *   threshold       — minimum reaction count needed (default 3)
 *   selfStar        — whether the author's own reaction counts (default false)
 *   ignoredChannels — channel IDs excluded from starring
 *   ignoredRoles    — messages by members with these roles are excluded
 *   enabled         — master on/off switch
 */

import { definePlugin } from "../definePlugin";
import type { PluginEventListener } from "../types";
import { TextChannel } from "discord.js";
import {
  getStarboardConfig,
  handleStarReaction,
} from "../../services/starboard";

export interface StarboardPluginConfig {
  defaultEmoji: string;
  defaultThreshold: number;
}

const reactionHandler = async (
  _: any, // PluginContext — unused at the event level
  reaction: import("discord.js").MessageReaction | import("discord.js").PartialMessageReaction,
  _user: import("discord.js").User | import("discord.js").PartialUser,
): Promise<void> => {
  // Fetch partial data so we always work with complete objects
  if (reaction.partial) {
    try { await reaction.fetch(); } catch { return; }
  }
  const message = reaction.message.partial
    ? await reaction.message.fetch().catch(() => null)
    : reaction.message;

  if (!message || !message.guild) return;

  const guildId = message.guild.id;
  const config = await getStarboardConfig(guildId);

  if (!config.enabled || !config.channelId) return;

  // Bail early if this is not the configured emoji
  const emojiKey = reaction.emoji.name ?? reaction.emoji.toString();
  if (emojiKey !== config.emoji && reaction.emoji.toString() !== config.emoji) return;

  // Ignore bots
  if (message.author?.bot) return;

  // Ignore excluded channels
  if (config.ignoredChannels.includes(message.channelId)) return;

  // Ignore excluded roles (check invoking member)
  if (config.ignoredRoles.length && message.guild) {
    const member = await message.guild.members.fetch(message.author!.id).catch(() => null);
    if (member) {
      const hasIgnored = member.roles.cache.some((r) => config.ignoredRoles.includes(r.id));
      if (hasIgnored) return;
    }
  }

  // Resolve the starboard channel
  const starboardChannel = message.guild.channels.cache.get(config.channelId) as TextChannel | undefined;
  if (!starboardChannel || !starboardChannel.isTextBased()) return;

  // Delegate to the service
  await handleStarReaction(message as import("discord.js").Message, guildId, config, starboardChannel);
};

const events: PluginEventListener[] = [
  {
    event: "messageReactionAdd",
    listener: reactionHandler,
  },
  {
    event: "messageReactionRemove",
    listener: reactionHandler,
  },
];

export const StarboardPlugin = definePlugin<StarboardPluginConfig>({
  name: "starboard",
  description: "Reposts highly-reacted messages to a dedicated starboard channel with configurable emoji, threshold, and ignore lists",
  version: "1.0.0",
  defaultConfig: {
    defaultEmoji: "⭐",
    defaultThreshold: 3,
  },
  events,
  onLoad(ctx) {
    ctx.logger.info("[Knub Plugin] Starboard plugin loaded.");
  },
});
