/** "Top posts" on the Starboard settings page: the ten most-starred posts of all time. Read-only. */
import { escapeHtml as esc } from "../../pages";
import type { ChannelOption } from "../botView";
import {
  STARBOARD_EXCERPT_SHOW_MAX,
  messageUrl,
  starboardPostUrl,
  storedExcerpt,
  type StarboardTopEntry,
} from "../../../services/starboardTop";
import { type GuildContext, emptyState, personId, relTime } from "./layout";

export interface StarboardTopView {
  entries: StarboardTopEntry[];
  starboardChannelId: string | null;
  emoji: string;
}

function link(href: string, label: string): string {
  return `<a class="text-link" href="${esc(href)}" rel="noopener noreferrer" target="_blank">${esc(label)}</a>`;
}

export function starboardTopPanel(ctx: GuildContext, view: StarboardTopView, channels: ChannelOption[]): string {
  const g = ctx.guild.id;
  const chan = (id: string) => channels.find(c => c.id === id)?.name;
  const rows = view.entries.map((e, i) => {
    const excerpt = storedExcerpt(e.excerpt, STARBOARD_EXCERPT_SHOW_MAX);
    const post = starboardPostUrl(g, e, view.starboardChannelId);
    const name = chan(e.sourceChannelId);
    return `<tr>
      <td data-label="Rank">${i + 1}</td>
      <td data-label="Stars"><strong>${e.starCount.toLocaleString("en-US")}</strong> ${esc(view.emoji)}</td>
      <td data-label="Author">${personId(ctx, e.authorId)}</td>
      <td data-label="Post">${excerpt ? esc(excerpt) : `<span class="faint">No text saved</span>`}
        <span class="faint">${name ? `#${esc(name)}` : "hidden or deleted channel"} · starred ${relTime(e.createdAt)}</span></td>
      <td data-label="Links">${link(messageUrl(g, e.sourceChannelId, e.sourceMessageId), "Original")}${post ? ` · ${link(post, "Starboard post")}` : ""}</td>
    </tr>`;
  }).join("");
  return `<section class="panel-card" aria-labelledby="sb-top-h">
    <h2 id="sb-top-h">Top posts</h2>
    <p class="muted">The ${view.entries.length > 1 ? `${view.entries.length} ` : ""}most-starred posts of all time. Same list as <code class="inline">/starboard top</code>, which can also show the past week or month, or one member's posts.</p>
    ${view.entries.length ? `<div class="table-wrap"><table class="case-table" id="sb-top">
      <caption class="visually-hidden">Most-starred posts</caption>
      <thead><tr><th scope="col">#</th><th scope="col">Stars</th><th scope="col">Author</th><th scope="col">Post</th><th scope="col">Links</th></tr></thead>
      <tbody>${rows}</tbody></table></div>` : emptyState("No starred posts yet.", "Posts show up here once they reach the starboard.")}
  </section>`;
}
