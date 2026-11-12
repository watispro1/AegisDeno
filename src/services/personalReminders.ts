/**
 * Creating and listing `/remindme` reminders, shared by the slash command and
 * the "Remind Me About This" message context menu. The checks are pure so
 * the limits are unit-tested; createPersonalReminder saves and arms the task.
 */
import type { Client } from "discord.js";
import { createTask, getTasksForCreator, type ScheduledTask } from "./scheduler";
import { scheduleTask } from "./schedulerRunner";
import { decodePersonalReminder, encodePersonalReminder, reminderRepeatIntervalMs, type ReminderRepeat } from "./timedActions";
import { REMINDER_MAX_DAYS, REMINDER_MIN_SECONDS, REMINDER_TEXT_MAX } from "./reminderEdit";

/** Pending reminders a single user may hold; they are persisted, so keep it bounded. */
export const MAX_PENDING_PER_USER = 25;

/** Duration presets offered by autocomplete. */
export const REMINDER_DURATION_PRESETS = [
  { name: "10 minutes", value: "10m" },
  { name: "30 minutes", value: "30m" },
  { name: "1 hour", value: "1h" },
  { name: "2 hours", value: "2h" },
  { name: "4 hours", value: "4h" },
  { name: "8 hours", value: "8h" },
  { name: "12 hours", value: "12h" },
  { name: "1 day (tomorrow)", value: "1d" },
  { name: "3 days", value: "3d" },
  { name: "1 week", value: "1w" },
] as const;

export const REMINDER_BOUNDS = { minSeconds: REMINDER_MIN_SECONDS, maxSeconds: REMINDER_MAX_DAYS * 86_400 } as const;

/** Why a new reminder can't be set, or null when it can. Pure. */
export function reminderRequestProblem(input: { text: string; durationSec: number | null; pending: number }): string | null {
  if (!input.text.trim()) return "The reminder text can't be empty.";
  if (input.text.length > REMINDER_TEXT_MAX) return `Keep the reminder under ${REMINDER_TEXT_MAX} characters.`;
  if (!input.durationSec || input.durationSec < REMINDER_MIN_SECONDS) return "Invalid duration. Use formats like `30m`, `2h`, `1d 12h`. Minimum is 10 seconds.";
  if (input.durationSec > REMINDER_BOUNDS.maxSeconds) return `Reminders cannot be set more than ${REMINDER_MAX_DAYS} days ahead.`;
  if (input.pending >= MAX_PENDING_PER_USER) return `You already have ${input.pending} pending reminders. Cancel one with \`/remindme cancel\` first.`;
  return null;
}

/** Only Discord message links are kept as a reminder's jump link. Pure. */
export function safeJumpUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/channels\/(?:\d{17,20}|@me)\/\d{17,20}\/\d{17,20}$/.test(url) ? url : undefined;
}

/** The default text for a reminder about a message: its first line, or what it carries. Pure. */
export function messageReminderText(note: string | null | undefined, message: { content: string; authorTag: string; attachments: number }): string {
  const n = note?.trim();
  if (n) return n.slice(0, REMINDER_TEXT_MAX);
  const firstLine = message.content.split("\n").find(l => l.trim())?.trim() ?? "";
  const what = firstLine
    ? `“${firstLine.length > 200 ? `${firstLine.slice(0, 199)}…` : firstLine}”`
    : message.attachments ? `${message.attachments} attachment${message.attachments === 1 ? "" : "s"}` : "a message";
  return `Message from ${message.authorTag}: ${what}`.slice(0, REMINDER_TEXT_MAX);
}

/** One line of the reminders list. Pure. */
export function reminderListLine(task: Pick<ScheduledTask, "id" | "executeAt" | "payload">): string {
  const payload = decodePersonalReminder(task.payload);
  const ts = Math.floor(new Date(task.executeAt).getTime() / 1000);
  const text = payload?.text ?? "(unreadable reminder)";
  const shown = text.length > 80 ? `${text.slice(0, 79)}…` : text;
  return `⏰ \`${task.id}\` · <t:${ts}:R>${payload?.repeat ? ` · 🔁 ${payload.repeat}` : ""}${payload?.jumpUrl ? ` · [message](${payload.jumpUrl})` : ""}\n-# ${shown.replace(/\n/g, " ")}`;
}

export interface NewReminder {
  userId: string;
  guildId: string | null;
  guildName: string | null;
  channelId: string;
  text: string;
  durationSec: number;
  inChannel: boolean;
  repeat?: ReminderRepeat;
  jumpUrl?: string;
}

export type CreateReminderResult = { ok: true; task: ScheduledTask; fireAt: Date } | { ok: false; error: string };

/** Validate, save and arm a reminder. Errors come back as text for the user. */
export async function createPersonalReminder(client: Client, input: NewReminder): Promise<CreateReminderResult> {
  const pending = await getTasksForCreator(input.userId, "personal_reminder");
  const problem = reminderRequestProblem({ text: input.text, durationSec: input.durationSec, pending: pending.length });
  if (problem) return { ok: false, error: problem };
  const setAt = Date.now();
  const fireAt = new Date(setAt + input.durationSec * 1000);
  const jumpUrl = safeJumpUrl(input.jumpUrl);
  const task = await createTask(
    input.guildId ?? "dm",
    input.channelId,
    input.userId,
    "personal_reminder",
    encodePersonalReminder({
      text: input.text.trim(),
      inChannel: input.inChannel,
      sourceName: input.guildName ?? "Direct Message",
      setAt,
      ...(input.repeat ? { repeat: input.repeat } : {}),
      ...(jumpUrl ? { jumpUrl } : {}),
    }),
    fireAt,
    reminderRepeatIntervalMs(input.repeat),
  );
  scheduleTask(client, task);
  return { ok: true, task, fireAt };
}
