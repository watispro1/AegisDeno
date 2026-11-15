/**
 * /starboard settings helpers: the ignore-list change (and what to say about
 * it), emoji suggestions, list lines with jump links, and mention lists that
 * fit an embed field. Pure apart from the types.
 */
import { checkReactionEmoji } from "./inputChecks";

export type IgnoreAction = "add" | "remove";

export interface IgnoreChange {
  ignoredChannels: string[];
  ignoredRoles: string[];
  /** What actually changed, for the reply. */
  changed: string[];
  /** What was asked but already so (already ignored / not on the list). */
  unchanged: string[];
}

/** Apply an add/remove to the ignore lists, saying what changed and what already was. Pure. */
export function applyIgnoreChange(
  current: { ignoredChannels: readonly string[]; ignoredRoles: readonly string[] },
  action: IgnoreAction,
  target: { channelId?: string | null; roleId?: string | null },
): IgnoreChange {
  const out: IgnoreChange = { ignoredChannels: [...current.ignoredChannels], ignoredRoles: [...current.ignoredRoles], changed: [], unchanged: [] };
  const apply = (list: string[], id: string, mention: string): string[] => {
    const has = list.includes(id);
    if (action === "add" ? has : !has) {
      out.unchanged.push(mention);
      return list;
    }
    out.changed.push(mention);
    return action === "add" ? [...list, id] : list.filter(x => x !== id);
  };
  if (target.channelId) out.ignoredChannels = apply(out.ignoredChannels, target.channelId, `<#${target.channelId}>`);
  if (target.roleId) out.ignoredRoles = apply(out.ignoredRoles, target.roleId, `<@&${target.roleId}>`);
  return out;
}

/** The reply after an ignore change. Pure. */
export function ignoreChangeMessage(action: IgnoreAction, c: Pick<IgnoreChange, "changed" | "unchanged">): string {
  const parts: string[] = [];
  if (c.changed.length) parts.push(`⭐ ${action === "add" ? "Added" : "Removed"} ${c.changed.join(" and ")} ${action === "add" ? "to" : "from"} the starboard ignore list.`);
  if (c.unchanged.length) parts.push(`ℹ️ ${c.unchanged.join(" and ")} ${c.unchanged.length === 1 ? "was" : "were"} ${action === "add" ? "already ignored" : "not on the ignore list"}.`);
  return parts.join("\n");
}

/** Mentions joined with ", ", ending "and N more" so it fits an embed field. Pure. */
export function clippedMentions(mentions: readonly string[], budget = 1000): string {
  if (!mentions.length) return "None";
  const shown: string[] = [];
  let used = 0;
  for (const m of mentions) {
    if (used + m.length + 2 > budget - 20) break;
    shown.push(m);
    used += m.length + 2;
  }
  const rest = mentions.length - shown.length;
  return `${shown.join(", ")}${rest ? ` and ${rest} more` : ""}`;
}

/** Emoji offered by /starboard emoji autocomplete before the server's own. */
export const STAR_EMOJI_PRESETS = ["⭐", "🌟", "✨", "💫", "🔥", "❤️", "👍", "🏆", "💯", "😂"] as const;

/** Emoji autocomplete: what was typed (when valid), the presets, then the server's emojis matching the text. Pure. */
export function starEmojiChoices(typed: string, serverEmojis: ReadonlyArray<{ id: string; name: string | null; animated: boolean | null }>): Array<{ name: string; value: string }> {
  const q = typed.trim();
  const out: Array<{ name: string; value: string }> = [];
  if (q && checkReactionEmoji(q).ok) out.push({ name: `${q} (as typed)`, value: q });
  const lower = q.toLowerCase().replace(/[:<>]/g, "");
  if (!lower || out.length) for (const e of STAR_EMOJI_PRESETS) if (e !== q) out.push({ name: e, value: e });
  for (const e of serverEmojis) {
    if (!e.name) continue;
    if (lower && !e.name.toLowerCase().includes(lower)) continue;
    out.push({ name: `:${e.name}: (server emoji)`, value: `<${e.animated ? "a" : ""}:${e.name}:${e.id}>` });
  }
  return out.slice(0, 25);
}

/** One line of /starboard list, with links to the original and the starboard post. Pure. */
export function starboardListLine(
  e: { starCount: number; sourceChannelId: string; sourceMessageId: string; starboardChannelId?: string | null; starboardMessageId?: string | null; authorId?: string | null; createdAt: Date | string },
  index: number,
  guildId: string,
  emoji: string,
): string {
  const ts = Math.floor(new Date(e.createdAt).getTime() / 1000);
  const source = `[original](https://discord.com/channels/${guildId}/${e.sourceChannelId}/${e.sourceMessageId})`;
  const board = e.starboardChannelId && e.starboardMessageId ? ` · [starboard post](https://discord.com/channels/${guildId}/${e.starboardChannelId}/${e.starboardMessageId})` : "";
  return `**${index + 1}.** ${e.starCount} ${emoji} · <#${e.sourceChannelId}>${e.authorId ? ` · <@${e.authorId}>` : ""} · <t:${ts}:R>\n${source}${board}`;
}
