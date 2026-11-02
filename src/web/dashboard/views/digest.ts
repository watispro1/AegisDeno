/** Staff digest page (/:guildId/digest) with a live preview. No inline styles or scripts. */
import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { ChannelOption } from "../botView";
import { DAY_NAMES, describeSchedule, type DigestConfig, type DigestEmbedData } from "../../../services/digestLogic";
import { type GuildContext, csrfField, emptyState, notice } from "./layout";
import { Form, channelOptions, type FormState, type Values } from "./form";
import { errorSummary, modulePage } from "./parts";

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
  return modulePage(cfg, ctx, {
    active: "digest",
    title: "Staff digest",
    lead: "One post a week for your staff: cases by type and moderator, joins and leaves, automod hits, incidents, trust changes and what's still open. Same as <code class=\"inline\">/digest</code>.",
    path: base,
    body: `${notice(o.noticeCode)}
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
      <button class="btn" type="submit" data-save-button>Save digest settings</button>
    </form></section>
  <section class="panel-card" aria-labelledby="dg-prev-h"><h2 id="dg-prev-h">Preview (last 7 days)</h2>${digestPreview(o.preview, ctx)}</section>`,
  });
}
