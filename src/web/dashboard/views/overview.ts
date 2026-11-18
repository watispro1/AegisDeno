import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { OverviewData } from "../data";
import { type GuildContext, emptyState, head, notice, shell } from "./layout";
import { gettingStartedCard, onboardingSteps, recentActivityCard, showGettingStarted } from "./gettingStarted";
import { caseTable, casesChart, checklistHtml, quickSettings, setupChecklist } from "./overviewParts";
import { type OverviewModel, moduleCards, moduleGrid } from "./overviewModules";
import { healthCard, overviewHealth, quickActions, statCard, ticketsCard } from "./overviewHero";
import { icon } from "./icons";

/* The overview's pieces live in overviewModules / overviewParts / overviewHero;
   these re-exports keep the old import paths working. */
export { caseTable, casesChart, setupChecklist, quickSettings, type CheckItem } from "./overviewParts";
export { moduleCards, moduleGrid, moduleReadiness, moduleStates, moduleTotals, type ModuleCard, type ModuleState, type OverviewModel } from "./overviewModules";
export { overviewHealth, type Health, type HealthLevel } from "./overviewHero";

/**
 * A server's overview, top to bottom: health summary, at-a-glance stats,
 * Common settings, then two columns (recent cases, the chart and open
 * tickets on the left; quick actions, the setup checklist and recent
 * activity on the right) and the full module board last.
 */
export function renderOverview(cfg: SiteConfig, ctx: GuildContext, data: OverviewData, model: OverviewModel = {}): string {
  const g = ctx.guild;
  const base = `/dashboard/${esc(g.id)}`;
  const x = model.extras;
  const cards = moduleCards(g.id, data, model);
  const checks = setupChecklist(g.id, model);
  const health = overviewHealth(checks, cards);
  const steps = model.snapshot ? onboardingSteps(g.id, model.snapshot, model.audit ?? [], ctx.viewer.userId) : [];
  const gettingStarted = showGettingStarted(model.snapshot, data, steps) ? gettingStartedCard(ctx, steps, model.canDismissOnboarding === true) : "";
  const ping = model.pingMs !== undefined && model.pingMs !== null && model.pingMs >= 0 ? model.pingMs : null;
  const headActions = `<a class="btn ghost sm" href="${base}/settings">${icon("settings")}Settings</a><a class="btn sm" href="${base}/cases">${icon("cases")}View cases</a>`;

  const recentCases = data.recentCases.length
    ? caseTable(ctx, data.recentCases, "The 10 most recent cases and warnings")
    : emptyState("No cases yet.", "Cases and warnings appear here as moderators use <code class=\"inline\">/warn</code>, <code class=\"inline\">/timeout</code>, <code class=\"inline\">/kick</code> and <code class=\"inline\">/ban</code>.", undefined, { icon: "▤" });

  return shell(cfg, {
    title: g.name,
    path: `/dashboard/${g.id}`,
    viewer: ctx.viewer,
    guild: ctx,
    active: "overview",
    body: `${head(g.name, "Overview of moderation and modules in this server.", [["Servers", "/dashboard"], [g.name, null]], { eyebrow: "Overview", actions: headActions })}
  ${notice(model.noticeCode)}
  ${healthCard(ctx, data, model, health, cards)}
  ${gettingStarted}
  <section class="ov-glance" aria-labelledby="glance-h">
  <h2 class="visually-hidden" id="glance-h">Last 7 and 30 days</h2>
  <dl class="stat-grid">
    ${statCard("Members", g.memberCount, { icon: "members" })}
    ${statCard("Cases, 7 days", data.cases7, { icon: "cases", href: `${base}/cases` })}
    ${statCard("Cases, 30 days", data.cases30, { icon: "cases", href: `${base}/cases` })}
    ${statCard("Warnings, 7 days", data.warnings7, { icon: "incident" })}
    ${statCard("Warnings, 30 days", data.warnings30, { icon: "incident" })}
    ${statCard("Open tickets", data.openTicketCount, { icon: "tickets" })}
    ${ping !== null ? statCard("Bot latency", ping, { note: "ms", icon: "pulse" }) : ""}
    ${statCard("Pending appeals", data.pendingAppeals, { note: data.pendingAppeals > 0 ? "see Appeals" : "", href: `${base}/appeals`, icon: "appeals", tone: data.pendingAppeals > 0 ? "warn" : undefined })}
    ${x ? statCard("Active giveaways", x.activeGiveaways, { href: `${base}/giveaways`, icon: "giveaways" }) : ""}
    ${x ? statCard("Automod hits, 7 days", x.automodHits7, { href: `${base}/settings/automod`, icon: "automod" }) : ""}
  </dl>
  </section>
  ${quickSettings(g.id, data, model)}
  <div class="ov-columns">
    <div class="ov-col-main">
      <section class="panel-card ov-cases" aria-labelledby="recent-cases-h">
        <div class="card-head"><h2 id="recent-cases-h">Recent cases</h2><a class="text-link" href="${base}/cases">All cases &rarr;</a></div>
        ${recentCases}
        ${data.pendingAppeals > 0 ? `<p class="card-foot"><a class="text-link" href="${base}/appeals">Review ${data.pendingAppeals.toLocaleString("en-US")} pending appeal${data.pendingAppeals === 1 ? "" : "s"} &rarr;</a></p>` : ""}
      </section>
      <section class="panel-card" aria-labelledby="chart-h">
        <h2 id="chart-h">Cases per day</h2>
        ${x ? casesChart(x.casesPerDay, Date.now()) : `<p class="muted">The chart appears once Aegis can read case history.</p>`}
      </section>
      ${ticketsCard(ctx, data)}
    </div>
    <div class="ov-col-side">
      ${quickActions(g.id, data)}
      <section class="panel-card" aria-labelledby="checklist-h">
        <h2 id="checklist-h">Setup checklist</h2>
        ${checklistHtml(checks)}
      </section>
      ${model.audit !== undefined ? recentActivityCard(g.id, model.audit) : ""}
    </div>
  </div>
  ${cards.length ? `<section class="mod-section" aria-labelledby="modules-h"><h2 id="modules-h">Modules</h2>${moduleGrid(cards, model)}</section>` : ""}`,
  });
}
