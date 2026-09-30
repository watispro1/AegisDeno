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
}

export const NAV: NavLink[] = [
  { label: "Features", href: "/features" },
  { label: "Commands", href: "/commands" },
  { label: "Docs", href: "/docs" },
  { label: "Changelog", href: "/changelog" },
  { label: "Status", href: "/status" },
];

function activeFor(current: string | undefined, href: string): string | null {
  if (!current) return null;
  if (href === "/") return current === "/" ? "page" : null;
  return current === href || current.startsWith(href + "/") ? "page" : null;
}

const sunIcon = `<svg class="icon-sun" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/></svg>`;
const moonIcon = `<svg class="icon-moon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
const menuIcon = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg>`;

export function layout(o: LayoutOptions): string {
  const origin = process.env.SITE_URL || "";
  const canonical = origin ? `${origin.replace(/\/$/, "")}${o.path}` : o.path;
  const ogImage = origin && o.ogImage ? `${origin.replace(/\/$/, "")}${o.ogImage}` : o.ogImage;

  const navItems = NAV.map((l) => {
    const cur = activeFor(o.current, l.href);
    return `<li><a class="nav-link" href="${l.href}"${cur ? ` aria-current="${cur}"` : ""}>${l.label}</a></li>`;
  }).join("\n        ");

  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${o.title}</title>
<meta name="description" content="${o.description}">
${o.omitCanonical ? "" : `<link rel="canonical" href="${canonical}">`}
${o.noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow">'}
<meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#fbfbfd" media="(prefers-color-scheme: light)">
<meta name="color-scheme" content="dark light">

<meta property="og:type" content="website">
<meta property="og:site_name" content="Aegis">
<meta property="og:title" content="${o.title}">
<meta property="og:description" content="${o.description}">
<meta property="og:url" content="${canonical}">
${ogImage ? `<meta property="og:image" content="${ogImage}">` : ""}
<meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${o.title}">
<meta name="twitter:description" content="${o.description}">
${ogImage ? `<meta name="twitter:image" content="${ogImage}">` : ""}

<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/favicon.svg">
<link rel="manifest" href="/manifest.webmanifest">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/assets/site.css">
<script src="/assets/theme-init.js"></script>
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
    </ul>
    <div class="nav-actions">
      <button class="icon-btn theme-toggle" type="button" aria-label="Switch theme">
        ${sunIcon}${moonIcon}
      </button>
      <a class="btn sm" href="${o.inviteUrl}">Add to Discord</a>
      <button class="icon-btn nav-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="nav-links">
        ${menuIcon}
      </button>
    </div>
  </div>
</nav>

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
        <p>A fast, modular Discord bot for moderation, auto moderation, logging, and community management.</p>
      </div>
      <div class="footer-col">
        <h4>Product</h4>
        <ul>
          <li><a href="/features">Features</a></li>
          <li><a href="/commands">Commands</a></li>
          <li><a href="/changelog">Changelog</a></li>
          <li><a href="/status">Status</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Documentation</h4>
        <ul>
          <li><a href="/docs">Getting started</a></li>
          <li><a href="/docs#configuration">Configuration</a></li>
          <li><a href="/docs#automod">Auto moderation</a></li>
          <li><a href="/docs#logging">Logging</a></li>
          <li><a href="/docs#permissions">Permissions</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Legal</h4>
        <ul>
          <li><a href="/terms">Terms of Service</a></li>
          <li><a href="/privacy">Privacy Policy</a></li>
          ${o.supportUrl ? `<li><a href="${o.supportUrl}">Support server</a></li>` : ""}
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <div>&copy; ${year} Aegis. Not affiliated with Discord Inc.</div>
      <nav aria-label="Footer">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/status">Status</a>
        <a href="/api/stats">API</a>
      </nav>
    </div>
  </div>
</footer>

<script src="/assets/site.js" defer></script>
${o.scripts || ""}
</body>
</html>`;
}
