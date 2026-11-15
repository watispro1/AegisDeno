/**
 * Lists behind the /serverinfo detail buttons: the channel tree (categories
 * with their channels, in Discord's order) and the sticker list. Pure.
 */
import { ChannelType } from "discord.js";

export interface TreeChannel { id: string; name: string; type: ChannelType; parentId: string | null; position: number }

const THREAD_TYPES = new Set<ChannelType>([ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread]);
const VOICE_TYPES = new Set<ChannelType>([ChannelType.GuildVoice, ChannelType.GuildStageVoice]);

function icon(type: ChannelType): string {
  if (VOICE_TYPES.has(type)) return "🔊";
  if (type === ChannelType.GuildAnnouncement) return "📢";
  if (type === ChannelType.GuildForum || type === ChannelType.GuildMedia) return "🗂️";
  return "#️⃣";
}

/** Text channels before voice inside a category, then by position, as Discord shows them. */
function order(a: TreeChannel, b: TreeChannel): number {
  const va = VOICE_TYPES.has(a.type) ? 1 : 0;
  const vb = VOICE_TYPES.has(b.type) ? 1 : 0;
  return va - vb || a.position - b.position || a.name.localeCompare(b.name);
}

/**
 * One line per channel, grouped under its category (channels with no
 * category first). Threads are left out; the embed already counts them.
 */
export function channelTreeLines(channels: readonly TreeChannel[]): string[] {
  const list = channels.filter(c => !THREAD_TYPES.has(c.type));
  const categories = list.filter(c => c.type === ChannelType.GuildCategory).sort((a, b) => a.position - b.position);
  const categoryIds = new Set(categories.map(c => c.id));
  const lines: string[] = [];
  const childrenOf = (id: string | null) => list
    .filter(c => c.type !== ChannelType.GuildCategory && (id === null ? !c.parentId || !categoryIds.has(c.parentId) : c.parentId === id))
    .sort(order);
  for (const c of childrenOf(null)) lines.push(`${icon(c.type)} <#${c.id}>`);
  for (const cat of categories) {
    const kids = childrenOf(cat.id);
    lines.push(`📁 **${cat.name.slice(0, 90)}** (${kids.length})`);
    for (const c of kids) lines.push(`\u2003${icon(c.type)} <#${c.id}>`);
  }
  return lines;
}

/** A sticker line: name, its emoji tag and description when set. */
export function stickerLine(s: { name: string; tags?: string | null; description?: string | null }): string {
  const tag = s.tags ? ` · :${s.tags.replace(/:/g, "").slice(0, 32)}:` : "";
  const desc = s.description ? `\n-# ${s.description.replace(/\s+/g, " ").slice(0, 100)}` : "";
  return `🏷️ **${s.name.slice(0, 60)}**${tag}${desc}`;
}
