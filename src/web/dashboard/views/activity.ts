import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { AuditEntry } from "../audit";
import { SECTION_TITLES, SETTINGS_SECTIONS, type SettingsSection } from "../validation";
import { type GuildContext, fmtDate, head, shell } from "./layout";
import { pagerNav } from "./parts";

/* ── Activity ──────────────────────────────────────────────────────── */

const AUDIT_LABELS: Record<string, string> = {
  "case.reason": "Edited a case reason",
  "case.revoke": "Revoked a case",
  "case.revoke+unban": "Revoked a ban and unbanned",
  "appeal.approved": "Approved an appeal",
  "appeal.denied": "Denied an appeal",
  "panel.ticket": "Posted the ticket panel",
  "panel.verification": "Posted the verification panel",
  "panel.role": "Re-posted a role panel",
};

export function auditLabel(action: string): string {
  if (AUDIT_LABELS[action]) return AUDIT_LABELS[action];
  const m = action.match(/^settings\.(\w+)$/);
  if (m && (SETTINGS_SECTIONS as readonly string[]).includes(m[1])) return `Changed ${SECTION_TITLES[m[1] as SettingsSection].toLowerCase()} settings`;
  return action;
}

export function renderActivity(
  cfg: SiteConfig,
  ctx: GuildContext,
  page: number,
  result: { items: AuditEntry[]; total: number },
  perPage: number,
): string {
  const g = ctx.guild;
  const base = `/dashboard/${esc(g.id)}/activity`;
  const pages = Math.max(1, Math.ceil(result.total / perPage));
  const current = Math.min(page, pages);
  const rows = result.items.map(e => `<tr>
      <td data-label="When">${esc(fmtDate(e.createdAt))}</td>
      <td data-label="Who">${esc(e.username)} <span class="faint">${esc(e.userId)}</span></td>
      <td data-label="What">${esc(auditLabel(e.action))}${e.target ? ` <code class="inline">${esc(e.target)}</code>` : ""}</td>
      <td data-label="Details">${e.summary ? esc(e.summary) : `<span class="faint">No field changed</span>`}</td>
    </tr>`).join("");

  return shell(cfg, {
    title: `Dashboard activity in ${g.name}`,
    path: `/dashboard/${g.id}/activity`,
    viewer: ctx.viewer,
    guild: ctx,
    active: "activity",
    body: `${head("Dashboard activity", "Every change made through this dashboard for this server, newest first. Kept for 180 days. Changes made with slash commands are in your log channel instead.", [["Servers", "/dashboard"], [g.name, `/dashboard/${g.id}`], ["Activity", null]])}
  ${result.items.length ? `<div class="table-wrap"><table class="case-table">
    <caption class="visually-hidden">Dashboard changes</caption>
    <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">What</th><th scope="col">Details</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>` : `<div class="empty-state"><strong>No dashboard changes yet.</strong>Saves, revokes, appeal decisions and posted panels show up here.</div>`}
  ${pagerNav(base, p => (p > 1 ? `?page=${p}` : ""), current, pages, result.total, "change")}`,
  });
}
