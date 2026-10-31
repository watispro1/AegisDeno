/** Community module pages: giveaways, suggestions, Ghost Watch, and the general Settings page. */
import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { ChannelOption } from "../botView";
import type { GiveawayRow, SuggestionFilter, SuggestionRow, WatchView } from "../moduleData";
import { SUGGESTION_NOTE_MAX } from "../moduleValidation";
import { type GuildContext, csrfField, emptyState, fmtDate, moduleStatus, notice, person } from "./layout";
import { Form, channelOptions, channelPickerEmptyNote, hiddenChannelNote, type FormState } from "./form";
import { actionButton, errorSummary, modulePage, pagerNav, tableFilter } from "./parts";
import { moduleGrid, type ModuleState } from "./overview";

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function renderGiveaways(cfg: SiteConfig, ctx: GuildContext, o: { rows: GiveawayRow[]; channels: ChannelOption[]; noticeCode: string | null }): string {
  const g = esc(ctx.guild.id);
  const base = `/dashboard/${g}/giveaways`;
  const chan = (id: string) => o.channels.find(c => c.id === id)?.name;
  const row = (gw: GiveawayRow) => `<tr>
      <td data-label="Prize"><strong>${esc(clip(gw.prize, 120))}</strong></td>
      <td data-label="Channel">${chan(gw.channelId) ? `#${esc(chan(gw.channelId) as string)}` : `<span class="faint">hidden or deleted</span>`}</td>
      <td data-label="${gw.ended ? "Ended" : "Ends"}">${esc(fmtDate(gw.endsAt))}</td>
      <td data-label="Entries">${gw.entrants.toLocaleString("en-US")}</td>
      <td data-label="Winners">${gw.ended ? (gw.winners.length ? gw.winners.map(w => person(ctx, w)).join(", ") : `<span class="faint">none</span>`) : `${gw.winnerCount} to draw`}</td>
      <td data-label="Host">${person(ctx, gw.hostId)}</td>
      <td data-label="Actions">${gw.ended
        ? actionButton(`${base}/${esc(gw.messageId)}/reroll`, ctx.viewer.csrf, "Reroll", { confirm: `Draw new winners for "${clip(gw.prize, 60)}"? Previous winners are skipped and the new ones are announced.` })
        : actionButton(`${base}/${esc(gw.messageId)}/end`, ctx.viewer.csrf, "End now", { danger: true, confirm: `End "${clip(gw.prize, 60)}" now and draw winners?` })}</td>
    </tr>`;
  const table = (rows: GiveawayRow[], id: string, caption: string) => `<div class="table-wrap"><table class="case-table" id="${id}" data-filterable>
    <caption class="visually-hidden">${esc(caption)}</caption>
    <thead><tr><th scope="col">Prize</th><th scope="col">Channel</th><th scope="col">When</th><th scope="col">Entries</th><th scope="col">Winners</th><th scope="col">Host</th><th scope="col">Actions</th></tr></thead>
    <tbody>${rows.map(row).join("")}</tbody></table></div>`;
  const active = o.rows.filter(r => !r.ended);
  const ended = o.rows.filter(r => r.ended);
  return modulePage(cfg, ctx, {
    active: "giveaways",
    title: "Giveaways",
    lead: "Running and finished giveaways. Start new ones with <code class=\"inline\">/giveaway start</code>; end or reroll them here.",
    path: base,
    body: `${notice(o.noticeCode)}
  <h2>Running <span class="count-badge">${active.length}</span></h2>
  ${active.length ? table(active, "gw-active", "Running giveaways") : emptyState("No giveaways running.", "Start one in Discord with <code class=\"inline\">/giveaway start</code>.")}
  <h2>Finished</h2>
  ${ended.length ? `${tableFilter("gw-ended", "Filter by prize")}${table(ended, "gw-ended", "Finished giveaways")}` : `<p class="muted">No finished giveaways yet.</p>`}
  <p class="muted">The newest 50 giveaways are shown.</p>`,
  });
}

const STATUS_TAG: Record<string, string> = { pending: "Pending", considered: "Considering", approved: "Approved", rejected: "Denied", archived: "Archived" };

export function renderSuggestions(cfg: SiteConfig, ctx: GuildContext, o: {
  items: SuggestionRow[]; total: number; page: number; perPage: number; filter: SuggestionFilter;
  channelId: string | null; channels: ChannelOption[]; hidden: ReadonlySet<string>; noticeCode: string | null; state?: FormState;
}): string {
  const g = esc(ctx.guild.id);
  const base = `/dashboard/${g}/suggestions`;
  const f = new Form(o.state ?? { values: { suggestionsChannelId: o.channelId ?? "" }, errors: {} }, "sg-");
  const pages = Math.max(1, Math.ceil(o.total / o.perPage));
  const tabs = (["open", "approved", "rejected", "all"] as const).map(k =>
    `<a href="${base}?status=${k}"${k === o.filter ? ' aria-current="page"' : ""}>${k === "open" ? "Open" : k === "approved" ? "Approved" : k === "rejected" ? "Denied" : "All"}</a>`).join("");
  const card = (s: SuggestionRow) => {
    const open = s.status === "pending" || s.status === "considered";
    return `<li class="item-card">
      <div class="item-head"><span class="status-pill ${open ? "neutral" : s.status === "approved" ? "on" : "off"}">${esc(STATUS_TAG[s.status] ?? s.status)}</span>
        <span class="faint">${esc(fmtDate(s.createdAt))} · by ${person(ctx, s.authorId)} · 👍 ${s.up} 👎 ${s.down}</span></div>
      <p class="prewrap">${esc(clip(s.content, 1200))}</p>
      ${s.reviewReason ? `<p class="muted"><strong>Staff note:</strong> ${esc(s.reviewReason)}</p>` : ""}
      ${open ? `<form class="review-form" method="post" action="${base}/${esc(s.id)}/review">
        ${csrfField(ctx.viewer)}
        <label class="visually-hidden" for="note-${esc(s.id)}">Staff note</label>
        <input type="text" id="note-${esc(s.id)}" name="note" maxlength="${SUGGESTION_NOTE_MAX}" placeholder="Staff note (optional, shown on the post and in the DM)">
        <span class="btn-row">
          <button class="btn sm" type="submit" name="action" value="approve">Approve</button>
          <button class="btn sm ghost" type="submit" name="action" value="consider">Consider</button>
          <button class="btn sm danger" type="submit" name="action" value="deny" data-confirm-button="Deny this suggestion? The author is told by DM.">Deny</button>
        </span>
      </form>` : ""}
    </li>`;
  };
  return modulePage(cfg, ctx, {
    active: "suggestions",
    title: "Suggestions",
    lead: "Review what members suggest with <code class=\"inline\">/suggest</code>. Decisions restyle the post and DM the author, as <code class=\"inline\">/suggest review</code> does.",
    path: base,
    body: `${notice(o.noticeCode)}
  <div class="module-head">${moduleStatus(Boolean(o.channelId), o.channelId ? "Enabled" : "No channel")}<span class="muted">${o.channelId ? "Members can post suggestions." : "Pick a channel to turn suggestions on."}</span></div>
  ${o.channelId && o.hidden.has(o.channelId) ? hiddenChannelNote(o.channelId, "suggestions channel") : ""}
  <details class="panel-card"${o.channelId ? "" : " open"}><summary>Suggestions channel</summary>
    ${errorSummary(o.state?.errors ?? {}, "f-sg-")}
    ${channelPickerEmptyNote(o.channels, o.hidden)}
    <form class="dash-form" method="post" action="${base}/channel" novalidate data-track-changes>
      ${csrfField(ctx.viewer)}
      ${f.select("suggestionsChannelId", "Post suggestions in", channelOptions(o.channels, "Off: no suggestions channel"), "Same as /suggest setup. Aegis needs View Channel, Send Messages and Embed Links there.")}
      <button class="btn" type="submit" data-save-button>Save channel</button>
    </form>
  </details>
  <nav class="tabs" aria-label="Filter suggestions">${tabs}</nav>
  ${o.items.length ? `<ul class="item-list">${o.items.map(card).join("")}</ul>` : emptyState(o.filter === "open" ? "Nothing waiting for review." : "No suggestions here.", "New suggestions show up as members post them.")}
  ${pagerNav(base, p => `?status=${o.filter}&page=${p}`, o.page, pages, o.total, "suggestion")}`,
  });
}

export function renderWatchlist(cfg: SiteConfig, ctx: GuildContext, o: { rows: WatchView[]; noticeCode: string | null }): string {
  const g = esc(ctx.guild.id);
  const base = `/dashboard/${g}/watchlist`;
  const rows = o.rows.map(w => `<tr>
      <td data-label="Member">${person(ctx, w.targetId)}</td>
      <td data-label="Reason">${w.reason ? esc(clip(w.reason, 140)) : `<span class="faint">none</span>`}</td>
      <td data-label="Watching">${esc(w.events.join(", ") || "everything")}</td>
      <td data-label="Alerts">${w.alertCount.toLocaleString("en-US")}</td>
      <td data-label="Until">${w.expiresAt ? esc(fmtDate(w.expiresAt)) : "No end"}</td>
      <td data-label="Actions">${actionButton(`${base}/${esc(w.targetId)}/remove`, ctx.viewer.csrf, "Stop watching", { danger: true, confirm: "Remove this member from your Ghost Watch list? Alerts stop at once." })}</td>
    </tr>`).join("");
  return modulePage(cfg, ctx, {
    active: "watchlist",
    title: "Ghost Watch",
    lead: "Your personal watch list: Aegis DMs you when these members are active. Only you see your list, as with <code class=\"inline\">/watchlist list</code>. Add members with <code class=\"inline\">/watchlist add</code>.",
    path: base,
    body: `${notice(o.noticeCode)}
  ${o.rows.length ? `${tableFilter("watch-table", "Filter your watch list")}
  <div class="table-wrap"><table class="case-table" id="watch-table" data-filterable>
    <caption class="visually-hidden">Your Ghost Watch list</caption>
    <thead><tr><th scope="col">Member</th><th scope="col">Reason</th><th scope="col">Watching</th><th scope="col">Alerts</th><th scope="col">Until</th><th scope="col">Actions</th></tr></thead>
    <tbody>${rows}</tbody></table></div>` : emptyState("You are not watching anyone.", "Use <code class=\"inline\">/watchlist add</code> in Discord to start.")}`,
  });
}

export function renderGeneralSettings(cfg: SiteConfig, ctx: GuildContext, o: { states: ModuleState[]; missingBotPermissions: string[]; hiddenCount: number }): string {
  const g = esc(ctx.guild.id);
  return modulePage(cfg, ctx, {
    active: "settings",
    title: "Settings",
    lead: "Every module in one place. Open one to change it; each page has its own on/off switch where the bot supports one.",
    path: `/dashboard/${g}/settings`,
    body: `${moduleGrid(o.states)}
  <section class="panel-card" aria-labelledby="perm-h">
    <h2 id="perm-h">Aegis's permissions</h2>
    ${o.missingBotPermissions.length
      ? `<p class="callout warn">Aegis's role is missing: <strong>${o.missingBotPermissions.map(esc).join(", ")}</strong>. Give them in Server Settings → Roles.</p>`
      : `<p class="check-ok">✓ Aegis has every server-wide permission its modules use.</p>`}
    ${o.hiddenCount ? `<p class="muted">${o.hiddenCount} channel${o.hiddenCount === 1 ? " is" : "s are"} hidden from Aegis (no View Channel). They are left out of every picker.</p>` : ""}
    <p class="muted">Run <code class="inline">/diagnostics</code> in Discord for per-channel checks.</p>
  </section>
  <p><a class="text-link" href="/dashboard/${g}/activity">Dashboard activity log &rarr;</a> · <a class="text-link" href="/dashboard/changelog">What's new in the dashboard &rarr;</a></p>`,
  });
}
