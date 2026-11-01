/**
 * A tiny event sink so other services (moderation cases, automod, purge) can
 * add to an active incident's timeline without importing Incident Mode, which
 * would create import cycles. Incident Mode installs the sink at startup;
 * until then, and when no incident is active, every call is a cheap no-op.
 */
import type { IncidentCounts, TimelineEvent } from "./incidentLogic";

type Sink = (guildId: string, event: TimelineEvent, inc?: Partial<IncidentCounts>, caseId?: string) => Promise<void> | void;

let sink: Sink | null = null;

export function setIncidentSink(fn: Sink | null): void {
  sink = fn;
}

/** A moderation case was recorded. */
export function noteIncidentCase(guildId: string, caseId: string | null, action: string, userId: string): void {
  if (!sink || !caseId) return;
  void Promise.resolve(sink(guildId, { at: new Date(), kind: "case", text: `Case ${caseId}: ${action} for ${userId}`, userId, caseId }, { cases: 1 }, caseId)).catch(() => undefined);
}

/** Messages were deleted (automod or purge). */
export function noteIncidentDeletes(guildId: string, count: number, source: string, userId?: string | null): void {
  if (!sink || !(count > 0)) return;
  void Promise.resolve(sink(guildId, { at: new Date(), kind: "delete", text: `${count} message(s) deleted by ${source}`, userId: userId ?? null }, { deleted: count })).catch(() => undefined);
}
