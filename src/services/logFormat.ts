/**
 * Pure builders for the server activity log entries (edits, bulk deletes,
 * role and nickname changes, voice moves, channel changes). The gateway
 * handlers in bot/events/serverLogs.ts only gather the inputs.
 */
import type { APIEmbedField, EmbedData } from "discord.js";
import { codeBlock, truncate } from "../utils/safeText";

type LogEmbed = Omit<EmbedData, "timestamp">;

const ts = (ms: number) => `<t:${Math.floor(ms / 1000)}:f>`;

/**
 * The words removed and added between two versions of a message, for the
 * "What changed" line. Uses the longest common run of words at the start and
 * end, which is what an edit to fix a typo or add a sentence looks like.
 */
export function wordDiff(before: string, after: string): { removed: string; added: string } {
  const a = before.split(/\s+/).filter(Boolean);
  const b = after.split(/\s+/).filter(Boolean);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  return { removed: a.slice(start, endA).join(" "), added: b.slice(start, endB).join(" ") };
}

export function editLogEmbed(input: {
  authorTag: string;
  authorId: string;
  channelId: string;
  url: string;
  before: string | null;
  after: string;
}): LogEmbed {
  const fields: APIEmbedField[] = [];
  if (input.before === null) {
    fields.push({ name: "Before", value: "*Not cached (sent before Aegis last restarted)*" });
  } else {
    fields.push({ name: "Before", value: codeBlock(input.before || "[no text]", 1024) });
    const diff = wordDiff(input.before, input.after);
    const parts = [diff.removed && `Removed: ${truncate(diff.removed, 200)}`, diff.added && `Added: ${truncate(diff.added, 200)}`].filter(Boolean);
    if (parts.length) fields.push({ name: "What changed", value: codeBlock(parts.join("\n"), 600) });
  }
  fields.push({ name: "After", value: codeBlock(input.after || "[no text]", 1024) });
  return {
    title: "✏️ Message Edited",
    color: 0xF1C40F,
    description: `**Author:** ${input.authorTag} (<@${input.authorId}>)\n**Channel:** <#${input.channelId}> · [Jump to message](${input.url})`,
    fields,
    footer: { text: `User ID: ${input.authorId}` },
  };
}

export interface TranscriptLine {
  createdAt: number;
  authorTag: string | null;
  authorId: string | null;
  content: string;
  attachments: number;
}

/** Plain-text transcript for the bulk-delete log attachment, oldest first. */
export function bulkDeleteTranscript(channelName: string, lines: readonly TranscriptLine[], maxBytes = 1_000_000): string {
  const header = `Bulk delete in #${channelName}: ${lines.length} message(s)\n\n`;
  const out = [header];
  let size = header.length;
  for (const l of [...lines].sort((x, y) => x.createdAt - y.createdAt)) {
    const who = l.authorTag ? `${l.authorTag} (${l.authorId})` : "Unknown author (not cached)";
    const extra = l.attachments ? ` [${l.attachments} attachment(s)]` : "";
    const row = `[${new Date(l.createdAt).toISOString()}] ${who}: ${l.content.replace(/\r?\n/g, "\n    ")}${extra}\n`;
    if (size + row.length > maxBytes) { out.push("... transcript cut to fit Discord's file size limit\n"); break; }
    out.push(row);
    size += row.length;
  }
  return out.join("");
}

export function bulkDeleteEmbed(input: { channelId: string; total: number; cached: number; authors: number }): LogEmbed {
  const uncached = input.total - input.cached;
  return {
    title: "🧹 Messages Bulk Deleted",
    color: 0xE74C3C,
    description: [
      `**Channel:** <#${input.channelId}>`,
      `**Messages:** ${input.total}${uncached ? ` (${uncached} not cached, so their text is missing)` : ""}`,
      `**Authors:** ${input.authors}`,
      input.cached ? "The attached file has the text of every cached message." : "",
    ].filter(Boolean).join("\n"),
  };
}

export interface MemberChange {
  added: string[];
  removed: string[];
  nickname: { before: string | null; after: string | null } | null;
}

/** What changed on a member, or null when nothing we log did. */
export function memberChanges(
  before: { roleIds: readonly string[]; nickname: string | null } | null,
  after: { roleIds: readonly string[]; nickname: string | null },
): MemberChange | null {
  if (!before) return null; // uncached old member: we cannot tell what changed
  const added = after.roleIds.filter(id => !before.roleIds.includes(id));
  const removed = before.roleIds.filter(id => !after.roleIds.includes(id));
  const nickname = before.nickname !== after.nickname ? { before: before.nickname, after: after.nickname } : null;
  return added.length || removed.length || nickname ? { added, removed, nickname } : null;
}

export function roleChangeEmbed(userTag: string, userId: string, change: MemberChange): LogEmbed | null {
  if (!change.added.length && !change.removed.length) return null;
  const list = (ids: string[]) => truncate(ids.map(id => `<@&${id}>`).join(" "), 1000);
  return {
    title: "🎭 Roles Updated",
    color: 0x9B59B6,
    description: `**Member:** ${userTag} (<@${userId}>)`,
    fields: [
      ...(change.added.length ? [{ name: "Added", value: list(change.added) }] : []),
      ...(change.removed.length ? [{ name: "Removed", value: list(change.removed) }] : []),
    ],
    footer: { text: `User ID: ${userId}` },
  };
}

export function nicknameChangeEmbed(userTag: string, userId: string, change: MemberChange): LogEmbed | null {
  if (!change.nickname) return null;
  const show = (n: string | null) => (n ? truncate(n, 100) : "*none*");
  return {
    title: "🏷️ Nickname Changed",
    color: 0x3498DB,
    description: `**Member:** ${userTag} (<@${userId}>)\n**Before:** ${show(change.nickname.before)}\n**After:** ${show(change.nickname.after)}`,
    footer: { text: `User ID: ${userId}` },
  };
}

export type VoiceMove = { kind: "join"; to: string } | { kind: "leave"; from: string } | { kind: "move"; from: string; to: string };

export function voiceMove(fromId: string | null, toId: string | null): VoiceMove | null {
  if (!fromId && toId) return { kind: "join", to: toId };
  if (fromId && !toId) return { kind: "leave", from: fromId };
  if (fromId && toId && fromId !== toId) return { kind: "move", from: fromId, to: toId };
  return null; // mute, deafen, stream or video toggles
}

export function voiceEmbed(userTag: string, userId: string, move: VoiceMove, nowMs = Date.now()): LogEmbed {
  const who = `${userTag} (<@${userId}>)`;
  if (move.kind === "join") return { title: "🔊 Joined Voice", color: 0x57F287, description: `${who} joined <#${move.to}> at ${ts(nowMs)}` };
  if (move.kind === "leave") return { title: "🔇 Left Voice", color: 0xE67E22, description: `${who} left <#${move.from}> at ${ts(nowMs)}` };
  return { title: "🔀 Moved Voice Channel", color: 0x3498DB, description: `${who} moved from <#${move.from}> to <#${move.to}>` };
}

export interface ChannelSnapshot {
  id: string;
  name: string;
  type: string;
  topic?: string | null;
  nsfw?: boolean;
  rateLimitPerUser?: number;
  parentId?: string | null;
}

/** Lines describing what changed on a channel, empty when nothing we log did (permission edits, position shuffles). */
export function channelChanges(before: ChannelSnapshot, after: ChannelSnapshot): string[] {
  const lines: string[] = [];
  if (before.name !== after.name) lines.push(`**Name:** #${truncate(before.name, 100)} → #${truncate(after.name, 100)}`);
  if ((before.topic ?? "") !== (after.topic ?? "")) lines.push(`**Topic:** ${truncate(before.topic || "none", 200)} → ${truncate(after.topic || "none", 200)}`);
  if (Boolean(before.nsfw) !== Boolean(after.nsfw)) lines.push(`**Age-restricted:** ${after.nsfw ? "on" : "off"}`);
  if ((before.rateLimitPerUser ?? 0) !== (after.rateLimitPerUser ?? 0)) lines.push(`**Slowmode:** ${before.rateLimitPerUser ?? 0}s → ${after.rateLimitPerUser ?? 0}s`);
  if ((before.parentId ?? null) !== (after.parentId ?? null)) lines.push(`**Category:** ${before.parentId ? `<#${before.parentId}>` : "none"} → ${after.parentId ? `<#${after.parentId}>` : "none"}`);
  return lines;
}

export function channelEmbed(kind: "create" | "delete" | "update", channel: ChannelSnapshot, changes: string[] = []): LogEmbed {
  const title = { create: "📌 Channel Created", delete: "🗑️ Channel Deleted", update: "🛠️ Channel Updated" }[kind];
  const color = { create: 0x57F287, delete: 0xE74C3C, update: 0xF1C40F }[kind];
  const ref = kind === "delete" ? `#${truncate(channel.name, 100)}` : `<#${channel.id}> (#${truncate(channel.name, 100)})`;
  return {
    title,
    color,
    description: [`**Channel:** ${ref}`, `**Type:** ${channel.type}`, ...changes].join("\n"),
    footer: { text: `Channel ID: ${channel.id}` },
  };
}
