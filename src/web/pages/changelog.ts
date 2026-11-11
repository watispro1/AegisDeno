import { REPO_URL } from "../layout";
import {
  CHANGE_KINDS,
  getChangelog,
  getDashboardChangelog,
  releaseCounts,
  sectionKind,
  versionBump,
  type ChangeKind,
  type Changelog,
  type ChangelogRelease,
  type VersionBump,
} from "../changelog";
import { DASHBOARD_VERSION } from "../../version";
import { type SiteConfig, endNote, escapeHtml, jsonLd, page, safeUrl } from "./shared";

/* Changelog: /changelog (bot, CHANGELOG.md) and /dashboard/changelog (DASHBOARD_CHANGELOG.md) */

/** Releases shown expanded on first load; older ones start collapsed (one click, or a link, opens them). */
export const OPEN_RELEASES = 3;

const KIND_LABEL: Record<ChangeKind, string> = {
  added: "Added",
  changed: "Changed",
  fixed: "Fixed",
  security: "Security",
  removed: "Removed",
  deprecated: "Deprecated",
  known: "Known limitations",
  other: "Other",
};

/** Lower-case word used in the per-release tally ("12 added", "3 fixed"). */
const KIND_TALLY: Record<ChangeKind, string> = {
  added: "added",
  changed: "changed",
  fixed: "fixed",
  security: "security",
  removed: "removed",
  deprecated: "deprecated",
  known: "known limits",
  other: "other",
};

const BUMP_LABEL: Record<VersionBump, string> = { major: "Major", minor: "Minor", patch: "Patch", initial: "First release" };

function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" }): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

function plural(n: number, word: string): string {
  return `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;
}

type Product = "bot" | "dashboard";

interface ProductInfo {
  product: Product;
  path: string;
  file: string;
  title: string;
  heading: string;
  lead: string;
}

function productInfo(product: Product): ProductInfo {
  if (product === "dashboard") {
    return {
      product,
      path: "/dashboard/changelog",
      file: "DASHBOARD_CHANGELOG.md",
      title: "Dashboard changelog | Aegis",
      heading: "Dashboard changelog",
      lead: `What changed in the web dashboard, newest first. Built from <a href="${REPO_URL}/blob/main/DASHBOARD_CHANGELOG.md">DASHBOARD_CHANGELOG.md</a> in the repository, so the two always match.`,
    };
  }
  return {
    product,
    path: "/changelog",
    file: "CHANGELOG.md",
    title: "Changelog | Aegis",
    heading: "Changelog",
    lead: `What changed in each version of the bot, newest first. Built from <a href="${REPO_URL}/blob/main/CHANGELOG.md">CHANGELOG.md</a> in the repository, so the two always match.`,
  };
}

/** Bot / Dashboard switch. Plain links, so it works without JavaScript. */
function productSwitch(current: Product, bot: Changelog, dash: Changelog): string {
  const latest = (log: Changelog) => log.releases.find(r => r.date)?.version;
  const tab = (p: Product, label: string, href: string, version: string | undefined) =>
    `<a class="cl-product-tab" href="${href}"${p === current ? ` aria-current="page"` : ""}>${label}${version ? ` <span class="cl-product-v">v${escapeHtml(version)}</span>` : ""}</a>`;
  return `<nav class="cl-product" aria-label="Which changelog">
      ${tab("bot", "Bot", "/changelog", latest(bot))}
      ${tab("dashboard", "Dashboard", "/dashboard/changelog", latest(dash) ?? DASHBOARD_VERSION)}
    </nav>`;
}

function statsStrip(log: Changelog): string {
  const released = log.releases.filter(r => r.date);
  if (!released.length) return "";
  const newest = released[0];
  const oldest = released[released.length - 1];
  const total = released.reduce((n, r) => n + releaseCounts(r).total, 0);
  const item = (label: string, value: string, hint: string) =>
    `<div class="cl-stat"><dt>${label}</dt><dd><strong>${value}</strong><span>${hint}</span></dd></div>`;
  return `<dl class="cl-stats">
    ${item("Latest", `<a href="#${escapeHtml(newest.id)}">v${escapeHtml(newest.version)}</a>`, `<time datetime="${escapeHtml(newest.date!)}">${fmtDate(newest.date!)}</time>`)}
    ${item("Releases", released.length.toLocaleString("en-US"), `since <time datetime="${escapeHtml(oldest.date!)}">${fmtDate(oldest.date!)}</time>`)}
    ${item("Changes", total.toLocaleString("en-US"), "listed entries")}
  </dl>`;
}

function kindChip(kind: ChangeKind, title: string): string {
  return `<span class="kchip kc-${kind}">${escapeHtml(title)}</span>`;
}

function tally(r: ChangelogRelease): string {
  const { byKind } = releaseCounts(r);
  const parts = CHANGE_KINDS.filter(k => byKind[k]).map(k => `<li class="tally-item kc-${k}"><span class="tally-dot" aria-hidden="true"></span>${byKind[k]} ${KIND_TALLY[k]}</li>`);
  return parts.length ? `<ul class="release-tally" aria-label="Changes in this release">${parts.join("")}</ul>` : "";
}

export function releaseBlock(r: ChangelogRelease, opts: { latest?: boolean; previous?: string | null; open?: boolean } = {}): string {
  const label = r.date ? `v${r.version}` : r.version;
  const id = escapeHtml(r.id);
  const bump = r.date ? versionBump(r.version, opts.previous) : null;
  const { total } = releaseCounts(r);
  const sections = r.sections.map(sec => {
    const kind = sectionKind(sec.title);
    return `<section class="change-group" data-kind="${kind}">
          <h3 class="change-head">${kindChip(kind, sec.title)}<span class="change-n">${sec.items.length}</span></h3>
          <ul class="changes">
            ${sec.items.map(i => `<li>${i}</li>`).join("\n            ")}
          </ul>
        </section>`;
  }).join("\n        ");

  return `<article class="release${opts.latest ? " is-latest" : ""}" id="${id}" aria-labelledby="${id}-title">
      <span class="release-node${bump ? ` node-${bump}` : ""}" aria-hidden="true"></span>
      <header class="release-head">
        <div class="release-heading">
          <h2 class="release-title" id="${id}-title"><a href="#${id}">${escapeHtml(label)}</a></h2>
          ${opts.latest ? `<span class="release-latest">Latest</span>` : ""}
          ${bump ? `<span class="vbadge vb-${bump}">${BUMP_LABEL[bump]}</span>` : ""}
        </div>
        <div class="release-meta">
          ${r.date ? `<time datetime="${escapeHtml(r.date)}">${fmtDate(r.date)}</time>` : `<span class="release-pending">Not released yet</span>`}
          ${r.compareUrl ? `<a class="release-diff" href="${safeUrl(r.compareUrl)}" rel="noopener noreferrer">Compare commits</a>` : ""}
          <button class="release-copy" type="button" data-copy-link="#${id}" aria-label="Copy a link to ${escapeHtml(label)}">Copy link</button>
        </div>
      </header>
      ${r.notes.map(n => `<p class="release-summary">${n}</p>`).join("\n      ")}
      ${tally(r)}
      <details class="release-body"${opts.open ? " open" : ""} data-default-open="${opts.open ? "1" : "0"}">
        <summary class="release-toggle"><span class="when-closed">Show ${plural(total, "change")}</span><span class="when-open">Hide changes</span></summary>
        ${sections}
        <p class="release-nomatch" hidden>Nothing in ${escapeHtml(label)} matches the filter.</p>
      </details>
    </article>`;
}

/** Version list, grouped by major version ("3.x"), for the sticky sidebar and the mobile jump menu. */
function versionNav(log: Changelog): string {
  const groups = new Map<string, ChangelogRelease[]>();
  for (const r of log.releases) {
    const major = /^\d+/.exec(r.version)?.[0];
    const key = major ? `${major}.x` : r.version;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([key, list]) => `<div class="toc-group" data-toc-group>
      <p class="side-title toc-group-title">${escapeHtml(key)}</p>
      <ul>
        ${list.map(r => `<li data-release="${escapeHtml(r.id)}"><a href="#${escapeHtml(r.id)}"><span class="toc-v">${escapeHtml(r.version)}</span>${r.date ? `<span class="toc-d">${fmtDate(r.date, { month: "short", day: "numeric" })}</span>` : ""}</a></li>`).join("\n        ")}
      </ul>
      </div>`).join("\n      ");
}

/** Search box, change-type filter and expand/collapse. Needs JavaScript, so hidden without it. */
function toolbar(log: Changelog): string {
  const present = new Map<ChangeKind, number>();
  for (const r of log.releases) for (const s of r.sections) {
    const k = sectionKind(s.title);
    present.set(k, (present.get(k) ?? 0) + s.items.length);
  }
  const kinds = CHANGE_KINDS.filter(k => present.has(k));
  const count = log.releases.length;
  return `<div class="cl-toolbar" data-js-only>
    <div class="release-search">
      <div class="search">
        <span class="icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        </span>
        <label class="visually-hidden" for="cl-search">Search changes</label>
        <input id="cl-search" type="search" placeholder="Search changes, commands or versions" autocomplete="off" spellcheck="false" aria-controls="cl-releases" aria-describedby="cl-count">
      </div>
      <button class="btn ghost sm" type="button" data-cl-expand aria-pressed="false">Expand all</button>
    </div>
    <div class="cl-filter">
      <div class="cl-kinds" role="group" aria-label="Show only one kind of change">
        <button class="cl-kind" type="button" data-cl-kind="all" aria-pressed="true">All</button>
        ${kinds.map(k => `<button class="cl-kind kc-${k}" type="button" data-cl-kind="${k}" aria-pressed="false"><span class="tally-dot" aria-hidden="true"></span>${KIND_LABEL[k]} <span class="n">${present.get(k)}</span></button>`).join("\n        ")}
      </div>
      <span class="cmd-count" id="cl-count" role="status" aria-live="polite">${plural(count, "release")}</span>
    </div>
  </div>
  <p class="empty-state" id="cl-empty" hidden><strong>No changes match.</strong> Try a shorter word, or <button class="linklike" type="button" data-cl-clear>clear the filter</button>.</p>`;
}

function renderLog(cfg: SiteConfig, product: Product): string {
  const info = productInfo(product);
  const bot = getChangelog();
  const dash = getDashboardChangelog();
  const log = product === "bot" ? bot : dash;
  const latestIndex = log.releases.findIndex(r => r.date);

  const releases = log.releases.length
    ? log.releases.map((r, index) => releaseBlock(r, {
        latest: index === latestIndex,
        previous: log.releases.slice(index + 1).find(x => x.date)?.version ?? null,
        open: index < OPEN_RELEASES,
      })).join("\n      ")
    : `<p class="empty-state"><strong>The changelog file could not be read.</strong> It lives in the repository as <a href="${REPO_URL}/blob/main/${info.file}">${info.file}</a>.</p>`;

  const crumbs = product === "bot"
    ? `<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span class="sep">/</span><span>Changelog</span></nav>`
    : `<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span class="sep">/</span><a href="/changelog">Changelog</a><span class="sep">/</span><span>Dashboard</span></nav>`;

  const feeds = [
    product === "bot" ? `<a href="/changelog.xml">Atom feed</a>` : "",
    `<a href="/changelog.json">JSON</a>`,
    `<a href="${REPO_URL}/blob/main/${info.file}">${info.file} on GitHub</a>`,
  ].filter(Boolean).join(`<span class="sep" aria-hidden="true">·</span>`);

  const nav = versionNav(log);
  const footer = product === "bot"
    ? endNote(cfg, `This server is running v${escapeHtml(cfg.version)}.`)
    : `<div class="end-note"><p>Dashboard v${escapeHtml(DASHBOARD_VERSION)}.</p><div class="btn-row"><a class="btn" href="/dashboard">Open the dashboard</a><a class="btn ghost" href="/changelog">Bot changelog</a></div></div>`;

  return `
<div class="wrap cl-page" data-cl-page>
  ${crumbs}
  <div class="page-head cl-head">
    <div class="cl-head-text">
      <span class="eyebrow">Release notes</span>
      <h1>${info.heading}</h1>
      <p class="lead">${info.lead}</p>
      <p class="cl-feeds">${feeds}</p>
    </div>
    ${productSwitch(product, bot, dash)}
  </div>
  ${statsStrip(log)}
  ${log.intro.length ? `<div class="cl-intro">${log.intro.map(p => `<p>${p}</p>`).join("")}</div>` : ""}
  ${log.releases.length ? toolbar(log) : ""}

  ${log.releases.length ? `<details class="toc-mobile">
    <summary>Jump to a version</summary>
    <nav aria-label="Versions">
      ${nav}
    </nav>
  </details>` : ""}

  <div class="split cl-split">
    ${log.releases.length ? `<aside class="toc cl-toc" aria-label="Versions">
      ${nav}
      <a class="cl-top" href="#main">Back to top</a>
    </aside>` : "<div></div>"}
    <div class="cl-timeline" id="cl-releases">
      ${releases}
      ${footer}
    </div>
  </div>
</div>`;
}

export function renderChangelog(cfg: SiteConfig): string {
  const released = getChangelog().releases.filter(r => r.date);
  return page(cfg, {
    title: "Changelog | Aegis",
    description: "Release history for the Aegis Discord bot, built from CHANGELOG.md in the repository.",
    path: "/changelog",
    body: renderLog(cfg, "bot"),
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
  return page(cfg, {
    title: "Dashboard changelog | Aegis",
    description: "Release history for the Aegis web dashboard, built from DASHBOARD_CHANGELOG.md in the repository.",
    path: "/dashboard/changelog",
    body: renderLog(cfg, "dashboard"),
  });
}
