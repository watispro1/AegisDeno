import type { SendableChannels } from "discord.js";

/**
 * Type guard for any channel-like value that exposes a callable `send()`.
 *
 * Works for cached channels and for the resolved channel objects slash-command
 * options return, so callers can drop `(channel as any).send` casts.
 */
export function isSendableChannel(channel: unknown): channel is SendableChannels {
  return (
    typeof channel === "object" &&
    channel !== null &&
    "send" in channel &&
    typeof (channel as { send?: unknown }).send === "function"
  );
}
