/**
 * The top of the redesigned overview: a server health summary worked out
 * from the setup checklist and module readiness, the at-a-glance stat cards,
 * quick actions (plain links to existing pages) and the open tickets list.
 * Pure presentation: nothing here reads the request or changes data.
 */
import { escapeHtml as esc } from "../../pages";
import type { OverviewData } from "../data";
import { type GuildContext, copyId, emptyState, person, personId, relTime } from "./layout";
import { icon } from "./icons";
import type { CheckItem } from "./overviewParts";
import { type ModuleCard, type OverviewModel, moduleTotals } from "./overviewModules";

export type HealthLevel = "good" | "attention" | "problem";

export interface Health {
  level: HealthLevel;
  title: string;
  detail: string;
}

/**
 * "good" when nothing is flagged, "attention" for setup steps and notes,
 * "problem" for a warning on the checklist or a module Aegis can't run.
 */
export function overviewHealth(checks: readonly CheckItem[], cards: readonly ModuleCard[]): Health {
  const t = moduleTotals([...cards]);
  const warns = checks.filter(c => c.level === "warn").length;
  const problems = warns + t.problem;
  const todo = checks.length - warns + t.setup;
  if (problems > 0) {
    return { level: "problem", title: `${problems} ${problems === 1 ? "problem needs" : "problems need"} fixing`, detail: "Some modules can't do their job until these are fixed. Each one links to the page that fixes it." };
  }
  if (todo > 0) {
    return { level: "attention", title: `${todo} ${todo === 1 ? "thing" : "things"} to finish setting up`, detail: "Aegis is running. A few settings would make it more useful here." };
  }
  return { level: "good", title: "Everything looks good", detail: "Aegis can see its channels, has the permissions it needs and every module that's on is configured." };
}

/** The health card at the top of the overview. */
export function healthCard(ctx: GuildContext, data: OverviewData, model: OverviewModel, h: Health, cards: readonly ModuleCard[]): string {
  const base = `/dashboard/${esc(ctx.guild.id)}`;
  const t = moduleTotals([...cards]);
  const facts: string[] = [];
  if (cards.length) facts.push(`<li><strong>${t.on}</strong> of ${cards.length} modules on</li>`);
  if (model.pingMs !== undefined && model.pingMs !== null && model.pingMs >= 0) facts.push(`<li><strong>${Math.round(model.pingMs).toLocaleString("en-US")} ms</strong> bot latency</li>`);
  facts.push(`<li><strong>${data.openTicketCount.toLocaleString("en-US")}</strong> open ticket${data.openTicketCount === 1 ? "" : "s"}</li>`);
  facts.push(`<li><strong>${data.pendingAppeals.toLocaleString("en-US")}</strong> pending appeal${data.pendingAppeals === 1 ? "" : "s"}</li>`);
  const glyph = h.level === "good" ? icon("check") : icon("alert");
  const cta = h.level === "good"
    ? `<a class="btn ghost sm" href="${base}/settings">Review settings</a>`
    : `<a class="btn sm" href="#checklist-h">See what to fix</a>`;
  return `<section class="ov-health" data-health="${h.level}" aria-labelledby="health-h">
    <span class="ov-health-badge" aria-hidden="true">${glyph}</span>
    <div class="ov-health-text">
      <p class="ov-health-kicker">Server health</p>
      <h2 id="health-h">${esc(h.title)}</h2>
      <p class="ov-health-detail">${esc(h.detail)}</p>
      <ul class="ov-health-facts">${facts.join("")}</ul>
    </div>
    <div class="ov-health-actions">${cta}<a class="btn ghost sm" href="${base}/cases">Open cases</a></div>
  </section>`;
}

/** One stat card: icon, label, value, optional note and link. */
export function statCard(label: string, value: number, o: { note?: string; href?: string; icon?: string; tone?: "warn" | "ok" } = {}): string {
  const inner = `<dt>${o.icon ? `<span class="stat-ico" aria-hidden="true">${icon(o.icon)}</span>` : ""}${esc(label)}</dt><dd>${value.toLocaleString("en-US")}${o.note ? ` <small>${esc(o.note)}</small>` : ""}</dd>`;
  return `<div class="stat"${o.tone ? ` data-tone="${o.tone}"` : ""}>${o.href ? `<a class="stat-link" href="${esc(o.href)}">${inner}</a>` : inner}</div>`;
}

interface QuickAction { icon: string; label: string; detail: string; href: string; badge?: number }

/** Shortcuts to the jobs moderators do most, as links to the existing pages. */
export function quickActions(guildId: string, data: OverviewData): string {
  const b = `/dashboard/${esc(guildId)}`;
  const actions: QuickAction[] = [
    { icon: "search", label: "Find a case", detail: "Filter by member, action or moderator", href: `${b}/cases` },
    { icon: "appeals", label: "Review appeals", detail: "Accept or deny ban appeals", href: `${b}/appeals`, badge: data.pendingAppeals },
    { icon: "incident", label: "Incident Mode", detail: "Lock the server down during a raid", href: `${b}/incident` },
    { icon: "announce", label: "Post an announcement", detail: "Send an embed to a channel", href: `${b}/announce` },
    { icon: "members", label: "Look up a member", detail: "History, notes and Trust Score", href: `${b}/members` },
    { icon: "backup", label: "Back up settings", detail: "Export or import this server's setup", href: `${b}/tools` },
  ];
  return `<section class="panel-card ov-actions" aria-labelledby="quick-actions-list-h">
    <h2 id="quick-actions-list-h">Quick actions</h2>
    <ul class="qa-list">${actions.map(a => `<li><a class="qa-item" href="${esc(a.href)}"><span class="qa-ico" aria-hidden="true">${icon(a.icon)}</span><span class="qa-text"><span class="qa-label">${esc(a.label)}</span><span class="qa-detail">${esc(a.detail)}</span></span>${a.badge ? `<span class="count-badge qa-badge">${a.badge.toLocaleString("en-US")}<span class="visually-hidden"> pending</span></span>` : `<span class="qa-arrow" aria-hidden="true">${icon("arrow")}</span>`}</a></li>`).join("")}</ul>
  </section>`;
}

/** Open tickets, newest first, with who claimed them. */
export function ticketsCard(ctx: GuildContext, data: OverviewData): string {
  const body = data.openTickets.length
    ? `<ul class="feed ov-tickets">${data.openTickets
        .map(t => `<li><strong>#${esc(t.id)}</strong> ${copyId(String(t.id), "Copy ticket ID")} opened by ${personId(ctx, t.userId)}, ${relTime(t.createdAt)}${
          t.claimedBy ? `, claimed by ${person(ctx, t.claimedBy)}` : ", unclaimed"
        }</li>`)
        .join("")}</ul>${data.openTicketCount > data.openTickets.length ? `<p class="muted">Showing the newest ${data.openTickets.length} of ${data.openTicketCount}.</p>` : ""}`
    : data.openTicketCount > 0
      // The count and the list are separate reads; never claim "none" next to a non-zero count.
      ? `<p class="muted">${data.openTicketCount.toLocaleString("en-US")} open ticket${data.openTicketCount === 1 ? "" : "s"}, but none could be listed just now. Reload to try again, or see them in Discord.</p>`
      : emptyState("No open tickets.", "New tickets show up here as members open them.", undefined, { icon: "✉" });
  return `<section class="panel-card" aria-labelledby="tickets-h">
    <div class="card-head"><h2 id="tickets-h">Open tickets</h2><span class="count-badge">${data.openTicketCount.toLocaleString("en-US")}</span></div>
    ${body}
  </section>`;
}
