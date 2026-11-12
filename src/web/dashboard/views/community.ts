/** Community module pages: giveaways, suggestions, Ghost Watch, and the general Settings page. */
import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { ChannelOption, RoleOption } from "../botView";
import { SUGGESTION_SEARCH_MAX, SUGGESTION_SORTS, SUGGESTION_SORT_LABELS, suggestionQueryString, type SuggestionQuery } from "../communityQuery";
import type { GiveawayRow, SuggestionFilter, SuggestionRow, WatchView } from "../moduleData";
import { SUGGESTION_NOTE_MAX } from "../moduleValidation";
import { type GuildContext, copyId, csrfField, emptyState, moduleStatus, notice, personId, relTime } from "./layout";
import { Form, channelOptions, channelPickerEmptyNote, hiddenChannelNote, type FormState } from "./form";
import { actionButton, errorSummary, modulePage, pagerNav } from "./parts";
import { moduleGrid, type ModuleState } from "./overview";
import { type Tone, helpPanel, listFoot, listTools, pagedTable, pill, rowAttrs, soonest, summaryStrip } from "./moduleKit";
import { epoch } from "./communityKit";

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** Bonus-entry cell: the role and how many tickets its holders get, or "none". */
export function giveawayBonus(gw: Pick<GiveawayRow, "bonusRoleId" | "bonusEntries">, roles: readonly Pick<RoleOption, "id" | "name">[]): string {
  if (!gw.bonusRoleId) return `<span class="faint">none</span>`;
  const name = roles.find(r => r.id === gw.bonusRoleId)?.name;
  const label = name ? `@${esc(name)}` : `<span class="faint">deleted role</span>`;
  const n = Math.max(1, Math.min(10, Math.trunc(gw.bonusEntries ?? 1)));
  return `${label} <span class="muted">×${n} entries</span> ${copyId(gw.bonusRoleId, "Copy bonus role ID")}`;
}

/** Cancel for a running giveaway. The tick box is the confirmation and the server refuses the form without it. */
function cancelForm(action: string, csrf: string, prize: string): string {
  return `<details class="cancel-gw"><summary class="btn sm ghost">Cancel…</summary>
    <form class="confirm-form" method="post" action="${esc(action)}">
      <input type="hidden" name="_csrf" value="${esc(csrf)}">
      <label><input type="checkbox" name="confirm" value="yes" required> Cancel "${esc(clip(prize, 60))}" with no winners. This can't be undone or rerolled.</label>
      <button class="btn sm danger" type="submit">Cancel giveaway</button>
    </form>
  </details>`;
}

export function renderGiveaways(cfg: SiteConfig, ctx: GuildContext, o: { rows: GiveawayRow[]; channels: ChannelOption[]; roles?: readonly RoleOption[]; noticeCode: string | null }): string {
  const g = esc(ctx.guild.id);
  const base = `/dashboard/${g}/giveaways`;
  const roles = o.roles ?? [];
  const chan = (id: string) => o.channels.find(c => c.id === id)?.name;
  const outcome = (gw: GiveawayRow) => (gw.cancelled ? "cancelled" : gw.ended ? (gw.winners.length ? "won" : "none") : "running");
  const row = (gw: GiveawayRow) => `<tr${rowAttrs(outcome(gw), { ends: epoch(gw.endsAt), entries: gw.entrants, prize: gw.prize.toLowerCase() })}>
      <td data-label="Prize"><strong>${esc(clip(gw.prize, 120))}</strong>${gw.cancelled ? ` <span class="status-pill off">Cancelled</span>` : ""} ${copyId(gw.messageId, "Copy giveaway message ID")}</td>
      <td data-label="Channel">${chan(gw.channelId) ? `#${esc(chan(gw.channelId) as string)}` : `<span class="faint">hidden or deleted</span>`} ${copyId(gw.channelId, "Copy channel ID")}</td>
      <td data-label="${gw.ended ? "Ended" : "Ends"}">${relTime(gw.endsAt)}</td>
      <td data-label="Entries">${gw.entrants.toLocaleString("en-US")}</td>
      <td data-label="Bonus">${giveawayBonus(gw, roles)}</td>
      <td data-label="Winners">${gw.cancelled ? `<span class="faint">cancelled, none drawn</span>` : gw.ended ? (gw.winners.length ? gw.winners.map(w => personId(ctx, w)).join(", ") : `<span class="faint">none</span>`) : `${gw.winnerCount} to draw`}</td>
      <td data-label="Host">${personId(ctx, gw.hostId)}</td>
      <td data-label="Actions">${gw.cancelled
        ? `<span class="faint">none</span>`
        : gw.ended
        ? actionButton(`${base}/${esc(gw.messageId)}/reroll`, ctx.viewer.csrf, "Reroll", { confirm: `Draw new winners for "${clip(gw.prize, 60)}"? Previous winners are skipped and the new ones are announced.` })
        : actionButton(`${base}/${esc(gw.messageId)}/end`, ctx.viewer.csrf, "End now", { danger: true, confirm: `End "${clip(gw.prize, 60)}" now and draw winners?` })
          + cancelForm(`${base}/${esc(gw.messageId)}/cancel`, ctx.viewer.csrf, gw.prize)}</td>
    </tr>`;
  const table = (rows: GiveawayRow[], id: string, caption: string) => `<div class="table-wrap"><table class="case-table" id="${id}"${pagedTable(20)}>
    <caption class="visually-hidden">${esc(caption)}</caption>
    <thead><tr><th scope="col">Prize</th><th scope="col">Channel</th><th scope="col">When</th><th scope="col">Entries</th><th scope="col">Bonus</th><th scope="col">Winners</th><th scope="col">Host</th><th scope="col">Actions</th></tr></thead>
    <tbody>${rows.map(row).join("")}</tbody></table></div>`;
  const active = o.rows.filter(r => !r.ended);
  const ended = o.rows.filter(r => r.ended);
  const byOutcome = (k: string) => ended.filter(r => outcome(r) === k).length;
  const next = soonest(active.map(r => r.endsAt));
  const stats = summaryStrip([
    { label: "Running", value: active.length, tone: active.length ? "ok" : "off", href: active.length ? "#gw-running-h" : undefined },
    next ? { label: "Next to end", value: "", html: relTime(next) } : { label: "Next to end", value: "None", tone: "off" },
    { label: "Entries (running)", value: active.reduce((n, r) => n + r.entrants, 0) },
    { label: "Finished", value: ended.length, hint: byOutcome("cancelled") ? `${byOutcome("cancelled")} cancelled` : undefined, href: ended.length ? "#gw-ended-h" : undefined },
  ], "Giveaway summary");
  const sorts = [{ value: "ends:asc", label: "Ending soonest" }, { value: "ends:desc", label: "Latest first" }, { value: "entries:desc", label: "Most entries" }, { value: "prize:asc", label: "Prize A–Z" }];
  const endedTools = listTools("gw-ended", {
    search: "Filter by prize",
    chipLabel: "Show finished giveaways",
    chips: [{ value: "won", label: "Winners drawn", count: byOutcome("won") }, { value: "none", label: "No winners", count: byOutcome("none") }, { value: "cancelled", label: "Cancelled", count: byOutcome("cancelled") }].filter(c => c.count),
    sorts: sorts.map(x => x.value === "ends:asc" ? { value: "ends:desc", label: "Ended most recently" } : x.value === "ends:desc" ? { value: "ends:asc", label: "Ended longest ago" } : x),
  });
  const help = helpPanel("How giveaways work", [
    ["Starting", "Run <code class=\"inline\">/giveaway start</code> in Discord. Members enter from its message in Discord."],
    ["Bonus entries", "Members with the bonus role get extra tickets in the draw."],
    ["End now", "Draws winners straight away and announces them in the giveaway's channel."],
    ["Reroll", "Draws new winners for a finished giveaway, skipping the earlier ones."],
    ["Cancel", "Stops a running giveaway with no winners. It can't be undone or rerolled, so you are asked to confirm."],
  ]);
  return modulePage(cfg, ctx, {
    active: "giveaways",
    title: "Giveaways",
    lead: "Running and finished giveaways. Start new ones with <code class=\"inline\">/giveaway start</code>; end, cancel or reroll them here.",
    path: base,
    body: `${notice(o.noticeCode)}${stats}${help}
  <h2 id="gw-running-h">Running <span class="count-badge">${active.length}</span></h2>
  ${active.length ? `${active.length > 5 ? listTools("gw-active", { search: "Filter running giveaways", sorts }) : ""}${table(active, "gw-active", "Running giveaways")}${active.length > 5 ? listFoot("gw-active") : ""}` : emptyState("No giveaways running.", "Start one in Discord with <code class=\"inline\">/giveaway start</code>.")}
  <h2 id="gw-ended-h">Finished <span class="count-badge">${ended.length}</span></h2>
  ${ended.length ? `${endedTools}${table(ended, "gw-ended", "Finished giveaways")}${listFoot("gw-ended", "No finished giveaways match. Clear the search or pick another filter.")}` : `<p class="muted">No finished giveaways yet. They move here once they end.</p>`}
  <p class="muted">The newest 50 giveaways are shown.</p>`,
  });
}

const STATUS_TAG: Record<string, string> = { pending: "Pending", considered: "Considering", approved: "Approved", rejected: "Denied", archived: "Archived" };
const STATUS_TONE: Record<string, Tone> = { pending: "warn", considered: "info", approved: "ok", rejected: "bad", archived: "off" };
const FILTER_LABEL: Record<SuggestionFilter, string> = { open: "Open", approved: "Approved", rejected: "Denied", all: "All" };

export function renderSuggestions(cfg: SiteConfig, ctx: GuildContext, o: {
  items: SuggestionRow[]; total: number; page: number; perPage: number; filter: SuggestionFilter;
  q?: string; sort?: SuggestionQuery["sort"];
  channelId: string | null; channels: ChannelOption[]; hidden: ReadonlySet<string>; noticeCode: string | null; state?: FormState;
}): string {
  const g = esc(ctx.guild.id);
  const base = `/dashboard/${g}/suggestions`;
  const f = new Form(o.state ?? { values: { suggestionsChannelId: o.channelId ?? "" }, errors: {} }, "sg-");
  const pages = Math.max(1, Math.ceil(o.total / o.perPage));
  const view = { filter: o.filter, q: o.q ?? "", sort: o.sort ?? "newest" as const };
  const tabs = (["open", "approved", "rejected", "all"] as const).map(k =>
    `<a href="${base}${esc(suggestionQueryString({ ...view, filter: k }))}"${k === o.filter ? ' aria-current="page"' : ""}>${k === "open" ? "Open" : k === "approved" ? "Approved" : k === "rejected" ? "Denied" : "All"}</a>`).join("");
  const up = o.items.reduce((n, s) => n + s.up, 0);
  const down = o.items.reduce((n, s) => n + s.down, 0);
  const waiting = o.items.filter(s => s.status === "pending").length;
  const stats = summaryStrip([
    { label: "Channel", value: "", html: pill(o.channelId ? "On" : "No channel", o.channelId ? "ok" : "warn"), hint: o.channelId ? undefined : "Pick one below" },
    { label: `${FILTER_LABEL[o.filter] ?? "Shown"}${view.q ? " matching" : ""}`, value: o.total },
    { label: "Not yet reviewed", value: waiting, hint: pages > 1 ? "On this page" : undefined, tone: waiting ? "warn" : "ok" },
    { label: "Votes", value: `👍 ${up.toLocaleString("en-US")} · 👎 ${down.toLocaleString("en-US")}`, hint: pages > 1 ? "On this page" : undefined },
  ], "Suggestion summary");
  const help = helpPanel("How reviewing works", [
    ["Approve", "Marks the suggestion approved, restyles its post and DMs the author."],
    ["Consider", "Keeps it open but shows staff are looking at it."],
    ["Deny", "Closes it as denied and DMs the author. You are asked to confirm first."],
    ["Staff note", `Optional, up to ${SUGGESTION_NOTE_MAX} characters. Shown on the post and in the DM.`],
  ]);
  const card = (s: SuggestionRow) => {
    const open = s.status === "pending" || s.status === "considered";
    return `<li class="item-card">
      <div class="item-head">${pill(STATUS_TAG[s.status] ?? s.status, STATUS_TONE[s.status] ?? "info")}
        <span class="faint">${relTime(s.createdAt)} · by ${personId(ctx, s.authorId)} · ID <code class="inline">${esc(s.id)}</code> ${copyId(s.id, "Copy suggestion ID")} · 👍 ${s.up} 👎 ${s.down}</span></div>
      <p class="prewrap">${esc(clip(s.content, 1200))}</p>
      ${s.reviewReason ? `<p class="muted"><strong>Staff note:</strong> ${esc(s.reviewReason)}</p>` : ""}
      ${!open && s.reviewedBy ? `<p class="faint">Reviewed by ${personId(ctx, s.reviewedBy)}</p>` : ""}
      ${open ? `<form class="review-form" method="post" action="${base}/${esc(s.id)}/review">
        ${csrfField(ctx.viewer)}
        <label class="visually-hidden" for="note-${esc(s.id)}">Staff note</label>
        <input type="text" id="note-${esc(s.id)}" name="note" maxlength="${SUGGESTION_NOTE_MAX}" data-count-max="${SUGGESTION_NOTE_MAX}" placeholder="Staff note (optional, shown on the post and in the DM)">
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
    body: `${notice(o.noticeCode)}${stats}${help}
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
  ${suggestionSearchForm(base, view)}
  ${o.items.length ? `<ul class="item-list">${o.items.map(card).join("")}</ul>` : view.q
    ? emptyState("No suggestions match that search.", `<a class="text-link" href="${base}${esc(suggestionQueryString({ ...view, q: "" }))}">Clear the search</a>`)
    : emptyState(o.filter === "open" ? "Nothing waiting for review." : "No suggestions here.", o.channelId ? "New suggestions show up as members post them with <code class=\"inline\">/suggest</code>." : "Pick a suggestions channel above so members can post them.", o.filter !== "all" ? { label: "See all suggestions", href: `${base}${suggestionQueryString({ ...view, filter: "all" })}` } : undefined)}
  ${pagerNav(base, p => suggestionQueryString(view, p), o.page, pages, o.total, "suggestion")}`,
  });
}

/** GET form: search text and sort, keeping the status tab. Works without JavaScript. */
function suggestionSearchForm(base: string, view: Pick<SuggestionQuery, "filter" | "q" | "sort">): string {
  return `<form class="search-bar" method="get" action="${base}" role="search">
    <input type="hidden" name="status" value="${esc(view.filter)}">
    <label class="visually-hidden" for="sg-q">Search suggestions</label>
    <input class="table-search" type="search" id="sg-q" name="q" value="${esc(view.q)}" maxlength="${SUGGESTION_SEARCH_MAX}" placeholder="Search suggestions">
    <label class="visually-hidden" for="sg-sort">Sort by</label>
    <select id="sg-sort" name="sort">${SUGGESTION_SORTS.map(k => `<option value="${k}"${k === view.sort ? " selected" : ""}>${esc(SUGGESTION_SORT_LABELS[k])}</option>`).join("")}</select>
    <button class="btn sm" type="submit">Apply</button>
    ${view.q || view.sort !== "newest" ? `<a class="text-link" href="${base}?status=${esc(view.filter)}">Reset</a>` : ""}
  </form>`;
}

export function renderWatchlist(cfg: SiteConfig, ctx: GuildContext, o: { rows: WatchView[]; noticeCode: string | null }): string {
  const g = esc(ctx.guild.id);
  const base = `/dashboard/${g}/watchlist`;
  const rows = o.rows.map(w => `<tr${rowAttrs(w.expiresAt ? "timed" : "open", { alerts: w.alertCount, added: epoch(w.createdAt), until: epoch(w.expiresAt) })}>
      <td data-label="Member">${personId(ctx, w.targetId)}</td>
      <td data-label="Reason">${w.reason ? esc(clip(w.reason, 140)) : `<span class="faint">none</span>`}</td>
      <td data-label="Watching">${esc(w.events.join(", ") || "everything")}</td>
      <td data-label="Alerts">${w.alertCount.toLocaleString("en-US")}</td>
      <td data-label="Added">${relTime(w.createdAt)}</td>
      <td data-label="Until">${w.expiresAt ? relTime(w.expiresAt) : "No end"}</td>
      <td data-label="Actions">${actionButton(`${base}/${esc(w.targetId)}/remove`, ctx.viewer.csrf, "Stop watching", { danger: true, confirm: "Remove this member from your Ghost Watch list? Alerts stop at once." })}</td>
    </tr>`).join("");
  const timed = o.rows.filter(w => w.expiresAt).length;
  const ends = soonest(o.rows.map(w => w.expiresAt));
  const stats = summaryStrip([
    { label: "Watching", value: o.rows.length, tone: o.rows.length ? "info" : "off" },
    { label: "Alerts sent", value: o.rows.reduce((n, w) => n + w.alertCount, 0) },
    ends ? { label: "Next to expire", value: "", html: relTime(ends) } : { label: "Next to expire", value: "None", hint: o.rows.length ? "Every watch has no end" : undefined, tone: "off" },
  ], "Ghost Watch summary");
  const help = helpPanel("How Ghost Watch works", [
    ["Adding", "Run <code class=\"inline\">/watchlist add</code> in Discord with a member and, optionally, a reason, how long (24 hours by default) and which events to watch."],
    ["Alerts", "Aegis DMs you when a watched member does one of the watched things. Keep your DMs open to Aegis."],
    ["Private", "Your list is yours: other staff can't see it, here or in Discord."],
    ["Stop watching", "Removes the member and stops alerts at once. You are asked to confirm first."],
  ]);
  return modulePage(cfg, ctx, {
    active: "watchlist",
    title: "Ghost Watch",
    lead: "Your personal watch list: Aegis DMs you when these members are active. Only you see your list, as with <code class=\"inline\">/watchlist list</code>. Add members with <code class=\"inline\">/watchlist add</code>.",
    path: base,
    body: `${notice(o.noticeCode)}
  ${stats}${help}
  ${o.rows.length ? `${listTools("watch-table", {
    search: "Filter your watch list",
    chipLabel: "Show watches",
    chips: o.rows.length > 1 && timed && timed < o.rows.length ? [{ value: "timed", label: "Has an end", count: timed }, { value: "open", label: "No end", count: o.rows.length - timed }] : undefined,
    sorts: [{ value: "alerts:desc", label: "Most alerts" }, { value: "added:desc", label: "Newest" }, { value: "added:asc", label: "Oldest" }, { value: "until:asc", label: "Expiring soonest" }],
  })}
  <div class="table-wrap"><table class="case-table" id="watch-table"${pagedTable(20)}>
    <caption class="visually-hidden">Your Ghost Watch list</caption>
    <thead><tr><th scope="col">Member</th><th scope="col">Reason</th><th scope="col">Watching</th><th scope="col">Alerts</th><th scope="col">Added</th><th scope="col">Until</th><th scope="col">Actions</th></tr></thead>
    <tbody>${rows}</tbody></table></div>${listFoot("watch-table", "Nobody on your list matches. Clear the search or pick another filter.")}` : emptyState("You are not watching anyone.", "Use <code class=\"inline\">/watchlist add</code> in Discord to start.")}`,
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
