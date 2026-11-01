/**
 * Public /features page: headline hero, in-page nav, one section per category
 * with feature cards (icon, description, linked commands, dashboard badge), a
 * "why Aegis" comparison and calls to action. No inline styles or scripts:
 * icons are an in-page SVG sprite referenced with <use href="#...">.
 */
import { getCommand } from "../catalog";
import { commandAnchor } from "./commands";
import { FEATURE_CATEGORIES, FEATURE_ICONS, HEADLINE, WHY_ROWS, type IconId } from "./featuresData";
import { type SiteConfig, breadcrumb, escapeHtml as esc, page, safeUrl } from "./shared";

/** Resolves "case view" to its catalog entry; null when the command or subcommand does not exist. */
export function resolveCommandRef(ref: string): { label: string; href: string } | null {
  const [name, ...rest] = ref.trim().split(/\s+/);
  const path = rest.join(" ");
  const cmd = getCommand(name);
  if (!cmd) return null;
  if (path && !cmd.subcommands.some(s => s.path === path)) return null;
  return { label: `/${cmd.name}${path ? ` ${path}` : ""}`, href: `/commands#${commandAnchor(cmd.name, path)}` };
}

/** Every command path the page references, for the drift test. */
export function featureCommandRefs(): string[] {
  return FEATURE_CATEGORIES.flatMap(c => c.cards.flatMap(card => card.commands));
}

function sprite(): string {
  const symbols = (Object.entries(FEATURE_ICONS) as Array<[IconId, string]>)
    .map(([id, d]) => `<symbol id="fi-${id}" viewBox="0 0 24 24">${d}</symbol>`).join("");
  return `<svg class="visually-hidden" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${symbols}</svg>`;
}

const icon = (id: IconId, cls = "f-icon") => `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#fi-${id}"/></svg>`;

function commandList(refs: string[]): string {
  const items = refs.map(ref => {
    const hit = resolveCommandRef(ref);
    // Commands load at startup; before that (or if one were removed) the name is shown unlinked.
    return hit ? `<li><a href="${esc(hit.href)}"><code>${esc(hit.label)}</code></a></li>` : `<li><code>/${esc(ref)}</code></li>`;
  });
  return `<ul class="f-cmds" aria-label="Related commands">${items.join("")}</ul>`;
}

export function renderFeatures(cfg: SiteConfig): string {
  const nav = FEATURE_CATEGORIES.map(c => `<li><a href="#${c.id}">${esc(c.title)}</a></li>`).join("");
  const hero = HEADLINE.map(h => `<li class="f-hero-card"><a href="${h.href}">${icon(h.icon, "f-icon lg")}<strong>${esc(h.title)}</strong><span>${esc(h.text)}</span></a></li>`).join("");
  const sections = FEATURE_CATEGORIES.map(c => `<section class="f-cat" id="${c.id}" aria-labelledby="${c.id}-title">
    <h2 id="${c.id}-title"><a class="group-anchor" href="#${c.id}">${esc(c.title)}</a></h2>
    <p class="f-lead">${esc(c.lead)}</p>
    <ul class="f-grid">${c.cards.map(card => `<li class="f-card" id="${card.id}">
      <div class="f-card-head">${icon(card.icon)}<h3>${esc(card.title)}</h3>${card.dashboard ? `<span class="f-badge" title="Also on the dashboard">On the dashboard: ${esc(card.dashboard)}</span>` : ""}</div>
      <p>${esc(card.text)}</p>
      ${commandList(card.commands)}
    </li>`).join("")}</ul>
  </section>`).join("\n");
  const why = `<section class="f-cat" id="why" aria-labelledby="why-title">
    <h2 id="why-title"><a class="group-anchor" href="#why">Why Aegis</a></h2>
    <div class="table-wrap"><table class="f-why"><caption class="visually-hidden">Aegis compared with doing it by hand or other bots</caption>
      <thead><tr><th scope="col">What matters</th><th scope="col">Aegis</th><th scope="col">Elsewhere</th></tr></thead>
      <tbody>${WHY_ROWS.map(([a, b, c]) => `<tr><th scope="row">${esc(a)}</th><td>${esc(b)}</td><td>${esc(c)}</td></tr>`).join("")}</tbody></table></div>
  </section>`;
  const body = `${sprite()}
<div class="wrap">
  ${breadcrumb("Features")}
  <div class="page-head f-head">
    <h1>Features</h1>
    <p class="lead">Moderation that explains itself: careful actions, filters, raid response and a trust score you can read, with a dashboard for all of it. Every command below links to its full reference.</p>
    <div class="btn-row">
      <a class="btn" href="/invite">Add to Discord</a>
      <a class="btn ghost" href="/dashboard">Open the dashboard</a>
    </div>
  </div>
  <ul class="f-hero" aria-label="Headline features">${hero}</ul>
  <nav class="f-nav" aria-label="Feature categories"><ul>${nav}<li><a href="#why">Why Aegis</a></li></ul></nav>
  ${sections}
  ${why}
  <div class="end-note">
    <p>Ready to try it? It works on a test server too.</p>
    <div class="btn-row">
      <a class="btn" href="/invite">Add to Discord</a>
      <a class="btn ghost" href="/dashboard">Open the dashboard</a>
      <a class="btn ghost" href="/commands">All commands</a>
      ${cfg.supportUrl ? `<a class="btn ghost" href="${safeUrl(cfg.supportUrl)}" rel="noopener noreferrer">Support server</a>` : ""}
    </div>
  </div>
</div>`;
  return page(cfg, {
    title: "Features | Aegis",
    description: "Moderation and cases, automod, Incident Mode, Trust Score, tickets and appeals, community tools, a web dashboard and a public status page in the Aegis Discord bot.",
    path: "/features",
    body,
  });
}
