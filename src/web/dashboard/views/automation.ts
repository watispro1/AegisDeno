/** Automation module pages: autoresponders, scheduled messages and announcements. */
import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { ChannelOption } from "../botView";
import type { AutoResponderRow, AutomationRow } from "../moduleData";
import { AUTORESPONDER_RESPONSE_MAX, AUTORESPONDER_TRIGGER_MAX, SCHEDULED_MESSAGE_MAX } from "../moduleValidation";
import { EMBED_LIMITS } from "../../../services/embedSpec";
import { type GuildContext, csrfField, emptyState, fmtDate, moduleStatus, notice, person } from "./layout";
import { Form, channelOptions, channelPickerEmptyNote, type FormState } from "./form";
import { actionButton, errorSummary, modulePage, tableFilter } from "./parts";
import { embedBuilder, variableReference } from "./embedBuilder";

const MATCH_LABELS: Record<string, string> = { contains: "Contains", exact: "Exact match", startsWith: "Starts with" };

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function renderAutoResponders(cfg: SiteConfig, ctx: GuildContext, o: {
  rows: AutoResponderRow[]; enabled: boolean; noticeCode: string | null; state?: FormState; max: number;
}): string {
  const g = esc(ctx.guild.id);
  const base = `/dashboard/${g}/autoresponders`;
  const state = o.state ?? { values: { matchType: "contains" }, errors: {} };
  const f = new Form(state, "ar-");
  const rows = o.rows.map(r => `<tr>
      <td data-label="Trigger"><code class="inline">${esc(r.trigger)}</code></td>
      <td data-label="Match">${esc(MATCH_LABELS[r.matchType] ?? r.matchType)}</td>
      <td data-label="Response" class="prewrap">${esc(clip(r.response, 160))}</td>
      <td data-label="Status">${moduleStatus(r.enabled, r.enabled ? "On" : "Off")}</td>
      <td data-label="Actions"><span class="btn-row">
        ${actionButton(`${base}/${esc(r.id)}/toggle`, ctx.viewer.csrf, r.enabled ? "Turn off" : "Turn on", { fields: { enabled: r.enabled ? "0" : "1" } })}
        ${actionButton(`${base}/${esc(r.id)}/delete`, ctx.viewer.csrf, "Delete", { danger: true, confirm: `Delete the autoresponder for "${clip(r.trigger, 60)}"? This can't be undone.` })}
      </span></td>
    </tr>`).join("");
  return modulePage(cfg, ctx, {
    active: "autoresponders",
    title: "Autoresponders",
    lead: "Automatic replies when a message matches a trigger. The same list as <code class=\"inline\">/autoresponder</code>.",
    path: base,
    body: `${notice(o.noticeCode)}
  <div class="module-head">
    ${moduleStatus(o.enabled)}
    <form class="inline-form" method="post" action="${base}/module">${csrfField(ctx.viewer)}<input type="hidden" name="enabled" value="${o.enabled ? "0" : "1"}">
      <button class="btn sm${o.enabled ? " ghost" : ""}" type="submit">${o.enabled ? "Turn off all autoresponders" : "Turn autoresponders on"}</button></form>
    <span class="muted">${o.enabled ? "Each one can also be turned off on its own." : "None of them answer while this is off; they are kept."}</span>
  </div>
  <section class="panel-card" aria-labelledby="ar-add-h">
    <h2 id="ar-add-h">Add an autoresponder</h2>
    ${errorSummary(state.errors, "f-ar-")}
    <form class="dash-form" method="post" action="${base}" novalidate data-track-changes>
      ${csrfField(ctx.viewer)}
      <div class="field-row two">
        ${f.text("trigger", "Trigger", AUTORESPONDER_TRIGGER_MAX, "Matching ignores case.", ' spellcheck="false"')}
        ${f.select("matchType", "Match", [{ value: "contains", label: "Message contains it" }, { value: "exact", label: "Message is exactly it" }, { value: "startsWith", label: "Message starts with it" }])}
      </div>
      ${f.textarea("response", "Response", AUTORESPONDER_RESPONSE_MAX, `Also understands <code class="inline">{tag}</code>, <code class="inline">{channel}</code> and <code class="inline">{user_id}</code>.`, ` rows="3" data-count-max="${AUTORESPONDER_RESPONSE_MAX}"`)}
      ${variableReference()}
      <button class="btn" type="submit" data-save-button>Add autoresponder</button>
      <span class="faint">${o.rows.length} of ${o.max} used.</span>
    </form>
  </section>
  <h2>Saved autoresponders</h2>
  ${o.rows.length ? `${tableFilter("ar-table", "Filter by trigger or response")}
  <div class="table-wrap"><table class="case-table" id="ar-table" data-filterable>
    <caption class="visually-hidden">Autoresponders</caption>
    <thead><tr><th scope="col">Trigger</th><th scope="col">Match</th><th scope="col">Response</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
    <tbody>${rows}</tbody></table></div>` : emptyState("No autoresponders yet.", "Add one above, or with <code class=\"inline\">/autoresponder add</code>.")}`,
  });
}

function every(ms: number | null): string {
  if (!ms) return "Once";
  const m = Math.round(ms / 60_000);
  if (m % 1440 === 0) return `Every ${m / 1440} day${m === 1440 ? "" : "s"}`;
  if (m % 60 === 0) return `Every ${m / 60} hour${m === 60 ? "" : "s"}`;
  return `Every ${m} minutes`;
}

export function renderAutomations(cfg: SiteConfig, ctx: GuildContext, o: {
  rows: AutomationRow[]; channels: ChannelOption[]; hidden: ReadonlySet<string>; noticeCode: string | null; state?: FormState; moduleOff?: boolean;
}): string {
  const g = esc(ctx.guild.id);
  const base = `/dashboard/${g}/automations`;
  const state = o.state ?? { values: { delay: "1h" }, errors: {} };
  const f = new Form(state, "task-");
  const chan = (id: string) => o.channels.find(c => c.id === id)?.name;
  const rows = o.rows.map(t => `<tr>
      <td data-label="Next post">${esc(fmtDate(t.executeAt))}</td>
      <td data-label="Channel">${chan(t.channelId) ? `#${esc(chan(t.channelId) as string)}` : `<span class="faint">hidden or deleted</span>`}</td>
      <td data-label="Repeats">${esc(every(t.intervalMs))}${t.type === "reminder" ? ' <span class="tag">reminder</span>' : ""}</td>
      <td data-label="Message" class="prewrap">${esc(clip(t.payload, 140))}</td>
      <td data-label="By">${person(ctx, t.creatorId)}</td>
      <td data-label="Actions">${actionButton(`${base}/${esc(t.id)}/cancel`, ctx.viewer.csrf, "Cancel", { danger: true, confirm: "Cancel this scheduled message? It will not post." })}</td>
    </tr>`).join("");
  return modulePage(cfg, ctx, {
    active: "automations",
    title: "Scheduled messages",
    lead: "Posts Aegis makes later, once or on repeat. The same list as <code class=\"inline\">/automation list all:true</code>.",
    path: base,
    body: `${notice(o.noticeCode)}
  <section class="panel-card" aria-labelledby="task-h">
    <h2 id="task-h">Schedule a message</h2>
    ${errorSummary(state.errors, "f-task-")}
    ${channelPickerEmptyNote(o.channels, o.hidden)}
    <form class="dash-form" method="post" action="${base}" novalidate data-track-changes>
      ${csrfField(ctx.viewer)}
      ${f.select("channelId", "Channel", channelOptions(o.channels, "Pick a channel"), "Aegis needs View Channel, Send Messages and Embed Links there.")}
      ${f.textarea("message", "Message", SCHEDULED_MESSAGE_MAX, "Without an embed below, posted as the description of a 📅 Scheduled Message embed. With one, posted as text above your embed. Roles and @everyone are never pinged.", ` rows="4" data-count-max="${SCHEDULED_MESSAGE_MAX}"`)}
      <div class="field-row two">
        ${f.text("delay", "Post in", 32, "Such as 30m, 2h or 1d 12h (1 minute to 28 days).", ' spellcheck="false"')}
        ${f.text("repeat", "Repeat every (optional)", 32, "Blank posts once. 10 minutes to 28 days.", ' spellcheck="false"')}
      </div>
      <details class="embed-optional"${Object.keys(state.values).some(k => k.startsWith("e_") && state.values[k]) ? " open" : ""}>
        <summary>Add an embed (optional)</summary>
        ${embedBuilder(f, "e_", { legend: "Embed", sample: { user: `@${ctx.viewer.username}`, username: ctx.viewer.username, server: ctx.guild.name, memberCount: ctx.guild.memberCount }, contentKey: "message", help: "Built here, posted later exactly as previewed. Variables are shown filled with your name." })}
      </details>
      ${o.moduleOff ? `<p class="notice bad">Scheduled messages are switched off on the Modules &amp; backup page, so new ones can't be added. Messages already scheduled still post.</p>` : ""}
      <button class="btn" type="submit" data-save-button${o.moduleOff ? " disabled" : ""}>Schedule</button>
    </form>
  </section>
  <h2>Pending</h2>
  ${o.rows.length ? `${tableFilter("task-table", "Filter scheduled messages")}
  <div class="table-wrap"><table class="case-table" id="task-table" data-filterable>
    <caption class="visually-hidden">Scheduled messages</caption>
    <thead><tr><th scope="col">Next post</th><th scope="col">Channel</th><th scope="col">Repeats</th><th scope="col">Message</th><th scope="col">By</th><th scope="col">Actions</th></tr></thead>
    <tbody>${rows}</tbody></table></div>` : emptyState("Nothing scheduled.", "Schedule a message above, or with <code class=\"inline\">/automation message</code>.")}`,
  });
}

export function renderAnnounce(cfg: SiteConfig, ctx: GuildContext, o: {
  channels: ChannelOption[]; hidden: ReadonlySet<string>; noticeCode: string | null; state?: FormState;
}): string {
  const g = esc(ctx.guild.id);
  const base = `/dashboard/${g}/announce`;
  const state = o.state ?? { values: { e_color: "#5865f2" }, errors: {} };
  const f = new Form(state);
  const sample = { user: `@${ctx.viewer.username}`, username: ctx.viewer.username, server: ctx.guild.name, memberCount: ctx.guild.memberCount };
  return modulePage(cfg, ctx, {
    active: "announce",
    title: "Announcements",
    lead: "Build an embed with a live preview and post it to a channel. Like <code class=\"inline\">/embed</code>, from the browser.",
    path: base,
    body: `${notice(o.noticeCode)}
  ${errorSummary(state.errors)}
  ${channelPickerEmptyNote(o.channels, o.hidden)}
  <form class="dash-form wide" method="post" action="${base}" novalidate data-track-changes>
    ${csrfField(ctx.viewer)}
    <fieldset><legend>Where</legend>
      ${f.select("channelId", "Channel", channelOptions(o.channels, "Pick a channel"))}
      ${f.textarea("content", "Message text above the embed (optional)", EMBED_LIMITS.content, "Mentions in it never ping anyone from the dashboard.", ` rows="2" data-count-max="${EMBED_LIMITS.content}"`)}
    </fieldset>
    ${embedBuilder(f, "e_", { legend: "Embed", sample, contentKey: "content", help: "Variables are filled with your own name in the preview; posted announcements show them as typed." })}
    <button class="btn" type="submit" data-save-button data-confirm-button="Post this announcement now?">Post announcement</button>
  </form>`,
  });
}
