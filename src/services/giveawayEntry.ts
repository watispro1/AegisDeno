/**
 * Giveaway entry, done in one atomic update so a double-click (or two
 * gateway deliveries) cannot both report "you are entered".
 */

export type EntryOutcome = "entered" | "already" | "closed";

export interface GiveawayEntryStore {
  /** Atomically apply `update` to the one document matching `filter`; null when none matched. */
  enter(filter: Record<string, unknown>, update: Record<string, unknown>): Promise<{ entrants?: string[] | null } | null>;
  /** Whether a giveaway matching `filter` exists. */
  exists(filter: Record<string, unknown>): Promise<boolean>;
}

/**
 * The filter only matches while the user is NOT yet an entrant, so of two
 * concurrent clicks exactly one update matches; the other sees no document
 * and is told it is already entered.
 */
export function entryFilter(guildId: string, messageId: string, userId: string): Record<string, unknown> {
  return { guildId, messageId, ended: false, entrants: { $ne: userId } };
}

export function entryUpdate(userId: string, isBooster: boolean): Record<string, unknown> {
  return {
    $addToSet: isBooster ? { entrants: userId, boosterEntrants: userId } : { entrants: userId },
  };
}

export async function enterGiveaway(
  store: GiveawayEntryStore,
  ids: { guildId: string; messageId: string; userId: string },
  isBooster: boolean,
): Promise<{ outcome: EntryOutcome; entrantCount: number | null }> {
  const updated = await store.enter(entryFilter(ids.guildId, ids.messageId, ids.userId), entryUpdate(ids.userId, isBooster));
  if (updated) return { outcome: "entered", entrantCount: updated.entrants?.length ?? null };
  const open = await store.exists({ guildId: ids.guildId, messageId: ids.messageId, ended: false });
  return { outcome: open ? "already" : "closed", entrantCount: null };
}

/** Entry requirements a giveaway can set; 0 or null means "no requirement". */
export interface GiveawayRequirements {
  requiredRoleId?: string | null;
  /** Discord account at least this many days old. */
  minAccountAgeDays?: number | null;
  /** In this server at least this many days. */
  minMemberDays?: number | null;
}

export interface EntrantFacts {
  hasRequiredRole: boolean;
  accountCreatedAt: Date;
  /** null when the member could not be fetched (left, or Discord did not say). */
  joinedAt: Date | null;
}

const DAY_MS = 86_400_000;

/** True when the giveaway needs the member object (role, server age or booster bonus). */
export function needsMemberLookup(req: GiveawayRequirements, boosterMultiplier: number): boolean {
  return Boolean(req.requiredRoleId) || (req.minMemberDays ?? 0) > 0 || boosterMultiplier > 1;
}

/** Why this member can't enter, or null when they can. Days left are rounded up. */
export function giveawayEntryBlock(req: GiveawayRequirements, facts: EntrantFacts, now = Date.now()): string | null {
  if (req.requiredRoleId && !facts.hasRequiredRole) return `❌ You need the <@&${req.requiredRoleId}> role to enter this giveaway.`;
  const minAccount = req.minAccountAgeDays ?? 0;
  if (minAccount > 0) {
    const ageMs = now - facts.accountCreatedAt.getTime();
    if (ageMs < minAccount * DAY_MS) {
      const left = Math.max(1, Math.ceil((minAccount * DAY_MS - ageMs) / DAY_MS));
      return `❌ Your Discord account must be at least **${minAccount} day${minAccount === 1 ? "" : "s"}** old to enter (${left} more day${left === 1 ? "" : "s"}).`;
    }
  }
  const minMember = req.minMemberDays ?? 0;
  if (minMember > 0) {
    if (!facts.joinedAt) return "❌ I couldn't check how long you've been in this server. Try again in a moment.";
    const inServerMs = now - facts.joinedAt.getTime();
    if (inServerMs < minMember * DAY_MS) {
      const left = Math.max(1, Math.ceil((minMember * DAY_MS - inServerMs) / DAY_MS));
      return `❌ You must have been in this server for at least **${minMember} day${minMember === 1 ? "" : "s"}** to enter (${left} more day${left === 1 ? "" : "s"}).`;
    }
  }
  return null;
}

/** Requirement lines for the giveaway embed (empty when there are none). */
export function requirementLines(req: GiveawayRequirements): string[] {
  const lines: string[] = [];
  if (req.requiredRoleId) lines.push(`> ⚠️ **Required Role:** <@&${req.requiredRoleId}>`);
  if ((req.minAccountAgeDays ?? 0) > 0) lines.push(`> 🗓️ **Account age:** at least ${req.minAccountAgeDays} day${req.minAccountAgeDays === 1 ? "" : "s"}`);
  if ((req.minMemberDays ?? 0) > 0) lines.push(`> 🏠 **In this server:** at least ${req.minMemberDays} day${req.minMemberDays === 1 ? "" : "s"}`);
  return lines;
}
