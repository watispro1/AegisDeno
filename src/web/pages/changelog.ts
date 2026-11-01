import { REPO_URL } from "../layout";
import { getChangelog, getDashboardChangelog, type ChangelogRelease } from "../changelog";
import { type SiteConfig, breadcrumb, endNote, escapeHtml, jsonLd, page, safeUrl } from "./shared";

/* ── Changelog ─────────────────────────────────────────────────────── */


function fmtDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

function releaseBlock(r: ChangelogRelease, latest = false): string {
  const label = r.date ? `v${r.version}` : r.version;
  const searchBlob = [r.version, ...r.notes, ...r.sections.flatMap(sec => [sec.title, ...sec.items])]
    .join(" ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return `<article class="release" id="${escapeHtml(r.id)}" data-search="${escapeHtml(searchBlob)}" aria-labelledby="${escapeHtml(r.id)}-title">
      <div class="release-meta">
        ${latest ? `<span class="release-latest">Latest</span>` : ""}
        ${r.date ? `<time datetime="${escapeHtml(r.date)}">${fmtDate(r.date)}</time>` : `<span class="release-pending">Not released yet</span>`}
        ${r.compareUrl ? `<a class="release-diff" href="${safeUrl(r.compareUrl)}" rel="noopener noreferrer">Commits</a>` : ""}
        <button class="release-copy" type="button" data-copy-link="#${escapeHtml(r.id)}" aria-label="Copy a link to ${escapeHtml(label)}">Copy link</button>
      </div>
      <div>
        <h2 class="release-title" id="${escapeHtml(r.id)}-title"><a href="#${escapeHtml(r.id)}">${escapeHtml(label)}</a></h2>
        ${r.notes.map(n => `<p class="release-summary">${n}</p>`).join("\n        ")}
        ${r.sections.map(sec => `<h3>${escapeHtml(sec.title)}</h3>
        <ul class="changes">
          ${sec.items.map(i => `<li>${i}</li>`).join("\n          ")}
        </ul>`).join("\n        ")}
      </div>
    </article>`;
}

export function renderChangelog(cfg: SiteConfig): string {
  const log = getChangelog();
  const toc = log.releases
    .map(r => `<li data-release="${escapeHtml(r.id)}"><a href="#${escapeHtml(r.id)}">${escapeHtml(r.version)}</a>${r.date ? ` <span class="faint">${escapeHtml(r.date)}</span>` : ""}</li>`)
    .join("\n        ");

  const releases = log.releases.length
    ? log.releases.map((r, index) => releaseBlock(r, index === 0 && Boolean(r.date))).join("\n      ")
    : `<p>The changelog file could not be read. It lives in the repository as <a href="${REPO_URL}/blob/main/CHANGELOG.md">CHANGELOG.md</a>.</p>`;

  const body = `
<div class="wrap">
  ${breadcrumb("Changelog")}
  <div class="page-head">
    <h1>Changelog</h1>
    <p class="lead">What changed in each version, newest first. This page is built from <a href="${REPO_URL}/blob/main/CHANGELOG.md">CHANGELOG.md</a> in the repository, so the two always match. There is also an <a href="/changelog.xml">Atom feed</a>. Changes to the web dashboard are in the <a href="/dashboard/changelog">dashboard changelog</a>.</p>
  </div>

  <div class="release-search">
    <div class="search">
      <span class="icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      </span>
      <label class="visually-hidden" for="cl-search">Search releases</label>
      <input id="cl-search" type="search" placeholder="Filter by version, command or fix" autocomplete="off" spellcheck="false" aria-controls="cl-releases">
    </div>
    <span class="cmd-count" id="cl-count" role="status" aria-live="polite">${log.releases.length} release${log.releases.length === 1 ? "" : "s"}</span>
  </div>
  <p class="empty-state" id="cl-empty" hidden><strong>No releases match.</strong> <button class="linklike" type="button" data-cl-clear>Clear the filter</button></p>

  <details class="toc-mobile">
    <summary>Jump to a version</summary>
    <ul>
      ${toc}
    </ul>
  </details>

  <div class="split">
    <aside class="toc" aria-label="Versions">
      <p class="side-title">Versions</p>
      <ul>
        ${toc}
      </ul>
    </aside>
    <div id="cl-releases">
      ${log.intro.map(p => `<p class="faint">${p}</p>`).join("\n      ")}
      ${releases}
      ${endNote(cfg, `This server is running v${escapeHtml(cfg.version)}.`)}
    </div>
  </div>
</div>`;

  const released = log.releases.filter(r => r.date);
  return page(cfg, {
    title: "Changelog | Aegis",
    description: "Release history for the Aegis Discord bot, built from CHANGELOG.md in the repository.",
    path: "/changelog",
    body,
    headExtra: jsonLd({
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "Aegis changelog",
      url: `${process.env.SITE_URL || ""}/changelog`,
      blogPost: released.slice(0, 10).map(r => ({
        "@type": "BlogPosting",
        headline: `Aegis ${r.version}`,
        datePublished: r.date,
        url: `${process.env.SITE_URL || ""}/changelog#${r.id}`,
      })),
    }),
  });
}

/** /dashboard/changelog: rendered from DASHBOARD_CHANGELOG.md. Public, no login. */
export function renderDashboardChangelog(cfg: SiteConfig): string {
  const log = getDashboardChangelog();
  const releases = log.releases.length
    ? log.releases.map(r => releaseBlock(r)).join("\n      ")
    : `<p>The dashboard changelog file could not be read. It lives in the repository as <a href="${REPO_URL}/blob/main/DASHBOARD_CHANGELOG.md">DASHBOARD_CHANGELOG.md</a>.</p>`;

  const body = `
<div class="wrap">
  <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span class="sep">/</span><a href="/changelog">Changelog</a><span class="sep">/</span><span>Dashboard</span></nav>
  <div class="page-head">
    <h1>Dashboard changelog</h1>
    <p class="lead">What changed in the web dashboard, newest first. This page is built from <a href="${REPO_URL}/blob/main/DASHBOARD_CHANGELOG.md">DASHBOARD_CHANGELOG.md</a> in the repository. Changes to the bot itself are in the <a href="/changelog">main changelog</a>.</p>
  </div>
  ${log.intro.map(p => `<p class="faint">${p}</p>`).join("\n  ")}
  ${releases}
  <p class="faint"><a href="/dashboard">Open the dashboard</a></p>
</div>`;

  return page(cfg, {
    title: "Dashboard changelog | Aegis",
    description: "Release history for the Aegis web dashboard, built from DASHBOARD_CHANGELOG.md in the repository.",
    path: "/dashboard/changelog",
    body,
  });
}
