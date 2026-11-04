/**
 * /remindme edit: work out the new reminder from what the user changed. Pure,
 * so every rule (limits, repeat on and off, nothing changed) is unit-tested.
 */
import { reminderRepeatIntervalMs, type PersonalReminderPayload, type ReminderRepeat } from "./timedActions";

export const REMINDER_MIN_SECONDS = 10;
export const REMINDER_MAX_DAYS = 365;
export const REMINDER_TEXT_MAX = 512;

export interface ReminderEditInput {
  text: string | null;
  /** Seconds from now, already parsed; null when the time is unchanged. */
  durationSec: number | null;
  /** "none" turns repeating off; null leaves it as it is. */
  repeat: ReminderRepeat | "none" | null;
}

export type ReminderEditPlan =
  | { ok: true; payload: PersonalReminderPayload; executeAt?: Date; intervalMs?: number | null; changes: string[] }
  | { ok: false; error: string };

export function planReminderEdit(current: PersonalReminderPayload, input: ReminderEditInput, now = Date.now()): ReminderEditPlan {
  if (input.text === null && input.durationSec === null && input.repeat === null) {
    return { ok: false, error: "Change at least one of `reminder`, `duration` or `repeat`." };
  }
  const changes: string[] = [];
  const payload: PersonalReminderPayload = { ...current };
  if (input.text !== null) {
    const text = input.text.trim();
    if (!text) return { ok: false, error: "The reminder text can't be empty." };
    if (text.length > REMINDER_TEXT_MAX) return { ok: false, error: `Keep the reminder under ${REMINDER_TEXT_MAX} characters.` };
    payload.text = text;
    changes.push("text");
  }
  let executeAt: Date | undefined;
  if (input.durationSec !== null) {
    if (input.durationSec < REMINDER_MIN_SECONDS) return { ok: false, error: "Use a duration like `30m`, `2h` or `1d`. The minimum is 10 seconds." };
    if (input.durationSec > REMINDER_MAX_DAYS * 86_400) return { ok: false, error: `Reminders can't be set more than ${REMINDER_MAX_DAYS} days ahead.` };
    executeAt = new Date(now + input.durationSec * 1000);
    changes.push("time");
  }
  let intervalMs: number | null | undefined;
  if (input.repeat !== null) {
    if (input.repeat === "none") delete payload.repeat;
    else payload.repeat = input.repeat;
    intervalMs = reminderRepeatIntervalMs(payload.repeat);
    changes.push("repeat");
  }
  return { ok: true, payload, ...(executeAt ? { executeAt } : {}), ...(intervalMs !== undefined ? { intervalMs } : {}), changes };
}
