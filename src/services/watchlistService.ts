/**
 * Ghost Watch Service
 *
 * Monitors server activity for members placed on a moderator's watchlist.
 * Fires private DM alerts to the watching moderator whenever a watched member
 * takes a monitored action. The watched member is never notified.
 */

import { Client, EmbedBuilder, Guild, GuildMember, Message, PartialGuildMember, PermissionFlagsBits, VoiceState } from "discord.js";
import { isSendableChannel, channelDisplayName, isObfuscatedChannel } from "../utils/channels";
import { codeBlock } from "../utils/safeText";
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

export interface CachedWatch {
  moderatorId: string;
  events: string[];
  expiresAt: Date | null;
  alertChannelId?: string | null;
}

/** One row the periodic sync reads from Mongo. */
export interface WatchRow {
  guildId: string;
  targetId: string;
  moderatorId: string;
  events: string[];
  expiresAt?: Date | null;
  alertChannelId?: string | null;
}

type CacheMutation =
  | { kind: "upsert"; guildId: string; targetId: string; watch: CachedWatch }
  | { kind: "remove"; guildId: string; targetId: string; moderatorId: string };

let activeWatchKeys = new Set<string>(); // key: `${guildId}:${targetId}`
let watchCache = new Map<string, CachedWatch[]>(); // key: `${guildId}:${targetId}`
/**
 * Mutations made while a sync is reading Mongo. The sync's snapshot may
 * predate them, so they are replayed onto the rebuilt cache; without this a
 * watch added during the read was dropped (until the next sync a minute later)
 * and a removed one came back.
 */
let pendingMutations: CacheMutation[] | null = null;
let syncInFlight: Promise<void> | null = null;

function applyMutation(keys: Set<string>, cache: Map<string, CachedWatch[]>, m: CacheMutation): void {
  const key = `${m.guildId}:${m.targetId}`;
  const list = cache.get(key) ?? [];
  if (m.kind === "upsert") {
    const idx = list.findIndex(w => w.moderatorId === m.watch.moderatorId);
    if (idx >= 0) list[idx] = m.watch; else list.push(m.watch);
    cache.set(key, list);
    keys.add(key);
    return;
  }
  const filtered = list.filter(w => w.moderatorId !== m.moderatorId);
  if (filtered.length === 0) {
    keys.delete(key);
    cache.delete(key);
  } else {
    cache.set(key, filtered);
  }
}

function mutate(m: CacheMutation): void {
  applyMutation(activeWatchKeys, watchCache, m);
  pendingMutations?.push(m);
}

export function updateWatchCache(
  guildId: string,
  targetId: string,
  moderatorId: string,
  events: string[],
  expiresAt: Date | null,
  alertChannelId: string | null = null,
): void {
  mutate({ kind: "upsert", guildId, targetId, watch: { moderatorId, events, expiresAt, alertChannelId } });
}

export function removeWatchFromCache(
  guildId: string,
  targetId: string,
  moderatorId: string,
): void {
  mutate({ kind: "remove", guildId, targetId, moderatorId });
}

/** The cached watches for one member (a copy). Exposed for tests and diagnostics. */
export function cachedWatches(guildId: string, targetId: string): CachedWatch[] {
  return [...(watchCache.get(`${guildId}:${targetId}`) ?? [])];
}

async function loadActiveWatchRows(): Promise<WatchRow[]> {
  const now = new Date();
  const rows = await WatchlistEntryModel.find({
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  }).select("guildId targetId moderatorId events expiresAt alertChannelId").lean();
  return rows as unknown as WatchRow[];
}

/**
 * Rebuild the cache from Mongo. Concurrent calls share one read. Watches added
 * or removed while the read is in flight are replayed on top of it.
 */
export function syncActiveWatches(load: () => Promise<WatchRow[]> = loadActiveWatchRows): Promise<void> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    pendingMutations = [];
    try {
      const entries = await load();
      const keys = new Set<string>();
      const cache = new Map<string, CachedWatch[]>();
      for (const entry of entries) {
        applyMutation(keys, cache, {
          kind: "upsert",
          guildId: entry.guildId,
          targetId: entry.targetId,
          watch: {
            moderatorId: entry.moderatorId,
            events: entry.events,
            expiresAt: entry.expiresAt ?? null,
            alertChannelId: entry.alertChannelId ?? null,
          },
        });
      }
      for (const m of pendingMutations) applyMutation(keys, cache, m);
      activeWatchKeys = keys;
      watchCache = cache;
    } catch (err) {
      // Keep the cache we have; a failed read must not drop every watch.
      logger.warn("Failed to synchronize active ghost watches:", err);
    } finally {
      pendingMutations = null;
      syncInFlight = null;
    }
  })();
  return syncInFlight;
}

let syncTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the background sync (prunes expired watches, picks up changes made on
 * other instances). Called once the client is ready; idempotent. Not started
 * on import, so tests and scripts that import this module touch no database.
 */
export function startWatchlistSync(): void {
  if (syncTimer) return;
  void syncActiveWatches();
  syncTimer = setInterval(() => {
    void syncActiveWatches();
  }, 60_000);
  syncTimer.unref?.();
}

// ─── Privacy gate ─────────────────────────────────────────────────────────────

/** Where an alert came from: a channel for message and voice events, none for joins, leaves and roles. */
export interface AlertSource {
  guild: Guild;
  channelId?: string | null;
}

/**
 * Whether a watcher may still receive an alert: they are still in the server,
 * still hold Moderate Members (the permission /watchlist needs), and, for an
 * event that happened in a channel, can currently view that channel.
 * Anything that cannot be confirmed counts as "no".
 */
export async function watcherMayReceive(source: AlertSource, moderatorId: string): Promise<boolean> {
  try {
    const member = source.guild.members.cache.get(moderatorId)
      ?? await source.guild.members.fetch(moderatorId).catch(() => null);
    if (!member) return false;
    if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) return false;
    if (!source.channelId) return true;
    const channel = source.guild.channels.cache.get(source.channelId)
      ?? await source.guild.channels.fetch(source.channelId).catch(() => null);
    if (!channel || isObfuscatedChannel(channel)) return false;
    const perms = channel.permissionsFor(member);
    return Boolean(perms?.has(PermissionFlagsBits.ViewChannel));
  } catch {
    return false;
  }
}

/**
 * Whether the staff alert channel post should leave out what was said and
 * where: when the source channel is private (its @everyone cannot view it),
 * people in the alert channel may not be allowed to read it.
 */
export function sourceIsPrivate(source: AlertSource): boolean {
  if (!source.channelId) return false;
  const channel = source.guild.channels.cache.get(source.channelId);
  if (!channel || isObfuscatedChannel(channel)) return true;
  const perms = channel.permissionsFor(source.guild.roles.everyone);
  return !perms?.has(PermissionFlagsBits.ViewChannel);
}

/** A copy of an alert embed without message content or jump links, for alert channels. */
export function redactAlertEmbed(embed: EmbedBuilder): EmbedBuilder {
  const copy = EmbedBuilder.from(embed.toJSON());
  const fields = (copy.data.fields ?? []).filter(f => !/Content|Jump/i.test(f.name));
  copy.setFields(fields);
  copy.addFields({ name: "🔒 Redacted", value: "This happened in a private channel, so the content is only in the watcher's DM.", inline: false });
  return copy;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * DM the watching moderator and, if the watch has one, post to its staff alert
 * channel. Nothing is sent unless the watcher still qualifies (see
 * watcherMayReceive). `postedChannels` de-duplicates channel posts when several
 * moderators watching the same member share a channel.
 * Returns whether anything was delivered.
 */
async function sendWatchAlert(
  client: Client,
  source: AlertSource,
  watch: CachedWatch,
  embed: EmbedBuilder,
  postedChannels?: Set<string>,
): Promise<boolean> {
  if (!(await watcherMayReceive(source, watch.moderatorId))) {
    logger.debug(`Ghost Watch: skipped alert for ${watch.moderatorId} in ${source.guild.id} (no longer a moderator or cannot view the source channel)`);
    return false;
  }
  try {
    const mod = client.users.cache.get(watch.moderatorId) ?? await client.users.fetch(watch.moderatorId);
    await mod.send({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch {
    // DMs closed or user not found — silently skip
  }

  const channelId = watch.alertChannelId;
  if (!channelId || postedChannels?.has(channelId)) return true;
  postedChannels?.add(channelId);
  try {
    const channel = client.channels.cache.get(channelId) ?? await client.channels.fetch(channelId);
    if (isSendableChannel(channel) && "guildId" in channel && channel.guildId === source.guild.id) {
      const posted = sourceIsPrivate(source) ? redactAlertEmbed(embed) : embed;
      await channel.send({ embeds: [posted], allowedMentions: { parse: [] } });
    }
  } catch {
    // Channel deleted or no access — skip
  }
  return true;
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
    if (await sendWatchAlert(client, { guild: member.guild }, w, embed, posted)) await incrementAlertCount(member.guild.id, member.id, w.moderatorId);
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
    if (await sendWatchAlert(client, { guild: member.guild }, w, embed, posted)) await incrementAlertCount(member.guild.id, member.id, w.moderatorId);
  }
}

/** Called from MessageCreate */
export async function watchlistOnMessage(client: Client, message: Message, isFirstOfDay = false): Promise<void> {
  if (!message.guildId || !message.guild || message.author.bot) return;
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
        { name: "💬 Content",  value: codeBlock(preview), inline: false },
      )
      .setFooter({ text: `Ghost Watch • You are watching this member` })
      .setTimestamp();
    if (await sendWatchAlert(client, { guild: message.guild!, channelId: message.channelId }, w, embed, posted)) await incrementAlertCount(message.guildId, message.author.id, w.moderatorId);
  }
}

/** Called from MessageUpdate */
export async function watchlistOnMessageEdit(client: Client, message: Message): Promise<void> {
  if (!message.guildId || !message.guild || !message.author || message.author.bot) return;
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
        { name: "💬 New Content", value: codeBlock(preview), inline: false },
      )
      .setFooter({ text: `Ghost Watch • You are watching this member` })
      .setTimestamp();
    if (await sendWatchAlert(client, { guild: message.guild!, channelId: message.channelId }, w, embed, posted)) await incrementAlertCount(message.guildId, message.author.id, w.moderatorId);
  }
}

/** Called from MessageDelete */
export async function watchlistOnMessageDelete(client: Client, message: Message): Promise<void> {
  if (!message.guildId || !message.guild || !message.author || message.author.bot) return;
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
        { name: "💬 Deleted Content", value: codeBlock(preview), inline: false },
      )
      .setFooter({ text: `Ghost Watch • You are watching this member` })
      .setTimestamp();
    if (await sendWatchAlert(client, { guild: message.guild!, channelId: message.channelId }, w, embed, posted)) await incrementAlertCount(message.guildId, message.author.id, w.moderatorId);
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
    if (await sendWatchAlert(client, { guild: newMember.guild }, w, embed, posted)) await incrementAlertCount(newMember.guild.id, newMember.id, w.moderatorId);
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
      .setDescription(`**${voiceState.member.user.tag}** joined voice channel <#${channel.id}> (${channelDisplayName(channel)}) in **${voiceState.guild.name}**.`)
      .addFields(
        { name: "👤 User",    value: `${voiceState.member.user.tag} (<@${voiceState.member.id}>)`, inline: true },
        { name: "🎙️ Channel", value: `<#${channel.id}>`, inline: true },
        { name: "🏠 Server",  value: voiceState.guild.name, inline: true },
      )
      .setFooter({ text: "Ghost Watch • You are watching this member" })
      .setTimestamp();

    if (await sendWatchAlert(client, { guild: voiceState.guild, channelId: channel.id }, w, embed, posted)) await incrementAlertCount(voiceState.guild.id, voiceState.member.id, w.moderatorId);
  }
}
