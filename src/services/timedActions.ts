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
  /** Repeating reminders re-fire on this cadence until cancelled. Omitted for one-off reminders. */
  repeat?: ReminderRepeat;
}

export type ReminderRepeat = "daily" | "weekly";

const DAY_MS = 86_400_000;

/** Interval for a repeating reminder, or null for a one-off. */
export function reminderRepeatIntervalMs(repeat: string | null | undefined): number | null {
  if (repeat === "daily") return DAY_MS;
  if (repeat === "weekly") return 7 * DAY_MS;
  return null;
}

/** Snooze lengths offered on a delivered reminder, in minutes. */
export const SNOOZE_OPTIONS_MINUTES = [10, 60] as const;

export const REMINDER_SNOOZE_PREFIX = "remindsnooze_";

export function reminderSnoozeCustomId(userId: string, minutes: number): string {
  return `${REMINDER_SNOOZE_PREFIX}${userId}_${minutes}`;
}

/** Parse a snooze button id; only the offered lengths are accepted. */
export function parseReminderSnoozeCustomId(customId: string): { userId: string; minutes: number } | null {
  const m = /^remindsnooze_(\d{1,20})_(\d{1,4})$/.exec(customId);
  if (!m) return null;
  const minutes = Number(m[2]);
  if (!(SNOOZE_OPTIONS_MINUTES as readonly number[]).includes(minutes)) return null;
  return { userId: m[1], minutes };
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
    const payload: PersonalReminderPayload = {
      text: o.text,
      inChannel: o.inChannel === true,
      sourceName: typeof o.sourceName === "string" ? o.sourceName : "Direct Message",
      setAt: typeof o.setAt === "number" && Number.isFinite(o.setAt) ? o.setAt : Date.now(),
    };
    if (o.repeat === "daily" || o.repeat === "weekly") payload.repeat = o.repeat;
    return payload;
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
