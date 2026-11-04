/** Cases and appeals: filters from the query string, reason edits, revokes and appeal reviews. */
import { Errors, checkbox, field, finish, optionalText, type FormBody, type Parsed } from "./formFields";

export const CASE_REASON_MAX = 512;

export function parseCaseReason(body: FormBody): Parsed<string> {
  const reason = field(body, "reason");
  if (reason === "") return { ok: false, errors: { reason: "Write a reason." } };
  if (reason.length > CASE_REASON_MAX) {
    return { ok: false, errors: { reason: `Keep the reason under ${CASE_REASON_MAX} characters (it is ${reason.length}).` } };
  }
  return { ok: true, value: reason };
}

export const CASE_TYPES = ["warn", "kick", "ban", "timeout", "untimeout", "unban", "clearwarnings", "purge", "lock", "unlock"] as const;

export interface CaseFilter {
  type: string | null;
  userId: string | null;
  moderatorId: string | null;
  /** Case-insensitive text the reason must contain. */
  query?: string | null;
  page: number;
  /** Rows per page; one of CASE_PAGE_SIZES. Absent means the default (25). */
  per?: number;
  /** First UTC day to include (YYYY-MM-DD). Absent means no lower bound. */
  from?: string;
  /** Last UTC day to include (YYYY-MM-DD). Absent means no upper bound. */
  to?: string;
}

/** A real calendar day written as YYYY-MM-DD, or null. */
export function isoDay(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value ? value : null;
}

/** The createdAt bounds for a filter's day range: from 00:00 UTC on `from` to the end of `to`. */
export function caseDateRange(filter: Pick<CaseFilter, "from" | "to">): { $gte?: Date; $lt?: Date } | null {
  if (!filter.from && !filter.to) return null;
  return {
    ...(filter.from ? { $gte: new Date(`${filter.from}T00:00:00Z`) } : {}),
    ...(filter.to ? { $lt: new Date(new Date(`${filter.to}T00:00:00Z`).getTime() + 86_400_000) } : {}),
  };
}

/** Page sizes offered on the Cases page. */
export const CASE_PAGE_SIZES = [10, 25, 50, 100] as const;

export const CASE_QUERY_MAX = 100;

/** Filters from the query string. Anything malformed is dropped rather than rejected. */
export function parseCaseFilter(query: Record<string, unknown>): CaseFilter {
  const pick = (key: string) => {
    const raw = query?.[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === "string" ? value.trim() : "";
  };
  // Accept a pasted mention (<@123> or <@!123>) as well as a bare ID.
  const id = (value: string) => value.replace(/^<@!?(\d+)>$/, "$1");
  const type = pick("type");
  const user = id(pick("user"));
  const mod = id(pick("moderator"));
  const page = Number(pick("page"));
  const per = Number(pick("per"));
  const q = pick("q").replace(/\s+/g, " ").slice(0, CASE_QUERY_MAX);
  let from = isoDay(pick("from"));
  let to = isoDay(pick("to"));
  if (from && to && from > to) [from, to] = [to, from];
  return {
    type: (CASE_TYPES as readonly string[]).includes(type) ? type : null,
    userId: /^\d{17,20}$/.test(user) ? user : null,
    moderatorId: /^\d{17,20}$/.test(mod) ? mod : null,
    query: q || null,
    page: Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1,
    // Only a non-default allowed size is kept, so the default filter shape is unchanged.
    ...(per !== 25 && (CASE_PAGE_SIZES as readonly number[]).includes(per) ? { per } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };
}

/** Revoke form: whether to also lift the ban in Discord. */
export function parseRevoke(body: FormBody): { unban: boolean } {
  return { unban: checkbox(body, "unban") };
}

export const APPEAL_FILTERS = ["pending", "approved", "denied", "expired", "all"] as const;
export type AppealFilter = (typeof APPEAL_FILTERS)[number];

export function parseAppealFilter(query: Record<string, unknown>): { status: AppealFilter; page: number } {
  const raw = query?.status;
  const value = typeof raw === "string" ? raw : "";
  const page = Number(typeof query?.page === "string" ? query.page : "");
  return {
    status: (APPEAL_FILTERS as readonly string[]).includes(value) ? (value as AppealFilter) : "pending",
    page: Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1,
  };
}

export const APPEAL_REVIEW_NOTE_MAX = 512;

export function parseAppealReview(body: FormBody): Parsed<{ decision: "approved" | "denied"; note: string | null }> {
  const errors = new Errors();
  const decisionRaw = field(body, "decision");
  if (decisionRaw !== "approved" && decisionRaw !== "denied") errors.add("decision", "Pick approve or deny.");
  const note = optionalText(body, "note", APPEAL_REVIEW_NOTE_MAX, "note", errors);
  return finish(errors, { decision: decisionRaw === "approved" ? "approved" : "denied", note });
}
