/**
 * Field readers shared by every dashboard form parser: typed reads of the
 * urlencoded body, the error collector, and the channel and role checks
 * against what the bot can see. Each section's parser lives in its own module.
 */
export type FormBody = Record<string, unknown>;

export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

export interface ValidationContext {
  textChannelIds: ReadonlySet<string>;
  /** Channels Discord hides from Aegis (obfuscated, no View Channel). Never valid picks. */
  hiddenChannelIds?: ReadonlySet<string>;
  /**
   * Role ID → whether the bot can assign it, and whether it is at or above the
   * viewer's own highest role (aboveViewer; never set for the server owner).
   */
  roles: ReadonlyMap<string, { assignable: boolean; aboveViewer?: boolean }>;
}


/** First value of a field as a trimmed string (urlencoded bodies can repeat keys). */
export function field(body: FormBody, key: string): string {
  const raw = body?.[key];
  const value = Array.isArray(raw) ? raw[raw.length - 1] : raw;
  return typeof value === "string" ? value.trim() : "";
}

/** Checkboxes post their value only when ticked; a hidden "0" may precede it. */
export function checkbox(body: FormBody, key: string): boolean {
  const raw = body?.[key];
  const values = Array.isArray(raw) ? raw : [raw];
  return values.some(v => v === "on" || v === "1" || v === "true");
}

export class Errors {
  readonly map: Record<string, string> = {};
  add(key: string, message: string): void {
    if (!this.map[key]) this.map[key] = message;
  }
  get empty(): boolean {
    return Object.keys(this.map).length === 0;
  }
}

export function integer(body: FormBody, key: string, min: number, max: number, label: string, errors: Errors, opts: { blank?: number } = {}): number {
  const raw = field(body, key);
  if (raw === "" && opts.blank !== undefined) return opts.blank;
  if (!/^-?\d{1,9}$/.test(raw)) {
    errors.add(key, `${label} must be a whole number between ${min} and ${max}.`);
    return min;
  }
  const n = Number(raw);
  if (n < min || n > max) {
    errors.add(key, `${label} must be between ${min} and ${max}.`);
    return Math.min(max, Math.max(min, n));
  }
  return n;
}

export function channel(body: FormBody, key: string, ctx: ValidationContext, errors: Errors, required: boolean, label: string): string | null {
  const raw = field(body, key);
  if (raw === "") {
    if (required) errors.add(key, `Pick a ${label}.`);
    return null;
  }
  if (ctx.hiddenChannelIds?.has(raw)) {
    errors.add(key, `Aegis can't see that ${label}. Give Aegis the View Channel permission there, or pick another one.`);
    return null;
  }
  if (!ctx.textChannelIds.has(raw)) {
    errors.add(key, `That ${label} is not a text channel Aegis can see. Pick one from the list.`);
    return null;
  }
  return raw;
}

/** Shown when a picked role is at or above the viewer's highest role. */
export const ROLE_ABOVE_VIEWER_ERROR =
  "That role is equal to or above your highest role in this server, so you can't hand it out. Pick a role below your highest role (only the server owner can pick any role).";

export function role(
  body: FormBody, key: string, ctx: ValidationContext, errors: Errors, required: boolean, label: string,
  opts: { anyRole?: boolean; saved?: string | null } = {},
): string | null {
  const raw = field(body, key);
  if (raw === "") {
    if (required) errors.add(key, `Pick a ${label}.`);
    return null;
  }
  const found = ctx.roles.get(raw);
  if (!found) {
    errors.add(key, `That ${label} does not exist in this server. Pick one from the list.`);
    return null;
  }
  if (opts.anyRole) return raw;
  if (!found.assignable) {
    errors.add(key, `Aegis cannot assign that role. Move Aegis's role above it and make sure it has Manage Roles.`);
    return null;
  }
  // Same rule as /rolepanel create and /verify setup: the role must be below the
  // viewer's own highest role. A role that is already saved may be kept as is,
  // so a moderator can change other settings in the section without being
  // blocked by a role the owner chose.
  if (found.aboveViewer && raw !== opts.saved) {
    errors.add(key, ROLE_ABOVE_VIEWER_ERROR);
    return null;
  }
  return raw;
}

export function finish<T>(errors: Errors, value: T): Parsed<T> {
  return errors.empty ? { ok: true, value } : { ok: false, errors: errors.map };
}

/** Every value of a repeated field (checkbox groups), trimmed, without blanks. */
export function fieldValues(body: FormBody, key: string): string[] {
  const raw = body?.[key];
  const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  return values.filter((v): v is string => typeof v === "string").map(v => v.trim()).filter(Boolean);
}

/**
 * IDs ticked in a checkbox group. Each must be one Aegis can see now, or one
 * that was already saved (so a channel type the picker does not list, or a
 * role Aegis cannot see right now, is kept rather than rejected).
 */
export function pickedIds(body: FormBody, key: string, known: (id: string) => boolean, previous: readonly string[], what: string, errors: Errors, max = 100): string[] {
  const out: string[] = [];
  for (const id of fieldValues(body, key)) {
    if (!/^\d{17,20}$/.test(id) || (!known(id) && !previous.includes(id))) {
      errors.add(key, `One of the ${what} is not in this server any more. Reload the page and pick again.`);
      continue;
    }
    if (!out.includes(id)) out.push(id);
  }
  if (out.length > max) errors.add(key, `Pick at most ${max} ${what}.`);
  return out;
}

/** Optional free text: line breaks normalised, trimmed, capped at `max`. Blank is null. */
export function optionalText(body: FormBody, key: string, max: number, label: string, errors: Errors): string | null {
  const raw = body?.[key];
  const value = (typeof raw === "string" ? raw : "").replace(/\r\n/g, "\n").trim();
  if (value.length > max) errors.add(key, `Keep the ${label} under ${max} characters (it is ${value.length}).`);
  return value || null;
}
