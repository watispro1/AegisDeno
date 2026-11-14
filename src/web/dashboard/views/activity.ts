import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { AuditEntry } from "../audit";
import { SECTION_TITLES, SETTINGS_SECTIONS, type SettingsSection } from "../validation";
import { type GuildContext, copyId, head, relTime, shell } from "./layout";
import { pagerNav } from "./parts";
import { countBy, helpPanel, listFoot, listTools, pagedTable, rowAttrs, summaryStrip } from "./moduleKit";

const AUDIT_GROUPS: Array<[RegExp, string]> = [
  [/^settings\.|^modules\.|^module\./, "Settings"],
  [/^case\.|^cases\.|^member\.|^appeal\.|^watchlist\./, "Moderation"],
  [/^panel\.|^announce\.|^automation\.|^autoresponder\./, "Messages"],
  [/^giveaway\.|^suggestion\.|^economy\./, "Community"],
  [/^incident\.|^trust\./, "Safety"],
];

/** The filter chip an audit action belongs to. */
export function auditGroup(action: string): string {
  for (const [re, label] of AUDIT_GROUPS) if (re.test(action)) return label;
  return "Other";
}

/* Activity */

const AUDIT_LABELS: Record<string, string> = {
  "case.reason": "Edited a case reason",
  "settings.automod.exemptions": "Changed one automod rule's exemptions",
  "cases.export": "Exported cases as CSV",
  "onboarding.dismiss": "Hid the Get started checklist",
  "case.revoke": "Revoked a case",
  "case.revoke+unban": "Revoked a ban and unbanned",
  "appeal.approved": "Approved an appeal",
  "appeal.denied": "Denied an appeal",
  "panel.ticket": "Posted the ticket panel",
  "panel.verification": "Posted the verification panel",
  "panel.role": "Re-posted a role panel",
  "autoresponder.add": "Added an autoresponder",
  "autoresponder.toggle": "Turned an autoresponder on or off",
  "autoresponder.remove": "Deleted an autoresponder",
  "module.autoresponders": "Switched autoresponders on or off",
  "module.suggestions": "Changed the suggestions channel",
  "automation.create": "Scheduled a message",
  "automation.cancel": "Cancelled a scheduled message",
  "announce.post": "Posted an announcement",
  "giveaway.end": "Ended a giveaway early",
  "giveaway.reroll": "Rerolled a giveaway",
  "suggestion.approve": "Approved a suggestion",
  "suggestion.deny": "Denied a suggestion",
  "suggestion.consider": "Marked a suggestion as considered",
  "watchlist.remove": "Removed a member from their Ghost Watch list",
  "giveaway.cancel": "Cancelled a giveaway",
  "incident.start": "Started Incident Mode",
  "incident.end": "Ended Incident Mode",
  "incident.settings": "Changed Incident Mode settings",
  "trust.settings": "Changed Trust Score settings",
  "modmail.settings": "Changed ModMail settings",
  "digest.settings": "Changed staff digest settings",
  "modules.save": "Saved module switches",
  "settings.export": "Exported server settings",
  "settings.import": "Imported server settings",
  "member.action": "Moderated a member",
  "member.note.add": "Added a staff note",
  "economy.toggle": "Turned the economy on or off",
  "economy.settings": "Changed economy settings",
  "economy.shop.add": "Added a shop item",
  "economy.shop.edit": "Edited a shop item",
  "economy.shop.remove": "Removed a shop item",
  "economy.give": "Gave a member coins",
  "economy.take": "Took coins from a member",
  "economy.reset": "Reset a member's balance",
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
  const rows = result.items.map(e => `<tr${rowAttrs(auditGroup(e.action), { when: e.createdAt.getTime(), who: e.username.toLowerCase() })}>
      <td data-label="When">${relTime(e.createdAt)}</td>
      <td data-label="Who">${esc(e.username)} <span class="faint">${esc(e.userId)}</span> ${copyId(e.userId, "Copy user ID")}</td>
      <td data-label="What">${esc(auditLabel(e.action))}${e.target ? ` <code class="inline">${esc(e.target)}</code> ${copyId(e.target, "Copy")}` : ""}</td>
      <td data-label="Details">${e.summary ? esc(e.summary) : `<span class="faint">No field changed</span>`}</td>
    </tr>`).join("");

  const groups = [...countBy(result.items, e => auditGroup(e.action))].map(([value, count]) => ({ value, label: value, count }));
  const people = new Set(result.items.map(e => e.userId)).size;
  const stats = summaryStrip([
    { label: "Changes kept", value: result.total, hint: "Last 180 days" },
    { label: "On this page", value: result.items.length, hint: `Page ${current} of ${pages}` },
    { label: "People on this page", value: people },
    ...(result.items[0] ? [{ label: "Latest change", value: "", html: relTime(result.items[0].createdAt) }] : []),
  ], "Activity summary");
  return shell(cfg, {
    title: `Dashboard activity in ${g.name}`,
    path: `/dashboard/${g.id}/activity`,
    viewer: ctx.viewer,
    guild: ctx,
    active: "activity",
    body: `${head("Dashboard activity", "Every change made through this dashboard for this server, newest first. Kept for 180 days. Changes made with slash commands are in your log channel instead.", [["Servers", "/dashboard"], [g.name, `/dashboard/${g.id}`], ["Activity", null]])}
  ${result.items.length ? stats : ""}
  ${result.items.length ? `${listTools("audit-table", {
    search: "Filter this page by person, action or detail",
    chips: groups.length > 1 ? groups : undefined,
    chipLabel: "Kind of change",
    sorts: [{ value: "when:desc", label: "Newest first" }, { value: "when:asc", label: "Oldest first" }, { value: "who:asc", label: "Person A–Z" }],
  })}<div class="table-wrap"><table class="case-table" id="audit-table"${pagedTable(25)}>
    <caption class="visually-hidden">Dashboard changes</caption>
    <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">What</th><th scope="col">Details</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>${listFoot("audit-table", "No change on this page matches. Clear the search, pick another kind, or try an older page.")}` : `<div class="empty-state"><strong>No dashboard changes yet.</strong>Saves, revokes, appeal decisions and posted panels show up here. <a class="btn ghost sm empty-action" href="/dashboard/${esc(g.id)}/settings">Open settings</a></div>`}
  ${helpPanel("About this log", [
    ["What's recorded", "Every save, revoke, appeal decision, posted panel and export made through this dashboard, with who did it."],
    ["What isn't", "Slash-command changes. Those go to your mod log channel."],
    ["Filters", "Search, kind chips and sort work on the page you're viewing. Use Older for earlier changes."],
  ])}
  ${pagerNav(base, p => (p > 1 ? `?page=${p}` : ""), current, pages, result.total, "change")}`,
  });
}
