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

  --glass: rgba(255, 255, 255, 0.72);
  --glass-strong: rgba(255, 255, 255, 0.88);
  --glass-border: rgba(15, 23, 42, 0.14);
  --glass-highlight: rgba(255, 255, 255, 0.98);
  --glass-shadow: 0 16px 36px -12px rgba(15, 23, 42, 0.14), 0 4px 12px -2px rgba(15, 23, 42, 0.08);
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
  /* Apple visionOS / macOS Sonoma — deep space base */
  --bg: #06060a;
  --bg-alt: #0a0b12;
  --surface: rgba(255, 255, 255, 0.042);
  --surface-2: rgba(255, 255, 255, 0.072);
  --border: rgba(255, 255, 255, 0.095);
  --border-strong: rgba(255, 255, 255, 0.175);
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

  /* Apple liquid-glass — true frosted glass */
  --glass: rgba(255, 255, 255, 0.046);
  --glass-strong: rgba(255, 255, 255, 0.084);
  --glass-border: rgba(255, 255, 255, 0.12);
  --glass-highlight: rgba(255, 255, 255, 0.22);
  --glass-shadow: 0 16px 40px -12px rgba(0, 0, 0, 0.65), 0 4px 14px -3px rgba(0, 0, 0, 0.4);
  --glass-blur: 48px;
  --glass-sat: 210%;

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
  --glass: rgba(255, 255, 255, 0.72);
  --glass-strong: rgba(255, 255, 255, 0.88);
  --glass-border: rgba(15, 23, 42, 0.14);
  --glass-highlight: rgba(255, 255, 255, 0.98);
  --glass-shadow: 0 16px 36px -12px rgba(15, 23, 42, 0.14), 0 4px 12px -2px rgba(15, 23, 42, 0.08);
  --glass-blur: 48px;
  --glass-sat: 190%;
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
[data-theme='cyberpunk'] { ${cyberpunkTokens} }
[data-theme='emerald'] { ${emeraldTokens} }
[data-theme='gold'] { ${goldTokens} }

@media (prefers-color-scheme: light) {
  :root:not([data-theme]) { ${lightTokens}
    --glass: rgba(255, 255, 255, 0.72);
    --glass-strong: rgba(255, 255, 255, 0.88);
    --glass-border: rgba(15, 23, 42, 0.14);
    --glass-highlight: rgba(255, 255, 255, 0.98);
    --glass-shadow: 0 16px 36px -12px rgba(15, 23, 42, 0.14), 0 4px 12px -2px rgba(15, 23, 42, 0.08);
    --glass-blur: 48px;
    --glass-sat: 190%;
    --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  }
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

/* Apple visionOS ambient orbs — multi-layered depth */
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

/* ── Buttons ─────────────────────────────────────────────────────── */
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
  background: var(--glass);
  border-color: var(--glass-border);
  color: var(--text);
  box-shadow: inset 0 1px 0 var(--glass-highlight), var(--glass-shadow);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  backdrop-filter: blur(20px) saturate(180%);
}
.btn.ghost:hover {
  background: var(--glass-strong);
  border-color: color-mix(in srgb, var(--primary) 55%, var(--glass-border));
}

.btn.lg { padding: 0.82rem 1.85rem; font-size: 1.01rem; border-radius: 980px; }
.btn.sm { padding: 0.4rem 0.9rem; font-size: 0.84rem; border-radius: 980px; }
.btn.block { width: 100%; }

.btn-row { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.btn-row.center { justify-content: center; }

/* ── Nav ─────────────────────────────────────────────────────────── */
.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  height: var(--nav-h);
  display: flex;
  align-items: center;
  /* macOS Sonoma translucent menu bar */
  background: color-mix(in srgb, var(--bg) 55%, transparent);
  backdrop-filter: blur(48px) saturate(220%) brightness(0.92);
  -webkit-backdrop-filter: blur(48px) saturate(220%) brightness(0.92);
  border-bottom: 1px solid transparent;
  box-shadow: none;
  transition: border-color 0.25s var(--ease), box-shadow 0.25s var(--ease);
}
.nav.scrolled {
  border-bottom-color: rgba(255,255,255,0.07);
  box-shadow: 0 1px 0 rgba(255,255,255,0.05), 0 4px 20px rgba(0,0,0,0.3);
}
[data-theme='light'] .nav { background: color-mix(in srgb, #fff 68%, transparent); }
[data-theme='light'] .nav.scrolled { border-bottom-color: rgba(0,0,0,0.08); }

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

/* ── Global search ─────────────────────────────────────────────────── */
.site-search[hidden] { display: none; }
.site-search { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: start center; padding: min(12vh, 7rem) 1rem 1rem; }
.site-search-backdrop { position: absolute; inset: 0; background: rgba(3, 5, 12, 0.65); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
.site-search-panel { position: relative; width: min(680px, 100%); max-height: min(72vh, 640px); overflow: hidden auto; background: var(--glass-strong); border: 1px solid var(--glass-border); border-radius: var(--r-xl); box-shadow: inset 0 1px 0 var(--glass-highlight), var(--shadow-lg); backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat)); -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat)); }
.site-search-head { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1rem 0.25rem 1.25rem; font-family: var(--display); font-weight: 700; }
.site-search-input-wrap { display: flex; align-items: center; gap: 0.7rem; margin: 0.7rem 1rem 0; padding: 0.75rem 0.85rem; border: 1px solid var(--glass-border); border-radius: var(--r); background: var(--glass); backdrop-filter: blur(20px) saturate(180%); -webkit-backdrop-filter: blur(20px) saturate(180%); }
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
    background: color-mix(in srgb, var(--bg) 72%, transparent);
    backdrop-filter: blur(40px) saturate(200%);
    -webkit-backdrop-filter: blur(40px) saturate(200%);
    border-bottom: 1px solid var(--glass-border);
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
  .nav-mobile-cta { display: block; margin-top: 0.65rem; padding-top: 0.85rem; border-top: 1px solid var(--glass-border); }
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

/* ── Stats ─────────────────────────────────────────────────────────── */
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1px;
  margin-top: clamp(2.5rem, 5vw, 3.5rem);
  background: var(--glass-border);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-xl);
  overflow: hidden;
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
}
.stat {
  background: var(--glass);
  padding: 1.35rem 1.1rem;
  text-align: center;
  transition: background 0.2s var(--ease);
}
.stat:hover { background: var(--glass-strong); }
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
  background: var(--glass);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-xl);
  padding: 1.6rem;
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  box-shadow: inset 0 1px 0 var(--glass-highlight), var(--glass-shadow);
  transition: transform 0.28s var(--spring), border-color 0.22s var(--ease),
              box-shadow 0.22s var(--ease);
}
.card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--primary) 38%, var(--glass-border));
  box-shadow: inset 0 1px 0 var(--glass-highlight), 0 20px 56px -24px rgba(0,0,0,0.85);
}
.card-icon {
  width: 42px; height: 42px;
  border-radius: 13px;
  background: var(--glass-strong);
  border: 1px solid var(--glass-border);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
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
  background: var(--glass);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-xl);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  box-shadow: inset 0 1px 0 var(--glass-highlight), var(--glass-shadow);
  transition: transform 0.28s var(--spring), box-shadow 0.22s var(--ease);
}
.step:hover { transform: translateY(-2px); }
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
  box-shadow: 0 4px 12px -3px var(--primary-ring), inset 0 1px 0 rgba(255,255,255,0.25);
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
  background: var(--glass);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-lg);
  overflow: hidden;
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  box-shadow: inset 0 1px 0 var(--glass-highlight);
  transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease);
}
details.acc[open] { border-color: color-mix(in srgb, var(--primary) 38%, var(--glass-border)); box-shadow: inset 0 1px 0 var(--glass-highlight), 0 8px 24px -12px rgba(0,0,0,0.5); }
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
  background: color-mix(in srgb, var(--bg) 70%, transparent);
  backdrop-filter: blur(44px) saturate(200%);
  -webkit-backdrop-filter: blur(44px) saturate(200%);
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
  background: var(--glass);
  border: 1px solid var(--glass-border);
  border-radius: 980px;
  padding: 0.6rem 2.4rem 0.6rem 2.4rem;
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  transition: border-color 0.16s var(--ease), box-shadow 0.16s var(--ease);
}
.search input::placeholder { color: var(--faint); }
.search input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft), inset 0 1px 0 var(--glass-highlight);
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
  background: var(--glass);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-lg);
  overflow: hidden;
  margin-bottom: 0.7rem;
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  box-shadow: inset 0 1px 0 var(--glass-highlight);
  transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease);
}
.cmd-card:hover { border-color: color-mix(in srgb, var(--primary) 35%, var(--glass-border)); box-shadow: inset 0 1px 0 var(--glass-highlight), 0 8px 24px -12px rgba(0,0,0,0.6); }
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
  border-radius: var(--r-lg);
  border: 1px solid var(--glass-border);
  background: var(--glass);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
  font-size: 0.9rem;
  color: var(--muted);
}
.callout .callout-icon { flex-shrink: 0; font-size: 1rem; line-height: 1.5; }
.callout strong { color: var(--text); }
.callout.info { background: color-mix(in srgb, var(--primary-soft) 80%, var(--glass)); border-color: color-mix(in srgb, var(--primary) 28%, var(--glass-border)); }
.callout.warn { background: color-mix(in srgb, var(--warn-soft) 80%, var(--glass)); border-color: color-mix(in srgb, var(--warn) 32%, var(--glass-border)); }
.callout.danger { background: color-mix(in srgb, var(--danger-soft) 80%, var(--glass)); border-color: color-mix(in srgb, var(--danger) 30%, var(--glass-border)); }

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

/* ── Footer ─────────────────────────────────────────────────────── */
footer.site {
  margin-top: clamp(3rem, 6vw, 5rem);
  border-top: 1px solid rgba(255,255,255,0.06);
  background: color-mix(in srgb, var(--bg) 70%, transparent);
  -webkit-backdrop-filter: blur(32px) saturate(160%);
  backdrop-filter: blur(32px) saturate(160%);
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

/* ── Back to Top Floating Button ──────────────────────────────────── */
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

/* ── Status Refresh Button ────────────────────────────────────────── */
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

/* ──────────────────────────────────────────────────────────────────
   Apple Liquid Glass — visionOS / macOS Sonoma
   Every floating surface uses the same frosted-glass recipe:
   backdrop blur + vibrancy + inner rim highlight + deep shadow.
────────────────────────────────────────────────────────────────── */

/* Level 1 — standard glass surfaces */
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
  border-color: var(--glass-border);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  box-shadow: inset 0 1px 0 var(--glass-highlight), var(--glass-shadow);
}

/* Level 2 — deeper panels */
.site-search-panel,
.modal-content {
  background: var(--glass-strong);
}

/* Colored tint overlays on top of glass */
.cta-box {
  background:
    radial-gradient(ellipse 70% 100% at 50% 0%, var(--primary-soft), transparent 70%),
    var(--glass);
  border-color: var(--glass-border);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  box-shadow: inset 0 1px 0 var(--glass-highlight), var(--glass-shadow);
}
.status-banner {
  background: linear-gradient(135deg, var(--accent-soft), var(--glass));
  border-color: var(--glass-border);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  box-shadow: inset 0 1px 0 var(--glass-highlight), var(--glass-shadow);
}
.status-banner.bad {
  background: linear-gradient(135deg, var(--danger-soft), var(--glass));
}

/* Top specular sheen — Apple's characteristic inner glow */
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

/* ── Stats grid — Apple Materials style */
.stat {
  background: var(--glass);
  border-color: var(--glass-border);
}
.stat:hover { background: var(--glass-strong); }

/* ── Sidebar glass */
.docs-side {
  background: var(--glass);
  border-color: var(--glass-border);
  border-radius: var(--r-xl);
}

/* ── Metric cards */
.metric,
.component-row,
.endpoint-item {
  border-radius: var(--r-lg);
}

/* ── Card hover — lift + deepen shadow */
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

/* ── Back-to-top */
.back-to-top {
  background: var(--glass);
  border-color: var(--glass-border);
  border-radius: 980px;
  -webkit-backdrop-filter: blur(24px) saturate(200%);
  backdrop-filter: blur(24px) saturate(200%);
  box-shadow: inset 0 1px 0 var(--glass-highlight), var(--glass-shadow);
}
.back-to-top:hover {
  background: var(--glass-strong);
  border-color: color-mix(in srgb, var(--primary) 55%, var(--glass-border));
  transform: translateY(-3px);
}

/* ── Pills, badges, tabs — vibrancy layer */
.pill,
.badge,
.tab,
.copy-btn,
.sub-item,
.cmd-run,
.icon-btn:hover,
kbd {
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  backdrop-filter: blur(16px) saturate(180%);
}

/* Tab active = solid primary — no glass */
.tab[aria-pressed='true'],
.tab[aria-selected='true'] {
  background: var(--primary);
  border-color: transparent;
  box-shadow: 0 2px 8px -3px var(--primary-ring), inset 0 1px 0 rgba(255,255,255,0.2);
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

/* Hairline separators pick up the rim light */
.cmd-body,
.hero-panel,
.component-row,
.window-bar {
  border-color: var(--glass-border);
}

/* ── Toast — pill-style glass notification */
.toast {
  border-radius: 980px;
  padding: 0.65rem 1.35rem;
  background: var(--glass-strong);
  border-color: var(--glass-border);
  box-shadow: inset 0 1px 0 var(--glass-highlight), 0 16px 48px rgba(0,0,0,0.6);
}

/* ── Search panel */
.site-search-input-wrap {
  background: var(--glass);
  border-color: var(--glass-border);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  backdrop-filter: blur(20px) saturate(180%);
}

/* ── Accessibility: honour reduced-transparency preference */
@media (prefers-reduced-transparency: reduce) {
  .glass, .card, .cmd-card, details.acc, .step, .metric, .component-row,
  .endpoint-item, .dash-card, .pg-card, .table-wrap, .cta-box, .status-banner,
  .stat, .hero-panel, .site-search-panel, .modal-content, .docs-side, .toast,
  .nav, .back-to-top, .btn.ghost, .site-search-input-wrap,
  .status-hero-card, .subsystem-card, .ft-showcase-card, .help-cat-card,
  .help-issue-card, .cl-stat-box, .cl-sidebar, .cl-card, .cl-empty,
  .bento-card, .cmd-pill {
    -webkit-backdrop-filter: none !important;
    backdrop-filter: none !important;
    background: var(--bg-alt) !important;
  }
}

/* ── Liquid Glass Toggle Button ──────────────────────────────────── */
.glass-toggle {
  position: relative;
  transition: all 0.2s var(--ease);
}
.glass-toggle .icon-glass {
  transition: transform 0.25s var(--spring);
}
.glass-toggle:hover .icon-glass {
  transform: scale(1.12);
}
.glass-toggle[aria-pressed="true"] {
  color: var(--primary);
  background: var(--primary-soft);
  box-shadow: 0 0 14px -3px var(--primary-ring), inset 0 1px 0 rgba(255,255,255,0.18);
}
.glass-toggle[aria-pressed="true"] .icon-glass {
  filter: drop-shadow(0 0 4px var(--primary));
}
.glass-toggle[aria-pressed="false"] {
  opacity: 0.65;
}
.glass-toggle[aria-pressed="false"]:hover {
  opacity: 1;
}

/* ── Liquid Glass Toggle: Solid / Opaque Performance Mode ───────── */
[data-glass="off"],
[data-glass="off"] :root {
  --glass: var(--surface);
  --glass-strong: var(--surface-2);
  --glass-border: var(--border);
  --glass-highlight: transparent;
  --glass-shadow: var(--shadow-sm);
  --glass-blur: 0px;
  --glass-sat: 100%;
}

[data-glass="off"] .glass,
[data-glass="off"] .card,
[data-glass="off"] .cmd-card,
[data-glass="off"] details.acc,
[data-glass="off"] .step,
[data-glass="off"] .metric,
[data-glass="off"] .component-row,
[data-glass="off"] .endpoint-item,
[data-glass="off"] .dash-card,
[data-glass="off"] .pg-card,
[data-glass="off"] .table-wrap,
[data-glass="off"] .cta-box,
[data-glass="off"] .status-banner,
[data-glass="off"] .stat,
[data-glass="off"] .hero-panel,
[data-glass="off"] .site-search-panel,
[data-glass="off"] .modal-content,
[data-glass="off"] .docs-side,
[data-glass="off"] .toast,
[data-glass="off"] .nav,
[data-glass="off"] .back-to-top,
[data-glass="off"] .btn.ghost,
[data-glass="off"] .site-search-input-wrap,
[data-glass="off"] .status-hero-card,
[data-glass="off"] .subsystem-card,
[data-glass="off"] .ft-showcase-card,
[data-glass="off"] .help-cat-card,
[data-glass="off"] .help-issue-card,
[data-glass="off"] .cl-stat-box,
[data-glass="off"] .cl-sidebar,
[data-glass="off"] .cl-card,
[data-glass="off"] .cl-empty,
[data-glass="off"] .bento-card,
[data-glass="off"] .cmd-pill,
[data-glass="off"] .pill,
[data-glass="off"] .badge,
[data-glass="off"] .tab,
[data-glass="off"] .copy-btn,
[data-glass="off"] .sub-item,
[data-glass="off"] .cmd-run,
[data-glass="off"] .icon-btn:hover,
[data-glass="off"] kbd {
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
  background: var(--bg-alt);
}

[data-glass="off"] .cmd-card::after,
[data-glass="off"] .dash-card::after,
[data-glass="off"] .pg-card::after,
[data-glass="off"] .cta-box::after,
[data-glass="off"] .hero-panel::after,
[data-glass="off"] .status-hero-card::after {
  display: none !important;
}

.spinning svg, svg.spinning {
  animation: spinIcon 0.75s linear infinite;
}
@keyframes spinIcon {
  100% { transform: rotate(360deg); }
}

/* ── Reworked Status Experience ──────────────────────────────────────── */
.status-hero-card {
  position: relative;
  background: var(--glass-strong);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-xl);
  padding: clamp(2rem, 4vw, 3rem);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  box-shadow: inset 0 1px 0 var(--glass-highlight), var(--glass-shadow);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  flex-wrap: wrap;
  overflow: hidden;
  margin-bottom: 2.5rem;
}
.status-hero-card::after {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(52, 211, 153, 0.12) 0%, transparent 70%);
  pointer-events: none;
  filter: blur(40px);
}
.status-hero-left {
  display: flex;
  align-items: center;
  gap: 1.75rem;
  flex-wrap: wrap;
}
.status-orb-container {
  position: relative;
  width: 68px;
  height: 68px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.status-orb-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid var(--accent);
  opacity: 0.35;
  animation: statusPulse 2.8s infinite ease-out;
}
.status-orb-core {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 24px var(--accent), 0 0 48px var(--accent-soft);
  transition: all 0.4s ease;
}
.status-hero-card.bad .status-orb-core {
  background: var(--danger);
  box-shadow: 0 0 24px var(--danger), 0 0 48px var(--danger-soft);
}
.status-hero-card.bad .status-orb-ring {
  border-color: var(--danger);
}
@keyframes statusPulse {
  0% { transform: scale(0.7); opacity: 0.8; }
  70% { transform: scale(1.45); opacity: 0; }
  100% { transform: scale(1.45); opacity: 0; }
}

.status-ping-waveform {
  display: inline-flex;
  align-items: flex-end;
  gap: 3px;
  height: 18px;
  margin-left: 0.5rem;
  vertical-align: middle;
}
.status-ping-waveform span {
  width: 3px;
  background: var(--accent);
  border-radius: 2px;
  animation: waveJump 1.4s ease-in-out infinite alternate;
}
.status-ping-waveform span:nth-child(1) { height: 35%; animation-delay: 0.1s; }
.status-ping-waveform span:nth-child(2) { height: 80%; animation-delay: 0.3s; }
.status-ping-waveform span:nth-child(3) { height: 50%; animation-delay: 0.5s; }
.status-ping-waveform span:nth-child(4) { height: 100%; animation-delay: 0.2s; }
.status-ping-waveform span:nth-child(5) { height: 60%; animation-delay: 0.4s; }
@keyframes waveJump {
  0% { transform: scaleY(0.4); opacity: 0.6; }
  100% { transform: scaleY(1); opacity: 1; }
}

.uptime-matrix-90 {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(7px, 1fr));
  gap: 4px;
  margin: 1rem 0 0.5rem;
}
.uptime-matrix-day {
  height: 32px;
  border-radius: 3px;
  background: var(--accent);
  opacity: 0.85;
  transition: all 0.2s;
  cursor: pointer;
  position: relative;
}
.uptime-matrix-day:hover {
  opacity: 1;
  transform: scaleY(1.15);
  box-shadow: 0 0 8px var(--accent);
}
.uptime-matrix-day.warn { background: var(--warn); }
.uptime-matrix-day.bad { background: var(--danger); }

.subsystem-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2.5rem;
}
.subsystem-card {
  background: var(--glass);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-lg);
  padding: 1.25rem 1.5rem;
  -webkit-backdrop-filter: blur(var(--glass-blur));
  backdrop-filter: blur(var(--glass-blur));
  box-shadow: inset 0 1px 0 var(--glass-highlight), var(--glass-shadow);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 1rem;
  transition: transform 0.25s, border-color 0.25s;
}
.subsystem-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--primary) 40%, var(--glass-border));
}

/* ── Reworked Features Showcase ──────────────────────────────────────── */
.ft-category-nav {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.5rem 0.25rem 1.5rem;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.ft-category-nav::-webkit-scrollbar { display: none; }
.ft-cat-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1.15rem;
  border-radius: 980px;
  background: var(--glass);
  border: 1px solid var(--glass-border);
  color: var(--text-2);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
}
.ft-cat-btn:hover {
  color: var(--text);
  background: var(--glass-strong);
  border-color: var(--primary);
}
.ft-cat-btn[aria-pressed="true"] {
  background: var(--primary);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 4px 14px -3px var(--primary-ring);
}

/* ── Interactive Command Pill Row ──────────────────────────────────── */
.cmd-pill-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  justify-content: center;
  align-items: center;
  margin: 1.5rem 0 2.25rem;
}
.cmd-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.95rem;
  border-radius: 980px;
  background: var(--glass);
  border: 1px solid var(--glass-border);
  color: var(--text);
  font-family: var(--mono);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s var(--ease);
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
}
.cmd-pill:hover {
  transform: translateY(-2px);
  background: var(--glass-strong);
  border-color: var(--primary);
  box-shadow: inset 0 1px 0 var(--glass-highlight), 0 6px 16px -4px var(--primary-ring);
}
.cmd-pill .pill-copy {
  font-size: 0.7rem;
  color: var(--muted);
  font-family: var(--font);
}

/* ── Interactive Hero Preview Tabs ─────────────────────────────────── */
.preview-tabs {
  display: flex;
  gap: 0.35rem;
  padding: 4px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 980px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.preview-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.85rem;
  border-radius: 980px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  background: transparent;
  border: none;
  color: #949ba4;
  transition: all 0.2s var(--ease);
}
.preview-tab-btn:hover {
  color: #f2f3f5;
}
.preview-tab-btn[aria-pressed="true"] {
  background: var(--primary);
  color: #fff;
  box-shadow: 0 2px 8px -2px var(--primary-ring);
}
.preview-panel {
  display: none;
}
.preview-panel.active {
  display: block;
}

/* ── Bento Grid of Core Pillars ───────────────────────────────────── */
.bento-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}
.bento-card {
  position: relative;
  background: var(--glass);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-xl);
  padding: clamp(1.5rem, 3vw, 2.25rem);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  box-shadow: inset 0 1px 0 var(--glass-highlight), var(--glass-shadow);
  display: flex;
  flex-direction: column;
  transition: all 0.25s var(--ease);
  overflow: hidden;
}
.bento-card:hover {
  transform: translateY(-3px);
  border-color: var(--primary);
  box-shadow: inset 0 1px 0 var(--glass-highlight), 0 16px 36px -12px var(--primary-ring);
}
.bento-icon {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  background: var(--primary-soft);
  color: var(--primary);
  display: grid;
  place-items: center;
  font-size: 1.4rem;
  margin-bottom: 1.25rem;
  border: 1px solid var(--primary-ring);
}
.bento-card h3 {
  font-size: 1.25rem;
  margin-bottom: 0.5rem;
  color: var(--text);
}
.bento-card p {
  color: var(--text-2);
  font-size: 0.95rem;
  line-height: 1.6;
  margin-bottom: 1.25rem;
  flex: 1;
}
.bento-points {
  list-style: none;
  padding: 0;
  margin: 0 0 1.25rem 0;
  display: grid;
  gap: 0.55rem;
  font-size: 0.88rem;
  color: var(--muted);
}
.bento-points li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.bento-points li::before {
  content: "✓";
  color: var(--accent);
  font-weight: 700;
  flex-shrink: 0;
}

/* ── Interactive Feature Demo Button ──────────────────────────────── */
.ft-demo-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.86rem;
  font-weight: 600;
  cursor: pointer;
  background: var(--primary);
  color: #fff;
  border: 1px solid transparent;
  transition: all 0.18s var(--ease);
  box-shadow: 0 2px 8px -2px var(--primary-ring);
}
.ft-demo-btn:hover {
  background: var(--primary-hover);
  transform: translateY(-1px);
}
.ft-demo-btn:active {
  transform: translateY(0);
}
.ft-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.6rem;
  border-radius: 980px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--primary-soft);
  color: var(--primary);
  border: 1px solid var(--primary-ring);
}

.ft-showcase-card {
  position: relative;
  background: var(--glass);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-xl);
  padding: clamp(1.75rem, 3.5vw, 2.75rem);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  box-shadow: inset 0 1px 0 var(--glass-highlight), var(--glass-shadow);
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 2.5rem;
  align-items: center;
  margin-bottom: 3rem;
  overflow: hidden;
}
@media (max-width: 920px) {
  .ft-showcase-card { grid-template-columns: 1fr; }
}

.ft-mockup-frame {
  background: #1e1f22;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 18px 48px -12px rgba(0, 0, 0, 0.7);
  overflow: hidden;
}
.ft-mockup-topbar {
  background: #141517;
  padding: 0.55rem 0.9rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.ft-mockup-body {
  padding: 1.15rem;
}

.ft-interactive-pill {
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.ft-interactive-pill:hover {
  transform: scale(1.04);
}
.ft-interactive-pill:active {
  transform: scale(0.97);
}

.ft-compare-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}
.ft-compare-table th, .ft-compare-table td {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--glass-border);
}
.ft-compare-table thead th {
  background: var(--glass-strong);
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.78rem;
  letter-spacing: 0.05em;
  color: var(--muted);
}
.ft-compare-table tr:hover td {
  background: rgba(255, 255, 255, 0.02);
}
.ft-compare-table .highlight-col {
  background: color-mix(in srgb, var(--primary-soft) 40%, transparent);
  border-left: 1px solid color-mix(in srgb, var(--primary) 30%, transparent);
  border-right: 1px solid color-mix(in srgb, var(--primary) 30%, transparent);
  font-weight: 600;
}

/* ── Reworked Help / Troubleshooting Center ───────────────────────────── */
.help-spotlight {
  position: relative;
  max-width: 680px;
  margin: 1.5rem auto 2.5rem;
}
.help-spotlight-input {
  width: 100%;
  padding: 1rem 1.4rem 1rem 3rem;
  border-radius: 980px;
  background: var(--glass-strong);
  border: 1px solid var(--glass-border);
  color: var(--text);
  font-size: 1.05rem;
  outline: none;
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  backdrop-filter: blur(24px) saturate(180%);
  box-shadow: inset 0 1px 0 var(--glass-highlight), var(--glass-shadow);
  transition: all 0.25s;
}
.help-spotlight-input:focus {
  border-color: var(--primary);
  box-shadow: inset 0 1px 0 var(--glass-highlight), 0 0 0 3px var(--primary-ring);
}
.help-spotlight-icon {
  position: absolute;
  left: 1.15rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted);
  pointer-events: none;
}

.help-category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.25rem;
  margin-bottom: 3rem;
}
.help-cat-card {
  background: var(--glass);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-xl);
  padding: 1.5rem;
  -webkit-backdrop-filter: blur(var(--glass-blur));
  backdrop-filter: blur(var(--glass-blur));
  box-shadow: inset 0 1px 0 var(--glass-highlight), var(--glass-shadow);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  text-decoration: none;
  color: inherit;
  transition: all 0.25s;
}
.help-cat-card:hover {
  transform: translateY(-3px);
  border-color: var(--primary);
  background: var(--glass-strong);
}
.help-cat-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--primary-soft);
  color: var(--link);
  display: grid;
  place-items: center;
  font-size: 1.4rem;
}

.help-issue-card {
  background: var(--glass);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-lg);
  margin-bottom: 1.25rem;
  overflow: hidden;
  transition: border-color 0.2s;
}
.help-issue-card:hover {
  border-color: color-mix(in srgb, var(--primary) 40%, var(--glass-border));
}
.help-issue-summary {
  padding: 1.25rem 1.5rem;
  font-weight: 700;
  font-size: 1.05rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  list-style: none;
}
.help-issue-summary::-webkit-details-marker { display: none; }
.help-issue-summary::after {
  content: '▼';
  font-size: 0.75rem;
  color: var(--muted);
  transition: transform 0.25s;
}
details[open] > .help-issue-summary::after {
  transform: rotate(180deg);
}
.help-issue-content {
  padding: 0 1.5rem 1.5rem;
  border-top: 1px solid var(--glass-border);
  background: var(--surface-2);
}

.help-command-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.75rem;
  background: var(--glass);
  border: 1px solid var(--glass-border);
  border-radius: 6px;
  font-family: var(--mono);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.18s;
  user-select: all;
}
.help-command-pill:hover {
  background: var(--glass-strong);
  border-color: var(--primary);
}

/* ── Reworked Changelog Hub ───────────────────────────────────────────── */
.cl-hero {
  text-align: center;
  padding: clamp(2.5rem, 6vw, 4rem) 0 1.5rem;
}
.cl-hero .breadcrumbs {
  justify-content: center;
}
.cl-hero-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
  margin: 2rem auto 2.5rem;
  max-width: 800px;
}
.cl-stat-box {
  background: var(--glass);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-lg);
  padding: 1.15rem 1rem;
  text-align: center;
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
  box-shadow: inset 0 1px 0 var(--glass-highlight);
}
.cl-stat-num {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--text);
  line-height: 1.1;
  background: linear-gradient(135deg, var(--text) 40%, var(--primary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.cl-stat-label {
  font-size: 0.74rem;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 600;
  margin-top: 0.25rem;
  letter-spacing: 0.05em;
}

.cl-feed-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.85rem 1.4rem;
  margin-bottom: 2rem;
  border-radius: var(--r-lg);
}

.cl-filter-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin: 1.5rem 0 2rem;
}
.cl-filter-bar .search {
  flex: 1;
  min-width: 240px;
}
.cl-filter-tabs {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
  background: var(--glass);
  padding: 4px;
  border-radius: 980px;
  border: 1px solid var(--glass-border);
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
}
.cl-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 1.05rem;
  border-radius: 980px;
  font-size: 0.86rem;
  font-weight: 600;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  color: var(--muted);
  transition: all 0.2s var(--ease);
}
.cl-tab:hover {
  color: var(--text);
  background: var(--surface);
}
.cl-tab[aria-pressed="true"] {
  background: var(--primary);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 4px 14px -3px var(--primary-ring);
}
.cl-tab-count {
  font-size: 0.72rem;
  opacity: 0.85;
  font-weight: 700;
  padding: 0.1rem 0.45rem;
  border-radius: 980px;
  background: rgba(0, 0, 0, 0.25);
}

.cl-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 2.5rem;
  align-items: start;
}
@media (max-width: 860px) {
  .cl-layout {
    grid-template-columns: 1fr;
  }
}

.cl-sidebar {
  position: sticky;
  top: calc(var(--nav-h, 64px) + 1.25rem);
  padding: 1rem 0;
  border-radius: var(--r-xl);
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  scrollbar-width: thin;
  -webkit-backdrop-filter: blur(var(--glass-blur));
  backdrop-filter: blur(var(--glass-blur));
}
.cl-sidebar-section {
  padding: 0.4rem 0.75rem;
  display: flex;
  flex-direction: column;
}
.cl-sidebar-title {
  font-size: 0.72rem;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--faint);
  margin-bottom: 0.6rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-left: 0.5rem;
}
.cl-sidebar-divider {
  height: 1px;
  background: var(--glass-border);
  margin: 0.6rem 0;
}
.cl-ver-pill {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.45rem 0.75rem;
  text-decoration: none;
  border-radius: 8px;
  border-left: 3px solid transparent;
  color: var(--muted);
  font-size: 0.85rem;
  transition: all 0.18s;
  margin-bottom: 2px;
}
.cl-ver-pill:hover {
  background: var(--surface-2);
  color: var(--text);
  border-left-color: var(--primary);
  text-decoration: none;
}
.cl-ver-pill.active {
  background: color-mix(in srgb, var(--primary-soft) 60%, transparent);
  color: var(--text);
  border-left-color: var(--primary);
  font-weight: 600;
}
.cl-ver-pill.knub:hover {
  border-left-color: #f5a623;
}
.cl-ver-pill.knub.active {
  background: color-mix(in srgb, #f5a623 15%, transparent);
  border-left-color: #f5a623;
}
.cl-ver-num {
  font-family: var(--mono);
  font-weight: 600;
  font-size: 0.84rem;
}
.cl-ver-date {
  font-size: 0.72rem;
  color: var(--faint);
}

.cl-main {
  min-width: 0;
}
.cl-section-header {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  margin: 1.5rem 0 1.25rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid var(--glass-border);
}
.cl-section-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.95rem;
  border-radius: 980px;
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.cl-section-badge--bot {
  background: color-mix(in srgb, var(--primary) 18%, transparent);
  color: var(--primary);
  border: 1px solid color-mix(in srgb, var(--primary) 35%, transparent);
}
.cl-section-badge--knub {
  background: color-mix(in srgb, #f5a623 15%, transparent);
  color: #f5a623;
  border: 1px solid color-mix(in srgb, #f5a623 35%, transparent);
}
.cl-section-count {
  font-size: 0.82rem;
  color: var(--faint);
  margin-left: auto;
  font-weight: 600;
}

.cl-card {
  position: relative;
  border-radius: var(--r-xl);
  padding: 1.75rem 2rem;
  margin-bottom: 1.5rem;
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  transition: all 0.25s var(--ease);
  overflow: hidden;
}
.cl-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--primary) 45%, var(--glass-border));
  box-shadow: inset 0 1px 0 var(--glass-highlight), 0 12px 32px -8px var(--primary-ring);
}
.cl-card--knub {
  border-left: 4px solid #f5a623;
}
.cl-card--knub:hover {
  border-color: color-mix(in srgb, #f5a623 50%, var(--glass-border));
  border-left-color: #f5a623;
  box-shadow: inset 0 1px 0 var(--glass-highlight), 0 12px 32px -8px rgba(245, 166, 35, 0.25);
}
.cl-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--primary), transparent);
  opacity: 0;
  transition: opacity 0.25s;
}
.cl-card:hover::before {
  opacity: 1;
}
.cl-card--knub::before {
  background: linear-gradient(90deg, #f5a623, transparent);
}
.cl-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}
.cl-card-meta {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.cl-card-version {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.cl-version-badge {
  font-size: 1.35rem;
  font-weight: 800;
  font-family: var(--mono);
  letter-spacing: -0.02em;
  color: var(--text);
}
.cl-version-badge--knub {
  color: #f5a623;
}
.cl-tag-pill {
  font-size: 0.72rem !important;
  padding: 0.18rem 0.65rem !important;
}
.cl-date {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: var(--faint);
  font-weight: 500;
}
.cl-permalink {
  font-size: 1.1rem;
  color: var(--faint);
  text-decoration: none;
  opacity: 0;
  transition: opacity 0.18s;
  padding: 0.2rem 0.4rem;
}
.cl-card:hover .cl-permalink {
  opacity: 1;
}
.cl-permalink:hover {
  color: var(--primary);
  text-decoration: none;
}
.cl-summary {
  font-size: 0.96rem;
  color: var(--text-2);
  margin-bottom: 1.25rem;
  line-height: 1.65;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--glass-border);
}
.cl-highlights {
  padding: 0;
  margin: 0;
  list-style: none;
}
.cl-card[hidden] {
  display: none !important;
}
.cl-empty {
  text-align: center;
  padding: 4rem 1.5rem;
  color: var(--faint);
  background: var(--glass);
  border-radius: var(--r-xl);
  border: 1px solid var(--glass-border);
}
.cl-empty strong {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 1.15rem;
  color: var(--text);
}

.cl-copy-md-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  border-radius: 980px;
  background: var(--glass);
  border: 1px solid var(--glass-border);
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.cl-copy-md-btn:hover {
  color: var(--text);
  background: var(--glass-strong);
  border-color: var(--primary);
}

/* ── Glass Toggle Button ────────────────────────────────────────────── */
.glass-toggle {
  position: relative;
  overflow: hidden;
  transition: color 0.16s, background 0.16s, border-color 0.16s, box-shadow 0.18s var(--ease);
}
.glass-toggle[aria-pressed='true'] {
  color: var(--link);
  background: var(--primary-soft);
  border-color: var(--primary-ring);
  box-shadow: 0 0 0 2px var(--primary-ring), inset 0 1px 0 rgba(255,255,255,0.15);
}
.glass-toggle[aria-pressed='true']::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(circle at 50% 0%, rgba(255,255,255,0.18), transparent 70%);
  pointer-events: none;
}
.glass-toggle[aria-pressed='false'] {
  color: var(--faint);
  opacity: 0.7;
}
.glass-toggle[aria-pressed='false']:hover {
  opacity: 1;
}

/* ── Liquid Glass OFF mode ──────────────────────────────────────────── */
/*
 * When data-glass="off" all backdrop-filter and translucency is removed.
 * Elements get solid opaque surfaces instead, which is faster on low-end
 * hardware, OLED displays, or for users who prefer reduced transparency.
 */
[data-glass='off'] {
  --glass: var(--surface-2);
  --glass-strong: var(--surface-2);
  --glass-border: var(--border);
  --glass-highlight: transparent;
  --glass-shadow: var(--shadow-md);
  --glass-blur: 0px;
  --glass-sat: 100%;
}

/* Strip all blur/saturation filters from every glass-using element */
[data-glass='off'] .nav,
[data-glass='off'] .nav-links,
[data-glass='off'] .card,
[data-glass='off'] .step,
[data-glass='off'] .stat,
[data-glass='off'] .stats,
[data-glass='off'] details.acc,
[data-glass='off'] .site-search-panel,
[data-glass='off'] .site-search-input-wrap,
[data-glass='off'] .site-search-backdrop,
[data-glass='off'] .btn.ghost,
[data-glass='off'] .hero-panel,
[data-glass='off'] .window-bar,
[data-glass='off'] .cl-card,
[data-glass='off'] .cl-sidebar,
[data-glass='off'] .cl-filter-tabs,
[data-glass='off'] .cl-empty,
[data-glass='off'] .bento-card,
[data-glass='off'] .preview-panel,
[data-glass='off'] .preview-tabs,
[data-glass='off'] .ft-card,
[data-glass='off'] .ft-hero-badge,
[data-glass='off'] [class*='glass'] {
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
}

/* Solid nav bar when glass is off */
[data-glass='off'] .nav {
  background: var(--bg);
  border-bottom-color: var(--border);
}
[data-glass='off'] .nav.scrolled {
  box-shadow: var(--shadow-sm);
}

/* Solid card surfaces */
[data-glass='off'] .card,
[data-glass='off'] .step,
[data-glass='off'] .cl-card,
[data-glass='off'] .bento-card,
[data-glass='off'] .ft-card {
  background: var(--bg-alt);
  border-color: var(--border);
  box-shadow: var(--shadow-sm);
}

/* Solid stat grid */
[data-glass='off'] .stat {
  background: var(--bg-alt);
}
[data-glass='off'] .stats {
  background: var(--border);
}

/* Solid search panel */
[data-glass='off'] .site-search-panel {
  background: var(--bg-alt);
}
[data-glass='off'] .site-search-input-wrap {
  background: var(--surface-2);
}
[data-glass='off'] .site-search-backdrop {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  background: rgba(3, 5, 12, 0.82);
}

/* Solid accordion */
[data-glass='off'] details.acc {
  background: var(--bg-alt);
}

/* Solid mobile nav */
[data-glass='off'] .nav-links {
  background: var(--bg-alt);
}

/* Solid changelog sidebar */
[data-glass='off'] .cl-sidebar,
[data-glass='off'] .cl-filter-tabs,
[data-glass='off'] .cl-empty {
  background: var(--bg-alt);
}

/* Ghost button solid */
[data-glass='off'] .btn.ghost {
  background: var(--surface-2);
  box-shadow: var(--shadow-sm);
}
[data-glass='off'] .btn.ghost:hover {
  background: var(--surface-2);
  border-color: var(--border-strong);
}

/* Reduce background ambient orbs when glass is off (keep subtle) */
[data-glass='off'] body::before {
  opacity: 0.45;
}
[data-glass='off'] body::after {
  opacity: 0.3;
}

/* Glass toggle icon tint when off */
[data-glass='off'] .glass-toggle {
  color: var(--faint);
  background: none;
  border-color: transparent;
  box-shadow: none;
}
[data-glass='off'] .glass-toggle::after { display: none; }

/* ── Reduced transparency OS preference ─────────────────────────────── */
@media (prefers-reduced-transparency: reduce) {
  :root {
    --glass-blur: 0px;
    --glass-sat: 100%;
  }
  .nav,
  .card, .step, .stat, .stats,
  details.acc,
  .site-search-panel, .site-search-input-wrap,
  .btn.ghost, .hero-panel, .window-bar,
  .cl-card, .cl-sidebar, .cl-filter-tabs {
    -webkit-backdrop-filter: none !important;
    backdrop-filter: none !important;
  }
}

/* ── Reading Progress Bar ─────────────────────────────────────────── */
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

/* ── Code Block Copy Button ───────────────────────────────────────── */
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
  transition: all 0.18s var(--ease);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 5;
}
pre.block:hover .code-copy-btn,
pre.block:focus-within .code-copy-btn {
  opacity: 1;
}
.code-copy-btn:hover {
  color: var(--text);
  background: var(--surface-2);
  border-color: var(--border-strong);
}

/* ── Docs Mobile Navigation & Header ───────────────────────────────── */
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
  border-radius: var(--r);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
}
.docs-mobile-label {
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

/* ── Floating Back to Top Button ──────────────────────────────────── */
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
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
}
.back-to-top.visible {
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

/* ── Mobile and Tablet Responsiveness ─────────────────────────────── */
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

/* ── Print ─────────────────────────────────────────────────────────── */
@media print {
  .nav, footer.site, .cmd-toolbar, .btn, .back-to-top, .reading-progress-bar, body::before, body::after { display: none !important; }
  body { background: #fff; color: #000; }
}
`;

