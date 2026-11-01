/**
 * What the dashboard needs from the live bot client, behind a small interface
 * so the routes can be exercised in tests with a fake.
 */
import { ChannelType, PermissionFlagsBits, type Client, type Guild } from "discord.js";
import { logger } from "../../utils/logger";
import { canManageGuild } from "./permissions";
import { isObfuscatedChannel } from "../../utils/channels";
import { memberTopRolePosition, roleAboveActor } from "../../permissions/hierarchy";
import { guildIconUrl } from "./cdn";

export interface GuildSummary {
  id: string;
  name: string;
  memberCount: number;
  /** Discord CDN icon URL, when the server has an icon. */
  iconUrl?: string | null;
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
  /** Position in the server's role list (higher is more powerful). */
  position: number;
  /** False for @everyone, managed roles, and roles at or above the bot's top role. */
  assignable: boolean;
  /**
   * True when the role is at or above the dashboard viewer's own highest role
   * (never for the server owner). Set per request by the route kit; the bot
   * view itself leaves it unset.
   */
  aboveViewer?: boolean;
}

/**
 * The dashboard viewer's place in the role list, for the same rule
 * /rolepanel create and /verify setup apply: a role handed out by a panel or
 * on join must sit below the viewer's highest role unless they own the server.
 */
export interface ViewerRoleLimit {
  /** The server owner's ID (or null when unknown). */
  ownerId: string | null;
  /** Position of the viewer's highest role, or null when they could not be fetched (fails closed). */
  topPosition: number | null;
}

/** Extra permissions some dashboard actions need, matching their slash commands. */
export type DashboardPermission = "BanMembers" | "KickMembers" | "ManageChannels" | "ManageRoles" | "ManageMessages" | "ModerateMembers";

export const DASHBOARD_PERMISSION_LABELS: Record<DashboardPermission, string> = {
  BanMembers: "Ban Members",
  KickMembers: "Kick Members",
  ManageChannels: "Manage Channels",
  ManageRoles: "Manage Roles",
  ManageMessages: "Manage Messages",
  ModerateMembers: "Moderate Members",
};

export interface BotView {
  hasGuild(guildId: string): boolean;
  guild(guildId: string): GuildSummary | null;
  /**
   * Re-checks with the live client that the user is the owner or holds
   * Administrator / Manage Server right now. Fails closed on any error.
   */
  memberCanManage(guildId: string, userId: string): Promise<boolean>;
  /**
   * Live check for one extra permission (Ban Members, Manage Channels, Manage
   * Roles), the same one the matching slash command requires. Owner and
   * Administrator always pass. Fails closed on any error.
   */
  memberHasPermission(guildId: string, userId: string, permission: DashboardPermission): Promise<boolean>;
  /**
   * Text and announcement channels Aegis can see, in server order. Channels
   * Discord has obfuscated (Aegis lacks View Channel) are left out.
   */
  textChannels(guildId: string): ChannelOption[];
  /**
   * IDs of channels Discord has obfuscated for Aegis (it lacks View Channel),
   * so a saved channel that became hidden can be told apart from a deleted one.
   */
  hiddenChannelIds(guildId: string): ReadonlySet<string>;
  /** Roles from highest to lowest, without @everyone. */
  roles(guildId: string): RoleOption[];
  /**
   * The viewer's highest role position and the server owner, fetched live
   * (member cache first). Fails closed: topPosition is null on any error.
   */
  viewerRoleLimit(guildId: string, userId: string): Promise<ViewerRoleLimit>;
  /** A username from the bot's user cache, for showing names next to IDs. */
  userName(userId: string): string | null;
  /**
   * Server-wide permissions Aegis's own role lacks (labels, the same list
   * /diagnostics checks). Optional so test fakes need not implement it.
   */
  botMissingPermissions?(guildId: string): string[];
}

/** What /diagnostics checks, in its order. */
export const BOT_PERMISSION_CHECKS: ReadonlyArray<[keyof typeof PermissionFlagsBits, string]> = [
  ["ViewChannel", "View Channels"],
  ["SendMessages", "Send Messages"],
  ["EmbedLinks", "Embed Links"],
  ["ManageMessages", "Manage Messages"],
  ["ModerateMembers", "Moderate Members"],
  ["BanMembers", "Ban Members"],
  ["KickMembers", "Kick Members"],
  ["ViewAuditLog", "View Audit Log"],
  ["ManageChannels", "Manage Channels"],
  ["ManageRoles", "Manage Roles"],
  ["ReadMessageHistory", "Read Message History"],
];

function sortChannels(guild: Guild) {
  return [...guild.channels.cache.values()]
    .filter(c => !isObfuscatedChannel(c) && (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement))
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
      return g ? { id: g.id, name: g.name ?? "Unknown server", memberCount: g.memberCount ?? 0, iconUrl: guildIconUrl(g.id, g.icon) } : null;
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

    async memberHasPermission(guildId, userId, permission) {
      const g = get(guildId);
      if (!g) return false;
      if (g.ownerId === userId) return true;
      try {
        const member = await g.members.fetch(userId);
        return member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits[permission]);
      } catch (err) {
        logger.debug(`Dashboard permission check (${permission}) failed in guild ${guildId}: ${(err as Error)?.message ?? err}`);
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

    hiddenChannelIds(guildId) {
      const g = get(guildId);
      if (!g) return new Set<string>();
      return new Set([...g.channels.cache.values()].filter(c => isObfuscatedChannel(c)).map(c => c.id));
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
          position: r.position,
          assignable: canManageRoles && !r.managed && r.position < top,
        }));
    },

    async viewerRoleLimit(guildId, userId) {
      const g = get(guildId);
      if (!g) return { ownerId: null, topPosition: null };
      try {
        return { ownerId: g.ownerId ?? null, topPosition: await memberTopRolePosition(g, userId) };
      } catch (err) {
        logger.debug(`Dashboard role position lookup failed in guild ${guildId}: ${(err as Error)?.message ?? err}`);
        return { ownerId: g.ownerId ?? null, topPosition: null };
      }
    },

    userName(userId) {
      return client?.users?.cache?.get(userId)?.username ?? null;
    },

    botMissingPermissions(guildId) {
      const me = get(guildId)?.members.me;
      if (!me) return [];
      if (me.permissions.has(PermissionFlagsBits.Administrator)) return [];
      return BOT_PERMISSION_CHECKS.filter(([flag]) => !me.permissions.has(PermissionFlagsBits[flag])).map(([, label]) => label);
    },
  };
}

/**
 * Marks each role the viewer may not pick (aboveViewer), using the same rule
 * as /rolepanel create and /verify setup (roleAboveActor): the server owner
 * may pick any role; everyone else, Administrators included, only roles
 * strictly below their own highest role. An unresolved viewer gets nothing.
 */
export function markRolesForViewer(roles: readonly RoleOption[], viewerId: string, limit: ViewerRoleLimit | undefined): RoleOption[] {
  return roles.map(r => ({
    ...r,
    aboveViewer: roleAboveActor({
      ownerId: limit?.ownerId ?? "",
      actorId: viewerId,
      actorTopPosition: limit?.topPosition ?? null,
      roles: [r],
    }) !== null,
  }));
}

/** Whether the viewer can hand out this role through the dashboard: Aegis can assign it and it is below the viewer. */
export function rolePickable(role: RoleOption): boolean {
  return role.assignable && !role.aboveViewer;
}
