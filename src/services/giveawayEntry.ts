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
