/**
 * Giveaway state transitions (end, reroll), each guarded by an atomic
 * conditional update so that of two concurrent transitions exactly one wins.
 *
 * Lifecycle of the guard fields:
 *   running       ended:false
 *   ending        ended:true,  winnersDrawn:false   (claimed by one end; winners being drawn)
 *   ended         ended:true,  winnersDrawn:true,  rerollSeq:N
 * Older documents have neither field; they count as fully ended with rerollSeq 0.
 *
 * - End claims `ended:false → ended:true, winnersDrawn:false` in one step, so a
 *   second end (button, command, dashboard or the scheduler's auto-end) finds
 *   nothing to claim. Winners are then written only while `winnersDrawn:false`,
 *   so they can never overwrite a reroll.
 * - Reroll refuses an "ending" giveaway and swaps winners only while
 *   `rerollSeq` still holds the value it read, bumping it in the same update.
 */

export interface TransitionGiveaway {
  guildId: string;
  messageId: string;
  ended?: boolean | null;
  winnersDrawn?: boolean | null;
  rerollSeq?: number | null;
  entrants?: string[] | null;
  boosterEntrants?: string[] | null;
  boosterMultiplier?: number | null;
  winners?: string[] | null;
  previousWinners?: string[] | null;
  winnerCount?: number | null;
  [key: string]: unknown;
}

export interface GiveawayTransitionStore {
  /** Atomically apply `update` to the one document matching `filter`; return it AFTER the update, or null. */
  update(filter: Record<string, unknown>, update: Record<string, unknown>): Promise<TransitionGiveaway | null>;
  /** Read the document matching `filter`, or null. */
  find(filter: Record<string, unknown>): Promise<TransitionGiveaway | null>;
}

export type DrawFn = (giveaway: TransitionGiveaway, count: number, excludePast: boolean) => string[];

export type TransitionResult =
  | { ok: true; giveaway: TransitionGiveaway; winners: string[] }
  | { ok: false; error: string };

export const TRANSITION_MESSAGES = {
  notFound: "No active giveaway found with that message ID.",
  alreadyEnded: "This giveaway has already ended. Its winners stay as drawn; use Reroll if you want new ones.",
  ending: "This giveaway is ending right now. Give it a moment, then check the channel for the winners.",
  notEnded: "No completed giveaway found with that message ID.",
  nobodyLeft: "Every entrant has already won this giveaway; there is nobody new to draw.",
  rerollRace: "Someone else rerolled or ended this giveaway a moment ago. Check the channel for the current winners.",
} as const;

export function endClaimFilter(guildId: string, messageId: string): Record<string, unknown> {
  return { guildId, messageId, ended: false };
}

export function endClaimUpdate(now: Date): Record<string, unknown> {
  return { $set: { ended: true, endedAt: now, winnersDrawn: false } };
}

export function finalizeFilter(guildId: string, messageId: string): Record<string, unknown> {
  return { guildId, messageId, ended: true, winnersDrawn: false };
}

export function finalizeUpdate(winners: string[]): Record<string, unknown> {
  return { $set: { winners, winnersDrawn: true, rerollSeq: 0 } };
}

/** Matches only a fully ended giveaway whose reroll counter still reads `seq` (missing counts as 0). */
export function rerollFilter(guildId: string, messageId: string, seq: number): Record<string, unknown> {
  return {
    guildId,
    messageId,
    ended: true,
    winnersDrawn: { $ne: false },
    rerollSeq: seq === 0 ? { $in: [0, null] } : seq,
  };
}

export function rerollUpdate(previous: string[], winners: string[], seq: number): Record<string, unknown> {
  return {
    $set: { winners, rerollSeq: seq + 1 },
    $addToSet: { previousWinners: { $each: previous } },
  };
}

/** Draw and store winners for a giveaway this caller has claimed (or one left half-ended by a crash). */
export async function finalizeEnd(
  store: GiveawayTransitionStore,
  claimed: TransitionGiveaway,
  draw: DrawFn,
): Promise<TransitionResult> {
  const winners = draw(claimed, claimed.winnerCount ?? 1, false);
  const done = await store.update(finalizeFilter(claimed.guildId, claimed.messageId), finalizeUpdate(winners));
  if (!done) return { ok: false, error: TRANSITION_MESSAGES.alreadyEnded };
  return { ok: true, giveaway: done, winners };
}

/** End a running giveaway. Exactly one of several concurrent callers gets ok:true. */
export async function endTransition(
  store: GiveawayTransitionStore,
  ids: { guildId: string; messageId: string },
  draw: DrawFn,
  now: Date = new Date(),
): Promise<TransitionResult> {
  // The claim returns the document after `ended` flipped, so its entrant list
  // is final: entry only matches `ended:false`.
  const claimed = await store.update(endClaimFilter(ids.guildId, ids.messageId), endClaimUpdate(now));
  if (!claimed) {
    const current = await store.find({ guildId: ids.guildId, messageId: ids.messageId });
    if (!current) return { ok: false, error: TRANSITION_MESSAGES.notFound };
    return { ok: false, error: current.winnersDrawn === false ? TRANSITION_MESSAGES.ending : TRANSITION_MESSAGES.alreadyEnded };
  }
  return finalizeEnd(store, claimed, draw);
}

/** Reroll an ended giveaway. Concurrent rerolls (or a reroll racing an end) cannot both win. */
export async function rerollTransition(
  store: GiveawayTransitionStore,
  ids: { guildId: string; messageId: string },
  count: number | null,
  draw: DrawFn,
): Promise<TransitionResult> {
  const current = await store.find({ guildId: ids.guildId, messageId: ids.messageId, ended: true });
  if (!current) return { ok: false, error: TRANSITION_MESSAGES.notEnded };
  if (current.winnersDrawn === false) return { ok: false, error: TRANSITION_MESSAGES.ending };

  const seq = current.rerollSeq ?? 0;
  const winners = draw(current, count ?? current.winnerCount ?? 1, true);
  if (winners.length === 0) return { ok: false, error: TRANSITION_MESSAGES.nobodyLeft };

  const swapped = await store.update(
    rerollFilter(ids.guildId, ids.messageId, seq),
    rerollUpdate(current.winners ?? [], winners, seq),
  );
  if (!swapped) return { ok: false, error: TRANSITION_MESSAGES.rerollRace };
  return { ok: true, giveaway: swapped, winners };
}
