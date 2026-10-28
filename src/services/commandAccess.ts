/**
 * Pure permission rules for /help visibility and /userinfo moderator-only fields.
 * Permissions are plain bigint bitfields so this stays free of Discord imports.
 */

const ADMINISTRATOR = 1n << 3n;
const KICK_MEMBERS = 1n << 1n;
const BAN_MEMBERS = 1n << 2n;
const MANAGE_MESSAGES = 1n << 13n;
const MODERATE_MEMBERS = 1n << 40n;

/** Permissions that count as "moderation" for showing warn counts and trust scores. */
export const MODERATION_PERMISSION_BITS: readonly bigint[] = [
  KICK_MEMBERS,
  BAN_MEMBERS,
  MANAGE_MESSAGES,
  MODERATE_MEMBERS,
];

export function hasModerationPermissions(memberPermissions: bigint | null | undefined): boolean {
  if (memberPermissions == null) return false;
  if ((memberPermissions & ADMINISTRATOR) === ADMINISTRATOR) return true;
  return MODERATION_PERMISSION_BITS.some(bit => (memberPermissions & bit) === bit);
}

export interface CommandAccessInfo {
  guildOnly?: boolean;
  /** Bitfield of permissions the command declares for the invoking member. */
  userPermissions?: bigint;
  /** `default_member_permissions` from the command data (string bitfield) when set. */
  defaultMemberPermissions?: string | null;
  /** `dm_permission` from the command data; false hides the command in DMs. */
  dmPermission?: boolean | null;
}

export interface AccessContext {
  inGuild: boolean;
  /** The invoking member's resolved permissions, or null outside a guild. */
  memberPermissions: bigint | null;
}

/** Whether the invoking member could run this command where /help was used. */
export function canUseCommand(cmd: CommandAccessInfo, ctx: AccessContext): boolean {
  if (!ctx.inGuild) {
    if (cmd.guildOnly || cmd.dmPermission === false) return false;
    return !cmd.userPermissions;
  }

  const perms = ctx.memberPermissions ?? 0n;
  if ((perms & ADMINISTRATOR) === ADMINISTRATOR) return true;

  let required = cmd.userPermissions ?? 0n;
  if (cmd.defaultMemberPermissions != null && cmd.defaultMemberPermissions !== "") {
    try {
      const dmp = BigInt(cmd.defaultMemberPermissions);
      // "0" means admins only.
      if (dmp === 0n) return false;
      required |= dmp;
    } catch {
      // ignore malformed values
    }
  }
  return (perms & required) === required;
}

export interface SearchableCommand {
  name: string;
  description: string;
  category: string;
  subcommands?: readonly string[];
}

/**
 * Rank commands for the /help autocomplete: name prefix matches first, then name
 * contains, then description / category / subcommand matches; alphabetical within a tier.
 */
export function searchCommands<T extends SearchableCommand>(list: readonly T[], query: string, limit = 25): T[] {
  const q = query.trim().toLowerCase().replace(/^\//, "");
  const tier = (c: T): number => {
    if (!q) return 0;
    const name = c.name.toLowerCase();
    if (name.startsWith(q)) return 0;
    if (name.includes(q)) return 1;
    const hay = `${c.description} ${c.category} ${(c.subcommands ?? []).join(" ")}`.toLowerCase();
    return hay.includes(q) ? 2 : -1;
  };
  return list
    .map(c => ({ c, t: tier(c) }))
    .filter(x => x.t >= 0)
    .sort((a, b) => a.t - b.t || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map(x => x.c);
}
