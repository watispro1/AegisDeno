import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { AppealRecord } from "../data";
import { APPEAL_FILTERS, APPEAL_REVIEW_NOTE_MAX, type AppealFilter } from "../validation";
import { type GuildContext, copyId, csrfField, emptyState, head, idCode, notice, person, personId, relTime, shell } from "./layout";
import { errorSummary, pagerNav, permissionNote } from "./parts";
import { type Tone, helpPanel, listFoot, listTools, pill, rowAttrs, summaryStrip } from "./moduleKit";

/* Appeals */

const APPEAL_FILTER_LABELS: Record<AppealFilter, string> = {
  pending: "Pending", approved: "Approved", denied: "Denied", expired: "Expired", all: "All",
};

const APPEAL_TONES: Record<string, Tone> = { pending: "warn", approved: "ok", denied: "bad", expired: "off" };

function appealTag(status: string): string {
  return pill(status, APPEAL_TONES[status] ?? "info");
}

export function renderAppeals(
  cfg: SiteConfig,
  ctx: GuildContext,
  filter: { status: AppealFilter; page: number },
  result: { items: AppealRecord[]; total: number },
  perPage: number,
  o: { missingPermission?: string | null; noticeCode?: string | null } = {},
): string {
  const g = ctx.guild;
  const base = `/dashboard/${esc(g.id)}/appeals`;
  const pages = Math.max(1, Math.ceil(result.total / perPage));
  const page = Math.min(filter.page, pages);
  const query = (p: number) => {
    const q = new URLSearchParams();
    if (filter.status !== "pending") q.set("status", filter.status);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `?${s}` : "";
  };
  const tabs = `<nav aria-label="Appeal status"><ul class="dash-nav">${APPEAL_FILTERS.map(s =>
    `<li><a href="${base}${s === "pending" ? "" : `?status=${s}`}"${s === filter.status ? ' aria-current="page"' : ""}>${APPEAL_FILTER_LABELS[s]}</a></li>`).join("")}</ul></nav>`;

  const submitted = result.items.filter(a => a.appealText).length;
  const rows = result.items.map(a => `<tr${rowAttrs(a.appealText ? "submitted" : "waiting", { filed: a.createdAt.getTime() })}>
      <td data-label="Filed">${relTime(a.createdAt)}</td>
      <td data-label="Code"><a class="case-link" href="${base}/${esc(a.code)}">${esc(a.code)}</a> ${copyId(a.code, "Copy appeal code")} ${appealTag(a.status)}</td>
      <td data-label="Member">${personId(ctx, a.userId)}</td>
      <td data-label="Banned by">${person(ctx, a.moderatorId)}</td>
      <td data-label="Statement">${a.appealText ? esc(a.appealText.length > 120 ? a.appealText.slice(0, 117) + "…" : a.appealText) : `<span class="faint">Not submitted yet</span>`}</td>
      <td data-label="Actions" class="cell-actions-td"><a class="btn sm${a.status === "pending" && a.appealText ? "" : " ghost"}" href="${base}/${esc(a.code)}">${a.status === "pending" && a.appealText ? "Review" : "Open"}</a></td>
    </tr>`).join("");

  return shell(cfg, {
    title: `Appeals in ${g.name}`,
    path: `/dashboard/${g.id}/appeals`,
    viewer: ctx.viewer,
    guild: ctx,
    active: "appeals",
    body: `${head("Ban appeals", "Members banned by Aegis get an appeal code by DM and send their statement with <code class=\"inline\">/appeal submit</code>. Review them here or with <code class=\"inline\">/appeal review</code>.", [["Servers", "/dashboard"], [g.name, `/dashboard/${g.id}`], ["Appeals", null]])}
  ${notice(o.noticeCode)}
  ${permissionNote(o.missingPermission ?? null)}
  ${summaryStrip([
    { label: `${APPEAL_FILTER_LABELS[filter.status]} appeals`, value: result.total, tone: filter.status === "pending" && result.total ? "warn" : undefined },
    { label: "Statements on this page", value: submitted, hint: `${result.items.length - submitted} not sent yet` },
    { label: "Page", value: `${page} / ${pages}` },
  ], "Appeals summary")}
  ${tabs}
  ${helpPanel("How appeals work", [
    ["Code", "Sent by DM when Aegis bans someone. It is how the member and staff refer to the appeal."],
    ["Statement", "The member writes it with <code class=\"inline\">/appeal submit</code>. An appeal without one can still be decided."],
    ["Approve", "Unbans the member, records an unban case and DMs them your note."],
    ["Deny", "Keeps the ban and DMs them your note. Unanswered appeals expire after a while."],
  ])}
  ${result.items.length > 1 ? listTools("appeals-table", {
    search: "Filter by code, member or statement",
    chipLabel: "Show appeals",
    chips: [{ value: "submitted", label: "Statement sent", count: submitted }, { value: "waiting", label: "No statement yet", count: result.items.length - submitted }],
    sorts: [{ value: "filed:asc", label: "Oldest first" }, { value: "filed:desc", label: "Newest first" }],
  }) : ""}
  ${result.items.length ? `<div class="table-wrap"><table class="case-table" id="appeals-table" data-filterable>
    <caption class="visually-hidden">${esc(APPEAL_FILTER_LABELS[filter.status])} ban appeals</caption>
    <thead><tr><th scope="col">Filed</th><th scope="col">Code</th><th scope="col">Member</th><th scope="col">Banned by</th><th scope="col">Statement</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>${result.items.length > 1 ? listFoot("appeals-table") : ""}` : emptyState(`No ${filter.status === "all" ? "" : `${filter.status} `}appeals.`, filter.status === "pending" ? "Nothing is waiting for review." : "Try another status.", filter.status === "pending" ? { label: "See all appeals", href: `${base}?status=all` } : { label: "Back to pending", href: base })}
  ${pagerNav(base, query, page, pages, result.total, "appeal")}`,
  });
}

export function renderAppeal(
  cfg: SiteConfig,
  ctx: GuildContext,
  appeal: AppealRecord,
  o: { missingPermission?: string | null; noticeCode?: string | null; errors?: Record<string, string>; noteValue?: string } = {},
): string {
  const g = ctx.guild;
  const action = `/dashboard/${esc(g.id)}/appeals/${esc(appeal.code)}`;
  const errors = o.errors ?? {};
  const review = appeal.status === "pending"
    ? `<h2>Review</h2>
  ${errorSummary(errors)}
  <form class="dash-form" method="post" action="${action}/review" novalidate>
    ${csrfField(ctx.viewer)}
    <div class="field">
      <label for="f-note">Note to the member (optional)</label>
      <textarea id="f-note" name="note" maxlength="${APPEAL_REVIEW_NOTE_MAX}"${errors.note ? ' aria-invalid="true" aria-describedby="note-error"' : ""}>${esc(o.noteValue ?? "")}</textarea>
      ${errors.note ? `<span class="field-error" id="note-error">${esc(errors.note)}</span>` : ""}
      <span class="field-help">Up to ${APPEAL_REVIEW_NOTE_MAX} characters. Sent to them by DM with the decision, and posted to your log channel.</span>
    </div>
    <div class="btn-row review-buttons" id="f-decision">
      <button class="btn" type="submit" name="decision" value="approved" data-confirm-button="Approve and unban this member?">Approve and unban</button>
      <button class="btn danger" type="submit" name="decision" value="denied" data-confirm-button="Deny this appeal? The ban stays.">Deny</button>
    </div>
  </form>`
    : `<h2>Decision</h2>
  <dl class="detail-list">
    <dt>Status</dt><dd>${appealTag(appeal.status)}</dd>
    ${appeal.reviewedBy ? `<dt>Reviewed by</dt><dd>${person(ctx, appeal.reviewedBy)}</dd>` : ""}
    ${appeal.reviewedAt ? `<dt>Reviewed</dt><dd>${relTime(appeal.reviewedAt)}</dd>` : ""}
    <dt>Note</dt><dd>${appeal.reviewNote ? esc(appeal.reviewNote) : `<span class="faint">None</span>`}</dd>
  </dl>`;

  return shell(cfg, {
    title: `Appeal ${appeal.code}`,
    path: action,
    viewer: ctx.viewer,
    guild: ctx,
    active: "appeals",
    body: `${head(`Appeal ${appeal.code}`, "", [["Servers", "/dashboard"], [g.name, `/dashboard/${g.id}`], ["Appeals", `/dashboard/${g.id}/appeals`], [appeal.code, null]])}
  ${notice(o.noticeCode)}
  ${permissionNote(o.missingPermission ?? null)}
  ${summaryStrip([
    { label: "Status", value: "", html: appealTag(appeal.status) },
    { label: "Member's history", value: "Open cases", href: `/dashboard/${g.id}/cases?user=${appeal.userId}` },
    { label: "Statement", value: appeal.appealText ? "Sent" : "Not yet", tone: appeal.appealText ? "ok" : "off" },
  ], "Appeal summary")}
  <dl class="detail-list">
    <dt>Code</dt><dd>${idCode(appeal.code, "Copy appeal code")} ${appealTag(appeal.status)}</dd>
    <dt>Member</dt><dd>${personId(ctx, appeal.userId)} <a class="text-link" href="/dashboard/${esc(g.id)}/cases?user=${esc(appeal.userId)}">Their history</a></dd>
    <dt>Banned by</dt><dd>${personId(ctx, appeal.moderatorId)}</dd>
    <dt>Filed</dt><dd>${relTime(appeal.createdAt)}</dd>
    <dt>Ban reason</dt><dd>${esc(appeal.banReason)}</dd>
  </dl>
  <h2>Their statement</h2>
  ${appeal.appealText ? `<blockquote class="quote-block">${esc(appeal.appealText)}</blockquote>` : emptyState("Not submitted yet.", "They send it with <code class=\"inline\">/appeal submit</code>. You can still decide without it.")}
  ${review}`,
  });
}
