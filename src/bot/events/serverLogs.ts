/**
 * Server activity logs: message edits, bulk deletes, role and nickname
 * changes, voice moves and channel changes. Each handler gathers what the
 * event carries and hands it to the pure builders in services/logFormat.ts.
 * Entries in channels Aegis cannot see are skipped.
 */
import {
  AttachmentBuilder,
  ChannelType,
  Events,
  type Client,
  type GuildBasedChannel,
  type GuildChannel,
} from "discord.js";
import { sendGuildLog } from "../../services/logging";
import {
  bulkDeleteEmbed,
  bulkDeleteTranscript,
  channelChanges,
  channelEmbed,
  editLogEmbed,
  memberChanges,
  nicknameChangeEmbed,
  roleChangeEmbed,
  voiceEmbed,
  voiceMove,
  type ChannelSnapshot,
  type TranscriptLine,
} from "../../services/logFormat";
import { isContentEdit } from "../eventFilters";
import { isObfuscatedChannel } from "../../utils/channels";
import { logger } from "../../utils/logger";

function snapshot(channel: GuildChannel | GuildBasedChannel): ChannelSnapshot {
  const c = channel as GuildChannel & { topic?: string | null; nsfw?: boolean; rateLimitPerUser?: number };
  return {
    id: c.id,
    name: c.name,
    type: ChannelType[c.type] ?? String(c.type),
    topic: c.topic ?? null,
    nsfw: c.nsfw,
    rateLimitPerUser: c.rateLimitPerUser,
    parentId: c.parentId ?? null,
  };
}

const warn = (what: string) => (err: unknown) => logger.warn(`Server log (${what}) failed:`, err);

export function registerServerLogs(client: Client): void {
  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    if (!newMessage.guildId || !isContentEdit(oldMessage, newMessage)) return;
    const msg = newMessage.partial ? await newMessage.fetch().catch(() => null) : newMessage;
    if (!msg || msg.author?.bot || !msg.author) return;
    if (newMessage.partial && !isContentEdit(oldMessage, msg)) return;
    if (msg.channel && isObfuscatedChannel(msg.channel)) return;
    await sendGuildLog(client, msg.guildId!, editLogEmbed({
      authorTag: msg.author.tag,
      authorId: msg.author.id,
      channelId: msg.channelId,
      url: msg.url,
      before: oldMessage.partial ? null : (oldMessage.content ?? ""),
      after: msg.content ?? "",
    }), "messageEdits").catch(warn("edit"));
  });

  client.on(Events.MessageBulkDelete, async (messages, channel) => {
    if (!("guildId" in channel) || !channel.guildId || isObfuscatedChannel(channel)) return;
    const lines: TranscriptLine[] = [];
    const authors = new Set<string>();
    for (const m of messages.values()) {
      if (m.partial) continue;
      if (m.author) authors.add(m.author.id);
      lines.push({
        createdAt: m.createdTimestamp,
        authorTag: m.author?.tag ?? null,
        authorId: m.author?.id ?? null,
        content: m.content ?? "",
        attachments: m.attachments?.size ?? 0,
      });
    }
    const files = lines.length
      ? [new AttachmentBuilder(Buffer.from(bulkDeleteTranscript(channel.name, lines), "utf8"), { name: `bulk-delete-${channel.id}.txt` })]
      : undefined;
    await sendGuildLog(client, channel.guildId, bulkDeleteEmbed({
      channelId: channel.id,
      total: messages.size,
      cached: lines.length,
      authors: authors.size,
    }), "messageDeletes", undefined, files).catch(warn("bulk delete"));
  });

  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    const before = oldMember.partial ? null : { roleIds: [...oldMember.roles.cache.keys()], nickname: oldMember.nickname };
    const change = memberChanges(before, { roleIds: [...newMember.roles.cache.keys()], nickname: newMember.nickname });
    if (!change) return;
    const guildId = newMember.guild.id;
    const roles = roleChangeEmbed(newMember.user.tag, newMember.id, {
      ...change,
      added: change.added.filter(id => id !== guildId),
      removed: change.removed.filter(id => id !== guildId),
    });
    if (roles) await sendGuildLog(client, guildId, roles, "roleChanges").catch(warn("roles"));
    const nick = nicknameChangeEmbed(newMember.user.tag, newMember.id, change);
    if (nick) await sendGuildLog(client, guildId, nick, "roleChanges").catch(warn("nickname"));
  });

  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    const member = newState.member ?? oldState.member;
    if (!member || member.user.bot) return;
    const move = voiceMove(oldState.channelId, newState.channelId);
    if (!move) return;
    await sendGuildLog(client, newState.guild.id, voiceEmbed(member.user.tag, member.id, move), "voiceEvents").catch(warn("voice"));
  });

  client.on(Events.ChannelCreate, async (channel) => {
    if (isObfuscatedChannel(channel)) return;
    await sendGuildLog(client, channel.guild.id, channelEmbed("create", snapshot(channel)), "channelEvents").catch(warn("channel create"));
  });

  client.on(Events.ChannelDelete, async (channel) => {
    if (channel.isDMBased() || isObfuscatedChannel(channel)) return;
    await sendGuildLog(client, channel.guild.id, channelEmbed("delete", snapshot(channel)), "channelEvents").catch(warn("channel delete"));
  });

  client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
    if (oldChannel.isDMBased() || newChannel.isDMBased() || isObfuscatedChannel(newChannel)) return;
    const changes = channelChanges(snapshot(oldChannel), snapshot(newChannel));
    if (!changes.length) return;
    await sendGuildLog(client, newChannel.guild.id, channelEmbed("update", snapshot(newChannel), changes), "channelEvents").catch(warn("channel update"));
  });
}
