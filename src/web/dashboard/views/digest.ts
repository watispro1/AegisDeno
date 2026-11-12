/** Staff digest page (/:guildId/digest) with a live preview. No inline styles or scripts. */
import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { ChannelOption } from "../botView";
import { DAY_NAMES, describeSchedule, type DigestConfig, type DigestEmbedData } from "../../../services/digestLogic";
import { type GuildContext, csrfField, emptyState, notice } from "./layout";
import { Form, channelOptions, type FormState, type Values } from "./form";
import { errorSummary, modulePage } from "./parts";
import { helpPanel, pill, summaryStrip } from "./moduleKit";
import { scheduleLine } from "./communityKit";

export function digestValues(c: DigestConfig): Values {
  return { enabled: c.enabled, channelId: c.channelId ?? "", day: String(c.day), hour: String(c.hour), timezone: c.timezone };
}

/** Discord's <t:…> and <@…> tokens shown readably in the HTML preview. */
function previewText(text: string, ctx: GuildContext): string {
  return esc(text)
    .replace(/&lt;t:(\d+):[a-zA-Z]&gt;/g, (_m, s: string) => new Date(Number(s) * 1000).toISOString().slice(0, 10))
    .replace(/&lt;@(\d{17,20})&gt;/g, (_m, id: string) => `@${esc(ctx.nameOf(id) ?? id)}`)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}

export function digestPreview(d: DigestEmbedData | null, ctx: GuildContext): string {
  if (!d) return emptyState("No preview available.", "Aegis needs to be in the server, with its database reachable.");
  return `<div class="embed-preview"><div class="embed-card">
    <p class="embed-title"><strong>${esc(d.title)}</strong></p>
    <p>${previewText(d.description, ctx)}</p>
    <dl class="embed-fields-preview">${d.fields.map(f => `<div class="${f.inline ? "inline" : ""}"><dt>${esc(f.name)}</dt><dd>${previewText(f.value, ctx)}</dd></div>`).join("")}</dl>
    <p class="faint">${esc(d.footer.text)}</p></div></div>`;
}

export function renderDigest(cfg: SiteConfig, ctx: GuildContext, o: { config: DigestConfig; preview: DigestEmbedData | null; channels: ChannelOption[]; noticeCode: string | null; state?: FormState }): string {
  const base = `/dashboard/${esc(ctx.guild.id)}/digest`;
  const f = new Form(o.state ?? { values: digestValues(o.config), errors: {} }, "dg-");
  const c = o.config;
  const chan = c.channelId ? o.channels.find(x => x.id === c.channelId)?.name : null;
  const stats = summaryStrip([
    { label: "Status", value: "", html: pill(c.enabled ? "On" : "Off", c.enabled ? "ok" : "off") },
    { label: "Posts", value: c.enabled ? (scheduleLine(c.day, c.hour, c.timezone, DAY_NAMES) ?? describeSchedule(c)) : "Not scheduled", tone: c.enabled ? undefined : "off" },
    { label: "Channel", value: c.channelId ? (chan ? `#${chan}` : "Hidden or deleted") : "Mod log channel", tone: c.channelId && !chan ? "warn" : undefined, hint: c.channelId && !chan ? "Pick another channel below" : undefined },
  ], "Digest summary");
  const line = c.enabled ? `Will post ${describeSchedule(c)}.` : "Off: nothing will be posted.";
  return modulePage(cfg, ctx, {
    active: "digest",
    title: "Staff digest",
    lead: "One post a week for your staff: cases by type and moderator, joins and leaves, automod hits, incidents, trust changes and what's still open. Same as <code class=\"inline\">/digest</code>.",
    path: base,
    body: `${notice(o.noticeCode)}${stats}
  ${helpPanel("What the digest covers", [
    ["Cases", "New cases in the past 7 days, by type and by moderator."],
    ["Members", "Joins and leaves, plus Trust Score averages and the lowest scores."],
    ["Automod and incidents", "Automod hits and any Incident Mode runs."],
    ["Still open", "Open tickets, appeals and ModMail threads waiting for staff."],
    ["Privacy", "Members are named but never pinged. Post it in a staff-only channel."],
  ])}
  <section class="panel-card" aria-labelledby="dg-cfg-h"><h2 id="dg-cfg-h">Schedule</h2>
    <p class="muted">${o.config.enabled ? `On: posts ${esc(describeSchedule(o.config))}.` : "Off."}</p>
    ${errorSummary(o.state?.errors ?? {}, "f-dg-")}
    <form class="dash-form" method="post" action="${base}/settings" novalidate data-track-changes>
      ${csrfField(ctx.viewer)}
      ${f.checkbox("enabled", "Post a weekly staff digest")}
      ${f.select("channelId", "Channel", channelOptions(o.channels, "The mod log channel"), "Keep it staff-only. Members are named but never pinged.")}
      <div class="field-row two">
        ${f.select("day", "Day", DAY_NAMES.map((d, i) => ({ value: String(i), label: d })))}
        ${f.number("hour", "Hour (0–23)", 0, 23)}
      </div>
      ${f.text("timezone", "Time zone", 64, "IANA name such as UTC, America/Chicago or Europe/London.", ' spellcheck="false" autocapitalize="off" list="dg-zones"')}
      <datalist id="dg-zones">${["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney"].map(z => `<option value="${z}">`).join("")}</datalist>
      <p class="schedule-line" data-schedule-preview="dg-" data-days="${esc(DAY_NAMES.join(","))}" aria-live="polite">${esc(line)}</p>
      <button class="btn" type="submit" data-save-button>Save digest settings</button>
    </form></section>
  <section class="panel-card" aria-labelledby="dg-prev-h"><h2 id="dg-prev-h">Preview (last 7 days)</h2><p class="muted">What the next digest would look like if it posted now.</p>${digestPreview(o.preview, ctx)}</section>`,
  });
}
