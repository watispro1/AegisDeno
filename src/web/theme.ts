/**
 * Design tokens and component styles for the Aegis site.
 * Served as a static stylesheet from /assets/site.css.
 */

/** Light theme tokens injected under [data-theme="light"]. */
const lightTokens = `
  --bg: #fbfbfd;
  --bg-alt: #f4f5f9;
  --surface: rgba(15, 23, 42, 0.025);
  --surface-2: rgba(15, 23, 42, 0.045);
  --border: rgba(15, 23, 42, 0.1);
  --border-strong: rgba(15, 23, 42, 0.18);
  --text: #0b0d14;
  --text-2: #333a4d;
  --muted: #5a627a;
  --faint: #656d80;
  --primary: #4752c4;
  --primary-hover: #3d47ad;
  --primary-soft: rgba(88, 101, 242, 0.1);
  --primary-ring: rgba(88, 101, 242, 0.18);
  --link: #4752c4;
  --accent: #16a34a;
  --accent-soft: rgba(34, 197, 94, 0.12);
  --warn: #b45309;
  --warn-soft: rgba(245, 158, 11, 0.14);
  --danger: #dc2626;
  --danger-soft: rgba(239, 68, 68, 0.1);
  --grid-line: rgba(15, 23, 42, 0.045);
  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.05);
  --shadow-md: 0 8px 24px -10px rgba(15, 23, 42, 0.18);
  --shadow-lg: 0 24px 56px -20px rgba(15, 23, 42, 0.28);
  --code-bg: rgba(15, 23, 42, 0.055);
  --selection: rgba(88, 101, 242, 0.22);
`;

const cyberpunkTokens = `
  --bg: #090614;
  --bg-alt: #0e091f;
  --surface: rgba(168, 85, 247, 0.04);
  --surface-2: rgba(168, 85, 247, 0.08);
  --border: rgba(236, 72, 153, 0.2);
  --border-strong: rgba(236, 72, 153, 0.4);
  --text: #fdf4ff;
  --text-2: #f0abfc;
  --muted: #c084fc;
  --faint: #9333ea;
  --primary: #ec4899;
  --primary-hover: #db2777;
  --primary-soft: rgba(236, 72, 153, 0.2);
  --primary-ring: rgba(236, 72, 153, 0.5);
  --link: #f472b6;
  --accent: #06b6d4;
  --accent-soft: rgba(6, 182, 212, 0.2);
  --warn: #f59e0b;
  --warn-soft: rgba(245, 158, 11, 0.2);
  --danger: #ef4444;
  --danger-soft: rgba(239, 68, 68, 0.2);
  --grid-line: rgba(236, 72, 153, 0.06);
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 10px 30px -12px rgba(236, 72, 153, 0.3);
  --shadow-lg: 0 30px 70px -24px rgba(236, 72, 153, 0.5);
  --code-bg: rgba(236, 72, 153, 0.1);
  --selection: rgba(236, 72, 153, 0.4);
`;

const emeraldTokens = `
  --bg: #04120e;
  --bg-alt: #081d17;
  --surface: rgba(16, 185, 129, 0.04);
  --surface-2: rgba(16, 185, 129, 0.08);
  --border: rgba(16, 185, 129, 0.2);
  --border-strong: rgba(16, 185, 129, 0.4);
  --text: #ecfdf5;
  --text-2: #a7f3d0;
  --muted: #6ee7b7;
  --faint: #059669;
  --primary: #10b981;
  --primary-hover: #059669;
  --primary-soft: rgba(16, 185, 129, 0.2);
  --primary-ring: rgba(16, 185, 129, 0.5);
  --link: #34d399;
  --accent: #38bdf8;
  --accent-soft: rgba(56, 189, 248, 0.2);
  --warn: #fbbf24;
  --warn-soft: rgba(251, 191, 36, 0.2);
  --danger: #f87171;
  --danger-soft: rgba(248, 113, 113, 0.2);
  --grid-line: rgba(16, 185, 129, 0.06);
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 10px 30px -12px rgba(16, 185, 129, 0.3);
  --shadow-lg: 0 30px 70px -24px rgba(16, 185, 129, 0.5);
  --code-bg: rgba(16, 185, 129, 0.1);
  --selection: rgba(16, 185, 129, 0.4);
`;

const goldTokens = `
  --bg: #0f0d09;
  --bg-alt: #18150f;
  --surface: rgba(245, 158, 11, 0.04);
  --surface-2: rgba(245, 158, 11, 0.08);
  --border: rgba(245, 158, 11, 0.2);
  --border-strong: rgba(245, 158, 11, 0.4);
  --text: #fffbeb;
  --text-2: #fde68a;
  --muted: #fcd34d;
  --faint: #d97706;
  --primary: #f59e0b;
  --primary-hover: #d97706;
  --primary-soft: rgba(245, 158, 11, 0.2);
  --primary-ring: rgba(245, 158, 11, 0.5);
  --link: #fbbf24;
  --accent: #10b981;
  --accent-soft: rgba(16, 185, 129, 0.2);
  --warn: #fb923c;
  --warn-soft: rgba(251, 146, 60, 0.2);
  --danger: #ef4444;
  --danger-soft: rgba(239, 68, 68, 0.2);
  --grid-line: rgba(245, 158, 11, 0.06);
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 10px 30px -12px rgba(245, 158, 11, 0.3);
  --shadow-lg: 0 30px 70px -24px rgba(245, 158, 11, 0.5);
  --code-bg: rgba(245, 158, 11, 0.1);
  --selection: rgba(245, 158, 11, 0.4);
`;

export const styles = `
/* ── Tokens ─────────────────────────────────────────────────────────── */
:root {
  --bg: #09090b;
  --bg-alt: #0d0e13;
  --surface: rgba(255, 255, 255, 0.028);
  --surface-2: rgba(255, 255, 255, 0.05);
  --border: rgba(255, 255, 255, 0.09);
  --border-strong: rgba(255, 255, 255, 0.16);
  --text: #f6f7fb;
  --text-2: #cbd2e1;
  --muted: #98a1b8;
  --faint: #7d8598;
  --primary: #5865F2;
  --primary-hover: #4752c4;
  --primary-soft: rgba(88, 101, 242, 0.14);
  --primary-ring: rgba(88, 101, 242, 0.4);
  --link: #929cfa;
  --accent: #4ade80;
  --accent-soft: rgba(74, 222, 128, 0.12);
  --warn: #fbbf24;
  --warn-soft: rgba(251, 191, 36, 0.13);
  --danger: #f87171;
  --danger-soft: rgba(248, 113, 113, 0.12);
  --grid-line: rgba(255, 255, 255, 0.03);
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 10px 30px -12px rgba(0, 0, 0, 0.6);
  --shadow-lg: 0 30px 70px -24px rgba(0, 0, 0, 0.75);
  --code-bg: rgba(255, 255, 255, 0.06);
  --selection: rgba(88, 101, 242, 0.35);

  --sans: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --display: 'Outfit', 'Inter', system-ui, sans-serif;
  --mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;

  --max: 1160px;
  --max-prose: 74ch;
  --nav-h: 66px;
  --r-sm: 8px;
  --r: 12px;
  --r-lg: 20px;
  --r-xl: 28px;

  --ease: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}

[data-theme='light'] { ${lightTokens} }
[data-theme='cyberpunk'] { ${cyberpunkTokens} }
[data-theme='emerald'] { ${emeraldTokens} }
[data-theme='gold'] { ${goldTokens} }

@media (prefers-color-scheme: light) {
  :root:not([data-theme]) { ${lightTokens} }
}

/* ── Reset ─────────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html {
  scroll-behavior: smooth;
  scroll-padding-top: calc(var(--nav-h) + 20px);
  -webkit-text-size-adjust: 100%;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--sans);
  font-size: 16px;
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow-x: hidden;
  transition: background 0.25s var(--ease), color 0.25s var(--ease);
}

::selection { background: var(--selection); color: var(--text); }

img, svg { display: block; max-width: 100%; }

a { color: var(--link); text-decoration: none; }
a:hover { text-decoration: underline; }

button { font: inherit; color: inherit; background: none; border: none; cursor: pointer; }

:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 3px;
  border-radius: 4px;
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}

.skip-link {
  position: absolute;
  left: 50%;
  top: -60px;
  transform: translateX(-50%);
  z-index: 200;
  background: var(--primary);
  color: #fff;
  padding: 0.7rem 1.25rem;
  border-radius: 0 0 var(--r) var(--r);
  font-weight: 600;
  transition: top 0.2s var(--ease);
}
.skip-link:focus { top: 0; text-decoration: none; }

.visually-hidden {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

.wrap {
  position: relative;
  z-index: 1;
  max-width: var(--max);
  margin-inline: auto;
  padding-inline: 1.5rem;
}

.wrap-prose { max-width: var(--max-prose); }

/* Ambient background */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 60% 40% at 12% -5%, var(--primary-soft), transparent 65%),
    radial-gradient(ellipse 50% 35% at 88% 0%, rgba(139, 92, 246, 0.1), transparent 60%);
}

body::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image:
    linear-gradient(var(--grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
  background-size: 68px 68px;
  mask-image: radial-gradient(ellipse 90% 55% at 50% 0%, #000 30%, transparent 78%);
  -webkit-mask-image: radial-gradient(ellipse 90% 55% at 50% 0%, #000 30%, transparent 78%);
}

/* ── Typography ────────────────────────────────────────────────────── */
h1, h2, h3, h4, h5 {
  font-family: var(--display);
  line-height: 1.15;
  letter-spacing: -0.03em;
  font-weight: 700;
  text-wrap: balance;
}

h1 { font-size: clamp(2.4rem, 6.2vw, 4.4rem); font-weight: 800; }
h2 { font-size: clamp(1.75rem, 3.6vw, 2.5rem); }
h3 { font-size: clamp(1.15rem, 2vw, 1.35rem); font-weight: 650; letter-spacing: -0.02em; }
h4 { font-size: 1.02rem; font-weight: 650; letter-spacing: -0.01em; }

p { text-wrap: pretty; }

.lead {
  font-size: clamp(1.05rem, 1.9vw, 1.22rem);
  color: var(--muted);
  line-height: 1.7;
}

.eyebrow {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--primary);
}

.gradient-text {
  background: linear-gradient(120deg, var(--text) 10%, #a5b4fc 60%, #c4b5fd 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.muted { color: var(--muted); }
.faint { color: var(--faint); font-size: 0.85rem; }

code, kbd, pre { font-family: var(--mono); }

code.inline {
  font-size: 0.86em;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.12em 0.42em;
  color: var(--text-2);
  white-space: nowrap;
}

pre.block {
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 1.1rem 1.25rem;
  overflow-x: auto;
  font-size: 0.86rem;
  line-height: 1.7;
  color: var(--text-2);
}

kbd {
  display: inline-block;
  font-size: 0.78em;
  background: var(--surface-2);
  border: 1px solid var(--border-strong);
  border-bottom-width: 2px;
  border-radius: 5px;
  padding: 0.1em 0.4em;
  color: var(--text-2);
}

/* ── Buttons ───────────────────────────────────────────────────────── */
.btn {
  --btn-bg: var(--primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: var(--btn-bg);
  color: #fff;
  padding: 0.66rem 1.25rem;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.93rem;
  letter-spacing: -0.01em;
  white-space: nowrap;
  border: 1px solid transparent;
  box-shadow: 0 4px 16px -6px var(--primary-ring);
  transition: transform 0.16s var(--ease), background 0.16s var(--ease),
              box-shadow 0.16s var(--ease), border-color 0.16s var(--ease);
}
.btn:hover {
  background: var(--primary-hover);
  transform: translateY(-2px);
  box-shadow: 0 10px 26px -8px var(--primary-ring);
  text-decoration: none;
}
.btn:active { transform: translateY(0); }

.btn.ghost {
  background: var(--surface);
  border-color: var(--border-strong);
  color: var(--text);
  box-shadow: none;
}
.btn.ghost:hover { background: var(--surface-2); border-color: var(--primary); }

.btn.lg { padding: 0.85rem 1.7rem; font-size: 1rem; border-radius: 12px; }
.btn.sm { padding: 0.42rem 0.8rem; font-size: 0.84rem; border-radius: 8px; }
.btn.block { width: 100%; }

.btn-row { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.btn-row.center { justify-content: center; }

/* ── Nav ───────────────────────────────────────────────────────────── */
.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  height: var(--nav-h);
  display: flex;
  align-items: center;
  background: color-mix(in srgb, var(--bg) 80%, transparent);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s var(--ease), background 0.2s var(--ease);
}
.nav.scrolled { border-bottom-color: var(--border); }

.nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  font-family: var(--display);
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: -0.02em;
  color: var(--text);
  flex-shrink: 0;
}
.brand:hover { text-decoration: none; }

.brand-mark {
  width: 30px; height: 30px;
  border-radius: 9px;
  background: linear-gradient(140deg, var(--primary), #8b5cf6);
  display: grid;
  place-items: center;
  font-size: 0.9rem;
  font-weight: 800;
  color: #fff;
  box-shadow: 0 4px 14px -4px var(--primary-ring);
  transition: transform 0.25s var(--ease-out);
}
.brand:hover .brand-mark { transform: rotate(-8deg) scale(1.06); }

.nav-links {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  list-style: none;
}
.nav-links > li { display: flex; }
.nav-links a.nav-link {
  position: relative;
  display: block;
  padding: 0.45rem 0.8rem;
  border-radius: 8px;
  color: var(--muted);
  font-size: 0.92rem;
  font-weight: 500;
  transition: color 0.16s var(--ease), background 0.16s var(--ease);
}
.nav-links a.nav-link:hover { color: var(--text); background: var(--surface); text-decoration: none; }
.nav-links a.nav-link[aria-current='page'] { color: var(--text); }
.nav-links a.nav-link[aria-current='page']::after {
  content: '';
  position: absolute;
  left: 0.8rem; right: 0.8rem; bottom: 0.15rem;
  height: 2px;
  border-radius: 2px;
  background: var(--primary);
}

.nav-actions { display: flex; align-items: center; gap: 0.5rem; }

.icon-btn {
  width: 36px; height: 36px;
  display: grid; place-items: center;
  border-radius: 9px;
  color: var(--muted);
  border: 1px solid transparent;
  transition: color 0.16s, background 0.16s, border-color 0.16s;
}
.icon-btn:hover { color: var(--text); background: var(--surface); border-color: var(--border); }

.theme-toggle .icon-moon { display: none; }
[data-theme='light'] .theme-toggle .icon-sun { display: none; }
[data-theme='light'] .theme-toggle .icon-moon { display: block; }
@media (prefers-color-scheme: light) {
  :root:not([data-theme]) .theme-toggle .icon-sun { display: none; }
  :root:not([data-theme]) .theme-toggle .icon-moon { display: block; }
}

.nav-toggle { display: none; }

@media (max-width: 900px) {
  .nav-toggle { display: grid; }
  .nav-links {
    position: fixed;
    inset: var(--nav-h) 0 auto 0;
    flex-direction: column;
    align-items: stretch;
    gap: 0.15rem;
    padding: 1rem 1.5rem 1.5rem;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    box-shadow: var(--shadow-lg);
    transform: translateY(-12px);
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s var(--ease), transform 0.2s var(--ease), visibility 0.2s;
  }
  .nav-links.open { opacity: 1; visibility: visible; transform: translateY(0); }
  .nav-links > li { display: block; }
  .nav-links a.nav-link { padding: 0.7rem 0.8rem; font-size: 1rem; }
  .nav-links a.nav-link[aria-current='page']::after { display: none; }
  .nav-links a.nav-link[aria-current='page'] { background: var(--primary-soft); }
  .nav-actions .btn { display: none; }
  .nav-mobile-cta { display: block; margin-top: 0.65rem; padding-top: 0.85rem; border-top: 1px solid var(--border); }
}

@media (min-width: 901px) { .nav-mobile-cta { display: none; } }

/* ── Sections ──────────────────────────────────────────────────────── */
section.block { padding: clamp(3.5rem, 7vw, 6rem) 0; }
section.tight { padding: clamp(2.5rem, 5vw, 4rem) 0; }

.section-head { max-width: 640px; margin-bottom: clamp(2rem, 4vw, 3.25rem); }
.section-head.center { margin-inline: auto; text-align: center; }
.section-head h2 { margin: 0.7rem 0 0.9rem; }
.section-head p { color: var(--muted); font-size: 1.03rem; }

.page-head { padding: clamp(2.5rem, 5vw, 4rem) 0 clamp(1.5rem, 3vw, 2rem); }
.page-head h1 { font-size: clamp(2.1rem, 4.6vw, 3.1rem); margin-bottom: 0.8rem; }
.page-head .lead { max-width: 62ch; }

.breadcrumbs {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.83rem;
  color: var(--faint);
  margin-bottom: 1.1rem;
  flex-wrap: wrap;
}
.breadcrumbs a { color: var(--muted); }
.breadcrumbs a:hover { color: var(--text); }
.breadcrumbs .sep { opacity: 0.5; }

/* ── Hero ──────────────────────────────────────────────────────────── */
.hero { padding: clamp(3.5rem, 8vw, 6.5rem) 0 clamp(3rem, 6vw, 5rem); text-align: center; }
.hero .lead { max-width: 60ch; margin-inline: auto; }
.hero-actions { margin-top: 2.25rem; }
.hero-note {
  margin-top: 1.5rem;
  font-size: 0.85rem;
  color: var(--faint);
}
.trust-strip {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.4rem 1.25rem;
  margin-top: 1rem;
  color: var(--faint);
  font-size: 0.78rem;
  font-weight: 600;
}
.trust-strip span { white-space: nowrap; }

.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.36rem 0.9rem 0.36rem 0.7rem;
  border-radius: 99px;
  background: var(--accent-soft);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  color: var(--accent);
  font-size: 0.8rem;
  font-weight: 600;
  margin-bottom: 1.6rem;
}
.badge .dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 0 var(--accent);
  animation: pulse 2.2s infinite;
}
.badge.warn { background: var(--warn-soft); border-color: color-mix(in srgb, var(--warn) 35%, transparent); color: var(--warn); }
.badge.warn .dot { background: var(--warn); }

@keyframes pulse {
  0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 55%, transparent); }
  70%  { box-shadow: 0 0 0 9px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}

.hero-panel {
  margin-top: clamp(3rem, 6vw, 4.5rem);
  border-radius: var(--r-xl);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  text-align: left;
}

.window-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
}
.window-dots { display: flex; gap: 0.35rem; }
.window-dots i { width: 10px; height: 10px; border-radius: 50%; background: var(--border-strong); display: block; }
.window-title {
  font-size: 0.8rem;
  color: var(--faint);
  font-family: var(--mono);
  margin-left: 0.35rem;
}

.chat {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.chat-row { display: flex; gap: 0.75rem; align-items: flex-start; }
.avatar {
  width: 34px; height: 34px;
  flex-shrink: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 0.8rem;
  font-weight: 700;
  color: #fff;
}
.avatar.bot { background: linear-gradient(140deg, var(--primary), var(--accentAlt)); }
.avatar.user { background: linear-gradient(140deg, #64748b, #94a3b8); }
.chat-body { min-width: 0; flex: 1; }
.chat-name { font-size: 0.86rem; font-weight: 650; }
.chat-name .bot-tag {
  display: inline-block;
  margin-left: 0.35rem;
  padding: 0.05rem 0.35rem;
  border-radius: 4px;
  background: var(--primary);
  color: #fff;
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  vertical-align: middle;
}
.chat-text { font-size: 0.88rem; color: var(--muted); }
.chat-text code { font-size: 0.84em; }

.embed {
  margin-top: 0.5rem;
  border-left: 3px solid var(--primary);
  background: var(--surface-2);
  border-radius: 0 8px 8px 0;
  padding: 0.7rem 0.9rem;
  font-size: 0.83rem;
  color: var(--text-2);
}
.embed-title { font-weight: 650; color: var(--text); margin-bottom: 0.3rem; }
.embed-field { display: flex; gap: 0.5rem; }
.embed-field .k { color: var(--faint); min-width: 74px; }

/* ── Stats ─────────────────────────────────────────────────────────── */
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1px;
  margin-top: clamp(2.5rem, 5vw, 3.5rem);
  background: var(--border);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  overflow: hidden;
}
.stat {
  background: var(--bg);
  padding: 1.35rem 1.1rem;
  text-align: center;
  transition: background 0.2s var(--ease);
}
.stat:hover { background: var(--bg-alt); }
.stat-value {
  font-family: var(--display);
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}
.stat-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.11em;
  color: var(--faint);
  font-weight: 600;
  margin-top: 0.25rem;
}

/* ── Cards ─────────────────────────────────────────────────────────── */
.grid { display: grid; gap: 1.1rem; }
.grid.cols-2 { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
.grid.cols-3 { grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }

.card {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 1.6rem;
  transition: transform 0.25s var(--ease-out), border-color 0.25s var(--ease),
              box-shadow 0.25s var(--ease), background 0.25s var(--ease);
}
.card:hover {
  transform: translateY(-4px);
  border-color: color-mix(in srgb, var(--primary) 50%, var(--border));
  box-shadow: var(--shadow-md);
}
.card-icon {
  width: 40px; height: 40px;
  border-radius: 11px;
  background: var(--primary-soft);
  border: 1px solid color-mix(in srgb, var(--primary) 30%, transparent);
  display: grid;
  place-items: center;
  font-size: 1.15rem;
  margin-bottom: 1.05rem;
}
.card h3 { margin-bottom: 0.45rem; }
.card p { color: var(--muted); font-size: 0.92rem; }
.card ul { margin-top: 0.9rem; padding-left: 1.1rem; color: var(--muted); font-size: 0.89rem; }
.card li { margin-bottom: 0.3rem; }
.card-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 1.1rem;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--primary);
}
.card-link::after { content: '→'; transition: transform 0.2s var(--ease); }
.card:hover .card-link::after { transform: translateX(3px); }

/* Feature list rows */
.feature-row {
  display: grid;
  grid-template-columns: 44px 1fr;
  gap: 1.1rem;
  align-items: start;
  padding: 1.15rem 0;
  border-bottom: 1px solid var(--border);
}
.feature-row:last-child { border-bottom: none; }
.feature-row .card-icon { margin-bottom: 0; }

/* ── Steps ─────────────────────────────────────────────────────────── */
.steps { display: grid; gap: 1.1rem; grid-template-columns: repeat(auto-fit, minmax(255px, 1fr)); counter-reset: step; }
.step {
  position: relative;
  padding: 1.6rem 1.4rem 1.4rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
}
.step::before {
  counter-increment: step;
  content: counter(step);
  position: absolute;
  top: -14px; left: 1.4rem;
  width: 30px; height: 30px;
  border-radius: 9px;
  background: var(--primary);
  color: #fff;
  font-family: var(--display);
  font-weight: 700;
  font-size: 0.92rem;
  display: grid; place-items: center;
  box-shadow: 0 4px 12px -3px var(--primary-ring);
}
.step h3 { margin-bottom: 0.35rem; }
.step p { color: var(--muted); font-size: 0.9rem; }

/* ── Tabs ──────────────────────────────────────────────────────────── */
.tabs { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 1.75rem; }
.tab {
  padding: 0.45rem 0.95rem;
  border-radius: 99px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  font-size: 0.88rem;
  font-weight: 550;
  transition: all 0.16s var(--ease);
}
.tab:hover { color: var(--text); border-color: var(--border-strong); }
.tab[aria-pressed='true'],
.tab[aria-selected='true'] {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}

/* ── Accordion ─────────────────────────────────────────────────────── */
.accordion { display: grid; gap: 0.6rem; }
details.acc {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  overflow: hidden;
  transition: border-color 0.2s var(--ease);
}
details.acc[open] { border-color: color-mix(in srgb, var(--primary) 40%, var(--border)); }
details.acc > summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.97rem;
  list-style: none;
  user-select: none;
}
details.acc > summary::-webkit-details-marker { display: none; }
details.acc > summary::after {
  content: '';
  width: 9px; height: 9px;
  border-right: 2px solid var(--faint);
  border-bottom: 2px solid var(--faint);
  transform: rotate(45deg);
  transition: transform 0.22s var(--ease);
  flex-shrink: 0;
  margin-top: -3px;
}
details.acc[open] > summary::after { transform: rotate(-135deg); margin-top: 3px; }
details.acc > summary:hover { color: var(--primary); }
.acc-body { padding: 0 1.25rem 1.25rem; color: var(--muted); font-size: 0.93rem; }
.acc-body p + p { margin-top: 0.75rem; }
.acc-body ul { padding-left: 1.2rem; margin-top: 0.5rem; }
.acc-body li { margin-bottom: 0.3rem; }

/* ── Tables ────────────────────────────────────────────────────────── */
.table-wrap {
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  overflow: hidden;
  background: var(--surface);
}
table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
thead th {
  text-align: left;
  padding: 0.85rem 1.1rem;
  font-size: 0.73rem;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--faint);
  font-weight: 700;
  background: var(--surface-2);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
tbody td {
  padding: 0.85rem 1.1rem;
  border-bottom: 1px solid var(--border);
  color: var(--text-2);
  vertical-align: top;
}
tbody tr:last-child td { border-bottom: none; }
tbody tr:hover td { background: var(--surface); }
td strong, th strong { color: var(--text); font-weight: 600; }

/* ── Badges & pills ────────────────────────────────────────────────── */
.pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.14rem 0.55rem;
  border-radius: 99px;
  font-size: 0.72rem;
  font-weight: 600;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--muted);
  white-space: nowrap;
}
.pill.primary { background: var(--primary-soft); border-color: color-mix(in srgb, var(--primary) 30%, transparent); color: var(--primary); }
.pill.ok { background: var(--accent-soft); border-color: color-mix(in srgb, var(--accent) 30%, transparent); color: var(--accent); }
.pill.warn { background: var(--warn-soft); border-color: color-mix(in srgb, var(--warn) 32%, transparent); color: var(--warn); }
.pill.danger { background: var(--danger-soft); border-color: color-mix(in srgb, var(--danger) 30%, transparent); color: var(--danger); }

/* ── Command reference ─────────────────────────────────────────────── */
.cmd-toolbar {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 1.5rem;
  position: sticky;
  top: var(--nav-h);
  z-index: 20;
  padding: 0.85rem 0;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.search {
  position: relative;
  flex: 1 1 260px;
  min-width: 220px;
}
.search input {
  width: 100%;
  font: inherit;
  font-size: 0.92rem;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.6rem 2.4rem 0.6rem 2.4rem;
  transition: border-color 0.16s var(--ease), box-shadow 0.16s var(--ease);
}
.search input::placeholder { color: var(--faint); }
.search input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-ring);
}
.search .icon {
  position: absolute;
  left: 0.8rem; top: 50%;
  transform: translateY(-50%);
  color: var(--faint);
  pointer-events: none;
  line-height: 0;
}
.search .hint {
  position: absolute;
  right: 0.6rem; top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}

.cmd-count { font-size: 0.85rem; color: var(--faint); white-space: nowrap; }

.cmd-group { margin-bottom: 2.75rem; }
.cmd-group-head {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding-bottom: 0.6rem;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}
.cmd-group-head h2 { font-size: 1.3rem; }
.cmd-group-head .blurb { font-size: 0.87rem; color: var(--faint); }

.cmd-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  overflow: hidden;
  margin-bottom: 0.7rem;
  transition: border-color 0.2s var(--ease);
}
.cmd-card:hover { border-color: var(--border-strong); }
.cmd-card[hidden] { display: none; }

.cmd-card > summary {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 1rem 1.2rem;
  cursor: pointer;
  list-style: none;
  user-select: none;
}
.cmd-card > summary::-webkit-details-marker { display: none; }
.cmd-card > summary:hover .cmd-slash { color: var(--primary); }

.cmd-anchor {
  color: var(--faint);
  font-family: var(--mono);
  font-size: 0.85rem;
  text-decoration: none;
  opacity: 0;
  transition: opacity 0.16s var(--ease), color 0.16s var(--ease);
  flex-shrink: 0;
}
.cmd-card:hover .cmd-anchor,
.cmd-anchor:focus-visible { opacity: 1; }
.cmd-anchor:hover { color: var(--primary); text-decoration: none; }

.cmd-card.flash { border-color: var(--primary); }

.cmd-run {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.6rem 0.75rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
}
.cmd-run .inline { margin: 0; }

.copy-btn {
  padding: 0.2rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 99px;
  background: var(--bg-alt);
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.16s var(--ease);
}
.copy-btn:hover { color: var(--text); border-color: var(--border-strong); text-decoration: none; }
.copy-btn.copied { color: var(--accent); border-color: var(--accent); }

.feed-note {
  text-align: center;
  margin-top: 1.5rem;
  font-size: 0.85rem;
  color: var(--faint);
}

.cmd-slash {
  font-family: var(--mono);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  transition: color 0.16s var(--ease);
}
.cmd-summary-text { flex: 1; min-width: 0; }
.cmd-desc { font-size: 0.87rem; color: var(--muted); }
.cmd-meta { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; }
.cmd-chevron {
  width: 8px; height: 8px;
  border-right: 2px solid var(--faint);
  border-bottom: 2px solid var(--faint);
  transform: rotate(45deg);
  transition: transform 0.22s var(--ease);
  flex-shrink: 0;
  margin-left: 0.25rem;
}
.cmd-card[open] .cmd-chevron { transform: rotate(-135deg); }

.cmd-body { padding: 0 1.2rem 1.2rem; border-top: 1px solid var(--border); }
.cmd-body > * { margin-top: 1.1rem; }
.cmd-section-title {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--faint);
  font-weight: 700;
  margin-bottom: 0.6rem;
}

.sub-list { display: grid; gap: 0.4rem; }
.sub-item {
  display: flex;
  gap: 0.7rem;
  align-items: baseline;
  padding: 0.55rem 0.75rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  font-size: 0.87rem;
  flex-wrap: wrap;
}
.sub-item code { color: #c7d2fe; font-size: 0.85rem; }
[data-theme='light'] .sub-item code { color: var(--primary); }
.sub-item .sub-desc { color: var(--muted); }
.sub-item .sub-opts { margin-left: auto; }

.opt-table { font-size: 0.85rem; }
.opt-table code { color: #c7d2fe; }
[data-theme='light'] .opt-table code { color: var(--primary); }
.opt-req { color: var(--danger); font-size: 0.75rem; font-weight: 600; }
.opt-opt { color: var(--faint); font-size: 0.75rem; }

.empty-state {
  text-align: center;
  padding: 3.5rem 1.5rem;
  color: var(--muted);
  border: 1px dashed var(--border-strong);
  border-radius: var(--r-lg);
}
.empty-state strong { display: block; color: var(--text); font-size: 1.05rem; margin-bottom: 0.35rem; }

mark { background: var(--warn-soft); color: var(--text); border-radius: 3px; padding: 0 2px; }

/* ── Callouts ──────────────────────────────────────────────────────── */
.callout {
  display: flex;
  gap: 0.85rem;
  padding: 1rem 1.15rem;
  border-radius: var(--r);
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 0.9rem;
  color: var(--muted);
}
.callout .callout-icon { flex-shrink: 0; font-size: 1rem; line-height: 1.5; }
.callout strong { color: var(--text); }
.callout.info { background: var(--primary-soft); border-color: color-mix(in srgb, var(--primary) 28%, transparent); }
.callout.warn { background: var(--warn-soft); border-color: color-mix(in srgb, var(--warn) 32%, transparent); }
.callout.danger { background: var(--danger-soft); border-color: color-mix(in srgb, var(--danger) 30%, transparent); }

/* ── Docs layout ───────────────────────────────────────────────────── */
.docs-layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: clamp(2rem, 4vw, 3.5rem);
  align-items: start;
  padding-bottom: 4rem;
}
.docs-side {
  position: sticky;
  top: calc(var(--nav-h) + 24px);
  max-height: calc(100vh - var(--nav-h) - 48px);
  overflow-y: auto;
  font-size: 0.88rem;
}
.docs-side .side-title {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--faint);
  font-weight: 700;
  margin-bottom: 0.7rem;
}
.docs-side ul { list-style: none; display: grid; gap: 0.1rem; }
.docs-side a {
  display: block;
  padding: 0.32rem 0.6rem;
  border-radius: 7px;
  color: var(--muted);
  border-left: 2px solid transparent;
  transition: all 0.15s var(--ease);
}
.docs-side a:hover { color: var(--text); background: var(--surface); text-decoration: none; }
.docs-side a.active {
  color: var(--primary);
  background: var(--primary-soft);
  border-left-color: var(--primary);
  font-weight: 550;
}
.docs-side .side-divider { height: 1px; background: var(--border); margin: 1.1rem 0; }

.prose { max-width: var(--max-prose); }
.prose h2 {
  font-size: 1.55rem;
  margin: 3rem 0 1rem;
  padding-top: 0.5rem;
  scroll-margin-top: calc(var(--nav-h) + 24px);
}
.prose h2:first-child { margin-top: 0; }
.prose h3 { font-size: 1.1rem; margin: 2rem 0 0.7rem; scroll-margin-top: calc(var(--nav-h) + 24px); }
.prose p { color: var(--muted); margin-bottom: 1rem; }
.prose p strong, .prose li strong { color: var(--text); font-weight: 600; }
.prose ul, .prose ol { color: var(--muted); padding-left: 1.35rem; margin-bottom: 1rem; }
.prose li { margin-bottom: 0.4rem; }
.prose code.inline { white-space: normal; }
.prose > * + * { margin-top: 1rem; }

.legal { max-width: var(--max-prose); }
.legal h2 { font-size: 1.3rem; margin: 2.75rem 0 0.8rem; scroll-margin-top: calc(var(--nav-h) + 24px); }
.legal h2:first-of-type { margin-top: 1.5rem; }
.legal h3 { font-size: 1.02rem; margin: 1.75rem 0 0.6rem; }
.legal p { color: var(--muted); margin-bottom: 0.9rem; }
.legal ul { color: var(--muted); padding-left: 1.3rem; margin-bottom: 1rem; }
.legal li { margin-bottom: 0.4rem; }
.legal strong { color: var(--text); font-weight: 600; }
.legal a { color: var(--primary); }
.legal a:hover { color: var(--primary-hover); }
.legal dl { margin: 1rem 0; }
.legal dt { color: var(--text); font-weight: 600; margin-top: 0.9rem; font-size: 0.93rem; }
.legal dd { color: var(--muted); margin-top: 0.2rem; }

@media (max-width: 940px) {
  .docs-layout { grid-template-columns: 1fr; }
  .docs-side {
    position: static;
    max-height: none;
    border: 1px solid var(--border);
    border-radius: var(--r);
    padding: 1rem 1.15rem;
    background: var(--surface);
  }
  .docs-side ul { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
}

/* ── FAQ ───────────────────────────────────────────────────────────── */
.accordion { max-width: 760px; margin-inline: auto; }

/* ── CTA ───────────────────────────────────────────────────────────── */
.cta-box {
  position: relative;
  text-align: center;
  padding: clamp(2.5rem, 6vw, 4.25rem) clamp(1.5rem, 4vw, 3rem);
  border-radius: var(--r-xl);
  border: 1px solid color-mix(in srgb, var(--primary) 32%, var(--border));
  background:
    radial-gradient(ellipse 70% 100% at 50% 0%, var(--primary-soft), transparent 70%),
    var(--surface);
  overflow: hidden;
}
.cta-box h2 { margin-bottom: 0.85rem; }
.cta-box p { color: var(--muted); max-width: 56ch; margin: 0 auto 2rem; }

/* ── Status page ───────────────────────────────────────────────────── */
.status-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.35rem 1.5rem;
  border-radius: var(--r-lg);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
  background: var(--accent-soft);
  margin-bottom: 2rem;
  flex-wrap: wrap;
}
.status-banner.bad { border-color: color-mix(in srgb, var(--danger) 32%, var(--border)); background: var(--danger-soft); }
.status-banner .status-text h2 { font-size: 1.25rem; margin: 0; }
.status-banner .status-text p { color: var(--muted); font-size: 0.9rem; margin-top: 0.2rem; }

.metric-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.metric {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 1.15rem 1.25rem;
}
.metric .label { font-size: 0.73rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--faint); font-weight: 600; }
.metric .value { font-family: var(--display); font-size: 1.6rem; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 0.3rem; letter-spacing: -0.02em; }
.metric .value.good { color: var(--accent); }
.metric .value.warn { color: var(--warn); }
.metric .sub { font-size: 0.8rem; color: var(--faint); margin-top: 0.15rem; }

.component-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.15rem;
  border: 1px solid var(--border);
  border-radius: var(--r);
  background: var(--surface);
  margin-bottom: 0.6rem;
}
.component-row .name { font-weight: 600; min-width: 180px; }
.component-row .desc { color: var(--muted); font-size: 0.87rem; flex: 1; }

.bar {
  height: 6px;
  border-radius: 99px;
  background: var(--surface-2);
  overflow: hidden;
  min-width: 120px;
}
.bar i { display: block; height: 100%; border-radius: 99px; background: var(--accent); transition: width 0.6s var(--ease-out); }
.bar.warn i { background: var(--warn); }
.bar.bad i { background: var(--danger); }

/* ── Changelog ─────────────────────────────────────────────────────── */
.timeline { position: relative; padding-left: 2rem; }
.timeline::before {
  content: '';
  position: absolute;
  left: 7px; top: 6px; bottom: 6px;
  width: 2px;
  background: linear-gradient(180deg, var(--primary), var(--border));
  border-radius: 2px;
}
.release { position: relative; padding-bottom: 2.5rem; }
.release::before {
  content: '';
  position: absolute;
  left: -2rem; top: 7px;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: var(--bg);
  border: 3px solid var(--primary);
}
.release .release-head { display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
.release h3 { margin: 0; }
.release time { font-size: 0.83rem; color: var(--faint); }
.release ul { margin-top: 0.6rem; padding-left: 1.2rem; color: var(--muted); font-size: 0.92rem; }
.release li { margin-bottom: 0.35rem; }

/* ── Footer ────────────────────────────────────────────────────────── */
footer.site {
  margin-top: clamp(3rem, 6vw, 5rem);
  border-top: 1px solid var(--border);
  background: var(--bg-alt);
  padding: clamp(2.5rem, 5vw, 3.5rem) 0 2rem;
}
.footer-grid {
  display: grid;
  gap: 2rem;
  grid-template-columns: minmax(200px, 1.4fr) repeat(auto-fit, minmax(140px, 1fr));
  margin-bottom: 2.5rem;
}
.footer-brand p { color: var(--muted); font-size: 0.88rem; margin-top: 0.9rem; max-width: 34ch; }
.footer-col h4 {
  font-size: 0.73rem;
  text-transform: uppercase;
  letter-spacing: 0.11em;
  color: var(--faint);
  font-weight: 700;
  margin-bottom: 0.9rem;
}
.footer-col ul { list-style: none; display: grid; gap: 0.5rem; }
.footer-col a { color: var(--muted); font-size: 0.89rem; }
.footer-col a:hover { color: var(--text); }

.footer-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
  font-size: 0.84rem;
  color: var(--faint);
}
.footer-bottom nav { display: flex; gap: 1.25rem; flex-wrap: wrap; }
.footer-bottom a { color: var(--faint); }
.footer-bottom a:hover { color: var(--text); }

/* ── Reveal on scroll ──────────────────────────────────────────────
   Gated on the .js class set by theme-init.js so content stays visible
   when JavaScript is unavailable or fails to load. */
.js .reveal {
  opacity: 0;
  transform: translateY(14px);
  transition: opacity 0.55s var(--ease-out), transform 0.55s var(--ease-out);
}
.js .reveal.visible { opacity: 1; transform: none; }

/* Safety net: if scripting is on but the observer never runs, do not
   leave the page blank. */
html:not(.reveal-ready) .reveal { opacity: 1; transform: none; }

@media (prefers-reduced-motion: reduce) {
  .js .reveal { opacity: 1; transform: none; }
}

/* ── Theme Switcher Bar ────────────────────────────────────────────── */
.theme-picker-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.5rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 99px;
  backdrop-filter: blur(12px);
}
.theme-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.2s var(--ease), border-color 0.2s var(--ease);
}
.theme-dot:hover { transform: scale(1.18); }
.theme-dot.active { border-color: var(--text); transform: scale(1.15); }
.theme-dot.t-midnight { background: #5865F2; }
.theme-dot.t-cyberpunk { background: #ec4899; }
.theme-dot.t-emerald { background: #10b981; }
.theme-dot.t-gold { background: #f59e0b; }
.theme-dot.t-light { background: #3b82f6; }

/* ── Discord Message & Embed Simulation ────────────────────────────────── */
.discord-box {
  background: #313338;
  border-radius: 12px;
  padding: 1.25rem;
  color: #dbdee1;
  font-family: 'Inter', system-ui, sans-serif;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.discord-msg-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}
.discord-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #fff;
  font-size: 1rem;
}
.discord-author {
  font-weight: 600;
  color: #f2f3f5;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.discord-bot-tag {
  background: #5865f2;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.12rem 0.35rem;
  border-radius: 4px;
  text-transform: uppercase;
}
.discord-time {
  font-size: 0.75rem;
  color: #949ba4;
}
.discord-embed-card {
  background: #2b2d31;
  border-left: 4px solid var(--primary);
  border-radius: 4px;
  padding: 1rem;
  margin-top: 0.5rem;
  max-width: 520px;
}
.discord-embed-title {
  font-weight: 700;
  color: #f2f3f5;
  font-size: 1rem;
  margin-bottom: 0.4rem;
}
.discord-embed-desc {
  font-size: 0.9rem;
  color: #dbdee1;
  line-height: 1.45;
  white-space: pre-wrap;
}
.discord-embed-fields {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.6rem;
  margin-top: 0.75rem;
}
.discord-field-name {
  font-size: 0.78rem;
  font-weight: 700;
  color: #b5bac1;
  text-transform: uppercase;
}
.discord-field-val {
  font-size: 0.88rem;
  color: #dbdee1;
}
.discord-buttons-row {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.85rem;
  flex-wrap: wrap;
}
.d-btn {
  background: #4e5058;
  color: #fff;
  padding: 0.4rem 0.85rem;
  border-radius: 4px;
  font-size: 0.84rem;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.d-btn.primary { background: #5865f2; }
.d-btn.success { background: #248046; }
.d-btn.danger { background: #da373c; }

/* ── Interactive Playground ──────────────────────────────────────────────── */
.playground-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  align-items: start;
}
@media (max-width: 860px) { .playground-grid { grid-template-columns: 1fr; } }

.pg-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 1.5rem;
  backdrop-filter: blur(16px);
}
.pg-form-group {
  margin-bottom: 1rem;
}
.pg-form-group label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.pg-input, .pg-select {
  width: 100%;
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  padding: 0.65rem 0.85rem;
  color: var(--text);
  font-size: 0.95rem;
  outline: none;
}
.pg-input:focus, .pg-select:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

/* ── Live Dashboard UI ─────────────────────────────────────────────────── */
.dash-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 1.5rem;
  backdrop-filter: blur(16px);
  position: relative;
  overflow: hidden;
}
.dash-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, var(--primary), var(--accent));
}
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}
.toggle-switch input { opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: var(--surface-2);
  border: 1px solid var(--border);
  transition: 0.3s;
  border-radius: 24px;
}
.toggle-slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background-color: var(--muted);
  transition: 0.3s;
  border-radius: 50%;
}
input:checked + .toggle-slider { background-color: var(--primary); border-color: var(--primary); }
input:checked + .toggle-slider:before { transform: translateX(20px); background-color: #fff; }

.log-stream-box {
  background: #090b10;
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 1rem;
  font-family: var(--mono);
  font-size: 0.83rem;
  max-height: 240px;
  overflow-y: auto;
  color: var(--text-2);
}
.log-item {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.4rem;
  align-items: flex-start;
}
.log-tag {
  font-weight: 700;
  font-size: 0.7rem;
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  text-transform: uppercase;
}
.log-tag.mod { background: var(--primary-soft); color: var(--link); }
.log-tag.automod { background: var(--warn-soft); color: var(--warn); }
.log-tag.system { background: var(--accent-soft); color: var(--accent); }

/* ── Toast Notifications ───────────────────────────────────────────────── */
#toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}
.toast {
  pointer-events: auto;
  background: var(--bg-alt);
  border: 1px solid var(--primary);
  color: var(--text);
  padding: 0.75rem 1.25rem;
  border-radius: var(--r);
  font-size: 0.9rem;
  font-weight: 600;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  gap: 0.6rem;
  animation: toastIn 0.3s var(--ease-out);
}
@keyframes toastIn {
  from { opacity: 0; transform: translateY(20px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* ── Quick Search Modal ──────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 10vh;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s var(--ease);
}
.modal-overlay.open { opacity: 1; pointer-events: auto; }
.modal-content {
  background: var(--bg-alt);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-lg);
  width: 90%;
  max-width: 640px;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

/* ── Responsive ────────────────────────────────────────────────────── */
@media (max-width: 620px) {
  .cmd-toolbar { position: static; }
  .stats { grid-template-columns: repeat(2, 1fr); }
  .btn.lg { width: 100%; }
  .btn-row { flex-direction: column; }
  .btn-row.center { align-items: center; }
  .hero-actions .btn { width: 100%; }
  .component-row { flex-wrap: wrap; gap: 0.5rem; }
  .component-row .name { min-width: 0; }
  .component-row .bar { width: 100%; }
}

/* ── Print ─────────────────────────────────────────────────────────── */
@media print {
  .nav, footer.site, .cmd-toolbar, .btn, body::before, body::after { display: none !important; }
  body { background: #fff; color: #000; }
}
`;

