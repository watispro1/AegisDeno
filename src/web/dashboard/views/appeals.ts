import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { AppealRecord } from "../data";
import { APPEAL_FILTERS, APPEAL_REVIEW_NOTE_MAX, type AppealFilter } from "../validation";
import { type GuildContext, csrfField, fmtDate, guildNav, head, notice, person, shell } from "./layout";
import { errorSummary, pagerNav, permissionNote } from "./parts";

/* ── Appeals ───────────────────────────────────────────────────────── */

const APPEAL_FILTER_LABELS: Record<AppealFilter, string> = {
  pending: "Pending", approved: "Approved", denied: "Denied", expired: "Expired", all: "All",
};

function appealTag(status: string): string {
  const cls = status === "approved" ? "ok" : status === "pending" ? "warn" : "";
  return `<span class="tag${cls ? ` ${cls}` : ""}">${esc(status)}</span>`;
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

  const rows = result.items.map(a => `<tr>
      <td data-label="Filed">${esc(fmtDate(a.createdAt))}</td>
      <td data-label="Code"><a class="case-link" href="${base}/${esc(a.code)}">${esc(a.code)}</a> ${appealTag(a.status)}</td>
      <td data-label="Member">${person(ctx, a.userId)}</td>
      <td data-label="Banned by">${person(ctx, a.moderatorId)}</td>
      <td data-label="Statement">${a.appealText ? esc(a.appealText.length > 120 ? a.appealText.slice(0, 117) + "…" : a.appealText) : `<span class="faint">Not submitted yet</span>`}</td>
    </tr>`).join("");

  return shell(cfg, {
    title: `Appeals in ${g.name}`,
    path: `/dashboard/${g.id}/appeals`,
    viewer: ctx.viewer,
    body: `${head("Ban appeals", "Members banned by Aegis get an appeal code by DM and send their statement with <code class=\"inline\">/appeal submit</code>. Review them here or with <code class=\"inline\">/appeal review</code>.", [["Servers", "/dashboard"], [g.name, `/dashboard/${g.id}`], ["Appeals", null]])}
  ${guildNav(g.id, "appeals")}
  ${notice(o.noticeCode)}
  ${permissionNote(o.missingPermission ?? null)}
  ${tabs}
  ${result.items.length ? `<div class="table-wrap"><table class="case-table">
    <caption class="visually-hidden">${esc(APPEAL_FILTER_LABELS[filter.status])} ban appeals</caption>
    <thead><tr><th scope="col">Filed</th><th scope="col">Code</th><th scope="col">Member</th><th scope="col">Banned by</th><th scope="col">Statement</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>` : `<div class="empty-state"><strong>No ${filter.status === "all" ? "" : `${filter.status} `}appeals.</strong>${filter.status === "pending" ? "Nothing is waiting for review." : "Try another status."}</div>`}
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
    ${appeal.reviewedAt ? `<dt>Reviewed</dt><dd>${esc(fmtDate(appeal.reviewedAt))}</dd>` : ""}
    <dt>Note</dt><dd>${appeal.reviewNote ? esc(appeal.reviewNote) : `<span class="faint">None</span>`}</dd>
  </dl>`;

  return shell(cfg, {
    title: `Appeal ${appeal.code}`,
    path: action,
    viewer: ctx.viewer,
    body: `${head(`Appeal ${appeal.code}`, "", [["Servers", "/dashboard"], [g.name, `/dashboard/${g.id}`], ["Appeals", `/dashboard/${g.id}/appeals`], [appeal.code, null]])}
  ${guildNav(g.id, "appeals")}
  ${notice(o.noticeCode)}
  ${permissionNote(o.missingPermission ?? null)}
  <dl class="detail-list">
    <dt>Code</dt><dd><code class="inline">${esc(appeal.code)}</code> ${appealTag(appeal.status)}</dd>
    <dt>Member</dt><dd>${person(ctx, appeal.userId)} <a class="text-link" href="/dashboard/${esc(g.id)}/cases?user=${esc(appeal.userId)}">Their history</a></dd>
    <dt>Banned by</dt><dd>${person(ctx, appeal.moderatorId)}</dd>
    <dt>Filed</dt><dd>${esc(fmtDate(appeal.createdAt))}</dd>
    <dt>Ban reason</dt><dd>${esc(appeal.banReason)}</dd>
    <dt>Statement</dt><dd class="prewrap">${appeal.appealText ? esc(appeal.appealText) : `<span class="faint">Not submitted yet. They send it with /appeal submit.</span>`}</dd>
  </dl>
  ${review}`,
  });
}
