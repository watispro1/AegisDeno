/**
 * Pure rules behind /temprole: duration bounds, which roles may be handed
 * out, what re-adding a role does, the persisted task payload, and what the
 * expiry task does when it fires. No Discord or Mongo imports.
 */
import { formatDurationLong, parseFriendlyDuration } from "../utils/duration";

export const TEMP_ROLE_MIN_SECONDS = 60;
export const TEMP_ROLE_MAX_SECONDS = 365 * 86_400;

export const TEMP_ROLE_PRESETS = [
  { name: "1 hour", value: "1h" },
  { name: "1 day", value: "1d" },
  { name: "3 days", value: "3d" },
  { name: "1 week", value: "7d" },
  { name: "30 days", value: "30d" },
  { name: "90 days", value: "90d" },
] as const;

export function parseTempRoleDuration(raw: string | null): { ok: true; seconds: number } | { ok: false; error: string } {
  const text = raw?.trim() ?? "";
  const seconds = text ? parseFriendlyDuration(text) : null;
  if (seconds === null) return { ok: false, error: "❌ I couldn't read that duration. Try `2h`, `7d`, `2 weeks` or `1d 12h`." };
  if (seconds < TEMP_ROLE_MIN_SECONDS || seconds > TEMP_ROLE_MAX_SECONDS) {
    return { ok: false, error: `❌ A temporary role must last between ${formatDurationLong(TEMP_ROLE_MIN_SECONDS)} and ${formatDurationLong(TEMP_ROLE_MAX_SECONDS)}.` };
  }
  return { ok: true, seconds };
}

export interface TempRoleTarget {
  id: string;
  position: number;
  /** Bot, booster or integration role that Discord manages. */
  managed: boolean;
}

/**
 * Why a role can't be given or taken with /temprole, or null when it can.
 * The role must sit strictly below Aegis's highest role and below the
 * moderator's highest role; the server owner may use any role Aegis can.
 */
export function tempRoleBlock(input: {
  role: TempRoleTarget;
  guildId: string;
  isOwner: boolean;
  /** Position of the moderator's highest role, or null when they could not be resolved. */
  actorTopPosition: number | null;
  botTopPosition: number;
}): string | null {
  const { role } = input;
  if (role.id === input.guildId) return "❌ @everyone can't be given as a temporary role.";
  if (role.managed) return "❌ That role is managed by an integration (a bot, booster or app role) and can't be assigned by hand.";
  if (role.position >= input.botTopPosition) return "❌ That role is at or above my highest role, so I can't manage it. Move my role above it first.";
  if (!input.isOwner && (input.actorTopPosition === null || role.position >= input.actorTopPosition)) {
    return "❌ That role is at or above your highest role, so you can't hand it out.";
  }
  return null;
}

export type TempRoleAddPlan =
  | { kind: "add" }
  | { kind: "extend"; previousExpiryMs: number }
  | { kind: "already-permanent" }
  | { kind: "already-longer"; currentExpiryMs: number };

/**
 * What `/temprole add` does given the member's current state.
 * - Member lacks the role: give it and schedule removal (any stale timer is replaced).
 * - Member has it with a pending timer: re-adding moves the expiry later; a
 *   shorter length is refused (remove it first to shorten).
 * - Member has it with no timer: it was given another way, so it is left alone
 *   rather than silently turned into a temporary role.
 */
export function planTempRoleAdd(input: { memberHasRole: boolean; pendingExpiryMs: number | null; newExpiryMs: number }): TempRoleAddPlan {
  if (!input.memberHasRole) return { kind: "add" };
  if (input.pendingExpiryMs === null) return { kind: "already-permanent" };
  if (input.newExpiryMs <= input.pendingExpiryMs) return { kind: "already-longer", currentExpiryMs: input.pendingExpiryMs };
  return { kind: "extend", previousExpiryMs: input.pendingExpiryMs };
}

export interface TempRolePayload {
  roleId: string;
  moderatorId: string;
  moderatorTag: string;
  reason: string;
  durationSeconds: number;
  caseId: string | null;
  /** When the role was given (epoch ms). */
  setAt: number;
}

const SNOWFLAKE = /^\d{17,20}$/;

export function encodeTempRole(payload: TempRolePayload): string {
  return JSON.stringify({ ...payload, reason: payload.reason.slice(0, 512) });
}

/** Null when the payload has no usable role id: there is nothing to remove then. */
export function decodeTempRole(raw: string): TempRolePayload | null {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o !== "object" || typeof o.roleId !== "string" || !SNOWFLAKE.test(o.roleId)) return null;
    return {
      roleId: o.roleId,
      moderatorId: typeof o.moderatorId === "string" ? o.moderatorId : "",
      moderatorTag: typeof o.moderatorTag === "string" ? o.moderatorTag : "Unknown",
      reason: typeof o.reason === "string" ? o.reason.slice(0, 512) : "",
      durationSeconds: typeof o.durationSeconds === "number" && Number.isFinite(o.durationSeconds) ? o.durationSeconds : 0,
      caseId: typeof o.caseId === "string" ? o.caseId : null,
      setAt: typeof o.setAt === "number" && Number.isFinite(o.setAt) ? o.setAt : 0,
    };
  } catch {
    return null;
  }
}

export type TempRoleExpiryDecision =
  | "remove"
  | "retry"
  | "skip-member-left"
  | "skip-role-deleted"
  | "skip-not-present"
  | "skip-unmanageable";

/**
 * What the expiry task does. A guild that is not available yet (boot, outage)
 * is retried; a member who left, a deleted role, or a role already taken off
 * end the task quietly. A role that moved above Aegis is skipped and logged.
 */
export function decideTempRoleExpiry(input: {
  guildAvailable: boolean;
  roleExists: boolean;
  memberFound: boolean;
  memberHasRole: boolean;
  roleBelowBot: boolean;
}): TempRoleExpiryDecision {
  if (!input.guildAvailable) return "retry";
  if (!input.roleExists) return "skip-role-deleted";
  if (!input.memberFound) return "skip-member-left";
  if (!input.memberHasRole) return "skip-not-present";
  if (!input.roleBelowBot) return "skip-unmanageable";
  return "remove";
}

/** Discord's "Unknown Member" (10007): the member is not in the server. */
export function isUnknownMemberError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === 10007;
}

/** One line for `/temprole list`. */
export function tempRoleListLine(entry: { userId: string; roleId: string; expiresAtMs: number; reason: string }, showUser: boolean): string {
  const ts = Math.floor(entry.expiresAtMs / 1000);
  const reason = entry.reason ? ` · ${entry.reason.length > 60 ? `${entry.reason.slice(0, 59)}…` : entry.reason}` : "";
  return `${showUser ? `<@${entry.userId}> · ` : ""}<@&${entry.roleId}> · ends <t:${ts}:R>${reason}`;
}
