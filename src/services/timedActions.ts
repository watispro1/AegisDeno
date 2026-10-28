/**
 * Pure helpers for timed actions persisted through the Mongo-backed scheduler
 * (`ScheduledTask` documents). Kept free of Discord/Mongo imports so they can
 * be unit-tested directly.
 */

/** Largest delay Node's setTimeout honours (~24.8 days); longer values fire after 1 ms. */
export const MAX_TIMEOUT_MS = 2_147_483_647;

/**
 * Work out how long to wait before the next timer tick for a task due at `executeAt`.
 * `final` is false when the delay had to be chunked and the task must be re-armed
 * rather than executed when the timer fires.
 */
export function nextTimerDelay(executeAtMs: number, nowMs: number): { waitMs: number; final: boolean } {
  const remaining = Math.max(0, executeAtMs - nowMs);
  if (remaining > MAX_TIMEOUT_MS) return { waitMs: MAX_TIMEOUT_MS, final: false };
  return { waitMs: remaining, final: true };
}

// ─── /remindme ───────────────────────────────────────────────────────────────

export interface PersonalReminderPayload {
  /** What the user asked to be reminded about. */
  text: string;
  /** Also ping the user in the channel the reminder was set from. */
  inChannel: boolean;
  /** Guild name (or "Direct Message") shown in the DM. */
  sourceName: string;
  /** When the reminder was created (epoch ms). */
  setAt: number;
}

export function encodePersonalReminder(payload: PersonalReminderPayload): string {
  return JSON.stringify(payload);
}

export function decodePersonalReminder(raw: string): PersonalReminderPayload | null {
  try {
    const obj: unknown = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    const o = obj as Record<string, unknown>;
    if (typeof o.text !== "string" || o.text.length === 0) return null;
    return {
      text: o.text,
      inChannel: o.inChannel === true,
      sourceName: typeof o.sourceName === "string" ? o.sourceName : "Direct Message",
      setAt: typeof o.setAt === "number" && Number.isFinite(o.setAt) ? o.setAt : Date.now(),
    };
  } catch {
    return null;
  }
}

// ─── /lock auto-unlock ───────────────────────────────────────────────────────

export interface ChannelUnlockPayload {
  /** Tag of the moderator who locked the channel. */
  moderatorTag: string;
  /** Lock duration in minutes, for the log and channel notice. */
  durationMinutes: number;
}

export function encodeChannelUnlock(payload: ChannelUnlockPayload): string {
  return JSON.stringify(payload);
}

export function decodeChannelUnlock(raw: string): ChannelUnlockPayload {
  try {
    const obj: unknown = JSON.parse(raw);
    if (obj && typeof obj === "object") {
      const o = obj as Record<string, unknown>;
      return {
        moderatorTag: typeof o.moderatorTag === "string" ? o.moderatorTag : "Unknown",
        durationMinutes: typeof o.durationMinutes === "number" ? o.durationMinutes : 0,
      };
    }
  } catch {
    // fall through
  }
  // An unlock must still happen even if the payload is unreadable.
  return { moderatorTag: "Unknown", durationMinutes: 0 };
}
