/** Polls page: a read-only list of the server's /poll polls with their results. */
import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { ChannelOption } from "../botView";
import { POLLS_SHOWN, formatPollPercent, messageJumpUrl, type PollRow } from "../communityQuery";
import { type GuildContext, copyId, emptyState, personId, relTime } from "./layout";
import { modulePage } from "./parts";
import { helpPanel, pill, rowAttrs, soonest, summaryStrip } from "./moduleKit";
import { cardFoot, cardList, cardTools, epoch } from "./communityKit";

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function pollCard(ctx: GuildContext, p: PollRow, channels: readonly ChannelOption[], hidden: ReadonlySet<string>): string {
  const channel = channels.find(c => c.id === p.channelId);
  const where = channel && !hidden.has(p.channelId) ? `#${esc(channel.name)}` : `<span class="faint">hidden or deleted channel</span>`;
  const jump = channel && !hidden.has(p.channelId) ? messageJumpUrl(ctx.guild.id, p.channelId, p.messageId) : null;
  const timing = p.ended ? "Closed" : p.endsAt ? `Closes ${relTime(p.endsAt)}` : "No time limit";
  const modes = [p.multiselect ? "pick any" : "pick one", p.anonymous ? "anonymous" : null].filter(Boolean).join(", ");
  const options = p.options.map((o, i) => `<li>
        <span class="poll-label">${i + 1}. ${esc(clip(o.label, 100))}</span>
        <meter min="0" max="100" value="${o.percent}" aria-hidden="true"></meter>
        <span class="poll-count"><strong>${formatPollPercent(o.percent)}</strong> <span class="muted">(${o.votes.toLocaleString("en-US")} vote${o.votes === 1 ? "" : "s"})</span></span>
      </li>`).join("");
  const lead = p.totalVotes > 0 ? p.options.reduce((a, b) => (b.votes > a.votes ? b : a)) : null;
  const tied = lead ? p.options.filter(o => o.votes === lead.votes).length > 1 : false;
  return `<li class="item-card poll-card"${rowAttrs(p.ended ? "closed" : "open", { created: epoch(p.createdAt), votes: p.totalVotes, closes: p.ended ? null : epoch(p.endsAt) })}>
      <div class="item-head">${pill(p.ended ? "Closed" : "Open", p.ended ? "off" : "ok")}${lead ? `<span class="poll-lead">${pill(tied ? "Tied" : `Leading: ${clip(lead.label, 40)}`, tied ? "warn" : "info")}</span>` : ""}
        <span class="faint">${relTime(p.createdAt)} · by ${personId(ctx, p.creatorId)} · ${where} · ${esc(modes)} · ${timing}</span></div>
      <h3 class="poll-question">${esc(clip(p.question, 300))}</h3>
      <ol class="poll-options">${options}</ol>
      <p class="faint">${p.voters.toLocaleString("en-US")} voter${p.voters === 1 ? "" : "s"}, ${p.totalVotes.toLocaleString("en-US")} vote${p.totalVotes === 1 ? "" : "s"}${p.multiselect ? " (members could pick more than one, so percentages are shares of all votes)" : ""}
        · Message ${copyId(p.messageId, "Copy poll message ID")}${jump ? ` · <a class="text-link" href="${esc(jump)}" rel="noopener noreferrer" target="_blank">Open in Discord</a>` : ""}</p>
    </li>`;
}

export function renderPolls(cfg: SiteConfig, ctx: GuildContext, o: { rows: PollRow[]; channels: ChannelOption[]; hidden: ReadonlySet<string> }): string {
  const base = `/dashboard/${esc(ctx.guild.id)}/polls`;
  const open = o.rows.filter(p => !p.ended).length;
  const votes = o.rows.reduce((n, p) => n + p.totalVotes, 0);
  const next = soonest(o.rows.filter(p => !p.ended).map(p => p.endsAt));
  const stats = summaryStrip([
    { label: "Open", value: open, tone: open ? "ok" : "off" },
    { label: "Closed", value: o.rows.length - open, tone: "off" },
    { label: "Votes cast", value: votes, hint: "Across the polls shown" },
    next ? { label: "Next to close", value: "", html: relTime(next) } : { label: "Next to close", value: "None", hint: open ? "Open polls have no time limit" : "No open polls", tone: "off" },
  ], "Poll summary");
  const tools = o.rows.length > 1 ? cardTools("poll-list", {
    search: "Search questions and options",
    chips: [{ value: "open", label: "Open", count: open }, { value: "closed", label: "Closed", count: o.rows.length - open }],
    sorts: [{ value: "created:desc", label: "Newest first" }, { value: "created:asc", label: "Oldest first" }, { value: "votes:desc", label: "Most votes" }, { value: "closes:asc", label: "Closing soonest" }],
  }) : "";
  const help = helpPanel("How polls work", [
    ["Starting a poll", "Run <code class=\"inline\">/poll</code> in Discord with a question and its options."],
    ["Pick one / pick any", "Pick-any polls let members choose several options, so percentages are shares of all votes, not of voters."],
    ["Anonymous", "Anonymous polls never show who voted for what, here or in Discord."],
    ["Closing", "Polls close on their timer, or from the poll message in Discord. Results stay here after they close."],
  ]);
  return modulePage(cfg, ctx, {
    active: "polls",
    title: "Polls",
    lead: "Results of polls made with <code class=\"inline\">/poll</code>. Votes update as members click; close a poll from its message in Discord.",
    path: base,
    body: `${o.rows.length
      ? `${stats}${help}
  <p class="muted">${open} open, ${o.rows.length - open} closed. The newest ${POLLS_SHOWN} polls are shown.</p>
  ${tools}
  <ul class="item-list" id="poll-list"${cardList(10)}>${o.rows.map(p => pollCard(ctx, p, o.channels, o.hidden)).join("")}</ul>
  ${cardFoot("poll-list", "No polls match. Clear the search or pick another filter.")}`
      : `${emptyState("No polls yet.", "Start one in Discord with <code class=\"inline\">/poll</code>. Its results show up here as members vote.")}${help}`}`,
  });
}
