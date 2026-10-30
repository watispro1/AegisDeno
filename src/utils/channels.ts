import type { SendableChannels } from "discord.js";

/**
 * Discord's CHANNEL_OBFUSCATED channel flag (1 << 17). Set on channels that
 * arrive over the Gateway while the bot lacks View Channel on them. Equal to
 * `ChannelFlags.ChannelObfuscated` in discord-api-types; kept as a raw bit so
 * it works whichever discord.js version is installed.
 * https://docs.discord.com/developers/resources/channel#channel-object-obfuscated-channels
 */
export const CHANNEL_OBFUSCATED_FLAG = 1 << 17;

/**
 * The placeholder name Discord gives an obfuscated channel. Informational only:
 * a server can create a real channel with this name, so detection uses the
 * CHANNEL_OBFUSCATED flag alone, as Discord's docs instruct.
 */
export const OBFUSCATED_CHANNEL_NAME = "___hidden___";

/** Shown wherever a saved or picked channel turns out to be hidden from Aegis. */
export const HIDDEN_CHANNEL_HINT = "Aegis can't see this channel. Give Aegis the View Channel permission there.";

/** The same hint for one channel, with a mention so Discord shows its real name to the reader. */
export function hiddenChannelMessage(channelId?: string | null): string {
  return channelId
    ? `Aegis can't see <#${channelId}>. Give Aegis the View Channel permission there.`
    : HIDDEN_CHANNEL_HINT;
}

function flagBits(flags: unknown): number | bigint | null {
  if (typeof flags === "number" || typeof flags === "bigint") return flags;
  if (typeof flags === "object" && flags !== null && "bitfield" in flags) {
    const b = (flags as { bitfield?: unknown }).bitfield;
    if (typeof b === "number" || typeof b === "bigint") return b;
  }
  return null;
}

/**
 * True for a channel whose metadata Discord has obfuscated because Aegis lacks
 * View Channel on it, read from the CHANNEL_OBFUSCATED flag only. The
 * `___hidden___` name is not a signal: a real channel can carry it. An
 * obfuscated channel's name, topic and permission overwrites are not real.
 * Never list it, count it, or edit it.
 * Accepts discord.js channels and raw API channel objects; anything else is false.
 */
export function isObfuscatedChannel(channel: unknown): boolean {
  if (typeof channel !== "object" || channel === null) return false;
  const bits = flagBits((channel as { flags?: unknown }).flags);
  if (bits === null) return false;
  return typeof bits === "bigint"
    ? (bits & BigInt(CHANNEL_OBFUSCATED_FLAG)) !== 0n
    : (bits & CHANNEL_OBFUSCATED_FLAG) !== 0;
}

/** The channels Aegis can actually see, in the order given. */
export function visibleChannels<T>(channels: Iterable<T>): T[] {
  const out: T[] = [];
  for (const c of channels) if (!isObfuscatedChannel(c)) out.push(c);
  return out;
}

/** A channel's display name, or a neutral label when Discord has hidden it. */
export function channelDisplayName(channel: unknown, fallback = "unknown"): string {
  if (isObfuscatedChannel(channel)) return "hidden channel";
  const name = typeof channel === "object" && channel !== null ? (channel as { name?: unknown }).name : null;
  return typeof name === "string" && name ? name : fallback;
}

/**
 * Type guard for any channel-like value that exposes a callable `send()`.
 *
 * Works for cached channels and for the resolved channel objects slash-command
 * options return, so callers can drop `(channel as any).send` casts. A channel
 * Discord has obfuscated (Aegis lacks View Channel) is never sendable.
 */
export function isSendableChannel(channel: unknown): channel is SendableChannels {
  return (
    typeof channel === "object" &&
    channel !== null &&
    "send" in channel &&
    typeof (channel as { send?: unknown }).send === "function" &&
    !isObfuscatedChannel(channel)
  );
}
