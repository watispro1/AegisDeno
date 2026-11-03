/**
 * A small sink so the case and warning services can say "this member's Trust
 * Score may have changed" without importing the trust or Discord layers.
 * lowTrustSync installs the sink at startup; until then every call is a
 * cheap no-op, which is also what the unit tests see.
 */
type Sink = (guildId: string, userId: string) => void;

let sink: Sink | null = null;

export function setTrustChangeSink(fn: Sink | null): void {
  sink = fn;
}

/** A case or warning for this member was added, revoked or removed. */
export function noteTrustChange(guildId: string, userId: string | null | undefined): void {
  if (!sink || !userId) return;
  try {
    sink(guildId, userId);
  } catch {
    // The sink only queues work; a failure there must never break the moderation action.
  }
}
