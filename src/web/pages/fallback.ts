/** 404 page and legacy route aliases. (The 404 suggestion logic lives in ../notFound.ts.) */
import { getCommand } from "../catalog";
import { REPO_URL } from "../layout";
import { icon, iconSprite, type IconId } from "./icons";
import { type SiteConfig, endNote, escapeHtml, page, safeUrl } from "./shared";
import { renderFeatures } from "./home";

/* 404 */

const DESTINATIONS: { href: string; title: string; text: string; icon: IconId }[] = [
  { href: "/commands", title: "Commands", text: "Every slash command with its options, searchable.", icon: "gavel" },
  { href: "/docs", title: "Docs", text: "Setup, configuration, permissions and a guide per feature.", icon: "layout" },
  { href: "/troubleshooting", title: "Troubleshooting", text: "Missing commands, role order, automod and tickets.", icon: "check" },
  { href: "/features", title: "Features", text: "What Aegis does, with the command for each part.", icon: "star" },
  { href: "/changelog", title: "Changelog", text: "What changed in each release.", icon: "clock" },
  { href: "/status", title: "Status", text: "Whether the bot is up right now.", icon: "pulse" },
];

/** Commands people most often look up, linked only if they exist. */
const POPULAR = ["ban", "warn", "timeout", "automod", "ticket", "logging", "verify", "diagnostics"];

export function renderNotFound(
  cfg: SiteConfig,
  suggestions: { href: string; label: string }[] = [],
  requestedPath = "",
): string {
  const path = String(requestedPath ?? "").slice(0, 120);
  const suggest = suggestions.length
    ? `<section class="nf-suggest" aria-labelledby="nf-suggest-title">
    <h2 id="nf-suggest-title">Did you mean</h2>
    <ul class="suggest">
      ${suggestions.map(s => `<li><a href="${safeUrl(s.href)}">${escapeHtml(s.label)}</a> <span class="faint">${escapeHtml(s.href)}</span></li>`).join("\n      ")}
    </ul>
  </section>`
    : "";

  const popular = POPULAR.filter(n => getCommand(n)).map(n =>
    `<li><a class="cmd-link" href="/commands#cmd-${escapeHtml(n)}"><code class="inline">/${escapeHtml(n)}</code></a></li>`
  ).join("");

  const body = `${iconSprite(DESTINATIONS.map(d => d.icon))}
<div class="wrap nf">
  <header class="nf-head">
    <p class="nf-code" aria-hidden="true">404</p>
    <div>
      <p class="eyebrow">Error 404 · page not found</p>
      <h1>There is no page at this address.</h1>
      ${path ? `<p class="nf-path">Nothing lives at <code class="inline">${escapeHtml(path)}</code>.</p>` : ""}
      <p class="lead">It may have moved, or the link has a typo. If a link on this site brought you here, please <a href="${REPO_URL}/issues" rel="noopener noreferrer">report it on GitHub</a>.</p>
    </div>
  </header>

  ${suggest}

  <section class="nf-search-wrap" aria-labelledby="nf-search-title">
    <h2 id="nf-search-title">Search the commands</h2>
    <form class="notfound-search" role="search" action="/commands" method="get">
      <label class="visually-hidden" for="notfound-q">Search commands</label>
      <input id="notfound-q" name="q" type="search" placeholder="Search commands, e.g. ban" autocomplete="off" spellcheck="false" maxlength="100">
      <button class="btn" type="submit">Search commands</button>
    </form>
    <p class="muted">Works without JavaScript. With it, press <kbd>Ctrl</kbd> <kbd>K</kbd> to search every page and command.</p>
    ${popular ? `<p class="side-title">Popular commands</p><ul class="nf-popular">${popular}</ul>` : ""}
  </section>

  <section aria-labelledby="nf-places-title">
    <h2 id="nf-places-title">Or go to</h2>
    <ul class="nf-places">
      ${DESTINATIONS.map(d => `<li><a href="${d.href}">${icon(d.icon)}<strong>${escapeHtml(d.title)}</strong><span>${escapeHtml(d.text)}</span></a></li>`).join("\n      ")}
    </ul>
    <p><a class="text-link" href="/">&larr; Back to the home page</a></p>
  </section>
  ${endNote(cfg, cfg.supportUrl ? "Still lost? Ask in the support server or open an issue on GitHub." : "Still lost? Open an issue on GitHub.")}
</div>`;

  return page(cfg, {
    title: "Page not found | Aegis",
    description: "The requested page could not be found.",
    path: "/404",
    body,
    noindex: true,
    omitCanonical: true,
  });
}

/* Legacy routes */

export function renderPlayground(cfg: SiteConfig): string {
  return renderFeatures(cfg);
}
