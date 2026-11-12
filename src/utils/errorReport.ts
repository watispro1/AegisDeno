/**
 * Uniform error reporting for commands, context menus and components.
 *
 * Every unexpected failure gets a short error ID that is written to the log
 * next to the stack trace and shown to the member, so a report in the support
 * server ("I got AE-7KQ2XM") leads straight to the log line. Known Discord API
 * errors (a missing permission, a deleted message, a member who left) are
 * translated into a sentence that says what to fix instead of a generic
 * "something went wrong". Pure apart from the random ID; unit-tested.
 */
import { randomBytes } from "node:crypto";

const ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O or 1/I, easy to read back

/** A short, readable error ID such as `AE-7KQ2XM`. */
export function newErrorId(random: (n: number) => Uint8Array = (n) => randomBytes(n)): string {
  const bytes = random(6);
  let out = "";
  for (let i = 0; i < 6; i++) out += ID_ALPHABET[(bytes[i] ?? 0) % ID_ALPHABET.length];
  return `AE-${out}`;
}

export const ERROR_ID_PATTERN = /^AE-[2-9A-HJ-NP-Z]{6}$/;

/** The numeric Discord API error code on an error, or null. */
export function discordErrorCode(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const code = (err as { code?: unknown }).code;
  return typeof code === "number" && Number.isInteger(code) ? code : null;
}

/** Discord API error codes Aegis explains in plain words. */
export const DISCORD_ERROR_CODES = {
  unknownChannel: 10003,
  unknownGuild: 10004,
  unknownMember: 10007,
  unknownMessage: 10008,
  unknownRole: 10011,
  unknownUser: 10013,
  unknownInteraction: 10062,
  alreadyAcknowledged: 40060,
  missingAccess: 50001,
  cannotDm: 50007,
  missingPermissions: 50013,
  tooOld: 50034,
} as const;

export interface CommandErrorReport {
  /** What to show the member (always mentions the error ID). */
  message: string;
  /** The interaction can no longer be answered (expired or already answered elsewhere); log only. */
  silent: boolean;
  /** A known, expected Discord refusal rather than a bug: log as a warning, not an error. */
  expected: boolean;
}

/**
 * The member-facing message for an error thrown while running `label`
 * (e.g. "/ban" or "User Info"). Known Discord refusals say what to fix.
 */
export function describeCommandError(err: unknown, label: string, errorId: string): CommandErrorReport {
  const code = discordErrorCode(err);
  const C = DISCORD_ERROR_CODES;
  const idLine = `\n-# Error ID: \`${errorId}\``;
  const known = (text: string): CommandErrorReport => ({ message: `${text}${idLine}`, silent: false, expected: true });

  switch (code) {
    case C.unknownInteraction:
    case C.alreadyAcknowledged:
      return { message: "", silent: true, expected: true };
    case C.missingPermissions:
      return known(
        `❌ Discord refused part of \`${label}\` because Aegis is missing a permission here, or the target is above Aegis's highest role. ` +
          "Check Aegis's role (Server Settings → Roles) and this channel's permission overrides, then run `/diagnostics`.",
      );
    case C.missingAccess:
      return known(`❌ Aegis can't see a channel \`${label}\` needed. Give Aegis **View Channel** there (channel settings → Permissions).`);
    case C.cannotDm:
      return known("❌ That member doesn't accept DMs from Aegis (their privacy settings block it), so the message couldn't be delivered.");
    case C.unknownMember:
      return known("❌ That member isn't in this server any more.");
    case C.unknownUser:
      return known("❌ Discord doesn't know that user. Check the ID and try again.");
    case C.unknownMessage:
      return known("❌ That message was deleted before Aegis could act on it.");
    case C.unknownChannel:
      return known("❌ That channel no longer exists.");
    case C.unknownRole:
      return known("❌ That role no longer exists.");
    case C.unknownGuild:
      return known("❌ Aegis can't reach this server any more.");
    case C.tooOld:
      return known("❌ Discord only lets bots bulk-delete messages younger than 14 days.");
    default:
      return {
        message: `❌ Something went wrong running \`${label}\`. It's been logged. If it keeps happening, share the error ID with the Aegis support server.${idLine}`,
        silent: false,
        expected: false,
      };
  }
}
