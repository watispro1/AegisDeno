import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { CaseRecord } from "../data";
import { CASE_REASON_MAX, CASE_TYPES, CASE_QUERY_MAX, type CaseFilter } from "../validation";
import { type GuildContext, csrfField, fmtDate, guildNav, head, notice, person, shell } from "./layout";
import { caseTable } from "./overview";

/* ── Cases ─────────────────────────────────────────────────────────── */

export function casesQuery(filter: CaseFilter, page: number): string {
  const q = new URLSearchParams();
  if (filter.type) q.set("type", filter.type);
  if (filter.userId) q.set("user", filter.userId);
  if (filter.moderatorId) q.set("moderator", filter.moderatorId);
  if (filter.query) q.set("q", filter.query);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function renderCases(
  cfg: SiteConfig,
  ctx: GuildContext,
  filter: CaseFilter,
  result: { items: CaseRecord[]; total: number },
  perPage: number,
): string {
  const g = ctx.guild;
  const base = `/dashboard/${esc(g.id)}/cases`;
  const pages = Math.max(1, Math.ceil(result.total / perPage));
  const page = Math.min(filter.page, pages);
  const typeOptions = [`<option value="">All types</option>`]
    .concat(CASE_TYPES.map(t => `<option value="${t}"${filter.type === t ? " selected" : ""}>${t}</option>`))
    .join("");

  const pager = result.total > perPage
    ? `<nav class="pager" aria-label="Pages">
      <span>Page ${page} of ${pages}, ${result.total.toLocaleString("en-US")} records</span>
      <span class="btn-row">
        ${page > 1 ? `<a class="btn ghost sm" href="${base}${esc(casesQuery(filter, page - 1))}" rel="prev">Newer</a>` : ""}
        ${page < pages ? `<a class="btn ghost sm" href="${base}${esc(casesQuery(filter, page + 1))}" rel="next">Older</a>` : ""}
      </span>
    </nav>`
    : `<p class="muted">${result.total.toLocaleString("en-US")} record${result.total === 1 ? "" : "s"}.</p>`;

  return shell(cfg, {
    title: `Cases in ${g.name}`,
    path: `/dashboard/${g.id}/cases`,
    viewer: ctx.viewer,
    body: `${head("Cases", "Moderation cases and warnings, newest first. Records older than a year are deleted automatically.", [["Servers", "/dashboard"], [g.name, `/dashboard/${g.id}`], ["Cases", null]])}
  ${guildNav(g.id, "cases")}
  <form class="filter-bar" method="get" action="${base}" role="search" aria-label="Filter cases">
    <div><label for="f-type">Type</label><select id="f-type" name="type">${typeOptions}</select></div>
    <div><label for="f-user">Member ID</label><input id="f-user" name="user" type="text" inputmode="numeric" autocomplete="off" value="${esc(filter.userId ?? "")}" placeholder="123456789012345678"></div>
    <div><label for="f-mod">Moderator ID</label><input id="f-mod" name="moderator" type="text" inputmode="numeric" autocomplete="off" value="${esc(filter.moderatorId ?? "")}" placeholder="123456789012345678"></div>
    <div><label for="f-q">Reason contains</label><input id="f-q" name="q" type="search" maxlength="${CASE_QUERY_MAX}" autocomplete="off" value="${esc(filter.query ?? "")}" placeholder="spam"></div>
    <div class="btn-row"><button class="btn" type="submit">Filter</button>${filter.type || filter.userId || filter.moderatorId || filter.query ? `<a class="btn ghost" href="${base}">Clear</a>` : ""}</div>
  </form>
  ${result.items.length ? caseTable(ctx, result.items, "Cases matching the filter") : `<div class="empty-state"><strong>Nothing matches.</strong>Try a different filter, or clear it.</div>`}
  ${pager}`,
  });
}

export function renderCase(
  cfg: SiteConfig,
  ctx: GuildContext,
  record: CaseRecord,
  o: { noticeCode?: string | null; reasonError?: string | null; reasonValue?: string } = {},
): string {
  const g = ctx.guild;
  const action = `/dashboard/${esc(g.id)}/cases/${esc(record.id)}`;
  const kind = record.kind === "warning" ? "Warning" : "Case";
  const reasonValue = o.reasonValue ?? record.reason;
  const isBanCase = record.kind === "case" && record.action === "ban";
  const err = o.reasonError
    ? `<span class="field-error" id="reason-error">${esc(o.reasonError)}</span>`
    : "";

  const revoke = record.revoked
    ? `<p class="muted">Revoked${record.revokedBy ? ` by ${person(ctx, record.revokedBy)}` : ""}${record.revokedAt ? `, ${esc(fmtDate(record.revokedAt))}` : ""}.</p>`
    : `<form class="dash-action" method="post" action="${action}/revoke" data-confirm="Revoke this ${kind.toLowerCase()}? It stays in the record but stops counting.">
      ${csrfField(ctx.viewer)}
      <p class="muted">Revoking keeps the record but stops it counting toward totals, escalation and the trust score.${
        isBanCase ? "" : ` It does not lift a timeout in Discord; use <code class="inline">/removetimeout</code> for that.`
      }</p>
      ${isBanCase ? `<div class="field"><label class="check" for="f-unban">
        <input type="checkbox" id="f-unban" name="unban">
        <span>Also unban this member in Discord<small>Same as <code class="inline">/unban</code>: lifts the ban, records an unban case and posts it to your log channel. Needs Ban Members.</small></span>
      </label></div>` : ""}
      <button class="btn danger" type="submit">Revoke ${kind.toLowerCase()}</button>
    </form>`;

  return shell(cfg, {
    title: `${kind} ${record.id}`,
    path: action,
    viewer: ctx.viewer,
    body: `${head(`${kind}: ${record.action}`, "", [["Servers", "/dashboard"], [g.name, `/dashboard/${g.id}`], ["Cases", `/dashboard/${g.id}/cases`], [record.id, null]])}
  ${guildNav(g.id, "cases")}
  ${notice(o.noticeCode)}
  <dl class="detail-list">
    <dt>ID</dt><dd><code class="inline">${esc(record.id)}</code></dd>
    <dt>Action</dt><dd>${esc(record.action)}${record.revoked ? ' <span class="tag warn">revoked</span>' : ""}</dd>
    <dt>Member</dt><dd>${person(ctx, record.userId)} <a class="text-link" href="/dashboard/${esc(g.id)}/cases?user=${esc(record.userId)}">Their history</a></dd>
    <dt>Moderator</dt><dd>${person(ctx, record.moderatorId)}</dd>
    <dt>When</dt><dd>${esc(fmtDate(record.createdAt))}</dd>
    <dt>Reason</dt><dd>${esc(record.reason)}</dd>
    ${record.details ? `<dt>Details</dt><dd>${esc(record.details)}</dd>` : ""}
    ${record.proofUrl && /^https:\/\//i.test(record.proofUrl) ? `<dt>Proof</dt><dd><a href="${esc(record.proofUrl)}" rel="noopener noreferrer nofollow">Open attachment</a></dd>` : ""}
  </dl>
  <h2>Edit the reason</h2>
  <form class="dash-form" method="post" action="${action}/reason" novalidate>
    ${csrfField(ctx.viewer)}
    <div class="field">
      <label for="f-reason">Reason</label>
      <textarea id="f-reason" name="reason" maxlength="${CASE_REASON_MAX}" required${o.reasonError ? ' aria-invalid="true" aria-describedby="reason-error"' : ""}>${esc(reasonValue)}</textarea>
      ${err}
      <span class="field-help">Up to ${CASE_REASON_MAX} characters. Same as <code class="inline">/case edit</code>; the change is logged with your name.</span>
    </div>
    <button class="btn" type="submit">Save reason</button>
  </form>
  <h2>Revoke</h2>
  ${revoke}`,
  });
}
