import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { CaseRecord, OverviewData } from "../data";
import { type GuildContext, fmtDate, head, person, shell } from "./layout";

/* ── Overview ──────────────────────────────────────────────────────── */

function caseRows(ctx: GuildContext, cases: CaseRecord[]): string {
  const g = esc(ctx.guild.id);
  return cases
    .map(c => `<tr>
      <td data-label="When">${esc(fmtDate(c.createdAt))}</td>
      <td data-label="Action"><a class="case-link" href="/dashboard/${g}/cases/${esc(c.id)}">${esc(c.action)}</a>${c.revoked ? ' <span class="tag warn">revoked</span>' : ""}</td>
      <td data-label="Member">${person(ctx, c.userId)}</td>
      <td data-label="Moderator">${person(ctx, c.moderatorId)}</td>
      <td data-label="Reason">${esc(c.reason.length > 120 ? c.reason.slice(0, 117) + "…" : c.reason)}</td>
    </tr>`)
    .join("");
}

export function caseTable(ctx: GuildContext, cases: CaseRecord[], caption: string): string {
  return `<div class="table-wrap"><table class="case-table">
    <caption class="visually-hidden">${esc(caption)}</caption>
    <thead><tr><th scope="col">When</th><th scope="col">Action</th><th scope="col">Member</th><th scope="col">Moderator</th><th scope="col">Reason</th></tr></thead>
    <tbody>${caseRows(ctx, cases)}</tbody>
  </table></div>`;
}

export function renderOverview(cfg: SiteConfig, ctx: GuildContext, data: OverviewData): string {
  const g = ctx.guild;
  const stat = (label: string, value: number, note = "") =>
    `<div class="stat"><dt>${esc(label)}</dt><dd>${value.toLocaleString("en-US")}${note ? ` <small>${esc(note)}</small>` : ""}</dd></div>`;
  const tickets = data.openTickets.length
    ? `<ul class="notes">${data.openTickets
        .map(t => `<li><strong>#${esc(t.id)}</strong> opened by ${person(ctx, t.userId)}, ${esc(fmtDate(t.createdAt))}${
          t.claimedBy ? `, claimed by ${person(ctx, t.claimedBy)}` : ", unclaimed"
        }</li>`)
        .join("")}</ul>${data.openTicketCount > data.openTickets.length ? `<p class="muted">Showing the newest ${data.openTickets.length} of ${data.openTicketCount}.</p>` : ""}`
    : `<p class="muted">No open tickets.</p>`;

  return shell(cfg, {
    title: g.name,
    path: `/dashboard/${g.id}`,
    viewer: ctx.viewer,
    guild: ctx,
    active: "overview",
    body: `${head(g.name, "", [["Servers", "/dashboard"], [g.name, null]])}
  <h2>Last 7 and 30 days</h2>
  <dl class="stat-grid">
    ${stat("Members", g.memberCount)}
    ${stat("Cases, 7 days", data.cases7)}
    ${stat("Cases, 30 days", data.cases30)}
    ${stat("Warnings, 7 days", data.warnings7)}
    ${stat("Warnings, 30 days", data.warnings30)}
    ${stat("Open tickets", data.openTicketCount)}
    ${data.pendingAppeals > 0 ? stat("Pending appeals", data.pendingAppeals, "see Appeals") : ""}
  </dl>
  <h2>Recent cases</h2>
  ${data.recentCases.length ? caseTable(ctx, data.recentCases, "The 10 most recent cases and warnings") : `<p class="muted">No cases or warnings recorded yet.</p>`}
  <p><a class="text-link" href="/dashboard/${esc(g.id)}/cases">All cases &rarr;</a></p>
  ${data.pendingAppeals > 0 ? `<p><a class="text-link" href="/dashboard/${esc(g.id)}/appeals">Review ${data.pendingAppeals.toLocaleString("en-US")} pending appeal${data.pendingAppeals === 1 ? "" : "s"} &rarr;</a></p>` : ""}
  <h2>Open tickets</h2>
  ${tickets}`,
  });
}
