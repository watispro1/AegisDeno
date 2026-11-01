/** Incident Mode pages: /:guildId/incident (start, end, defaults, history) and /:guildId/incident/:id (report). */
import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { ChannelOption } from "../botView";
import { formatMinutes, summarizeIncident, INCIDENT_MAX_MINUTES, MAX_SLOWMODE_SECONDS, MAX_GATE_TIMEOUT_MINUTES, type IncidentConfig, type IncidentOptions } from "../../../services/incidentLogic";
import type { IncidentRecord } from "../../../services/incidentStore";
import { type GuildContext, csrfField, emptyState, fmtDate, notice, person } from "./layout";
import { Form, channelPicks, type FormState, type Values } from "./form";
import { errorSummary, modulePage } from "./parts";

export function incidentValues(o: IncidentOptions, auto?: IncidentConfig["autoTrigger"]): Values {
  return {
    durationMinutes: String(o.durationMinutes), slowmodeSeconds: String(o.slowmodeSeconds), slowmodeChannelIds: o.slowmodeChannelIds.join(","),
    lockMode: o.lockMode, lockChannelIds: o.lockChannelIds.join(","), joinGate: o.joinGate, minAccountAgeDays: String(o.minAccountAgeDays),
    gateTimeoutMinutes: String(o.gateTimeoutMinutes), pauseInvites: o.pauseInvites,
    ...(auto ? { autoEnabled: auto.enabled, autoJoins: String(auto.joins), autoSeconds: String(auto.seconds) } : {}),
  };
}

function optionFields(f: Form, channels: ChannelOption[], hidden: ReadonlySet<string>): string {
  const picks = channelPicks(channels, hidden);
  return `<div class="field-row two">
      ${f.number("durationMinutes", "Ends automatically after (minutes)", 1, INCIDENT_MAX_MINUTES, "Up to 1440 (24 hours). Survives restarts.")}
      ${f.number("slowmodeSeconds", "Slowmode (seconds)", 0, MAX_SLOWMODE_SECONDS, "0 leaves slowmode alone. Channels already slower keep theirs.")}
    </div>
    ${f.multi("slowmodeChannelIds", "Slowmode channels", picks, "None picked: every public text channel Aegis can manage.")}
    ${f.select("lockMode", "Lock @everyone from sending", [
      { value: "none", label: "Don't lock" }, { value: "public", label: "Every public channel" }, { value: "selected", label: "Only the channels picked below" },
    ])}
    ${f.multi("lockChannelIds", "Channels to lock", picks, "Used when locking only picked channels. Private channels are never locked by \"every public channel\".")}
    <div class="field-row two">
      ${f.select("joinGate", "Join gate for new accounts", [{ value: "timeout", label: "Time them out" }, { value: "kick", label: "Kick them" }, { value: "off", label: "Off" }], "Bots and members above Aegis are never gated.")}
      ${f.number("minAccountAgeDays", "Gate accounts younger than (days)", 1, 365)}
    </div>
    ${f.number("gateTimeoutMinutes", "Gate timeout length (minutes)", 1, MAX_GATE_TIMEOUT_MINUTES)}
    ${f.checkbox("pauseInvites", "Pause server invites", "Needs Manage Server for Aegis. Resumed when the incident ends, unless invites were already paused.")}`;
}

function timeline(rec: IncidentRecord, ctx: GuildContext, limit: number): string {
  const events = rec.timeline.slice(-limit).reverse();
  if (!events.length) return emptyState("No events yet.", "Joins, gated accounts, cases and deletions appear here as they happen.");
  return `<ol class="timeline">${events.map(e => `<li class="tl-${esc(e.kind)}">
      <time datetime="${esc(new Date(e.at).toISOString())}">${esc(fmtDate(new Date(e.at)).slice(11))}</time>
      <span class="tag">${esc(e.kind)}</span> ${esc(e.text)}${e.caseId ? ` · <a href="/dashboard/${esc(ctx.guild.id)}/cases/${esc(e.caseId)}">case</a>` : ""}
    </li>`).join("")}</ol>${rec.timelineTruncated ? `<p class="faint">The timeline reached its limit; later events are counted in the totals but not listed.</p>` : ""}`;
}

function summary(rec: IncidentRecord): string {
  return `<ul class="stat-list">${summarizeIncident({ startedAt: new Date(rec.startedAt), endedAt: rec.endedAt ? new Date(rec.endedAt) : null, counts: rec.counts, changes: rec.changes, invitesPaused: rec.invitesPaused, caseIds: rec.caseIds.slice(0, 5) })
    .map(l => `<li>${esc(l)}</li>`).join("")}</ul>`;
}

export function renderIncident(cfg: SiteConfig, ctx: GuildContext, o: {
  active: IncidentRecord | null; recent: IncidentRecord[]; config: IncidentConfig; channels: ChannelOption[]; hidden: ReadonlySet<string>;
  noticeCode: string | null; startState?: FormState; settingsState?: FormState;
}): string {
  const base = `/dashboard/${esc(ctx.guild.id)}/incident`;
  const start = new Form(o.startState ?? { values: incidentValues(o.config.defaults), errors: {} }, "inc-");
  const defaults = new Form(o.settingsState ?? { values: incidentValues(o.config.defaults, o.config.autoTrigger), errors: {} }, "incd-");
  const a = o.active;
  const activeCard = a
    ? `<section class="panel-card incident-live" aria-labelledby="inc-live-h">
        <h2 id="inc-live-h"><span class="status-pill off">Active</span> Incident Mode is on</h2>
        <p><strong>Reason:</strong> ${esc(a.reason)}</p>
        <p>Started ${esc(fmtDate(new Date(a.startedAt)))} by ${a.trigger === "auto" ? "the auto-trigger" : person(ctx, a.startedBy.id)}. Ends automatically ${esc(fmtDate(new Date(a.endsAt)))}.</p>
        ${summary(a)}
        <form class="dash-form" method="post" action="${base}/end" data-confirm="End Incident Mode and restore every channel it changed?">
          ${csrfField(ctx.viewer)}
          <div class="field"><label for="inc-end-reason">Why it is over (optional)</label><input type="text" id="inc-end-reason" name="reason" maxlength="300" autocomplete="off"></div>
          <button class="btn danger" type="submit">End incident and restore</button>
          <a class="btn ghost" href="${base}/${esc(a.id)}">Full timeline</a>
        </form>
        <h3>Latest events</h3>
        ${timeline(a, ctx, 25)}
      </section>`
    : `<section class="panel-card" aria-labelledby="inc-start-h">
        <h2 id="inc-start-h">Start Incident Mode</h2>
        <p class="muted">For raids and spam waves. Everything Aegis changes is recorded and put back exactly when the incident ends, by you or on its timer. Staff are alerted in the mod log without pings.</p>
        ${errorSummary(o.startState?.errors ?? {}, "f-inc-")}
        <form class="dash-form" method="post" action="${base}/start" novalidate data-confirm="Start Incident Mode now? Channels change immediately.">
          ${csrfField(ctx.viewer)}
          ${start.text("reason", "Reason", 300, "Shown in the mod log and the report.")}
          ${optionFields(start, o.channels, o.hidden)}
          <button class="btn danger" type="submit">Start Incident Mode</button>
        </form>
      </section>`;
  const history = o.recent.filter(r => r.status === "ended");
  return modulePage(cfg, ctx, {
    active: "incident",
    title: "Incident Mode",
    lead: "Raid protection in one switch: slowmode, lockdown, a join gate for new accounts and paused invites, all undone exactly when it ends. Same as <code class=\"inline\">/incident</code>.",
    path: base,
    body: `${notice(o.noticeCode)}
  ${activeCard}
  <section class="panel-card" aria-labelledby="inc-def-h">
    <h2 id="inc-def-h">Defaults and auto-trigger</h2>
    <p class="muted">Used by <code class="inline">/incident start</code> when an option is left blank, and by the auto-trigger.</p>
    ${errorSummary(o.settingsState?.errors ?? {}, "f-incd-")}
    <form class="dash-form" method="post" action="${base}/settings" novalidate data-track-changes>
      ${csrfField(ctx.viewer)}
      <fieldset><legend>Auto-trigger</legend>
        ${defaults.checkbox("autoEnabled", "Start Incident Mode on its own when many accounts join at once", "Off by default. Uses the defaults below.")}
        <div class="field-row two">
          ${defaults.number("autoJoins", "Joins", 3, 500)}
          ${defaults.number("autoSeconds", "Within (seconds)", 5, 600)}
        </div>
      </fieldset>
      ${optionFields(defaults, o.channels, o.hidden)}
      <button class="btn" type="submit" data-save-button>Save defaults</button>
    </form>
  </section>
  <h2>Past incidents</h2>
  ${history.length ? `<div class="table-wrap"><table class="case-table">
    <caption class="visually-hidden">Past incidents</caption>
    <thead><tr><th scope="col">Started</th><th scope="col">Length</th><th scope="col">Reason</th><th scope="col">Joins</th><th scope="col">Gated</th><th scope="col">Report</th></tr></thead>
    <tbody>${history.map(r => `<tr>
      <td data-label="Started">${esc(fmtDate(new Date(r.startedAt)))}</td>
      <td data-label="Length">${esc(formatMinutes(((r.endedAt ? new Date(r.endedAt).getTime() : Date.now()) - new Date(r.startedAt).getTime()) / 60_000))}</td>
      <td data-label="Reason">${esc(r.reason.slice(0, 80))}</td>
      <td data-label="Joins">${r.counts.joins}</td><td data-label="Gated">${r.counts.gated}</td>
      <td data-label="Report"><a href="${base}/${esc(r.id)}">View</a></td></tr>`).join("")}</tbody></table></div>`
    : emptyState("No past incidents.", "Reports are kept for 90 days after an incident ends.")}`,
  });
}

export function renderIncidentReport(cfg: SiteConfig, ctx: GuildContext, rec: IncidentRecord): string {
  const base = `/dashboard/${esc(ctx.guild.id)}/incident`;
  const changes = rec.changes.length
    ? `<ul>${rec.changes.map(c => `<li>#${esc(c.name)}: ${[c.slowmode ? `slowmode ${c.slowmode.from}s → ${c.slowmode.to}s` : "", c.lock ? `locked (was ${c.lock.previous})` : ""].filter(Boolean).join(", ")}</li>`).join("")}</ul>`
    : `<p class="muted">No channels were changed.</p>`;
  return modulePage(cfg, ctx, {
    active: "incident",
    title: `Incident report`,
    lead: `${rec.status === "ended" ? "Ended" : "Active"} · started ${esc(fmtDate(new Date(rec.startedAt)))}${rec.endedAt ? ` · ended ${esc(fmtDate(new Date(rec.endedAt)))}` : ""}`,
    path: `${base}/${esc(rec.id)}`,
    body: `<p><a href="${base}">← Incident Mode</a></p>
  <section class="panel-card"><h2>Summary</h2>
    <p><strong>Reason:</strong> ${esc(rec.reason)}${rec.endReason ? ` · <strong>Ended:</strong> ${esc(rec.endReason)}` : ""}</p>
    ${summary(rec)}
    ${rec.caseIds.length ? `<p>Cases: ${rec.caseIds.slice(0, 50).map(id => `<a href="/dashboard/${esc(ctx.guild.id)}/cases/${esc(id)}"><code class="inline">${esc(id.slice(-8))}</code></a>`).join(" ")}</p>` : ""}
  </section>
  <section class="panel-card"><h2>What changed</h2>${changes}</section>
  <section class="panel-card"><h2>Timeline</h2>${timeline(rec, ctx, 500)}</section>`,
  });
}
