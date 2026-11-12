/**
 * Clear "why not" text for a refused moderation action. The checks themselves
 * stay in hierarchy.ts (isRoleHierarchyValid / isBotHierarchyValid); this only
 * explains a refusal they already made, naming the roles involved and how to
 * fix it, instead of a bare "role hierarchy" message.
 */
import type { Guild } from "discord.js";

export interface RoleRef {
  name: string;
  position: number;
}

export interface HierarchyRefusalInput {
  /** "ban", "kick", "timeout", "warn". */
  action: string;
  who: "you" | "bot";
  ownerId: string;
  actorId: string;
  targetId: string;
  targetName: string;
  /** Top roles; null when the member could not be loaded. */
  actorTop: RoleRef | null;
  targetTop: RoleRef | null;
}

function roleLabel(role: RoleRef): string {
  return role.name === "@everyone" ? "@everyone (no roles)" : `**@${role.name.slice(0, 80)}**`;
}

/** The explanation for a refusal. Pure. */
export function explainHierarchyRefusal(input: HierarchyRefusalInput): string {
  const { action, who, targetName } = input;
  const subject = who === "you" ? "You can't" : "I can't";
  if (input.actorId === input.targetId) return who === "you" ? `❌ You can't ${action} yourself.` : `❌ I can't ${action} myself.`;
  if (input.targetId === input.ownerId) return `❌ ${subject} ${action} **${targetName}**: they own this server, and Discord lets nobody act on the owner.`;
  if (!input.actorTop || !input.targetTop) {
    return `❌ ${subject} ${action} **${targetName}** right now: I couldn't load ${!input.targetTop ? "their" : who === "you" ? "your" : "my"} roles to compare. Try again in a moment.`;
  }
  const same = input.actorTop.position === input.targetTop.position;
  const where = same
    ? `their highest role is the same as ${who === "you" ? "yours" : "mine"}, ${roleLabel(input.targetTop)}`
    : `their highest role ${roleLabel(input.targetTop)} is above ${who === "you" ? "yours" : "mine"}, ${roleLabel(input.actorTop)}`;
  const fix = who === "you"
    ? "A moderator with a higher role can do it, or an admin can move your role up in Server Settings → Roles."
    : `To let me, drag my role ${roleLabel(input.actorTop)} above ${roleLabel(input.targetTop)} in Server Settings → Roles.`;
  return `❌ ${subject} ${action} **${targetName}**: ${where}. ${fix}`;
}

/** Load the roles and explain. Never throws; falls back to a short message. */
export async function hierarchyRefusalText(guild: Guild, who: "you" | "bot", actorId: string, targetId: string, action: string, targetName: string): Promise<string> {
  try {
    const [actor, target] = await Promise.all([
      guild.members.fetch(actorId).catch(() => null),
      guild.members.fetch(targetId).catch(() => null),
    ]);
    const top = (m: typeof actor): RoleRef | null => (m ? { name: m.roles.highest.name, position: m.roles.highest.position } : null);
    return explainHierarchyRefusal({
      action, who, ownerId: guild.ownerId, actorId, targetId, targetName, actorTop: top(actor), targetTop: top(target),
    });
  } catch {
    return who === "you"
      ? `❌ You can't ${action} this member: they have a higher or equal role.`
      : `❌ I can't ${action} this member: they are above my highest role.`;
  }
}
