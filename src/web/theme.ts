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

  --glass: var(--bg-alt);
  --glass-strong: var(--surface-2);
  --glass-border: var(--border);
  --glass-highlight: transparent;
  --glass-shadow: var(--shadow-sm);
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
/* â”€â”€ Tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
:root {
  /* Clean high-contrast solid dark base */
  --bg: #06060a;
  --bg-alt: #0e0f17;
  --surface: rgba(255, 255, 255, 0.042);
  --surface-2: rgba(255, 255, 255, 0.072);
  --border: rgba(255, 255, 255, 0.1);
  --border-strong: rgba(255, 255, 255, 0.2);
  --text: #f5f6fa;
  --text-2: #c8cfe0;
  --muted: #96a0b8;
  --faint: #6b7590;
  --primary: #5e6ad2;
  --primary-hover: #4c58c0;
  --primary-soft: rgba(94, 106, 210, 0.16);
  --primary-ring: rgba(94, 106, 210, 0.38);
  --link: #8b98f8;
  --accent: #34d399;
  --accent-soft: rgba(52, 211, 153, 0.13);
  --warn: #fbbf24;
  --warn-soft: rgba(251, 191, 36, 0.14);
  --danger: #f87171;
  --danger-soft: rgba(248, 113, 113, 0.13);
  --grid-line: rgba(255, 255, 255, 0.025);
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.45);
  --shadow-md: 0 12px 36px -10px rgba(0, 0, 0, 0.7);
  --shadow-lg: 0 32px 80px -20px rgba(0, 0, 0, 0.85);
  --code-bg: rgba(255, 255, 255, 0.065);
  --selection: rgba(94, 106, 210, 0.38);

  /* Solid surface tokens */
  --glass: var(--bg-alt);
  --glass-strong: var(--surface-2);
  --glass-border: var(--border);
  --glass-highlight: transparent;
  --glass-shadow: var(--shadow-sm);
  --glass-blur: 0px;
  --glass-sat: 100%;

  /* SF Pro-inspired type stack */
  --sans: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, 'Segoe UI', sans-serif;
  --display: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Outfit', 'Inter', system-ui, sans-serif;
  --mono: 'SF Mono', 'JetBrains Mono', ui-monospace, Menlo, monospace;

  --max: 1160px;
  --max-prose: 74ch;
  --nav-h: 52px;
  --r-sm: 10px;
  --r: 14px;
  --r-lg: 20px;
  --r-xl: 28px;

  --ease: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}

[data-theme='light'] { ${lightTokens}
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
[data-theme='cyberpunk'] { ${cyberpunkTokens} }
[data-theme='emerald'] { ${emeraldTokens} }
[data-theme='gold'] { ${goldTokens} }

@media (prefers-color-scheme: light) {
  :root:not([data-theme]) { ${lightTokens}
    --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  }
}

/* â”€â”€ Reset â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* Apple visionOS ambient orbs â€” multi-layered depth */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 60% 44% at 14% -4%, rgba(94,106,210,0.24), transparent 65%),
    radial-gradient(ellipse 50% 38% at 88% 6%, rgba(139,92,246,0.15), transparent 60%),
    radial-gradient(ellipse 44% 32% at 50% 108%, rgba(52,211,153,0.09), transparent 55%);
}

body::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  display: block;
  background:
    radial-gradient(ellipse 36% 28% at 74% 54%, rgba(94,106,210,0.08), transparent 60%),
    radial-gradient(ellipse 28% 22% at 18% 76%, rgba(139,92,246,0.07), transparent 55%);
}

/* â”€â”€ Typography â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€ Buttons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.btn {
  --btn-bg: var(--primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: var(--btn-bg);
  color: #fff;
  padding: 0.66rem 1.35rem;
  border-radius: 980px;
  font-weight: 600;
  font-size: 0.93rem;
  letter-spacing: -0.012em;
  white-space: nowrap;
  border: 1px solid rgba(255,255,255,0.16);
  box-shadow: 0 2px 12px -4px var(--primary-ring), inset 0 1px 0 rgba(255,255,255,0.22);
  transition: transform 0.18s var(--spring), background 0.18s var(--ease),
              box-shadow 0.18s var(--ease), opacity 0.18s var(--ease);
}
.btn:hover {
  background: var(--primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 6px 24px -6px var(--primary-ring), inset 0 1px 0 rgba(255,255,255,0.22);
  text-decoration: none;
  opacity: 0.92;
}
.btn:active { transform: translateY(0) scale(0.98); transition-duration: 0.07s; }

.btn.ghost {
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text);
  box-shadow: var(--shadow-sm);
}
.btn.ghost:hover {
  background: var(--surface);
  border-color: var(--border-strong);
}

.btn.lg { padding: 0.82rem 1.85rem; font-size: 1.01rem; border-radius: 980px; }
.btn.sm { padding: 0.4rem 0.9rem; font-size: 0.84rem; border-radius: 980px; }
.btn.block { width: 100%; }

.btn-row { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.btn-row.center { justify-content: center; }

/* â”€â”€ Nav â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  height: var(--nav-h);
  display: flex;
  align-items: center;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  box-shadow: none;
  transition: border-color 0.25s var(--ease), box-shadow 0.25s var(--ease);
}
.nav.scrolled {
  box-shadow: var(--shadow-sm);
}
[data-theme='light'] .nav { background: var(--bg); }
[data-theme='light'] .nav.scrolled { border-bottom-color: var(--border); }

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
  font-size: 1.08rem;
  letter-spacing: -0.025em;
  color: var(--text);
  flex-shrink: 0;
}
.brand:hover { text-decoration: none; }

.brand-mark {
  width: 28px; height: 28px;
  border-radius: 8px;
  background: linear-gradient(145deg, #7c83f5 0%, #5e6ad2 50%, #8b5cf6 100%);
  display: grid;
  place-items: center;
  font-size: 0.85rem;
  font-weight: 800;
  color: #fff;
  box-shadow: 0 2px 10px -3px var(--primary-ring), inset 0 1px 0 rgba(255,255,255,0.3);
  transition: transform 0.28s var(--spring), box-shadow 0.28s var(--ease);
}
.brand:hover .brand-mark {
  transform: rotate(-8deg) scale(1.08);
  box-shadow: 0 6px 20px -4px var(--primary-ring), inset 0 1px 0 rgba(255,255,255,0.3);
}

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
.site-search-trigger { cursor: pointer; }

.theme-toggle .icon-moon { display: none; }
[data-theme='light'] .theme-toggle .icon-sun { display: none; }
[data-theme='light'] .theme-toggle .icon-moon { display: block; }
@media (prefers-color-scheme: light) {
  :root:not([data-theme]) .theme-toggle .icon-sun { display: none; }
  :root:not([data-theme]) .theme-toggle .icon-moon { display: block; }
}

.nav-toggle { display: none; }

/* â”€â”€ Global search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.site-search[hidden] { display: none; }
.site-search { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: start center; padding: min(12vh, 7rem) 1rem 1rem; }
.site-search-backdrop { position: absolute; inset: 0; background: rgba(3, 5, 12, 0.78); }
.site-search-panel { position: relative; width: min(680px, 100%); max-height: min(72vh, 640px); overflow: hidden auto; background: var(--bg-alt); border: 1px solid var(--border); border-radius: var(--r-xl); box-shadow: var(--shadow-lg); }
.site-search-head { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1rem 0.25rem 1.25rem; font-family: var(--display); font-weight: 700; }
.site-search-input-wrap { display: flex; align-items: center; gap: 0.7rem; margin: 0.7rem 1rem 0; padding: 0.75rem 0.85rem; border: 1px solid var(--border); border-radius: var(--r); background: var(--surface-2); }
.site-search-input-wrap:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
.site-search-input-wrap svg { color: var(--muted); flex: 0 0 auto; }
.site-search-input-wrap input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: var(--text); font: inherit; }
.site-search-input-wrap input::placeholder { color: var(--faint); }
.site-search-help { margin: 0.7rem 1.25rem; color: var(--faint); font-size: 0.82rem; }
.site-search-results { min-height: 1rem; padding: 0 0.75rem 0.75rem; }
.site-search-result { display: flex; align-items: center; gap: 0.75rem; padding: 0.8rem; border-radius: var(--r-sm); color: var(--text); }
.site-search-result:hover, .site-search-result:focus { background: var(--surface-2); text-decoration: none; outline: none; }
.site-search-result-icon { display: grid; place-items: center; width: 2rem; height: 2rem; flex: 0 0 auto; border-radius: 7px; background: var(--primary-soft); color: var(--link); font-size: 0.9rem; }
.site-search-result-copy { min-width: 0; display: grid; gap: 0.1rem; }
.site-search-result-copy strong { font-size: 0.92rem; }
.site-search-result-copy small { overflow: hidden; color: var(--muted); font-size: 0.8rem; text-overflow: ellipsis; white-space: nowrap; }
.site-search-empty { padding: 1.25rem; color: var(--muted); text-align: center; }

@media (max-width: 900px) {
  .nav-toggle { display: grid; }
  .nav-links {
    position: fixed;
    inset: var(--nav-h) 0 auto 0;
    flex-direction: column;
    align-items: stretch;
    gap: 0.15rem;
    padding: 1rem 1.5rem 1.5rem;
    background: var(--bg-alt);
    border-bottom: 1px solid var(--border);
    box-shadow: 0 24px 48px rgba(0,0,0,0.5);
    transform: translateY(-12px);
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.22s var(--ease), transform 0.22s var(--ease-out), visibility 0.22s;
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

/* â”€â”€ Sections â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€ Hero â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
  border-bottom: 1px solid var(--glass-border);
  background: var(--glass-strong);
}
.window-dots { display: flex; gap: 0.35rem; }
/* macOS-style traffic lights */
.window-dots i { width: 10px; height: 10px; border-radius: 50%; display: block; }
.window-dots i:nth-child(1) { background: #ff5f57; box-shadow: 0 0 0 0.5px rgba(0,0,0,0.2); }
.window-dots i:nth-child(2) { background: #febc2e; box-shadow: 0 0 0 0.5px rgba(0,0,0,0.2); }
.window-dots i:nth-child(3) { background: #28c840; box-shadow: 0 0 0 0.5px rgba(0,0,0,0.2); }
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

/* â”€â”€ Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1px;
  margin-top: clamp(2.5rem, 5vw, 3.5rem);
  background: var(--border);
  border: 1px solid var(--border);
  border-radius: var(--r-xl);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}
.stat {
  background: var(--bg-alt);
  padding: 1.35rem 1.1rem;
  text-align: center;
  transition: background 0.2s var(--ease);
}
.stat:hover { background: var(--surface-2); }
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

/* â”€â”€ Cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.grid { display: grid; gap: 1.1rem; }
.grid.cols-2 { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
.grid.cols-3 { grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }

.card {
  position: relative;
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: var(--r-xl);
  padding: 1.6rem;
  box-shadow: var(--shadow-sm);
  transition: transform 0.28s var(--spring), border-color 0.22s var(--ease),
              box-shadow 0.22s var(--ease);
}
.card:hover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
}
.card-icon {
  width: 42px; height: 42px;
  border-radius: 13px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  display: grid;
  place-items: center;
  font-size: 1.2rem;
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
.card-link::after { content: 'â†’'; transition: transform 0.2s var(--ease); }
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

/* â”€â”€ Steps â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.steps { display: grid; gap: 1.1rem; grid-template-columns: repeat(auto-fit, minmax(255px, 1fr)); counter-reset: step; }
.step {
  position: relative;
  padding: 1.6rem 1.4rem 1.4rem;
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: var(--r-xl);
  box-shadow: var(--shadow-sm);
  transition: transform 0.28s var(--spring), box-shadow 0.22s var(--ease);
}
.step:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
.step::before {
  counter-increment: step;
  content: counter(step);
  position: absolute;
  top: -14px; left: 1.4rem;
  width: 30px; height: 30px;
  border-radius: 980px;
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

/* â”€â”€ Tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€ Accordion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.accordion { display: grid; gap: 0.6rem; }
details.acc {
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease);
}
details.acc[open] { border-color: var(--primary-ring); box-shadow: var(--shadow-md); }
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

/* â”€â”€ Tables â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€ Badges & pills â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€ Command reference â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
  background: var(--bg);
  border-bottom: 1px solid var(--border);
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
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 980px;
  padding: 0.6rem 2.4rem 0.6rem 2.4rem;
  transition: border-color 0.16s var(--ease), box-shadow 0.16s var(--ease);
}
.search input::placeholder { color: var(--faint); }
.search input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
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
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  overflow: hidden;
  margin-bottom: 0.7rem;
  box-shadow: var(--shadow-sm);
  transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease);
}
.cmd-card:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
}
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

/* â”€â”€ Callouts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.callout {
  display: flex;
  gap: 0.85rem;
  padding: 1rem 1.15rem;
  border-radius: var(--r-lg);
  border: 1px solid var(--border);
  background: var(--bg-alt);
  box-shadow: var(--shadow-sm);
  font-size: 0.9rem;
  color: var(--muted);
}
.callout .callout-icon { flex-shrink: 0; font-size: 1rem; line-height: 1.5; }
.callout strong { color: var(--text); }
.callout.info { background: var(--primary-soft); border-color: var(--primary-ring); }
.callout.warn { background: var(--warn-soft); border-color: var(--warn); }
.callout.danger { background: var(--danger-soft); border-color: var(--danger); }

/* â”€â”€ Docs layout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€ FAQ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.accordion { max-width: 760px; margin-inline: auto; }

/* â”€â”€ CTA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€ Status page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.status-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem 1.75rem;
  border-radius: var(--r-lg);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
  background: linear-gradient(135deg, var(--accent-soft), var(--surface));
  margin-bottom: 2.5rem;
  flex-wrap: wrap;
  box-shadow: var(--shadow-sm);
}
.status-banner.bad {
  border-color: color-mix(in srgb, var(--danger) 32%, var(--border));
  background: linear-gradient(135deg, var(--danger-soft), var(--surface));
}
.status-banner .status-text h2 { font-size: 1.3rem; margin: 0; }
.status-banner .status-text p { color: var(--muted); font-size: 0.91rem; margin-top: 0.25rem; }

/* Animated pulse dot */
.status-pulse-dot {
  width: 13px; height: 13px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
  box-shadow: 0 0 0 0 var(--accent);
  animation: statusPulse 2.4s infinite;
}
.status-banner.bad .status-pulse-dot {
  background: var(--danger);
  animation: statusPulseDanger 2.4s infinite;
}
@keyframes statusPulse {
  0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 55%, transparent); }
  60%  { box-shadow: 0 0 0 10px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}
@keyframes statusPulseDanger {
  0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--danger) 55%, transparent); }
  60%  { box-shadow: 0 0 0 10px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}

/* Section headings */
.status-section { }
.status-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  padding-bottom: 0.6rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 1.25rem;
}
.status-section-title {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--faint);
  font-weight: 700;
}

/* Uptime history bars */
.uptime-bar-row {
  display: flex;
  gap: 3px;
  margin-bottom: 0.5rem;
  height: 32px;
  align-items: stretch;
}
.uptime-day {
  flex: 1;
  border-radius: 4px;
  background: var(--accent-soft);
  border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
  transition: background 0.2s var(--ease), transform 0.15s var(--ease);
  cursor: default;
}
.uptime-day.ok {
  background: color-mix(in srgb, var(--accent) 28%, var(--surface));
  border-color: color-mix(in srgb, var(--accent) 20%, transparent);
}
.uptime-day.warn {
  background: color-mix(in srgb, var(--warn) 32%, var(--surface));
  border-color: color-mix(in srgb, var(--warn) 24%, transparent);
}
.uptime-day.bad {
  background: color-mix(in srgb, var(--danger) 32%, var(--surface));
  border-color: color-mix(in srgb, var(--danger) 24%, transparent);
}
.uptime-day:hover { transform: scaleY(1.1); }
.uptime-legend {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.77rem;
  color: var(--faint);
  margin-top: 0.35rem;
}

/* Metric grid */
.metric-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); }
.metric {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 1.15rem 1.25rem;
  transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease);
}
.metric:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-sm);
}
.metric .label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--faint); font-weight: 700; }
.metric .value { font-family: var(--display); font-size: 1.65rem; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 0.3rem; letter-spacing: -0.02em; }
.metric .value.good { color: var(--accent); }
.metric .value.warn { color: var(--warn); }
.metric .sub { font-size: 0.79rem; color: var(--faint); margin-top: 0.2rem; }

/* SLA tier grid */
.sla-tier-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
}
.sla-tier {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.15rem;
  border: 1px solid var(--border);
  border-radius: var(--r);
  background: var(--surface);
  opacity: 0.55;
  transition: opacity 0.2s var(--ease), border-color 0.2s var(--ease), box-shadow 0.2s var(--ease);
}
.sla-tier.active {
  opacity: 1;
  border-color: var(--border-strong);
  box-shadow: var(--shadow-sm);
}
.sla-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.sla-dot.ok  { background: var(--accent); }
.sla-dot.warn { background: var(--warn); }
.sla-dot.bad  { background: var(--danger); }
.sla-label { font-weight: 650; font-size: 0.9rem; }
.sla-range { font-size: 0.78rem; color: var(--faint); margin-top: 0.1rem; }

/* Component row */
.component-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--border);
  border-radius: var(--r);
  background: var(--surface);
  margin-bottom: 0.6rem;
  transition: border-color 0.2s var(--ease);
}
.component-row:hover { border-color: var(--border-strong); }
.component-row .name { font-weight: 650; font-size: 0.93rem; min-width: 200px; }
.component-row .desc { color: var(--muted); font-size: 0.85rem; flex: 1; }

/* Endpoint list */
.endpoint-list { display: grid; gap: 0.5rem; }
.endpoint-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 1.15rem;
  border: 1px solid var(--border);
  border-radius: var(--r);
  background: var(--surface);
  color: var(--text);
  text-decoration: none;
  transition: border-color 0.2s var(--ease), background 0.2s var(--ease);
}
.endpoint-item:hover {
  border-color: var(--primary);
  background: var(--primary-soft);
  text-decoration: none;
}
.endpoint-item code.inline { flex-shrink: 0; }
.endpoint-item .faint { min-width: 0; }

/* Bar */
.bar {
  height: 6px;
  border-radius: 99px;
  background: var(--surface-2);
  overflow: hidden;
  min-width: 80px;
  flex-shrink: 0;
}
.bar i { display: block; height: 100%; border-radius: 99px; background: var(--accent); transition: width 0.6s var(--ease-out); }
.bar.warn i { background: var(--warn); }
.bar.bad i { background: var(--danger); }

/* â”€â”€ Changelog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€ Footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€ Reveal on scroll â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

/* â”€â”€ Discord Message & Embed Simulation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€ Interactive Playground â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.playground-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  align-items: start;
}
@media (max-width: 860px) { .playground-grid { grid-template-columns: 1fr; } }

.pg-card {
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
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

/* â”€â”€ Live Dashboard UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.dash-card {
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
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

.page-header {
  text-align: center;
  padding: 3.5rem 0 1.5rem;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}

/* â”€â”€ Toast Notifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€ Quick Search Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(0, 0, 0, 0.78);
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

/* â”€â”€ Back to Top Floating Button â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.back-to-top {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);
  cursor: pointer;
  opacity: 0;
  visibility: hidden;
  transform: translateY(12px);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 990;
}
.back-to-top:hover {
  background: var(--surface-2);
  border-color: var(--primary);
  color: var(--primary);
  transform: translateY(8px);
}
.back-to-top.visible {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}
.back-to-top.visible:hover {
  transform: translateY(-2px);
}

/* â”€â”€ Status Refresh Button â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.status-refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-2);
  transition: all 0.2s ease;
}
.status-refresh-btn:hover {
  background: var(--surface-2);
  border-color: var(--primary);
  color: var(--text);
}
.status-refresh-btn.spinning span {
  display: inline-block;
  animation: spinRefresh 0.6s linear infinite;
}
@keyframes spinRefresh {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Apple Liquid Glass â€” visionOS / macOS Sonoma
   Every floating surface uses the same frosted-glass recipe:
   backdrop blur + vibrancy + inner rim highlight + deep shadow.
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/* Level 1 â€” standard glass surfaces */
.glass,
.cmd-card,
details.acc,
.step,
.metric,
.component-row,
.endpoint-item,
.dash-card,
.pg-card,
.table-wrap,
.stat,
.hero-panel,
.site-search-panel,
.modal-content,
.docs-side,
.toast {
  background: var(--glass);
  border-color: var(--glass-border);  box-shadow: inset 0 1px 0 var(--glass-highlight), var(--glass-shadow);
}

/* Level 2 â€” deeper panels */
.site-search-panel,
.modal-content {
  background: var(--glass-strong);
}

/* Colored tint overlays on top of glass */
.cta-box {
  background:
    radial-gradient(ellipse 70% 100% at 50% 0%, var(--primary-soft), transparent 70%),
    var(--glass);
  border-color: var(--glass-border);  box-shadow: inset 0 1px 0 var(--glass-highlight), var(--glass-shadow);
}
.status-banner {
  background: linear-gradient(135deg, var(--accent-soft), var(--glass));
  border-color: var(--glass-border);  box-shadow: inset 0 1px 0 var(--glass-highlight), var(--glass-shadow);
}
.status-banner.bad {
  background: linear-gradient(135deg, var(--danger-soft), var(--glass));
}

/* Top specular sheen â€” Apple's characteristic inner glow */
.cmd-card::after,
.dash-card::after,
.pg-card::after,
.cta-box::after,
.hero-panel::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(
    175deg,
    rgba(255,255,255,0.09) 0%,
    rgba(255,255,255,0.03) 25%,
    transparent 55%
  );
  z-index: 0;
}
.cmd-card,
.dash-card,
.pg-card,
.cta-box,
.hero-panel { position: relative; }

/* Internal layers above the sheen */
.cmd-card > summary,
.cmd-body,
.dash-card > *,
.pg-card > * { position: relative; z-index: 1; }

/* â”€â”€ Stats grid â€” Apple Materials style */
.stat {
  background: var(--glass);
  border-color: var(--glass-border);
}
.stat:hover { background: var(--glass-strong); }

/* â”€â”€ Sidebar glass */
.docs-side {
  background: var(--glass);
  border-color: var(--glass-border);
  border-radius: var(--r-xl);
}

/* â”€â”€ Metric cards */
.metric,
.component-row,
.endpoint-item {
  border-radius: var(--r-lg);
}

/* â”€â”€ Card hover â€” lift + deepen shadow */
.card:hover,
.cmd-card:hover,
.metric:hover,
.component-row:hover,
.endpoint-item:hover {
  border-color: color-mix(in srgb, var(--primary) 40%, var(--glass-border));
  box-shadow:
    inset 0 1px 0 var(--glass-highlight),
    0 28px 64px -24px rgba(0,0,0,0.9),
    0 0 0 1px color-mix(in srgb, var(--primary) 12%, transparent);
}

/* â”€â”€ Back-to-top */
.back-to-top {
  background: var(--glass);
  border-color: var(--glass-border);
  border-radius: 980px;  box-shadow: inset 0 1px 0 var(--glass-highlight), var(--glass-shadow);
}
.back-to-top:hover {
  background: var(--glass-strong);
  border-color: color-mix(in srgb, var(--primary) 55%, var(--glass-border));
  transform: translateY(-3px);
}

/* â”€â”€ Pills, badges, tabs â€” vibrancy layer */
.pill,
.badge,
.tab,
.copy-btn,
.sub-item,
.cmd-run,
.icon-btn:hover,
kbd {}

/* Tab active = solid primary â€” no glass */
.tab[aria-pressed='true'],
.tab[aria-selected='true'] {
  background: var(--primary);
  border-color: transparent;
  box-shadow: 0 2px 8px -3px var(--primary-ring), inset 0 1px 0 rgba(255,255,255,0.2);}

/* Hairline separators pick up the rim light */
.cmd-body,
.hero-panel,
.component-row,
.window-bar {
  border-color: var(--glass-border);
}

/* â”€â”€ Toast â€” pill-style glass notification */
.toast {
  border-radius: 980px;
  padding: 0.65rem 1.35rem;
  background: var(--glass-strong);
  border-color: var(--glass-border);
  box-shadow: inset 0 1px 0 var(--glass-highlight), 0 16px 48px rgba(0,0,0,0.6);
}

/* â”€â”€ Search panel */
.site-search-input-wrap {
  background: var(--glass);
  border-color: var(--glass-border);}

/* â”€â”€ Accessibility: honour reduced-transparency preference */
@media (prefers-reduced-transparency: reduce) {
  .glass, .card, .cmd-card, details.acc, .step, .metric, .component-row,
  .endpoint-item, .dash-card, .pg-card, .table-wrap, .cta-box, .status-banner,
  .stat, .hero-panel, .site-search-panel, .modal-content, .docs-side, .toast,
  .nav, .back-to-top, .btn.ghost, .site-search-input-wrap,
  .status-hero-card, .subsystem-card, .ft-showcase-card, .help-cat-card,
  .help-issue-card, .cl-stat-box, .cl-sidebar, .cl-card, .cl-empty,
  .bento-card, .cmd-pill {    background: var(--bg-alt) !important;
  }
}

/* â”€â”€ Liquid Glass Toggle Button â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/* â”€â”€ Reading Progress Bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.reading-progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  width: 0%;
  background: linear-gradient(90deg, var(--primary), #8b5cf6, var(--accent));
  z-index: 9999;
  pointer-events: none;
  transition: width 0.1s ease-out;
  box-shadow: 0 0 8px rgba(88, 101, 242, 0.45);
}

/* â”€â”€ Code Block Copy Button â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
pre.block {
  position: relative;
}
.code-copy-btn {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.22rem 0.55rem;
  font-size: 0.74rem;
  font-family: var(--font);
  font-weight: 550;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  cursor: pointer;
  opacity: 0;
  transition: all 0.18s var(--ease);}
pre.block:hover .code-copy-btn,
pre.block:focus-within .code-copy-btn {
  opacity: 1;
}
.code-copy-btn:hover {
  color: var(--text);
  background: var(--surface-2);
  border-color: var(--border-strong);
}

/* â”€â”€ Docs Mobile Navigation & Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.docs-header {
  margin-bottom: 1.75rem;
}
.docs-meta-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.6rem;
}
.docs-mobile-nav {
  display: none;
  margin-bottom: 1.5rem;
  padding: 0.75rem 1rem;
  background: var(--glass);
  border: 1px solid var(--border);
  border-radius: var(--r);.docs-mobile-label {
  display: block;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.4rem;
}
.docs-mobile-select {
  width: 100%;
  padding: 0.6rem 0.85rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  color: var(--text);
  font-size: 0.92rem;
  font-family: inherit;
  outline: none;
  cursor: pointer;
}
.docs-mobile-select:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-ring);
}

/* â”€â”€ Floating Back to Top Button â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.back-to-top {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--glass-strong);
  border: 1px solid var(--border-strong);
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 900;
  opacity: 0;
  visibility: hidden;
  transform: translateY(12px);
  transition: all 0.25s var(--ease);
  box-shadow: var(--shadow-md);.back-to-top.visible {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}
.back-to-top:hover {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
  transform: translateY(-2px);
  box-shadow: 0 10px 20px -5px var(--primary-ring);
}

/* â”€â”€ Mobile and Tablet Responsiveness â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
@media (max-width: 992px) {
  .docs-layout {
    grid-template-columns: 200px 1fr;
    gap: 1.75rem;
  }
}

@media (max-width: 768px) {
  :root {
    --nav-h: 60px;
  }
  .wrap {
    padding-left: 1.15rem;
    padding-right: 1.15rem;
  }
  .docs-layout {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  .docs-side {
    display: none;
  }
  .docs-mobile-nav {
    display: block;
  }
  .code-copy-btn {
    opacity: 0.9;
  }
  .table-wrap {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    border-radius: var(--r-sm);
    box-shadow: inset -8px 0 8px -8px rgba(0, 0, 0, 0.2);
  }
  .table-wrap table {
    min-width: 520px;
  }
  .prose pre.block {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding-top: 2.2rem;
  }
  .stats {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }
  .hero-panel {
    padding: 1.25rem 1rem;
  }
  .hero-title {
    font-size: 2.4rem;
  }
  .brand-mark {
    width: 32px;
    height: 32px;
    font-size: 16px;
  }
}

@media (max-width: 620px) {
  .cmd-toolbar { position: static; }
  .btn.lg { width: 100%; }
  .btn-row { flex-direction: column; }
  .btn-row.center { align-items: center; }
  .hero-actions .btn { width: 100%; }
  .component-row { flex-wrap: wrap; gap: 0.5rem; }
  .component-row .name { min-width: 0; }
  .component-row .bar { width: 100%; }
}

@media (max-width: 480px) {
  .stats {
    grid-template-columns: 1fr;
  }
  .hero-title {
    font-size: 2rem;
  }
  .lead {
    font-size: 1rem;
  }
  .btn-row, .hero-actions {
    flex-direction: column;
    width: 100%;
  }
  .btn.lg, .btn.block {
    width: 100%;
    justify-content: center;
  }
  .nav-inner {
    padding: 0 0.5rem;
  }
  .docs-meta-badges {
    flex-direction: column;
    align-items: flex-start;
  }
  .back-to-top {
    bottom: 1.25rem;
    right: 1.25rem;
    width: 42px;
    height: 42px;
  }
}

/* â”€â”€ Print â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
@media print {
  .nav, footer.site, .cmd-toolbar, .btn, .back-to-top, .reading-progress-bar, body::before, body::after { display: none !important; }
  body { background: #fff; color: #000; }
}
`;



