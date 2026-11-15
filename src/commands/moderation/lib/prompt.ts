/**
 * Shared bits for the moderation confirmation prompts (/ban, /kick,
 * /timeout, /softban, /lock server). Replaces `fetchReply: true`, which
 * discord.js 14 deprecates, with `withResponse`.
 */
import {
  MessageFlags,
  type ChatInputCommandInteraction,
  type InteractionReplyOptions,
  type Message,
} from "discord.js";

/** Reply ephemerally and return the reply message so a collector can listen on it. */
export async function replyEphemeralPrompt(
  interaction: ChatInputCommandInteraction,
  payload: Omit<InteractionReplyOptions, "flags" | "withResponse" | "fetchReply">,
): Promise<Message> {
  const response = await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral, withResponse: true });
  const message = response.resource?.message;
  if (!message) throw new Error("Discord returned no message for the confirmation prompt");
  return message;
}

/**
 * Whether a quick "timeout for N minutes" would cut short a longer timeout
 * the member already has. Pure.
 */
export function wouldShortenTimeout(currentUntil: Date | null | undefined, addMs: number, nowMs = Date.now()): boolean {
  if (!currentUntil) return false;
  return currentUntil.getTime() > nowMs + addMs;
}

/** A temporary ban's reason starts with "[temp:ref] 7 days: …"; show moderators the reason without the marker. */
export function stripTempBanMarker(reason: string | null | undefined): string {
  return String(reason ?? "").replace(/^\[temp:[0-9a-f]+\]\s*/i, "");
}
