/**
 * Ghost Watch Service
 *
 * Monitors server activity for members placed on a moderator's watchlist.
 * Fires private DM alerts to the watching moderator whenever a watched member
 * takes a monitored action. The watched member is never notified.
 */

import { Client, EmbedBuilder, GuildMember, Message, PartialGuildMember, VoiceState } from "discord.js";
import { isSendableChannel } from "../utils/channels";
import { WatchlistEntryModel } from "../database/mongo";
import { logger } from "../utils/logger";

// ─── Event presets (pure) ─────────────────────────────────────────────────────

export type WatchEvent =
  | "message" | "edit" | "delete" | "join" | "leave" | "roleChange" | "voice" | "firstMessage";

/** `/watchlist add events:` choices mapped to the events they alert on. */
export const WATCH_EVENT_PRESETS: Record<string, WatchEvent[]> = {
  all:           ["message", "edit", "delete", "join", "leave", "roleChange", "voice", "firstMessage"],
  messages:      ["message", "edit", "delete"],
  presence:      ["join", "leave", "voice"],
  roles:         ["roleChange"],
  voice:         ["voice"],
  first_message: ["firstMessage"],
  daily:         ["firstMessage", "voice"],
};

export function resolveWatchEvents(preset: string | null | undefined): WatchEvent[] {
  return [...(WATCH_EVENT_PRESETS[preset ?? "all"] ?? WATCH_EVENT_PRESETS.all)];
}

/**
 * Which alert (if any) a new message should raise for a watch. A first message
 * of the day is labelled as such whenever the watch cares about messages.
 */
export function messageAlertKind(events: readonly string[], isFirstOfDay: boolean): "firstMessage" | "message" | null {
  if (isFirstOfDay && (events.includes("firstMessage") || events.includes("message"))) return "firstMessage";
  if (events.includes("message")) return "message";
  return null;
}

/** Older entries stored "presence"/"all" literally; treat them as voice watchers too. */
export function watchesVoice(events: readonly string[]): boolean {
  return events.includes("voice") || events.includes("presence") || events.includes("all");
}

// ─── Fast In-Memory Watch Cache ───────────────────────────────────────────────

interface CachedWatch {
  moderatorId: string;
  events: string[];
  expiresAt: Date | null;
  alertChannelId?: string | null;
}

const activeWatchKeys = new Set<string>(); // key: `${guildId}:${targetId}`
const watchCache = new Map<string, CachedWatch[]>(); // key: `${guildId}:${targetId}`

export function updateWatchCache(
  guildId: string,
  targetId: string,
  moderatorId: string,
  events: string[],
  expiresAt: Date | null,
  alertChannelId: string | null = null,
): void {
  const key = `${guildId}:${targetId}`;
  activeWatchKeys.add(key);
  const list = watchCache.get(key) ?? [];
  const idx = list.findIndex(w => w.moderatorId === moderatorId);
  if (idx >= 0) {
    list[idx] = { moderatorId, events, expiresAt, alertChannelId };
  } else {
    list.push({ moderatorId, events, expiresAt, alertChannelId });
  }
  watchCache.set(key, list);
}

export function removeWatchFromCache(
  guildId: string,
  targetId: string,
  moderatorId: string,
): void {
  const key = `${guildId}:${targetId}`;
  const list = watchCache.get(key);
  if (!list) return;
  const filtered = list.filter(w => w.moderatorId !== moderatorId);
  if (filtered.length === 0) {
    activeWatchKeys.delete(key);
    watchCache.delete(key);
  } else {
    watchCache.set(key, filtered);
  }
}

export async function syncActiveWatches(): Promise<void> {
  try {
    const now = new Date();
    const entries = await WatchlistEntryModel.find({
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    }).select("guildId targetId moderatorId events expiresAt alertChannelId").lean();

    activeWatchKeys.clear();
    watchCache.clear();

    for (const entry of entries as any[]) {
      const key = `${entry.guildId}:${entry.targetId}`;
      activeWatchKeys.add(key);
      const list = watchCache.get(key) ?? [];
      list.push({
        moderatorId: entry.moderatorId,
        events: entry.events,
        expiresAt: entry.expiresAt ?? null,
        alertChannelId: entry.alertChannelId ?? null,
      });
      watchCache.set(key, list);
    }
  } catch (err) {
    logger.warn("Failed to synchronize active ghost watches:", err);
  }
}

// Background sync interval (prunes expired watches and syncs from DB)
const sweepInterval = setInterval(() => {
  syncActiveWatches().catch(() => null);
}, 60_000);
sweepInterval.unref?.();

// Trigger initial sync shortly after startup
setTimeout(() => {
  syncActiveWatches().catch(() => null);
}, 2_000).unref?.();

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * DM the watching moderator and, if the watch has one, post to its staff alert
 * channel. `postedChannels` de-duplicates channel posts when several
 * moderators watching the same member share a channel.
 */
async function sendWatchAlert(
  client: Client,
  watch: CachedWatch,
  embed: EmbedBuilder,
  postedChannels?: Set<string>,
): Promise<void> {
  try {
    const mod = client.users.cache.get(watch.moderatorId) ?? await client.users.fetch(watch.moderatorId);
    await mod.send({ embeds: [embed] });
  } catch {
    // DMs closed or user not found — silently skip
  }

  const channelId = watch.alertChannelId;
  if (!channelId || postedChannels?.has(channelId)) return;
  postedChannels?.add(channelId);
  try {
    const channel = client.channels.cache.get(channelId) ?? await client.channels.fetch(channelId);
    if (isSendableChannel(channel)) {
      await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    }
  } catch {
    // Channel deleted or no access — skip
  }
}

async function getWatches(guildId: string, targetId: string): Promise<CachedWatch[]> {
  const key = `${guildId}:${targetId}`;
  // 99.99% of members are not on a watchlist — fast O(1) in-memory rejection
  if (!activeWatchKeys.has(key)) {
    return [];
  }

  const cached = watchCache.get(key);
  if (cached) {
    const now = Date.now();
    const valid = cached.filter(w => !w.expiresAt || w.expiresAt.getTime() > now);
    if (valid.length !== cached.length) {
      if (valid.length === 0) {
        activeWatchKeys.delete(key);
        watchCache.delete(key);
      } else {
        watchCache.set(key, valid);
      }
    }
    return valid;
  }

  return [];
}

async function incrementAlertCount(guildId: string, targetId: string, moderatorId: string): Promise<void> {
  await WatchlistEntryModel.updateOne(
    { guildId, targetId, moderatorId },
    { $inc: { alertCount: 1 } }
  ).catch(() => null);
}

// ─── Event handlers ───────────────────────────────────────────────────────────

/** Called from GuildMemberAdd */
export async function watchlistOnJoin(client: Client, member: GuildMember): Promise<void> {
  const watches = await getWatches(member.guild.id, member.id);
  const posted = new Set<string>();
  for (const w of watches) {
    if (!(w.events as string[]).includes("join")) continue;
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({ name: "🕵️ Ghost Watch Alert — Member Joined", iconURL: member.user.displayAvatarURL() })
      .setDescription(`**${member.user.tag}** joined **${member.guild.name}**.`)
      .addFields(
        { name: "👤 User",     value: `${member.user.tag} (<@${member.id}>)`, inline: true },
        { name: "🏠 Server",   value: member.guild.name, inline: true },
        { name: "📅 Joined",   value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
      )
      .setFooter({ text: `Ghost Watch • You are watching this member` })
      .setTimestamp();
    await sendWatchAlert(client, w, embed, posted);
    await incrementAlertCount(member.guild.id, member.id, w.moderatorId);
  }
}

/** Called from GuildMemberRemove */
export async function watchlistOnLeave(client: Client, member: GuildMember | PartialGuildMember): Promise<void> {
  const user = member.user;
  if (!user) return;
  const watches = await getWatches(member.guild.id, member.id);
  const posted = new Set<string>();
  for (const w of watches) {
    if (!(w.events as string[]).includes("leave")) continue;
    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setAuthor({ name: "🕵️ Ghost Watch Alert — Member Left", iconURL: user.displayAvatarURL() })
      .setDescription(`**${user.tag}** left **${member.guild.name}**.`)
      .addFields(
        { name: "👤 User",   value: `${user.tag} (<@${member.id}>)`, inline: true },
        { name: "🏠 Server", value: member.guild.name, inline: true },
      )
      .setFooter({ text: `Ghost Watch • You are watching this member` })
      .setTimestamp();
    await sendWatchAlert(client, w, embed, posted);
    await incrementAlertCount(member.guild.id, member.id, w.moderatorId);
  }
}

/** Called from MessageCreate */
export async function watchlistOnMessage(client: Client, message: Message, isFirstOfDay = false): Promise<void> {
  if (!message.guildId || message.author.bot) return;
  const watches = await getWatches(message.guildId, message.author.id);
  const posted = new Set<string>();
  for (const w of watches) {
    const kind = messageAlertKind(w.events, isFirstOfDay);
    if (!kind) continue;
    const alertTitle = kind === "firstMessage" ? "🕵️ Ghost Watch Alert — First Message of the Day ☀️" : "🕵️ Ghost Watch Alert — Message Sent";
    const preview = message.content.slice(0, 200) || "[No text content]";
    const embed = new EmbedBuilder()
      .setColor(kind === "firstMessage" ? 0xF1C40F : 0x5865F2)
      .setAuthor({ name: alertTitle, iconURL: message.author.displayAvatarURL() })
      .setDescription(`**${message.author.tag}** sent a message in <#${message.channelId}>.`)
      .addFields(
        { name: "👤 User",     value: `${message.author.tag} (<@${message.author.id}>)`, inline: true },
        { name: "📺 Channel",  value: `<#${message.channelId}>`, inline: true },
        { name: "🔗 Jump",     value: `[Open Message](${message.url})`, inline: true },
        { name: "💬 Content",  value: `\`\`\`\n${preview}\n\`\`\``, inline: false },
      )
      .setFooter({ text: `Ghost Watch • You are watching this member` })
      .setTimestamp();
    await sendWatchAlert(client, w, embed, posted);
    await incrementAlertCount(message.guildId, message.author.id, w.moderatorId);
  }
}

/** Called from MessageUpdate */
export async function watchlistOnMessageEdit(client: Client, message: Message): Promise<void> {
  if (!message.guildId || message.author?.bot) return;
  const watches = await getWatches(message.guildId, message.author.id);
  const posted = new Set<string>();
  for (const w of watches) {
    if (!(w.events as string[]).includes("edit")) continue;
    const preview = message.content?.slice(0, 200) ?? "[Unknown content]";
    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setAuthor({ name: "🕵️ Ghost Watch Alert — Message Edited", iconURL: message.author.displayAvatarURL() })
      .setDescription(`**${message.author.tag}** edited a message in <#${message.channelId}>.`)
      .addFields(
        { name: "👤 User",     value: `${message.author.tag} (<@${message.author.id}>)`, inline: true },
        { name: "📺 Channel",  value: `<#${message.channelId}>`, inline: true },
        { name: "🔗 Jump",     value: `[Open Message](${message.url})`, inline: true },
        { name: "💬 New Content", value: `\`\`\`\n${preview}\n\`\`\``, inline: false },
      )
      .setFooter({ text: `Ghost Watch • You are watching this member` })
      .setTimestamp();
    await sendWatchAlert(client, w, embed, posted);
    await incrementAlertCount(message.guildId, message.author.id, w.moderatorId);
  }
}

/** Called from MessageDelete */
export async function watchlistOnMessageDelete(client: Client, message: Message): Promise<void> {
  if (!message.guildId || !message.author || message.author.bot) return;
  const watches = await getWatches(message.guildId, message.author.id);
  const posted = new Set<string>();
  for (const w of watches) {
    if (!(w.events as string[]).includes("delete")) continue;
    const preview = message.content?.slice(0, 200) ?? "[Unknown content]";
    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setAuthor({ name: "🕵️ Ghost Watch Alert — Message Deleted", iconURL: message.author.displayAvatarURL() })
      .setDescription(`**${message.author.tag}** deleted a message in <#${message.channelId}>.`)
      .addFields(
        { name: "👤 User",    value: `${message.author.tag} (<@${message.author.id}>)`, inline: true },
        { name: "📺 Channel", value: `<#${message.channelId}>`, inline: true },
        { name: "💬 Deleted Content", value: `\`\`\`\n${preview}\n\`\`\``, inline: false },
      )
      .setFooter({ text: `Ghost Watch • You are watching this member` })
      .setTimestamp();
    await sendWatchAlert(client, w, embed, posted);
    await incrementAlertCount(message.guildId, message.author.id, w.moderatorId);
  }
}

/** Called from GuildMemberUpdate (role changes, nickname changes, etc.) */
export async function watchlistOnRoleChange(client: Client, oldMember: GuildMember | PartialGuildMember, newMember: GuildMember): Promise<void> {
  const watches = await getWatches(newMember.guild.id, newMember.id);
  if (watches.length === 0) return;

  // Diff the role sets
  const oldRoles = "roles" in oldMember && oldMember.roles ? oldMember.roles.cache : new Map();
  const newRoles = newMember.roles.cache;

  const added   = [...newRoles.values()].filter(r => !oldRoles.has(r.id));
  const removed = [...oldRoles.values()].filter(r => !newRoles.has(r.id));

  if (added.length === 0 && removed.length === 0) return; // No role change

  const posted = new Set<string>();
  for (const w of watches) {
    if (!(w.events as string[]).includes("roleChange")) continue;
    const changeLines = [
      added.length > 0   ? `✅ **Added:**   ${added.map(r => `<@&${r.id}>`).join(", ")}` : null,
      removed.length > 0 ? `❌ **Removed:** ${removed.map(r => `<@&${r.id}>`).join(", ")}` : null,
    ].filter(Boolean).join("\n");

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setAuthor({ name: "🕵️ Ghost Watch Alert — Role Changed", iconURL: newMember.user.displayAvatarURL() })
      .setDescription(`**${newMember.user.tag}**'s roles changed in **${newMember.guild.name}**.`)
      .addFields(
        { name: "👤 User",     value: `${newMember.user.tag} (<@${newMember.id}>)`, inline: true },
        { name: "🔧 Changes",  value: changeLines, inline: false },
      )
      .setFooter({ text: `Ghost Watch • You are watching this member` })
      .setTimestamp();
    await sendWatchAlert(client, w, embed, posted);
    await incrementAlertCount(newMember.guild.id, newMember.id, w.moderatorId);
  }
}

/** Called from VoiceStateUpdate */
export async function watchlistOnVoiceJoin(client: Client, voiceState: VoiceState): Promise<void> {
  if (!voiceState.guild?.id || !voiceState.member || voiceState.member.user.bot) return;
  const channel = voiceState.channel;
  if (!channel) return;

  const watches = await getWatches(voiceState.guild.id, voiceState.member.id);
  const posted = new Set<string>();
  for (const w of watches) {
    if (!watchesVoice(w.events)) continue;

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setAuthor({ name: "🕵️ Ghost Watch Alert — Joined Voice 🎙️", iconURL: voiceState.member.user.displayAvatarURL() })
      .setDescription(`**${voiceState.member.user.tag}** joined voice channel <#${channel.id}> (${channel.name}) in **${voiceState.guild.name}**.`)
      .addFields(
        { name: "👤 User",    value: `${voiceState.member.user.tag} (<@${voiceState.member.id}>)`, inline: true },
        { name: "🎙️ Channel", value: `<#${channel.id}>`, inline: true },
        { name: "🏠 Server",  value: voiceState.guild.name, inline: true },
      )
      .setFooter({ text: "Ghost Watch • You are watching this member" })
      .setTimestamp();

    await sendWatchAlert(client, w, embed, posted);
    await incrementAlertCount(voiceState.guild.id, voiceState.member.id, w.moderatorId);
  }
}
