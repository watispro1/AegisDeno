/** Polls page: a read-only list of the server's /poll polls with their results. */
import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { ChannelOption } from "../botView";
import { POLLS_SHOWN, formatPollPercent, messageJumpUrl, type PollRow } from "../communityQuery";
import { type GuildContext, copyId, emptyState, personId, relTime } from "./layout";
import { modulePage } from "./parts";

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
  return `<li class="item-card">
      <div class="item-head"><span class="status-pill ${p.ended ? "off" : "on"}">${p.ended ? "Closed" : "Open"}</span>
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
  return modulePage(cfg, ctx, {
    active: "polls",
    title: "Polls",
    lead: "Results of polls made with <code class=\"inline\">/poll</code>. Votes update as members click; close a poll from its message in Discord.",
    path: base,
    body: `${o.rows.length
      ? `<p class="muted">${open} open, ${o.rows.length - open} closed. The newest ${POLLS_SHOWN} polls are shown.</p>
  <ul class="item-list">${o.rows.map(p => pollCard(ctx, p, o.channels, o.hidden)).join("")}</ul>`
      : emptyState("No polls yet.", "Start one in Discord with <code class=\"inline\">/poll</code>.")}`,
  });
}
