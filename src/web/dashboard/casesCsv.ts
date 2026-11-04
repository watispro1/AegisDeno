/**
 * CSV export of the Cases page. Every field is quoted, and a value a
 * spreadsheet would run as a formula (starting with =, +, -, @, tab or
 * carriage return) is prefixed with an apostrophe so it opens as plain text.
 */
import type { CaseRecord } from "./dataTypes";

/** Most rows one export holds; same cap as /case export. */
export const CASE_EXPORT_MAX = 5_000;

export const CASE_CSV_COLUMNS = ["id", "kind", "action", "user_id", "moderator_id", "reason", "details", "proof_url", "revoked", "revoked_by", "revoked_at_utc", "created_at_utc"] as const;

export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function isoOrBlank(d: Date | null): string {
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : "";
}

export function casesToCsv(records: readonly CaseRecord[]): string {
  const lines = [CASE_CSV_COLUMNS.join(",")];
  for (const r of records) {
    lines.push([
      r.id, r.kind, r.action, r.userId, r.moderatorId, r.reason, r.details, r.proofUrl,
      r.revoked ? "yes" : "no", r.revokedBy, isoOrBlank(r.revokedAt), isoOrBlank(r.createdAt),
    ].map(csvCell).join(","));
  }
  // CRLF line ends and a byte-order mark so Excel reads UTF-8 names correctly.
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
