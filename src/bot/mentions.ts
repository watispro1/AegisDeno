import type { MessageMentionOptions } from "discord.js";

/**
 * Client-wide allowedMentions default, used for every message, interaction
 * reply and webhook the bot sends. User mentions still ping; @everyone, @here
 * and role mentions inside any text (user-supplied or configured) do not.
 * Features that are meant to ping everyone or a role opt in on that one
 * message: /announce with a ping choice, and the ticket staff-role ping.
 */
export const DEFAULT_ALLOWED_MENTIONS: MessageMentionOptions = { parse: ["users"], repliedUser: true };
