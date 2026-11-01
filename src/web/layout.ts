export interface NavLink {
  label: string;
  href: string;
}

export interface LayoutOptions {
  title: string;
  description: string;
  path: string;
  body: string;
  /** Current path, used to mark the active nav item. */
  current?: string;
  inviteUrl: string;
  supportUrl: string;
  version: string;
  /** Path to the generated SVG logo, used as the social preview image. */
  ogImage?: string;
  noindex?: boolean;
  /** Drop the canonical link (used for error pages). */
  omitCanonical?: boolean;
  /** Extra tags injected before </head>. */
  headExtra?: string;
  /** Script tags injected before </body>. */
  scripts?: string;
  /** Appended to stylesheet and script URLs to bust caches on deploy. */
  assetVersion?: string;
}

/** Public source repository. */
export const REPO_URL = "https://github.com/watispro1/AegisDeno";

export const NAV: NavLink[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Features", href: "/features" },
  { label: "Commands", href: "/commands" },
  { label: "Docs", href: "/docs" },
  { label: "Changelog", href: "/changelog" },
  { label: "Status", href: "/status" },
];

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only allow same-site or http(s) URLs to be emitted into markup. */
function safeUrl(url: string): string {
  const value = (url ?? "").trim();
  if (value === "" || value === "#") return "#";
  if (value.startsWith("/")) return esc(value);
  if (/^https?:\/\//i.test(value)) return esc(value);
  return "#";
}

function activeFor(current: string | undefined, href: string): string | null {
  if (!current) return null;
  if (href === "/") return current === "/" ? "page" : null;
  return current === href || current.startsWith(href + "/") ? "page" : null;
}

const sunIcon = `<svg class="icon-sun" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/></svg>`;
const moonIcon = `<svg class="icon-moon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
const menuIcon = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg>`;

export function layout(o: LayoutOptions): string {
  const origin = (process.env.SITE_URL || "").replace(/\/$/, "");
  const canonical = esc(origin ? `${origin}${o.path}` : o.path);
  const ogImage = origin && o.ogImage ? `${origin}${o.ogImage}` : o.ogImage;
  const title = esc(o.title);
  const description = esc(o.description);
  const inviteUrl = safeUrl(o.inviteUrl);
  const supportUrl = safeUrl(o.supportUrl);
  const v = o.assetVersion ? `?v=${encodeURIComponent(o.assetVersion)}` : "";

  const navItems = NAV.map((l) => {
    const cur = activeFor(o.current, l.href);
    return `<li><a class="nav-link" href="${l.href}"${cur ? ` aria-current="${cur}"` : ""}>${l.label}</a></li>`;
  }).join("\n        ");

  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${description}">
${o.omitCanonical ? "" : `<link rel="canonical" href="${canonical}">`}
${o.noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow">'}
<meta name="theme-color" content="#fbfaf8">
<meta name="color-scheme" content="light dark">

<meta property="og:type" content="website">
<meta property="og:site_name" content="Aegis">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Aegis: a moderation bot for Discord">` : ""}
<meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
${ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}">` : ""}

<link rel="icon" href="/assets/favicon.svg${v}" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/favicon.svg${v}">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="alternate" type="application/atom+xml" title="Aegis changelog" href="/changelog.xml">

<link rel="stylesheet" href="/assets/site.css${v}">
<script src="/assets/theme-init.js${v}"></script>
${o.headExtra || ""}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>

<nav class="nav" aria-label="Main navigation">
  <div class="wrap nav-inner">
    <a class="brand" href="/">
      <span class="brand-mark" aria-hidden="true">A</span>
      <span>Aegis</span>
    </a>
    <ul class="nav-links" id="nav-links">
        ${navItems}
        <li class="nav-mobile-cta"><a class="btn block" href="${inviteUrl}">Add Aegis to Discord</a></li>
    </ul>
    <div class="nav-actions">
      <button class="icon-btn theme-toggle" type="button" aria-label="Switch theme">
        ${sunIcon}${moonIcon}
      </button>
      <button class="icon-btn site-search-trigger" type="button" aria-label="Search pages and commands (Ctrl K)" aria-haspopup="dialog" aria-controls="site-search-dialog" title="Search (Ctrl K)">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
        <kbd>Ctrl K</kbd>
      </button>
      <a class="btn sm" href="${inviteUrl}">Add to Discord</a>
      <button class="icon-btn nav-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="nav-links">
        ${menuIcon}
      </button>
    </div>
  </div>
</nav>

<div class="site-search" id="site-search-dialog" role="dialog" aria-modal="true" aria-labelledby="site-search-title" hidden>
  <div class="site-search-backdrop" data-site-search-close></div>
  <section class="site-search-panel" role="document">
    <div class="site-search-head">
      <label id="site-search-title" for="site-search-input">Search Aegis</label>
      <button class="icon-btn" type="button" data-site-search-close aria-label="Close search">×</button>
    </div>
    <div class="site-search-input-wrap">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
      <input id="site-search-input" type="search" autocomplete="off" placeholder="ban, automod, tickets…" aria-describedby="site-search-help">
      <kbd>Esc</kbd>
    </div>
    <p class="site-search-help" id="site-search-help">Type two characters or more. ↑/↓ to move, Enter to open, Esc to close.</p>
    <div class="site-search-results" id="site-search-results" role="listbox" aria-live="polite"></div>
  </section>
</div>

<div id="toast-container"></div>

<main id="main">
${o.body}
</main>

<footer class="site">
  <div class="wrap">
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="brand" href="/">
          <span class="brand-mark" aria-hidden="true">A</span>
          <span>Aegis</span>
        </a>
        <p>A Discord moderation bot, run from slash commands, with a web dashboard for cases and settings.</p>
        <p class="footer-meta"><a href="/changelog#v${esc(o.version)}">Version ${esc(o.version)}</a> · <a href="/dashboard/changelog">Dashboard changelog</a></p>
      </div>
      <div class="footer-col">
        <h2 class="footer-title">Site</h2>
        <ul>
          <li><a href="/features">Features</a></li>
          <li><a href="/commands">Commands</a></li>
          <li><a href="/docs">Documentation</a></li>
          <li><a href="/changelog">Changelog</a></li>
          <li><a href="/status">Status</a></li>
          <li><a href="/dashboard">Dashboard</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h2 class="footer-title">Docs</h2>
        <ul>
          <li><a href="/docs#quickstart">Quickstart</a></li>
          <li><a href="/docs#configuration">Configuration</a></li>
          <li><a href="/docs#automod">Automod</a></li>
          <li><a href="/docs#logging">Logging</a></li>
          <li><a href="/docs#permissions">Permissions</a></li>
          <li><a href="/troubleshooting">Troubleshooting</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h2 class="footer-title">Legal and project</h2>
        <ul>
          <li><a href="/terms">Terms of Service</a></li>
          <li><a href="/privacy">Privacy Policy</a></li>
          <li><a href="/security">Security</a></li>
          <li><a href="${REPO_URL}" rel="noopener noreferrer">Source on GitHub</a></li>
          <li><a href="${REPO_URL}/issues" rel="noopener noreferrer">Report a problem</a></li>
          ${o.supportUrl ? `<li><a href="${supportUrl}" rel="noopener noreferrer">Support server</a></li>` : ""}
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <div>&copy; ${year} Aegis. Not affiliated with Discord Inc.</div>
      <nav aria-label="Footer">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/security">Security</a>
        <a href="/status">Status</a>
        <a href="/api/stats">API</a>
        <a href="/changelog.xml">Feed</a>
      </nav>
    </div>
  </div>
</footer>

<script src="/assets/site.js${v}" defer></script>
${o.scripts || ""}
</body>
</html>`;
}
