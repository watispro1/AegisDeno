/**
 * Public /roadmap page ("What's next"): open work the maintainer has in mind.
 * These are plans, not promises; nothing here has a date. When an item ships
 * it moves to CHANGELOG.md and comes off this list.
 */
import { REPO_URL } from "../layout";
import { type IconId } from "./featuresData";
import { icon, iconSprite } from "./icons";
import { type SiteConfig, breadcrumb, endNote, escapeHtml as esc, page } from "./shared";

export interface RoadmapItem {
  title: string;
  text: string;
}

export interface RoadmapGroup {
  id: string;
  icon: IconId;
  title: string;
  items: RoadmapItem[];
}

export const ROADMAP: RoadmapGroup[] = [
  {
    id: "economy",
    icon: "star",
    title: "Economy",
    items: [
      { title: "Blackjack", text: "A blackjack game for the server economy, with the bet limits and daily loss cap the other games already use." },
      { title: "Daily quests", text: "Small daily goals that pay out coins, so there is a reason to come back beyond the daily claim." },
      { title: "Buy more than one", text: "A quantity option on the shop's buy command, instead of buying the same item one at a time." },
    ],
  },
  {
    id: "bot",
    icon: "clock",
    title: "Bot",
    items: [
      { title: "Paging follow-ups", text: "More of the long lists in Discord replies get Prev and Next buttons, and the existing pagers get small consistency fixes." },
      { title: "Snooze keeps the jump link", text: "Snoozing a personal reminder from its DM keeps the link back to the message it was set from." },
    ],
  },
  {
    id: "website",
    icon: "layout",
    title: "Website",
    items: [
      { title: "Legal pages redesign", text: "The terms and privacy policy get the same layout as the rest of the site, with the plain-language summaries kept." },
    ],
  },
];

export function renderRoadmap(cfg: SiteConfig): string {
  const groups = ROADMAP.map(g => `<section class="f-cat" id="${g.id}" aria-labelledby="${g.id}-title">
    <h2 id="${g.id}-title"><a class="group-anchor" href="#${g.id}">${esc(g.title)}</a></h2>
    <ul class="f-grid">${g.items.map(i => `<li class="f-card">
      <div class="f-card-head">${icon(g.icon)}<h3>${esc(i.title)}</h3><span class="f-badge">Planned</span></div>
      <p>${esc(i.text)}</p>
    </li>`).join("")}</ul>
  </section>`).join("\n  ");
  const body = `${iconSprite(ROADMAP.map(g => g.icon))}
<div class="wrap">
  ${breadcrumb("What's next")}
  <div class="page-head f-head">
    <span class="eyebrow">Roadmap</span>
    <h1>What's next</h1>
    <p class="lead">Work that is planned for Aegis. These are plans, not promises: there are no dates, things may change or be dropped, and anything that ships shows up in the <a href="/changelog">changelog</a> first.</p>
  </div>
  <nav class="f-nav" aria-label="Roadmap areas"><ul>${ROADMAP.map(g => `<li><a href="#${g.id}">${esc(g.title)}</a></li>`).join("")}</ul></nav>
  ${groups}
  ${endNote(cfg, `Have an idea or a request? Ask in the support server or open an <a href="${REPO_URL}/issues" rel="noopener noreferrer">issue on GitHub</a>. To hear when something ships, follow the <a href="/changelog.xml">changelog feed</a>.`)}
</div>`;
  return page(cfg, {
    title: "What's next | Aegis",
    description: "What is planned for the Aegis Discord bot and website. Plans, not promises: shipped work appears in the changelog.",
    path: "/roadmap",
    body,
  });
}
