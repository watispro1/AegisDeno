/**
 * Pure formatting for /userinfo and the User Info context menu. Kept apart
 * from the command so the rules (who sees what, how records are cut to fit)
 * are unit-tested.
 */
import { truncate } from "../utils/safeText";

export interface RecordEntry {
  _id: string;
  action: string;
  reason: string;
  moderatorId: string;
  revoked?: boolean;
  createdAt: Date | string | number;
}

/** A reason that cannot break inline formatting or run over one line. */
export function inlineReason(reason: string | null | undefined, max = 90): string {
  const flat = String(reason ?? "").replace(/[\r\n]+/g, " ").replace(/`/g, "ʹ").trim();
  return truncate(flat || "No reason given", max);
}

/** One record line: full ID (works with /case view), action, reason, moderator, when. Mentions never ping (allowedMentions is empty). */
export function recordLine(entry: RecordEntry): string {
  const ts = Math.floor(new Date(entry.createdAt).getTime() / 1000);
  const id = `\`${String(entry._id)}\``;
  const action = entry.action.toUpperCase();
  const body = `${id} **${action}** · ${inlineReason(entry.reason)} · <@${entry.moderatorId}> · <t:${ts}:R>`;
  return entry.revoked ? `~~${body}~~ *(undone)*` : body;
}

/** Lines joined under `max` characters with a "+N more" tail when they did not all fit. */
export function fitRecordLines(lines: readonly string[], max = 4000, moreHint = ""): string {
  const out: string[] = [];
  let used = 0;
  for (const line of lines) {
    if (used + line.length + 1 > max - 80) break;
    out.push(line);
    used += line.length + 1;
  }
  const left = lines.length - out.length;
  if (left > 0) out.push(`…and ${left} more${moreHint ? `. ${moreHint}` : ""}`);
  return out.join("\n");
}

/**
 * Whether the reply is private. The right-click menu and moderators' views
 * (which carry warnings, cases and the Trust Score) are always private; anyone
 * else may ask for a private reply.
 */
export function userInfoEphemeral(input: { viewerIsMod: boolean; contextMenu: boolean; requested: boolean | null }): boolean {
  if (input.contextMenu || input.viewerIsMod) return true;
  return input.requested ?? false;
}

/** "3 active · 1 undone" style summary of warnings. */
export function warningSummary(warnings: ReadonlyArray<{ revoked?: boolean }>): string {
  const undone = warnings.filter(w => w.revoked).length;
  const active = warnings.length - undone;
  return `**${active}** active${undone ? ` · ${undone} undone` : ""}`;
}
