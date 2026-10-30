/**
 * Pure helpers for ticket transcripts and inactivity auto-close.
 * Kept free of Discord/Mongo imports so they can be unit-tested directly.
 */

export const DEFAULT_TICKET_AUTOCLOSE_HOURS = 48;
export const MAX_TICKET_AUTOCLOSE_HOURS = 24 * 30;
const HOUR_MS = 3_600_000;

export interface TranscriptAttachment {
  name: string;
  url: string;
}

export interface TranscriptMessage {
  authorTag: string;
  authorId: string;
  bot: boolean;
  timestamp: number;
  content: string;
  attachments: TranscriptAttachment[];
  embedCount: number;
}

export interface TranscriptMeta {
  guildName: string;
  channelName: string;
  ticketId: string;
  openerId: string;
  closedById?: string | null;
  reason?: string | null;
  generatedAt: number;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(url: string): string | null {
  return /^https:\/\//i.test(url) ? url : null;
}

/**
 * Render a self-contained HTML transcript (inline CSS, no scripts, no external assets).
 * Messages are sorted oldest first regardless of input order.
 */
export function renderTranscriptHtml(meta: TranscriptMeta, messages: readonly TranscriptMessage[]): string {
  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);
  const rows = sorted.map(m => {
    const attachments = m.attachments
      .map(a => {
        const href = safeUrl(a.url);
        const name = escapeHtml(a.name || "attachment");
        return href ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${name}</a>` : `<span>${name}</span>`;
      })
      .join(" ");
    const extras = [
      attachments ? `<div class="att">📎 ${attachments}</div>` : "",
      m.embedCount > 0 ? `<div class="meta">[${m.embedCount} embed${m.embedCount === 1 ? "" : "s"}]</div>` : "",
    ].join("");
    const body = m.content ? `<div class="body">${escapeHtml(m.content)}</div>` : "";
    return `<div class="msg"><div class="head"><span class="author${m.bot ? " bot" : ""}">${escapeHtml(m.authorTag)}</span> <span class="meta">${escapeHtml(m.authorId)} · ${new Date(m.timestamp).toISOString()}</span></div>${body}${extras}</div>`;
  });

  const info = [
    ["Server", meta.guildName],
    ["Channel", `#${meta.channelName}`],
    ["Ticket", meta.ticketId],
    ["Opened by", meta.openerId],
    ...(meta.closedById ? [["Closed by", meta.closedById]] : []),
    ...(meta.reason ? [["Reason", meta.reason]] : []),
    ["Messages", String(sorted.length)],
    ["Generated", new Date(meta.generatedAt).toISOString()],
  ]
    .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Transcript — #${escapeHtml(meta.channelName)}</title>
<style>
body{font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;margin:0;padding:24px;background:#fff;color:#1f2328}
h1{font-size:18px;margin:0 0 12px}
dl{display:grid;grid-template-columns:max-content 1fr;gap:2px 12px;margin:0 0 20px;padding:12px;border:1px solid #d0d7de;border-radius:6px}
dt{font-weight:600}dd{margin:0;word-break:break-all}
.msg{padding:8px 0;border-top:1px solid #eaeef2}
.author{font-weight:600}.author.bot{color:#5865f2}
.meta{color:#656d76;font-size:12px}
.body{white-space:pre-wrap;word-wrap:break-word}
.att a{color:#0969da}
.empty{color:#656d76}
</style>
</head>
<body>
<h1>Ticket transcript — #${escapeHtml(meta.channelName)}</h1>
<dl>${info}</dl>
${rows.length ? rows.join("\n") : `<p class="empty">No messages.</p>`}
</body>
</html>
`;
}

/** Clamp a configured auto-close value to whole hours in [0, MAX]; 0 means disabled. */
export function normalizeAutoCloseHours(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_TICKET_AUTOCLOSE_HOURS;
  return Math.max(0, Math.min(MAX_TICKET_AUTOCLOSE_HOURS, Math.floor(value)));
}

/**
 * Decide what an inactivity check should do.
 * - `disabled`: auto-close is off, drop the check.
 * - `close`: the ticket has been quiet for the full window.
 * - `recheck`: there was activity since; check again at `at`.
 * - `defer`: the channel is hidden from Aegis (no View Channel), so its activity
 *   cannot be seen and the stored time is stale. Treat it as active now and
 *   check again a full window later; never close a ticket Aegis cannot see.
 */
export function autoCloseDecision(
  lastActivityAtMs: number,
  autoCloseHours: number,
  nowMs: number,
  opts: { channelHidden?: boolean } = {},
): { action: "disabled" } | { action: "close" } | { action: "recheck"; at: number } | { action: "defer"; at: number } {
  if (autoCloseHours <= 0) return { action: "disabled" };
  if (opts.channelHidden) return { action: "defer", at: nowMs + autoCloseHours * HOUR_MS };
  const dueAt = lastActivityAtMs + autoCloseHours * HOUR_MS;
  if (dueAt <= nowMs) return { action: "close" };
  return { action: "recheck", at: dueAt };
}

export interface TicketTaskPayload {
  ticketId: string;
}

export function encodeTicketTask(payload: TicketTaskPayload): string {
  return JSON.stringify(payload);
}

export function decodeTicketTask(raw: string): TicketTaskPayload | null {
  try {
    const o: unknown = JSON.parse(raw);
    if (o && typeof o === "object" && typeof (o as Record<string, unknown>).ticketId === "string") {
      return { ticketId: (o as Record<string, string>).ticketId };
    }
  } catch {
    // fall through
  }
  return null;
}
