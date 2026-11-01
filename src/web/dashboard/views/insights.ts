/** Analytics (/:guildId/analytics) and Modules & backup (/:guildId/tools: module switches, settings export/import). */
import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { AnalyticsData } from "../extras";
import { MODULE_SWITCH_KEYS, type ModuleSwitches } from "../../../services/guildConfigNormalize";
import { MODULE_LABELS } from "../../../services/moduleSwitches";
import { SETTINGS_IMPORT_MAX_CHARS } from "../settingsTransfer";
import { type GuildContext, csrfField, notice } from "./layout";
import { modulePage } from "./parts";
import { barChart, lineChart, rankBars } from "./charts";

export const ANALYTICS_RANGES = [7, 30, 90] as const;

export function renderAnalytics(cfg: SiteConfig, ctx: GuildContext, o: { days: number; data: AnalyticsData }): string {
  const base = `/dashboard/${esc(ctx.guild.id)}/analytics`;
  const d = o.data;
  const range = ANALYTICS_RANGES.map(n => n === o.days ? `<span class="btn sm" aria-current="page">${n} days</span>` : `<a class="btn ghost sm" href="${base}?days=${n}">${n} days</a>`).join(" ");
  const empty = d.joins.every(n => n === 0) && d.leaves.every(n => n === 0);
  return modulePage(cfg, ctx, {
    active: "analytics",
    title: "Analytics",
    lead: "Joins and leaves, moderation cases and automod hits over time. Counts only; nothing here identifies members.",
    path: base,
    body: `<nav class="btn-row range-nav" aria-label="Time range">${range}</nav>
  <div class="insight-grid">
    <section class="panel-card span-2"><h2>Joins and leaves</h2>
      ${lineChart({ label: "Joins", values: d.joins, cls: "s-join" }, { label: "Leaves", values: d.leaves, cls: "s-leave" }, d.days, "Joins and leaves per day")}
      ${empty ? `<p class="faint">Join and leave counts start from this version; older days show zero.</p>` : ""}
    </section>
    <section class="panel-card"><h2>Cases and warnings per day</h2>${barChart(d.cases, d.days, "Cases and warnings per day")}</section>
    <section class="panel-card"><h2>Automod hits per day</h2>${barChart(d.automod, d.days, "Automod hits per day", "bar alt")}</section>
    <section class="panel-card"><h2>Cases by type</h2>${rankBars(d.casesByType, k => esc(k), "No cases in this range.")}</section>
    <section class="panel-card"><h2>Cases by moderator</h2>${rankBars(d.casesByModerator, k => { const n = ctx.nameOf(k); return n ? esc(n) : `<code class="inline">${esc(k)}</code>`; }, "No cases in this range.")}</section>
    <section class="panel-card"><h2>Automod hits by rule</h2>${rankBars(d.automodByRule, k => esc(k), "No automod hits in this range.")}</section>
  </div>`,
  });
}

export function renderTools(cfg: SiteConfig, ctx: GuildContext, o: { switches: ModuleSwitches; noticeCode: string | null; importError?: string | null; importWarnings?: string[]; importText?: string }): string {
  const base = `/dashboard/${esc(ctx.guild.id)}/tools`;
  const help: Record<string, string> = {
    tickets: "Off: the ticket panel button refuses new tickets. Open tickets keep working.",
    giveaways: "Off: /giveaway start is refused. Running giveaways still end and draw.",
    scheduled: "Off: no new scheduled messages from /automation or the dashboard. Already scheduled ones still post.",
    appeals: "Off: /appeal submit is refused. Pending appeals can still be reviewed.",
  };
  return modulePage(cfg, ctx, {
    active: "tools",
    title: "Modules & backup",
    lead: "Switch whole modules off, and save or restore this server's Aegis settings as a file.",
    path: base,
    body: `${notice(o.noticeCode)}
  <section class="panel-card" aria-labelledby="mod-h"><h2 id="mod-h">Modules</h2>
    <form class="dash-form" method="post" action="${base}/modules" data-track-changes>
      ${csrfField(ctx.viewer)}
      ${MODULE_SWITCH_KEYS.map(k => `<div class="field"><label class="check switch" for="f-module_${k}"><input type="checkbox" id="f-module_${k}" name="module_${k}"${o.switches[k] ? " checked" : ""}><span>${esc(MODULE_LABELS[k])}<small>${esc(help[k])}</small></span></label></div>`).join("")}
      <button class="btn" type="submit" data-save-button>Save modules</button>
    </form>
  </section>
  <section class="panel-card" aria-labelledby="exp-h"><h2 id="exp-h">Export settings</h2>
    <p class="muted">Downloads logging, welcome and goodbye, escalation, tickets, role panel limits, automod, Incident Mode and module settings as JSON. Cases, warnings and members are never included.</p>
    <p><a class="btn" href="${base}/export" download>Download settings (.json)</a></p>
  </section>
  <section class="panel-card" aria-labelledby="imp-h"><h2 id="imp-h">Import settings</h2>
    <p class="muted">Restores a file from Export, here or from another server. Channels and roles that don't exist here, that Aegis can't see, or that are above your highest role are skipped and listed. Verification and starboard are not included.</p>
    ${o.importError ? `<div class="error-summary" role="alert" tabindex="-1" data-error-summary><h2>Nothing was changed.</h2><p>${esc(o.importError)}</p></div>` : ""}
    ${o.importWarnings?.length ? `<div class="callout warn" role="status"><p>Imported, with these adjustments:</p><ul>${o.importWarnings.map(w => `<li>${esc(w)}</li>`).join("")}</ul></div>` : ""}
    <form class="dash-form" method="post" action="${base}/import" data-confirm="Replace this server's settings with the imported file?">
      ${csrfField(ctx.viewer)}
      <div class="field"><label for="f-import-file">Choose an export file</label><input type="file" id="f-import-file" accept="application/json,.json" data-import-file="f-import-json"><span class="field-help">Read in your browser and pasted below; or paste the JSON yourself.</span></div>
      <div class="field"><label for="f-import-json">Settings JSON</label><textarea id="f-import-json" name="json" rows="8" maxlength="${SETTINGS_IMPORT_MAX_CHARS}" spellcheck="false" required>${esc(o.importText ?? "")}</textarea></div>
      <button class="btn danger" type="submit">Import settings</button>
    </form>
  </section>`,
  });
}
