/** 404 page and legacy route aliases. (The 404 suggestion logic lives in ../notFound.ts.) */
import { REPO_URL } from "../layout";
import { type SiteConfig, endNote, escapeHtml, page, safeUrl } from "./shared";
import { renderFeatures } from "./home";

/* ── 404 ───────────────────────────────────────────────────────────── */

export function renderNotFound(cfg: SiteConfig, suggestions: { href: string; label: string }[] = []): string {
  const suggest = suggestions.length
    ? `<p class="suggest">Did you mean ${suggestions
        .map(s => `<a href="${safeUrl(s.href)}">${escapeHtml(s.label)}</a>`)
        .join(", ")}?</p>`
    : "";
  const body = `
<div class="wrap">
  <div class="page-head">
    <p class="eyebrow">404</p>
    <h1>There is no page at this address.</h1>
    <p class="lead">It may have moved, or the link has a typo. If a link on this site brought you here, please <a href="${REPO_URL}/issues" rel="noopener noreferrer">report it on GitHub</a>.</p>
  </div>
  ${suggest}
  <form class="notfound-search" role="search" action="/commands" method="get">
    <label class="visually-hidden" for="notfound-q">Search commands</label>
    <input id="notfound-q" name="q" type="search" placeholder="Search commands, e.g. ban" autocomplete="off" spellcheck="false" maxlength="100">
    <button class="btn" type="submit">Search commands</button>
  </form>
  <ul class="notes">
    <li><a href="/commands">Commands</a>: every slash command with its options, searchable.</li>
    <li><a href="/docs">Docs</a>: setup, configuration and permissions.</li>
    <li><a href="/troubleshooting">Troubleshooting</a>: missing commands, role order, automod.</li>
    <li><a href="/changelog">Changelog</a>: what changed recently.</li>
    <li><a href="/">Home</a></li>
  </ul>
  ${endNote(cfg, "You can also press <kbd>Ctrl</kbd> <kbd>K</kbd> to search every page and command.")}
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

/* ── Legacy routes ─────────────────────────────────────────────────── */

export function renderPlayground(cfg: SiteConfig): string {
  return renderFeatures(cfg);
}
