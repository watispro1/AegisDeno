/**
 * Incident Mode's Discord side: reads channel state, edits slowmode and the
 * @everyone overwrite, pauses invites, gates joins, and posts to the mod log.
 * Hidden channels (Discord obfuscated them because Aegis lacks View Channel)
 * are never read, listed, or edited. Also builds the process-wide service.
 */
import { ChannelType, GuildFeature, PermissionFlagsBits, type Client, type Guild, type GuildBasedChannel, type GuildMember } from "discord.js";
import { isObfuscatedChannel } from "../utils/channels";
import { logger } from "../utils/logger";
import { sendGuildLog } from "./logging";
import { addModerationCase } from "./moderationCases";
import { getGuildConfig } from "./configuration";
import { dashboardUrl } from "../config/links";
import { setIncidentSink } from "./incidentHooks";
import { createIncidentService, type IncidentOps, type IncidentService } from "./incidentService";
import { mongoIncidentStore } from "./incidentStore";
import type { ChannelSnapshot, SendState } from "./incidentLogic";

const SEND = PermissionFlagsBits.SendMessages;

type OverwriteChannel = Extract<GuildBasedChannel, { permissionOverwrites: unknown }>;

function kindOf(c: GuildBasedChannel): ChannelSnapshot["kind"] {
  if (c.type === ChannelType.GuildText) return "text";
  if (c.type === ChannelType.GuildAnnouncement) return "announcement";
  return "other";
}

/** Reads one channel the way Incident Mode needs it. Exported for tests with fake channels. */
export function snapshotChannel(guild: Guild, c: GuildBasedChannel): ChannelSnapshot | null {
  if (c.isThread() || c.type === ChannelType.GuildCategory || !("permissionOverwrites" in c)) return null;
  const hidden = isObfuscatedChannel(c);
  const me = guild.members.me;
  const everyone = guild.roles.everyone;
  const perms = !hidden && me ? (c as OverwriteChannel).permissionsFor(me) : null;
  const everyonePerms = !hidden ? (c as OverwriteChannel).permissionsFor(everyone) : null;
  const ow = !hidden ? (c as OverwriteChannel).permissionOverwrites.cache.get(everyone.id) : undefined;
  const send: SendState = ow?.deny.has(SEND) ? "deny" : ow?.allow.has(SEND) ? "allow" : "neutral";
  return {
    id: c.id,
    name: hidden ? "hidden" : c.name,
    kind: kindOf(c),
    hidden,
    isPublic: Boolean(everyonePerms?.has(PermissionFlagsBits.ViewChannel)),
    canEditChannel: Boolean(perms?.has(PermissionFlagsBits.ManageChannels)),
    canEditOverwrites: Boolean(perms?.has(PermissionFlagsBits.ManageChannels) && perms.has(PermissionFlagsBits.ManageRoles)),
    rateLimitPerUser: "rateLimitPerUser" in c && typeof c.rateLimitPerUser === "number" ? c.rateLimitPerUser : 0,
    everyoneSend: send,
    hasEveryoneOverwrite: Boolean(ow),
    everyoneOverwriteOnlySendDeny: Boolean(ow && ow.allow.bitfield === 0n && ow.deny.bitfield === SEND),
  };
}

/** Whether Aegis may act on a newly joined member (not the owner, and below Aegis's highest role). */
export function joinActionable(member: GuildMember, action: "timeout" | "kick"): boolean {
  if (member.id === member.guild.ownerId) return false;
  return action === "kick" ? member.kickable : member.moderatable;
}

export function discordIncidentOps(client: Client): IncidentOps {
  const guild = (id: string) => client.guilds.cache.get(id) ?? null;
  const channel = (guildId: string, channelId: string): OverwriteChannel => {
    const c = guild(guildId)?.channels.cache.get(channelId);
    if (!c || isObfuscatedChannel(c) || !("permissionOverwrites" in c)) throw new Error("channel unavailable");
    return c as OverwriteChannel;
  };
  return {
    async snapshotChannels(guildId) {
      const g = guild(guildId);
      if (!g) return [];
      return [...g.channels.cache.values()].map(c => snapshotChannel(g, c)).filter((c): c is ChannelSnapshot => c !== null);
    },
    async setSlowmode(guildId, channelId, seconds, reason) {
      const c = channel(guildId, channelId);
      if (!("setRateLimitPerUser" in c)) throw new Error("no slowmode");
      await (c as unknown as { setRateLimitPerUser(s: number, r?: string): Promise<unknown> }).setRateLimitPerUser(seconds, reason);
    },
    async setEveryoneSend(guildId, channelId, change, reason) {
      const g = guild(guildId);
      if (!g) throw new Error("guild unavailable");
      const c = channel(guildId, channelId);
      if (change.kind === "delete") await c.permissionOverwrites.delete(g.roles.everyone, reason);
      else await c.permissionOverwrites.edit(g.roles.everyone, { SendMessages: change.value }, { reason });
    },
    invitesState(guildId) {
      const g = guild(guildId);
      if (!g) return null;
      return {
        disabled: g.features.includes(GuildFeature.InvitesDisabled),
        canChange: Boolean(g.members.me?.permissions.has(PermissionFlagsBits.ManageGuild)),
      };
    },
    async setInvitesDisabled(guildId, disabled) {
      const g = guild(guildId);
      if (!g) throw new Error("guild unavailable");
      await g.disableInvites(disabled);
    },
    async postModLog(guildId, message) {
      await sendGuildLog(client, guildId, { title: message.title, description: message.description, color: message.color, fields: message.fields }, "modActions");
    },
    async gateMember(guildId, userId, action, minutes, reason) {
      const g = guild(guildId);
      const member = g ? await g.members.fetch(userId) : null;
      if (!member) throw new Error("member unavailable");
      if (!joinActionable(member, action)) throw new Error("member above Aegis");
      if (action === "kick") await member.kick(reason);
      else await member.timeout(minutes * 60_000, reason);
    },
    async recordCase(guildId, userId, action, reason, details) {
      return addModerationCase({ guildId, userId, moderatorId: client.user?.id ?? "Aegis", action, reason, details });
    },
    botUserId: () => client.user?.id ?? "0",
  };
}

let service: IncidentService | null = null;

/** The process-wide Incident Mode service; created on first use with the live client. */
export function incidentService(client: Client): IncidentService {
  if (service) return service;
  service = createIncidentService({
    store: mongoIncidentStore(),
    ops: discordIncidentOps(client),
    getConfig: async (guildId) => (await getGuildConfig(guildId)).incident!,
    reportUrl: (guildId, id) => `${dashboardUrl(guildId)}/incident/${id}`,
    log: logger,
  });
  const svc = service;
  setIncidentSink((guildId, ev, inc, caseId) => svc.record(guildId, ev, inc, caseId));
  return service;
}

/** For tests: forget the singleton. */
export function resetIncidentServiceForTests(): void {
  service = null;
  setIncidentSink(null);
}
