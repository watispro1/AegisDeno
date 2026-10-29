/**
 * What the dashboard needs from the live bot client, behind a small interface
 * so the routes can be exercised in tests with a fake.
 */
import { ChannelType, PermissionFlagsBits, type Client, type Guild } from "discord.js";
import { logger } from "../../utils/logger";
import { canManageGuild } from "./permissions";

export interface GuildSummary {
  id: string;
  name: string;
  memberCount: number;
}

export interface ChannelOption {
  id: string;
  name: string;
  /** Category name, for grouping in pickers. */
  parent: string | null;
}

export interface RoleOption {
  id: string;
  name: string;
  /** False for @everyone, managed roles, and roles at or above the bot's top role. */
  assignable: boolean;
}

export interface BotView {
  hasGuild(guildId: string): boolean;
  guild(guildId: string): GuildSummary | null;
  /**
   * Re-checks with the live client that the user is the owner or holds
   * Administrator / Manage Server right now. Fails closed on any error.
   */
  memberCanManage(guildId: string, userId: string): Promise<boolean>;
  /** Text and announcement channels, in server order. */
  textChannels(guildId: string): ChannelOption[];
  /** Roles from highest to lowest, without @everyone. */
  roles(guildId: string): RoleOption[];
  /** A username from the bot's user cache, for showing names next to IDs. */
  userName(userId: string): string | null;
}

function sortChannels(guild: Guild) {
  return [...guild.channels.cache.values()]
    .filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement)
    .sort((a, b) => {
      const pa = "parent" in a && a.parent ? a.parent.position : -1;
      const pb = "parent" in b && b.parent ? b.parent.position : -1;
      if (pa !== pb) return pa - pb;
      const ra = "rawPosition" in a ? Number(a.rawPosition) : 0;
      const rb = "rawPosition" in b ? Number(b.rawPosition) : 0;
      return ra - rb;
    });
}

export function discordBotView(client: Client): BotView {
  const get = (guildId: string): Guild | null => client?.guilds?.cache?.get(guildId) ?? null;

  return {
    hasGuild: (guildId) => Boolean(get(guildId)),

    guild(guildId) {
      const g = get(guildId);
      return g ? { id: g.id, name: g.name ?? "Unknown server", memberCount: g.memberCount ?? 0 } : null;
    },

    async memberCanManage(guildId, userId) {
      const g = get(guildId);
      if (!g) return false;
      if (g.ownerId === userId) return true;
      try {
        // The GuildMembers intent keeps cached members current; uncached members come from the API.
        const member = await g.members.fetch(userId);
        return canManageGuild(member.permissions.bitfield, g.ownerId === member.id);
      } catch (err) {
        logger.debug(`Dashboard permission check failed for a member of guild ${guildId}: ${(err as Error)?.message ?? err}`);
        return false;
      }
    },

    textChannels(guildId) {
      const g = get(guildId);
      if (!g) return [];
      return sortChannels(g).map(c => ({
        id: c.id,
        name: c.name,
        parent: "parent" in c && c.parent ? c.parent.name : null,
      }));
    },

    roles(guildId) {
      const g = get(guildId);
      if (!g) return [];
      const me = g.members.me;
      const top = me?.roles.highest.position ?? 0;
      const canManageRoles = me?.permissions.has(PermissionFlagsBits.ManageRoles) ?? false;
      return [...g.roles.cache.values()]
        .filter(r => r.id !== g.id)
        .sort((a, b) => b.position - a.position)
        .map(r => ({
          id: r.id,
          name: r.name,
          assignable: canManageRoles && !r.managed && r.position < top,
        }));
    },

    userName(userId) {
      return client?.users?.cache?.get(userId)?.username ?? null;
    },
  };
}
