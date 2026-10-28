/**
 * Shared rules for the Undo button shown after /warn, /timeout and /ban.
 * Pure helpers only, so they can be unit-tested without Discord or Mongo.
 */
import { ButtonBuilder, ButtonStyle, PermissionFlagsBits, type PermissionsBitField } from "discord.js";

/** How long the Undo button stays usable after the action. */
export const UNDO_WINDOW_MS = 5 * 60 * 1000;

export type UndoableAction = "warn" | "timeout" | "ban";

/** True while an action taken at `actionAtMs` can still be undone at `nowMs`. */
export function isUndoWindowOpen(actionAtMs: number, nowMs: number, windowMs = UNDO_WINDOW_MS): boolean {
  const elapsed = nowMs - actionAtMs;
  return elapsed >= 0 && elapsed <= windowMs;
}

/** Permission a moderator needs to press Undo for each action. */
export function undoPermissionFor(action: UndoableAction): bigint {
  return action === "ban" ? PermissionFlagsBits.BanMembers : PermissionFlagsBits.ModerateMembers;
}

/** Only staff holding the action's permission may press Undo. */
export function canPressUndo(action: UndoableAction, permissions: Readonly<PermissionsBitField> | null | undefined): boolean {
  return permissions?.has(undoPermissionFor(action)) === true;
}

/** Undo button with a consistent look. `done` renders it disabled as "Undone". */
export function buildUndoButton(customId: string, state: "ready" | "done" | "expired" = "ready"): ButtonBuilder {
  const label = state === "done" ? "Undone" : state === "expired" ? "Undo expired" : "Undo (5 min)";
  return new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(ButtonStyle.Danger)
    .setEmoji("↩️")
    .setDisabled(state !== "ready");
}
