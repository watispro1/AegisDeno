/**
 * Incident and maintenance notices for the public status page.
 *
 * Two sources, merged: the STATIC_NOTICES list below (edit and deploy) and the
 * `statusnotices` Mongo collection (insert a document from Atlas to post one
 * without a deploy). Both are public: never put internal hostnames, IPs or
 * secrets in a notice. Reads are cached for a minute and skipped entirely
 * while the database is down.
 */
import mongoose from "mongoose";

export type NoticeKind = "incident" | "maintenance";
export type NoticeSeverity = "minor" | "major" | "info";

export interface StatusNotice {
  title: string;
  body: string;
  kind: NoticeKind;
  severity: NoticeSeverity;
  startsAt: Date;
  /** Planned end (maintenance) or null. */
  endsAt: Date | null;
  /** Set when an incident is over; resolved notices show for 7 days. */
  resolvedAt: Date | null;
}

/** Notices shipped with the code. Newest first. */
export const STATIC_NOTICES: StatusNotice[] = [];

const StatusNoticeSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 120 },
  body: { type: String, default: "", maxlength: 1000 },
  kind: { type: String, enum: ["incident", "maintenance"], default: "incident" },
  severity: { type: String, enum: ["minor", "major", "info"], default: "minor" },
  startsAt: { type: Date, default: Date.now },
  endsAt: { type: Date, default: null },
  resolvedAt: { type: Date, default: null },
}, { versionKey: false });
StatusNoticeSchema.index({ startsAt: -1 });
export const StatusNoticeModel = mongoose.models.StatusNotice ?? mongoose.model("StatusNotice", StatusNoticeSchema);

const RESOLVED_VISIBLE_MS = 7 * 86_400_000;

function clean(raw: Record<string, unknown>): StatusNotice | null {
  const date = (v: unknown) => (v instanceof Date || typeof v === "string" || typeof v === "number") && !Number.isNaN(new Date(v).getTime()) ? new Date(v) : null;
  const title = typeof raw.title === "string" ? raw.title.trim().slice(0, 120) : "";
  const startsAt = date(raw.startsAt);
  if (!title || !startsAt) return null;
  return {
    title,
    body: typeof raw.body === "string" ? raw.body.slice(0, 1000) : "",
    kind: raw.kind === "maintenance" ? "maintenance" : "incident",
    severity: raw.severity === "major" || raw.severity === "info" ? raw.severity : "minor",
    startsAt,
    endsAt: date(raw.endsAt),
    resolvedAt: date(raw.resolvedAt),
  };
}

/**
 * Notices worth showing now: open incidents, maintenance that has not ended,
 * and anything resolved or finished in the last 7 days. Newest first, max 10.
 */
export function visibleNotices(all: ReadonlyArray<Record<string, unknown> | StatusNotice>, nowMs: number): StatusNotice[] {
  return all
    .map(n => clean(n as Record<string, unknown>))
    .filter((n): n is StatusNotice => n !== null)
    .filter(n => {
      const closedAt = n.resolvedAt ?? (n.kind === "maintenance" ? n.endsAt : null);
      return !closedAt || nowMs - closedAt.getTime() < RESOLVED_VISIBLE_MS;
    })
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
    .slice(0, 10);
}

/** Whether a notice is still open (unresolved incident, or maintenance under way or upcoming). */
export function noticeOpen(n: StatusNotice, nowMs: number): boolean {
  if (n.resolvedAt) return false;
  if (n.kind === "maintenance") return !n.endsAt || n.endsAt.getTime() > nowMs;
  return true;
}

let cache: { at: number; rows: Record<string, unknown>[] } | null = null;

export async function loadNotices(nowMs = Date.now()): Promise<StatusNotice[]> {
  if (mongoose.connection?.readyState === 1 && (!cache || nowMs - cache.at > 60_000)) {
    try {
      const rows = (await StatusNoticeModel.find({}).sort({ startsAt: -1 }).limit(25).lean().maxTimeMS(2000)) as Record<string, unknown>[];
      cache = { at: nowMs, rows };
    } catch {
      cache = { at: nowMs, rows: cache?.rows ?? [] };
    }
  }
  return visibleNotices([...STATIC_NOTICES, ...(cache?.rows ?? [])], nowMs);
}
