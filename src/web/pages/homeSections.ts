/**
 * Home page sections that sit above the long feature list: the four
 * differentiators, the "for server managers / for staff" split and the
 * "What's new" strip built from CHANGELOG.md.
 */
import { getReleases, type ChangelogRelease } from "../changelog";
import { icon } from "./icons";
import type { IconId } from "./featuresData";
import { escapeHtml as esc } from "./shared";

/** The four things that set Aegis apart; each links to its reason on /why. */
export const DIFFERENTIATORS: Array<{ icon: IconId; title: string; text: string; href: string }> = [
  { icon: "alert", title: "Exact restore", text: "Incident Mode records every channel before it touches it, then puts each slowmode and permission back exactly when it ends.", href: "/why#incident" },
  { icon: "gauge", title: "A Trust Score you can read", text: "A 0–100 score where every point is listed. Counts and dates only, never message content.", href: "/why#explainable" },
  { icon: "lock", title: "No Administrator", text: "The invite asks only for the permissions its commands use. Administrator is never requested.", href: "/why#permissions" },
  { icon: "star", title: "Free, nothing locked", text: "No paid tier and no premium features. Every command works in every server.", href: "/why#free" },
];

export function differentiators(): string {
  return `<section class="section" aria-labelledby="diff-title">
  <div class="wrap">
    <div class="section-head">
      <h2 id="diff-title">Why servers pick Aegis</h2>
      <p>Four things most moderation bots don't do. Each one says where to check it on <a href="/why">Why Aegis</a>.</p>
    </div>
    <ul class="diff-grid">
      ${DIFFERENTIATORS.map(d => `<li class="diff-card">
        ${icon(d.icon, "f-icon lg")}
        <h3>${esc(d.title)}</h3>
        <p>${esc(d.text)}</p>
        <a class="text-link" href="${d.href}">How it works &rarr;</a>
      </li>`).join("\n      ")}
    </ul>
  </div>
</section>`;
}

export function audienceSplit(): string {
  return `<section class="section" aria-labelledby="audience-title">
  <div class="wrap">
    <div class="section-head">
      <h2 id="audience-title">Who it's for</h2>
    </div>
    <div class="audience">
      <div class="audience-card">
        <h3>For server managers</h3>
        <ul>
          <li>Set up in about five minutes with a few slash commands.</li>
          <li>Change settings, review cases and run Incident Mode from the <a href="/dashboard">web dashboard</a>.</li>
          <li>Pick exactly which filters, logs and tools are on.</li>
        </ul>
        <p><a class="text-link" href="/docs#quickstart">Setup guide &rarr;</a></p>
      </div>
      <div class="audience-card">
        <h3>For staff</h3>
        <ul>
          <li>Warn, time out and ban with an Undo button for when you get it wrong.</li>
          <li>Every action becomes a numbered case anyone on the team can look up.</li>
          <li>Check a member's Trust Score before handing out a role.</li>
        </ul>
        <p><a class="text-link" href="/docs#moderation">Moderation docs &rarr;</a></p>
      </div>
    </div>
  </div>
</section>`;
}

/** Plain text of a rendered changelog item, cut to its headline (before the first colon or full stop). */
export function itemHeadline(html: string, max = 60): string {
  const text = html.replace(/<ul[\s\S]*$/, "").replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();
  const head = text.split(/:\s|\.\s|\.$/)[0].trim();
  return head.length > max ? `${head.slice(0, max - 1).trimEnd()}…` : head;
}

/** The newest dated release that added something, else the newest dated release. */
export function newestWithAdditions(releases: ChangelogRelease[] = getReleases()): ChangelogRelease | null {
  const dated = releases.filter(r => r.date);
  return dated.find(r => r.sections.some(s => /^added$/i.test(s.title) && s.items.length)) ?? dated[0] ?? null;
}

export function whatsNewStrip(): string {
  const r = newestWithAdditions();
  if (!r) return "";
  const added = r.sections.find(s => /^added$/i.test(s.title)) ?? r.sections[0];
  const items = (added?.items ?? []).slice(0, 3).map(i => itemHeadline(i, 44)).filter(Boolean);
  return `<aside class="whats-new" aria-label="What's new">
    <span class="whats-new-label">New in <a href="/changelog#${esc(r.id)}">v${esc(r.version)}</a></span>
    ${items.length ? `<ul>${items.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
    <a class="text-link" href="/changelog">Changelog &rarr;</a>
    <a class="text-link" href="/roadmap">Roadmap &rarr;</a>
  </aside>`;
}
