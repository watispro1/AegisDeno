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
import { listFoot, listTools, rowAttrs, summaryStrip } from "./moduleKit";
import { epoch } from "./communityKit";

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
    return `<tr${rowAttrs(null, { rank: i + 1, stars: e.starCount, starred: epoch(e.createdAt) })}>
      <td data-label="Rank"><span class="rank-badge${i === 0 ? " rank-1" : ""}">${i + 1}</span></td>
      <td data-label="Stars"><strong>${e.starCount.toLocaleString("en-US")}</strong> ${esc(view.emoji)}</td>
      <td data-label="Author">${personId(ctx, e.authorId)}</td>
      <td data-label="Post">${excerpt ? esc(excerpt) : `<span class="faint">No text saved</span>`}
        <span class="faint">${name ? `#${esc(name)}` : "hidden or deleted channel"} · starred ${relTime(e.createdAt)}</span></td>
      <td data-label="Links">${link(messageUrl(g, e.sourceChannelId, e.sourceMessageId), "Original")}${post ? ` · ${link(post, "Starboard post")}` : ""}</td>
    </tr>`;
  }).join("");
  const stars = view.entries.reduce((n, e) => n + e.starCount, 0);
  const authors = new Map<string, number>();
  for (const e of view.entries) authors.set(e.authorId, (authors.get(e.authorId) ?? 0) + 1);
  const topAuthor = [...authors.entries()].sort((a, b) => b[1] - a[1])[0];
  const stats = view.entries.length ? summaryStrip([
    { label: "Top post", value: `${view.entries[0].starCount.toLocaleString("en-US")} ${view.emoji}` },
    { label: "Stars in top list", value: stars },
    { label: "Authors", value: authors.size, hint: topAuthor && topAuthor[1] > 1 ? `One member has ${topAuthor[1]} of these` : undefined },
  ], "Top posts summary") : "";
  const tools = view.entries.length > 3 ? listTools("sb-top", {
    search: "Search posts, authors or channels",
    sorts: [{ value: "rank:asc", label: "Most stars" }, { value: "starred:desc", label: "Newest" }, { value: "starred:asc", label: "Oldest" }],
  }) : "";
  return `<section class="panel-card" aria-labelledby="sb-top-h">
    <h2 id="sb-top-h">Top posts</h2>
    <p class="muted">The ${view.entries.length > 1 ? `${view.entries.length} ` : ""}most-starred posts of all time. Same list as <code class="inline">/starboard top</code>, which can also show the past week or month, or one member's posts.</p>
    ${stats}${tools}
    ${view.entries.length ? `<div class="table-wrap"><table class="case-table" id="sb-top" data-filterable>
      <caption class="visually-hidden">Most-starred posts</caption>
      <thead><tr><th scope="col">#</th><th scope="col">Stars</th><th scope="col">Author</th><th scope="col">Post</th><th scope="col">Links</th></tr></thead>
      <tbody>${rows}</tbody></table></div>${tools ? listFoot("sb-top", "No top posts match that search.") : ""}` : emptyState("No starred posts yet.", "Posts show up here once they reach the starboard. Check that a starboard channel is set above and members react with the star emoji.")}
  </section>`;
}
