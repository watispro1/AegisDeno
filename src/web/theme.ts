/**
 * Stylesheet for the Aegis site, served from /assets/site.css.
 *
 * The look is deliberately plain: one paper-coloured background, one teal
 * accent, the system sans-serif for text and the system monospace for anything
 * you would type into Discord (IBM Plex is used if it is installed locally; no
 * web fonts are downloaded). Thin borders instead of shadows, 4px corners, no gradients,
 * no blur, no scroll animations. Light is the default; dark is opt-in via the
 * toggle in the header and is remembered in localStorage.
 */
export const styles = String.raw`
/* ── Tokens ─────────────────────────────────────────────────────────── */
:root {
  --bg: #fbfaf8;
  --bg-sunk: #f3f2ee;
  --surface: #ffffff;
  --text: #1b1b19;
  --text-2: #3a3a36;
  --muted: #5d5c57;
  --faint: #686762;
  --border: #e2e0da;
  --border-strong: #cfccc4;
  --accent: #17695a;
  --accent-hover: #10564a;
  --accent-ink: #ffffff;
  --accent-soft: #e5f0ed;
  --link: #17695a;
  --ok: #1d7a43;
  --warn: #9a5b00;
  --danger: #b3261e;
  --code-bg: #f1efea;
  --mark: #fde9a6;

  /* Discord mock colours: these imitate the Discord client, not the site. */
  --dc-bg: #313338;
  --dc-input: #383a40;
  --dc-text: #dbdee1;
  --dc-muted: #949ba4;
  --dc-embed: #2b2d31;
  --dc-blurple: #5865f2;

  --sans: "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;

  --r: 4px;
  --r-lg: 6px;
  --wrap: 1120px;
  --nav-h: 56px;
  color-scheme: light;
}

[data-theme="dark"] {
  --bg: #161716;
  --bg-sunk: #1c1d1c;
  --surface: #1e1f1e;
  --text: #e9e8e4;
  --text-2: #d2d1cc;
  --muted: #a8a7a1;
  --faint: #96958f;
  --border: #2f302e;
  --border-strong: #42433f;
  --accent: #5ec2a6;
  --accent-hover: #7dd3bb;
  --accent-ink: #0e1a17;
  --accent-soft: #1d2d29;
  --link: #6fcbb1;
  --ok: #5fc98a;
  --warn: #e3a64a;
  --danger: #f2837b;
  --code-bg: #232523;
  --mark: #5a4a12;
  color-scheme: dark;
}

/* ── Base ───────────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; scroll-padding-top: calc(var(--nav-h) + 16px); }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--sans);
  font-size: 16px;
  line-height: 1.6;
  text-rendering: optimizeLegibility;
  overflow-wrap: break-word;
}
a, button, summary, label, select, input, textarea { touch-action: manipulation; }
img, svg { display: block; max-width: 100%; }
a { color: var(--link); text-underline-offset: 2px; text-decoration-thickness: 1px; }
a:hover { color: var(--accent-hover); }
h1, h2, h3, h4 { color: var(--text); line-height: 1.25; margin: 0 0 .5em; font-weight: 600; letter-spacing: -0.01em; }
h1 { font-size: clamp(1.9rem, 1.4rem + 2vw, 2.6rem); letter-spacing: -0.02em; }
h2 { font-size: clamp(1.35rem, 1.2rem + .6vw, 1.6rem); }
h3 { font-size: 1.1rem; }
h4 { font-size: .95rem; }
p { margin: 0 0 1em; }
ul, ol { margin: 0 0 1em; padding-left: 1.25rem; }
li + li { margin-top: .25em; }
hr { border: 0; border-top: 1px solid var(--border); margin: 2rem 0; }
mark { background: var(--mark); color: inherit; border-radius: 2px; padding: 0 1px; }
kbd {
  font-family: var(--mono);
  font-size: .75rem;
  border: 1px solid var(--border-strong);
  border-bottom-width: 2px;
  border-radius: 3px;
  padding: 0 .35rem;
  color: var(--muted);
  background: var(--surface);
}
code, pre { font-family: var(--mono); }
code.inline, .prose code, .legal code {
  font-size: .86em;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: .05em .35em;
  white-space: nowrap;
}
pre.block {
  margin: 0 0 1.25rem;
  padding: .9rem 1rem;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: var(--r);
  font-size: .85rem;
  line-height: 1.7;
  overflow-x: auto;
}
pre.block code { background: none; border: 0; padding: 0; white-space: pre; }
table { width: 100%; border-collapse: collapse; font-size: .92rem; }
th, td { text-align: left; vertical-align: top; padding: .55rem .75rem; border-bottom: 1px solid var(--border); }
th { font-weight: 600; font-size: .8rem; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; background: var(--bg-sunk); }
tbody tr:last-child td { border-bottom: 0; }
.table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--r); margin: 0 0 1.5rem; background: var(--surface); }
.table-wrap td code { white-space: nowrap; }

:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 2px; }
::selection { background: var(--accent-soft); }

.visually-hidden {
  position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
.skip-link {
  position: absolute; left: 1rem; top: -100px; z-index: 100;
  background: var(--text); color: var(--bg); padding: .5rem .75rem; border-radius: var(--r);
}
.skip-link:focus { top: .75rem; color: var(--bg); }

.wrap {
  max-width: var(--wrap); margin: 0 auto;
  padding: 0 max(1.25rem, env(safe-area-inset-right)) 0 max(1.25rem, env(safe-area-inset-left));
}
.muted { color: var(--muted); }
.faint { color: var(--faint); }

/* ── Buttons ────────────────────────────────────────────────────────── */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: .4rem;
  min-height: 44px; padding: .45rem 1rem;
  font: 500 .92rem/1.2 var(--sans);
  color: var(--accent-ink); background: var(--accent);
  border: 1px solid var(--accent); border-radius: var(--r);
  text-decoration: none; cursor: pointer; white-space: nowrap;
}
.btn:hover { background: var(--accent-hover); border-color: var(--accent-hover); color: var(--accent-ink); }
.btn.ghost { background: transparent; color: var(--text); border-color: var(--border-strong); }
.btn.ghost:hover { background: var(--bg-sunk); color: var(--text); border-color: var(--border-strong); }
.btn.sm { min-height: 40px; padding: .3rem .75rem; font-size: .85rem; }
.btn.block { display: flex; width: 100%; }
.btn-row { display: flex; flex-wrap: wrap; gap: .6rem; align-items: center; }
.text-link { font-weight: 500; text-decoration: none; }
.text-link:hover { text-decoration: underline; }

.icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 44px; height: 44px; padding: 0;
  background: transparent; color: var(--muted);
  border: 1px solid transparent; border-radius: var(--r);
  cursor: pointer; font-size: 1.1rem;
}
.site-search-trigger { width: auto; gap: .45rem; padding: 0 .55rem; border-color: var(--border); }
.site-search-trigger kbd { font-size: .7rem; }
.icon-btn:hover { color: var(--text); border-color: var(--border); background: var(--bg-sunk); }

.tag {
  display: inline-block;
  font: 500 .72rem/1.5 var(--mono);
  color: var(--muted);
  border: 1px solid var(--border-strong);
  border-radius: 3px;
  padding: 0 .35rem;
  white-space: nowrap;
}
.tag.warn { color: var(--warn); border-color: currentColor; }
.tag.danger { color: var(--danger); border-color: currentColor; }

/* ── Header ─────────────────────────────────────────────────────────── */
.nav {
  position: sticky; top: 0; z-index: 50;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  padding-top: env(safe-area-inset-top);
}
.nav-inner { display: flex; align-items: center; gap: 1.5rem; height: var(--nav-h); }
.brand { display: inline-flex; align-items: center; gap: .5rem; min-height: 44px; color: var(--text); text-decoration: none; font-weight: 600; font-size: 1rem; }
.brand:hover { color: var(--text); }
.brand-mark {
  display: inline-grid; place-items: center;
  width: 24px; height: 24px; border-radius: 3px;
  background: var(--text); color: var(--bg);
  font: 600 .8rem/1 var(--mono);
}
.nav-links { display: flex; gap: .25rem; list-style: none; margin: 0; padding: 0; }
.nav-links li + li { margin-top: 0; }
.nav-link {
  display: inline-flex; align-items: center; min-height: 44px;
  padding: 0 .6rem; color: var(--muted); text-decoration: none; font-size: .92rem;
  border-radius: var(--r);
}
.nav-link:hover { color: var(--text); }
.nav-link[aria-current="page"] { color: var(--text); font-weight: 500; box-shadow: inset 0 -2px 0 var(--accent); border-radius: 0; }
.nav-mobile-cta { display: none; }
.nav-actions { display: flex; align-items: center; gap: .25rem; margin-left: auto; }
.nav-actions .btn { margin-left: .5rem; }
.nav-toggle { display: none; }
.theme-toggle .icon-moon { display: none; }
[data-theme="dark"] .theme-toggle .icon-sun { display: none; }
[data-theme="dark"] .theme-toggle .icon-moon { display: block; }

@media (max-width: 860px) {
  .nav-toggle { display: inline-flex; }
  .site-search-trigger { width: 44px; padding: 0; border-color: transparent; }
  .site-search-trigger kbd { display: none; }
  .nav-actions .btn { display: none; }
  .nav-links {
    display: none;
    position: absolute; left: 0; right: 0; top: 100%;
    flex-direction: column; gap: 0;
    background: var(--bg); border-bottom: 1px solid var(--border);
    padding: .5rem max(1.25rem, env(safe-area-inset-right)) calc(1rem + env(safe-area-inset-bottom)) max(1.25rem, env(safe-area-inset-left));
    max-height: calc(100vh - var(--nav-h)); max-height: calc(100dvh - var(--nav-h) - env(safe-area-inset-top));
    overflow-y: auto; overscroll-behavior: contain;
  }
  .nav-links.open { display: flex; }
  .nav-link { width: 100%; min-height: 44px; border-bottom: 1px solid var(--border); border-radius: 0; }
  .nav-link[aria-current="page"] { box-shadow: inset 2px 0 0 var(--accent); padding-left: .8rem; }
  .nav-mobile-cta { display: block; margin-top: .75rem; }
}

/* ── Search dialog ──────────────────────────────────────────────────── */
.site-search[hidden] { display: none; }
.site-search { position: fixed; inset: 0; z-index: 90; display: flex; justify-content: center; align-items: flex-start; padding: 10vh 1rem 1rem; }
.site-search-backdrop { position: absolute; inset: 0; background: rgba(20, 20, 18, .45); }
.site-search-panel {
  position: relative; width: 100%; max-width: 580px;
  background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--r-lg);
  padding: 1rem;
}
.site-search-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: .5rem; }
.site-search-head label { font-weight: 600; font-size: .9rem; }
.site-search-input-wrap {
  display: flex; align-items: center; gap: .5rem;
  border: 1px solid var(--border-strong); border-radius: var(--r);
  padding: 0 .65rem; color: var(--faint); background: var(--bg);
}
.site-search-input-wrap:focus-within { border-color: var(--accent); }
.site-search-input-wrap input {
  flex: 1; min-width: 0; min-height: 44px; border: 0; outline: 0; background: transparent;
  color: var(--text); font: 400 1rem var(--sans);
}
.site-search-help { font-size: .8rem; color: var(--faint); margin: .5rem 0; }
.site-search-results { display: flex; flex-direction: column; max-height: 50vh; overflow-y: auto; }
.site-search-result {
  display: flex; gap: .75rem; align-items: baseline;
  padding: .55rem .5rem; border-radius: var(--r);
  color: var(--text); text-decoration: none; border-bottom: 1px solid var(--border);
}
.site-search-result:hover, .site-search-result:focus-visible { background: var(--bg-sunk); color: var(--text); }
.site-search-result-icon { font-family: var(--mono); color: var(--accent); width: 1rem; flex-shrink: 0; }
.site-search-result-copy { display: flex; flex-direction: column; min-width: 0; }
.site-search-result-copy strong { font-weight: 500; font-family: var(--mono); font-size: .9rem; }
.site-search-result-copy small { color: var(--muted); font-size: .82rem; }
.site-search-empty { color: var(--muted); font-size: .9rem; padding: .5rem; margin: 0; }

/* ── Toast ──────────────────────────────────────────────────────────── */
#toast-container { position: fixed; right: max(1rem, env(safe-area-inset-right)); bottom: max(1rem, env(safe-area-inset-bottom)); z-index: 95; display: flex; flex-direction: column; gap: .5rem; pointer-events: none; }
.toast {
  background: var(--text); color: var(--bg);
  font: 400 .85rem/1.4 var(--sans);
  padding: .5rem .8rem; border-radius: var(--r);
  max-width: min(320px, calc(100vw - 2rem));
}

/* ── Page furniture ─────────────────────────────────────────────────── */
main { display: block; min-height: 60vh; }
.page-head { padding: 2.5rem 0 1.75rem; border-bottom: 1px solid var(--border); margin-bottom: 2rem; }
.page-head h1 { margin-bottom: .35rem; }
.page-head .lead { margin-bottom: 0; }
.breadcrumbs { font-size: .82rem; color: var(--faint); padding-top: 1.5rem; }
.breadcrumbs a { color: var(--faint); }
.breadcrumbs .sep { margin: 0 .4rem; }
.breadcrumbs + .page-head { padding-top: 1rem; }
.eyebrow { display: block; font: 500 .78rem/1.4 var(--mono); color: var(--faint); margin-bottom: .5rem; }
.lead { font-size: 1.08rem; color: var(--text-2); max-width: 62ch; }
.section { padding: 3rem 0; border-top: 1px solid var(--border); }
.section:first-child { border-top: 0; }
.section-head { display: grid; grid-template-columns: minmax(0, 1fr); gap: .25rem; margin-bottom: 1.5rem; max-width: 68ch; }
.section-head h2 { margin: 0; }
.section-head p { margin: 0; color: var(--muted); }
.callout {
  border: 1px solid var(--border); border-left: 3px solid var(--accent);
  background: var(--surface); border-radius: var(--r);
  padding: .75rem 1rem; margin: 0 0 1.25rem; font-size: .93rem;
}
.callout.warn { border-left-color: var(--warn); }
.callout p:last-child { margin-bottom: 0; }

/* ── Discord mock ───────────────────────────────────────────────────── */
.dc {
  background: var(--dc-bg); color: var(--dc-text);
  border-radius: var(--r-lg); border: 1px solid #1f2023;
  font-size: .9rem; line-height: 1.45; overflow: hidden;
}
.dc-bar {
  display: flex; align-items: center; gap: .4rem;
  padding: .55rem .9rem; border-bottom: 1px solid #26272b;
  color: var(--dc-muted); font: 500 .8rem/1.2 var(--sans);
}
.dc-bar b { color: var(--dc-text); font-weight: 600; }
.dc-body { padding: .9rem; display: flex; flex-direction: column; gap: .9rem; }
.dc-msg { display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: .65rem; }
.dc-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  display: grid; place-items: center;
  font: 600 .85rem/1 var(--sans); color: #fff; background: #4e5058;
}
.dc-avatar.bot { background: #17695a; }
.dc-name { font-weight: 600; color: #f2f3f5; font-size: .9rem; }
.dc-name small { color: var(--dc-muted); font-weight: 400; font-size: .72rem; margin-left: .35rem; }
.dc-tag {
  display: inline-block; vertical-align: 1px;
  background: var(--dc-blurple); color: #fff;
  font: 600 .62rem/1.4 var(--sans); padding: 0 .3rem; border-radius: 3px; margin-left: .3rem;
}
.dc-used { color: var(--dc-muted); font-size: .8rem; margin-bottom: .2rem; }
.dc-used code { color: #c9cdfb; font-family: var(--mono); font-size: .78rem; }
.dc-embed {
  margin-top: .3rem; background: var(--dc-embed);
  border-left: 4px solid #3ba55c; border-radius: 4px;
  padding: .6rem .8rem; max-width: 460px;
}
.dc-embed.yellow { border-left-color: #faa61a; }
.dc-embed-title { font-weight: 600; color: #f2f3f5; margin-bottom: .3rem; }
.dc-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: .35rem .9rem; }
.dc-field { font-size: .82rem; min-width: 0; }
.dc-reason { margin-top: .35rem; }
.dc-field b { display: block; color: #f2f3f5; font-weight: 600; font-size: .78rem; }
.dc-input {
  display: flex; flex-wrap: wrap; align-items: center; gap: .35rem;
  margin: 0 .9rem .9rem; padding: .55rem .7rem;
  background: var(--dc-input); border-radius: 6px;
  font-family: var(--mono); font-size: .82rem;
}
.dc-cmd { color: #f2f3f5; font-weight: 500; }
.dc-opt { display: inline-flex; border-radius: 3px; overflow: hidden; background: #2b2d31; }
.dc-opt .k { padding: 0 .35rem; color: var(--dc-muted); background: #232428; }
.dc-opt .v { padding: 0 .4rem; color: #dbdee1; }

/* ── Home ───────────────────────────────────────────────────────────── */
.hero { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 3rem; align-items: start; padding: 3.5rem 0 3rem; }
.hero h1 { font-size: clamp(2rem, 1.5rem + 2.2vw, 2.9rem); max-width: 18ch; margin-bottom: 1rem; }
.hero .lead { margin-bottom: 1.5rem; }
.hero-meta { display: flex; flex-wrap: wrap; gap: .4rem 1rem; font: 400 .82rem/1.4 var(--mono); color: var(--faint); margin-bottom: 1.25rem; }
.hero-meta span { display: inline-flex; align-items: center; gap: .4rem; }
.hero-aside { display: flex; flex-direction: column; gap: .6rem; }
.hero-caption { font-size: .8rem; color: var(--faint); margin: 0; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--ok); flex-shrink: 0; }
.dot.warn { background: var(--warn); }
.dot.danger { background: var(--danger); }

.ref { border-top: 1px solid var(--border); }
.ref-row {
  display: grid; grid-template-columns: 11rem minmax(0, 1fr) minmax(0, 17rem);
  gap: 1.25rem; padding: 1rem 0; border-bottom: 1px solid var(--border); align-items: baseline;
}
.ref-row h3 { font-size: 1rem; margin: 0; }
.ref-row h3 a { color: var(--text); text-decoration: none; }
.ref-row h3 a:hover { color: var(--accent); text-decoration: underline; }
.ref-row p { margin: 0; color: var(--text-2); font-size: .95rem; }
.ref-cmd { font: 400 .82rem/1.5 var(--mono); color: var(--muted); }
.ref-cmd code { color: var(--text); }

.steps { list-style: none; padding: 0; margin: 0; counter-reset: step; display: grid; gap: 0; border-top: 1px solid var(--border); }
.steps li { counter-increment: step; display: grid; grid-template-columns: 2.25rem minmax(0, 1fr); gap: .5rem 1rem; padding: 1rem 0; border-bottom: 1px solid var(--border); margin: 0; }
.steps li::before { content: counter(step); font: 500 .9rem/1.6 var(--mono); color: var(--accent); }
.steps h3 { font-size: 1rem; margin: 0 0 .2rem; }
.steps p { margin: 0 0 .4rem; color: var(--text-2); font-size: .95rem; }
.steps pre.block { margin: .35rem 0 0; }

.two-col { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 2.5rem; }
.notes { list-style: none; padding: 0; margin: 0; }
.notes li { padding: .7rem 0; border-bottom: 1px solid var(--border); margin: 0; font-size: .95rem; color: var(--text-2); }
.notes li strong { color: var(--text); font-weight: 600; }

.accordion { border-top: 1px solid var(--border); }
.acc { border-bottom: 1px solid var(--border); }
.acc summary {
  cursor: pointer; list-style: none; padding: .85rem 0; font-weight: 500;
  display: flex; justify-content: space-between; gap: 1rem; min-height: 44px; align-items: center;
}
.acc summary::-webkit-details-marker { display: none; }
.acc summary::after { content: "+"; font-family: var(--mono); color: var(--faint); }
.acc[open] summary::after { content: "\2212"; }
.acc-body { padding: 0 0 1rem; color: var(--text-2); font-size: .95rem; max-width: 70ch; }
.acc-body p:last-child { margin-bottom: 0; }

.end-note { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem; padding: 1.5rem 0; }
.end-note p { margin: 0; color: var(--text-2); }

/* ── Two-pane pages (features, docs) ────────────────────────────────── */
.split { display: grid; grid-template-columns: 13rem minmax(0, 1fr); gap: 3rem; align-items: start; padding-bottom: 3rem; }
.toc { position: sticky; top: calc(var(--nav-h) + 1.5rem); font-size: .88rem; max-height: calc(100vh - var(--nav-h) - 3rem); overflow-y: auto; }
.side-title { font: 500 .75rem/1.4 var(--mono); color: var(--faint); text-transform: uppercase; letter-spacing: .05em; margin: 0 0 .5rem; }
.toc ul { list-style: none; padding: 0; margin: 0 0 1.5rem; border-left: 1px solid var(--border); }
.toc li { margin: 0; }
.toc a { display: block; padding: .25rem 0 .25rem .75rem; margin-left: -1px; color: var(--muted); text-decoration: none; border-left: 1px solid transparent; }
.toc a:hover { color: var(--text); }
.toc a.active { color: var(--text); border-left-color: var(--accent); font-weight: 500; }
.toc-mobile { display: none; border: 1px solid var(--border); border-radius: var(--r); margin-bottom: 1.5rem; background: var(--surface); }
.toc-mobile summary { cursor: pointer; padding: .6rem .8rem; font-weight: 500; font-size: .92rem; min-height: 44px; display: flex; align-items: center; }
.toc-mobile ul { list-style: none; margin: 0; padding: 0 .8rem .6rem; columns: 2; column-gap: 1rem; }
.toc-mobile li { margin: 0; }
.toc-mobile a { display: block; padding: .35rem 0; font-size: .9rem; }

.feature { padding: 0 0 2.5rem; margin-bottom: 2.5rem; border-bottom: 1px solid var(--border); }
.feature:last-child { border-bottom: 0; margin-bottom: 0; }
.feature h2 { margin-bottom: .4rem; }
.feature > p { color: var(--text-2); max-width: 68ch; }
.feature ul { max-width: 68ch; color: var(--text-2); }
.feature-cmds { display: grid; gap: 0; margin: 1rem 0; border: 1px solid var(--border); border-radius: var(--r); background: var(--surface); }
.feature-cmds div { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1rem; padding: .5rem .8rem; border-bottom: 1px solid var(--border); font-size: .9rem; }
.feature-cmds div:last-child { border-bottom: 0; }
.feature-cmds code { font-family: var(--mono); font-size: .84rem; color: var(--text); overflow-wrap: anywhere; }
.feature-cmds span { color: var(--muted); }
.feature-links { font-size: .9rem; }

.prose { max-width: 72ch; }
.prose h2 { margin-top: 2.75rem; padding-top: 1.75rem; border-top: 1px solid var(--border); }
.prose h2:first-child { margin-top: 0; padding-top: 0; border-top: 0; }
.prose h3 { margin-top: 1.75rem; }
.prose p, .prose li { color: var(--text-2); }
.prose .table-wrap { max-width: none; }

/* ── Commands ───────────────────────────────────────────────────────── */
.cmd-toolbar { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; margin-bottom: .75rem; }
.search {
  position: relative; flex: 1 1 320px; display: flex; align-items: center;
  border: 1px solid var(--border-strong); border-radius: var(--r); background: var(--surface);
}
.search:focus-within { border-color: var(--accent); }
.search .icon { position: absolute; left: .7rem; color: var(--faint); display: flex; }
.search input {
  flex: 1; min-width: 0; min-height: 44px; padding: 0 2.5rem 0 2.25rem;
  border: 0; outline: 0; background: transparent; color: var(--text); font: 400 .95rem var(--sans);
}
.search .hint { position: absolute; right: .6rem; }
.cmd-count { font: 400 .85rem var(--mono); color: var(--faint); }
.tabs { display: flex; flex-wrap: wrap; gap: .35rem; margin-bottom: 2rem; }
.tab {
  min-height: 44px; padding: .25rem .75rem;
  font: 400 .85rem var(--sans); color: var(--muted);
  background: transparent; border: 1px solid var(--border); border-radius: var(--r); cursor: pointer;
}
.tab:hover { color: var(--text); border-color: var(--border-strong); }
.tab[aria-pressed="true"] { color: var(--accent-ink); background: var(--accent); border-color: var(--accent); }
.tab .n { font-family: var(--mono); font-size: .78rem; opacity: .75; margin-left: .2rem; }
.empty-state { border: 1px dashed var(--border-strong); border-radius: var(--r); padding: 1.25rem; color: var(--muted); margin-bottom: 2rem; }
.empty-state[hidden] { display: none; }
.empty-state strong { display: block; color: var(--text); }

.cmd-group { margin-bottom: 2.5rem; }
.cmd-group[hidden] { display: none; }
.cmd-group-head { display: flex; align-items: baseline; gap: .75rem; flex-wrap: wrap; padding-bottom: .5rem; border-bottom: 1px solid var(--border-strong); }
.cmd-group-head h2 { font-size: 1.15rem; margin: 0; }
.cmd-group-head .blurb { color: var(--muted); font-size: .9rem; }
.cmd-group-head .n { margin-left: auto; font: 400 .8rem var(--mono); color: var(--faint); }

.cmd-card { border-bottom: 1px solid var(--border); }
.cmd-card[hidden] { display: none; }
.cmd-card > summary {
  list-style: none; cursor: pointer;
  display: grid; grid-template-columns: 1.25rem minmax(9rem, max-content) minmax(0, 1fr) auto 1rem;
  gap: .75rem; align-items: baseline; padding: .7rem 0; min-height: 44px;
}
.cmd-card > summary::-webkit-details-marker { display: none; }
.cmd-card > summary:hover .cmd-slash { color: var(--accent); }
.cmd-anchor { color: var(--faint); text-decoration: none; font-family: var(--mono); font-size: .85rem; opacity: .6; }
.cmd-anchor:hover { opacity: 1; color: var(--accent); }
.cmd-slash { font: 500 .95rem var(--mono); color: var(--text); }
.cmd-summary-text { min-width: 0; }
.cmd-desc { color: var(--text-2); font-size: .92rem; }
.cmd-meta { display: flex; gap: .3rem; flex-wrap: wrap; justify-content: flex-end; }
.cmd-chevron { font-family: var(--mono); color: var(--faint); }
.cmd-chevron::before { content: "+"; }
.cmd-card[open] .cmd-chevron::before { content: "\2212"; }
.cmd-card.flash > summary { background: var(--accent-soft); }
.cmd-body { padding: .25rem 0 1.25rem 2rem; display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; }
.cmd-body > * { min-width: 0; }
.cmd-run { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
.copy-btn {
  display: inline-flex; align-items: center; min-height: 44px; padding: 0 .75rem;
  font: 400 .8rem var(--sans); color: var(--muted); text-decoration: none;
  background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--r); cursor: pointer;
}
.copy-btn:hover { color: var(--text); }
.copy-btn.copied { color: var(--ok); border-color: var(--ok); }
.cmd-section-title { font: 500 .75rem/1.4 var(--mono); color: var(--faint); text-transform: uppercase; letter-spacing: .05em; margin-bottom: .4rem; }
.synopsis {
  margin: 0; padding: .6rem .8rem; background: var(--code-bg); border: 1px solid var(--border); border-radius: var(--r);
  font: 400 .84rem/1.75 var(--mono); overflow-x: auto; white-space: pre;
}
.synopsis .opt { color: var(--faint); }
.opt-table td:first-child code { font-family: var(--mono); font-size: .84rem; }
.opt-req { font: 500 .78rem var(--mono); color: var(--warn); }
.opt-opt { font: 400 .78rem var(--mono); color: var(--faint); }
.cmd-perms { font-size: .9rem; color: var(--text-2); margin: 0; }

/* ── Help page ──────────────────────────────────────────────────────── */
.help-search { max-width: 560px; margin-bottom: 2rem; }
.issue-group { margin-bottom: 2.25rem; }
.issue-group[hidden] { display: none; }
.issue-group h2 { font-size: 1.15rem; padding-bottom: .5rem; border-bottom: 1px solid var(--border-strong); margin-bottom: 0; }
.issue { border-bottom: 1px solid var(--border); }
.issue[hidden] { display: none; }
.issue summary { cursor: pointer; list-style: none; padding: .8rem 0; font-weight: 500; display: flex; justify-content: space-between; gap: 1rem; min-height: 44px; align-items: center; }
.issue summary::-webkit-details-marker { display: none; }
.issue summary::after { content: "+"; font-family: var(--mono); color: var(--faint); }
.issue[open] summary::after { content: "\2212"; }
.issue-body { padding: 0 0 1rem; color: var(--text-2); font-size: .95rem; max-width: 72ch; }
.issue-body ol { margin-bottom: 0; }
.hierarchy { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin: 0 0 1.25rem; }
.hierarchy > div { padding: .75rem 1rem; border: 1px solid var(--border); border-radius: var(--r); background: var(--surface); font-size: .92rem; }
.hierarchy ol { margin: 0; padding-left: 1.25rem; }
.hierarchy .bad { border-left: 3px solid var(--danger); }
.hierarchy .good { border-left: 3px solid var(--ok); }
.hierarchy-label { display: block; font: 500 .75rem var(--mono); text-transform: uppercase; letter-spacing: .05em; margin: 0 0 .35rem; color: var(--faint); }

/* ── Changelog ──────────────────────────────────────────────────────── */
.release { display: grid; grid-template-columns: 9rem minmax(0, 1fr); gap: 1.5rem; padding: 1.75rem 0; border-bottom: 1px solid var(--border); scroll-margin-top: 5rem; }
.release-meta { font-family: var(--mono); font-size: .85rem; color: var(--faint); padding-top: .2rem; }
.release-meta time, .release-pending { display: block; }
.release-pending { color: var(--warn); }
.release-diff { display: inline-block; margin-top: .35rem; color: var(--text-2); }
.release-title { font-size: 1.3rem; margin: 0 0 .5rem; font-family: var(--mono); }
.release-title a { color: var(--text); text-decoration: none; }
.release-title a:hover { color: var(--accent); text-decoration: underline; }
.release h3 { font-size: .8rem; margin: 1.1rem 0 .35rem; text-transform: uppercase; letter-spacing: .06em; color: var(--text-2); }
.release-summary { color: var(--text-2); margin-bottom: .75rem; max-width: 72ch; }
.changes { padding-left: 1.1rem; margin: 0; max-width: 76ch; }
.changes li { padding: .2rem 0; margin: 0; font-size: .93rem; color: var(--text-2); }
.changes li strong { color: var(--text); font-weight: 600; }
.changes li ul { padding-left: 1.1rem; margin: .2rem 0 0; list-style: circle; }
.changes li li { padding: .1rem 0; }

/* ── Status ─────────────────────────────────────────────────────────── */
.status-line {
  display: flex; flex-wrap: wrap; align-items: center; gap: .75rem 1.25rem;
  padding: 1rem 1.1rem; margin-bottom: 2rem;
  border: 1px solid var(--border); border-left: 3px solid var(--ok);
  border-radius: var(--r); background: var(--surface);
}
.status-line.bad { border-left-color: var(--danger); }
.status-line h2 { font-size: 1.15rem; margin: 0; }
.status-line p { margin: 0; color: var(--muted); font-size: .92rem; flex: 1 1 260px; }
.status-line .btn { margin-left: auto; }
.metrics td:nth-child(2) { font-family: var(--mono); white-space: nowrap; }
.metrics td:first-child { font-weight: 500; white-space: nowrap; }
.metrics td.good { color: var(--ok); }
.metrics td.warn { color: var(--warn); }
.metrics tr.current td { background: var(--accent-soft); }
.endpoints td:first-child { white-space: nowrap; }

/* ── Legal ──────────────────────────────────────────────────────────── */
.legal { max-width: 72ch; padding-bottom: 3rem; }
.legal h2 { font-size: 1.15rem; margin-top: 2rem; }
.legal h3 { font-size: 1rem; margin-top: 1.25rem; }
.legal p, .legal li { color: var(--text-2); }
.legal h2[id], .legal h3[id] { scroll-margin-top: 5rem; }
.legal table { width: 100%; }
.legal-meta { display: flex; flex-wrap: wrap; gap: .25rem 1rem; }
.at-a-glance { border: 1px solid var(--border); border-radius: var(--r); padding: 1rem 1.25rem; background: var(--bg-sunk); margin: 1rem 0 0; max-width: 72ch; }
.at-a-glance h2 { font-size: 1rem; margin: 0 0 .5rem; }
.at-a-glance ul { margin: 0; padding-left: 1.2rem; }
.at-a-glance li { color: var(--text-2); }
/* 404 suggestions and search */
.suggest { margin: 1rem 0 1.5rem; }
.suggest a { font-weight: 500; }
.notfound-search { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; max-width: 36rem; margin: 1rem 0 1.5rem; }
.notfound-search input { flex: 1 1 14rem; min-width: 0; min-height: 44px; padding: .5rem .75rem; border: 1px solid var(--border-strong); border-radius: var(--r); background: var(--bg); color: var(--text); font: inherit; }
@media (max-width: 860px), (pointer: coarse) { .notfound-search input { font-size: 16px; } }

/* ── Footer ─────────────────────────────────────────────────────────── */
footer.site { border-top: 1px solid var(--border); margin-top: 3rem; padding: 2.5rem 0 calc(1.5rem + env(safe-area-inset-bottom)); font-size: .88rem; background: var(--bg-sunk); }
.footer-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) repeat(3, minmax(0, 1fr)); gap: 2rem; }
.footer-brand p { color: var(--muted); max-width: 36ch; margin-top: .6rem; }
.footer-meta a { color: var(--text-2); }
.footer-title { font: 500 .75rem/1.4 var(--mono); color: var(--faint); text-transform: uppercase; letter-spacing: .05em; margin-bottom: .6rem; }
.footer-col ul { list-style: none; padding: 0; margin: 0; }
.footer-col li { margin: 0; }
.footer-col a { display: inline-block; padding: .2rem 0; color: var(--text-2); text-decoration: none; }
.footer-col a:hover { color: var(--accent); text-decoration: underline; }
.footer-bottom { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 1rem; margin-top: 2rem; padding-top: 1.25rem; border-top: 1px solid var(--border); color: var(--faint); font-size: .82rem; }
.footer-bottom nav { display: flex; flex-wrap: wrap; gap: 1rem; }
.footer-bottom a { color: var(--faint); }

/* Touch screens: give list links a 44px target. */
@media (pointer: coarse) {
  .toc a, .toc-mobile a { display: flex; align-items: center; min-height: 44px; padding-top: .25rem; padding-bottom: .25rem; }
  .footer-col a, .footer-bottom a, .footer-meta a, .breadcrumbs a, .suggest a, .text-link, .ref-row h3 a, .case-link, .release-title a, .release-diff {
    display: inline-flex; align-items: center; min-height: 44px;
  }
  .footer-col a { padding: 0; }
  .footer-bottom a { min-width: 44px; justify-content: center; }
  .cmd-anchor { display: inline-flex; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; }
  .btn.sm { min-height: 44px; }
}


/* ── Dashboard ──────────────────────────────────────────────────────── */
.dash-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; padding: 1rem 0; border-bottom: 1px solid var(--border); font-size: .9rem; color: var(--muted); }
.dash-bar form { margin: 0; }
.dash-bar > span { min-width: 0; overflow-wrap: anywhere; }
.dash-action { margin: 0 0 2rem; }
.section-title { margin-top: 2.5rem; }
.dash-nav { display: flex; flex-wrap: wrap; gap: .35rem; margin: 0 0 2rem; padding: 0; list-style: none; }
.dash-nav li { margin: 0; }
.dash-nav a {
  display: inline-flex; align-items: center; min-height: 44px; padding: .25rem .9rem;
  font-size: .9rem; color: var(--text-2); text-decoration: none;
  border: 1px solid var(--border); border-radius: var(--r); background: var(--surface);
}
.dash-nav a:hover { border-color: var(--border-strong); color: var(--text); }
.dash-nav a[aria-current="page"] { color: var(--accent-ink); background: var(--accent); border-color: var(--accent); }
.guild-list { list-style: none; padding: 0; margin: 0 0 2rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(16rem, 100%), 1fr)); gap: .75rem; }
.guild-list li { margin: 0; }
.guild-item {
  display: flex; align-items: center; justify-content: space-between; gap: .75rem; min-height: 56px;
  padding: .7rem 1rem; border: 1px solid var(--border); border-radius: var(--r); background: var(--surface);
  color: var(--text); text-decoration: none;
}
a.guild-item:hover { border-color: var(--accent); color: var(--text); }
.guild-item .name { font-weight: 500; overflow-wrap: anywhere; }
.stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(11rem, 100%), 1fr)); gap: .75rem; margin: 0 0 2rem; padding: 0; }
.stat { border: 1px solid var(--border); border-radius: var(--r); background: var(--surface); padding: .8rem 1rem; margin: 0; }
.stat dt { font-size: .82rem; color: var(--muted); }
.stat dd { margin: .15rem 0 0; font: 600 1.5rem/1.2 var(--mono); color: var(--text); }
.stat dd small { font: 400 .8rem var(--sans); color: var(--faint); }
.dash-form { max-width: 44rem; margin: 0 0 2.5rem; }
.dash-form fieldset { min-width: 0; border: 1px solid var(--border); border-radius: var(--r); background: var(--surface); padding: 1rem 1.1rem .25rem; margin: 0 0 1.25rem; }
.dash-form legend { font-weight: 600; padding: 0 .35rem; }
.field { margin: 0 0 1rem; }
.field > label { display: block; font-weight: 500; margin-bottom: .3rem; }
.field input[type="text"], .field input[type="number"], .field select, .field textarea, .filter-bar input, .filter-bar select {
  width: 100%; min-height: 44px; padding: .45rem .65rem;
  font: 400 .95rem var(--sans); color: var(--text); background: var(--bg);
  border: 1px solid var(--border-strong); border-radius: var(--r);
}
.field textarea { min-height: 7rem; resize: vertical; font-family: var(--mono); font-size: .88rem; line-height: 1.5; }
.field input:focus, .field select:focus, .field textarea:focus, .filter-bar input:focus, .filter-bar select:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
.field [aria-invalid="true"] { border-color: var(--danger); }
.field-help { display: block; font-size: .85rem; color: var(--muted); margin-top: .3rem; }
.field-error { display: block; font-size: .87rem; color: var(--danger); margin-top: .3rem; font-weight: 500; }
.check { display: flex; align-items: flex-start; gap: .6rem; min-height: 44px; padding: .55rem 0; margin: 0 0 .5rem; cursor: pointer; }
.check input { width: 1.2rem; height: 1.2rem; margin: .15rem 0 0; flex-shrink: 0; accent-color: var(--accent); }
.check span small { display: block; color: var(--muted); font-size: .85rem; }
.field-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .75rem; }
.error-summary { border: 1px solid var(--danger); border-left-width: 3px; border-radius: var(--r); background: var(--surface); padding: .75rem 1rem; margin: 0 0 1.5rem; }
.error-summary h2 { font-size: 1rem; margin: 0 0 .4rem; color: var(--danger); }
.error-summary ul { margin: 0; }
.notice { border: 1px solid var(--border); border-left: 3px solid var(--ok); border-radius: var(--r); background: var(--surface); padding: .75rem 1rem; margin: 0 0 1.5rem; }
.notice.bad { border-left-color: var(--danger); }
.notice p { margin: 0; }
.filter-bar { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(11rem, 100%), 1fr)); gap: .75rem; align-items: end; margin: 0 0 1.5rem; }
.filter-bar label { display: block; font-size: .85rem; font-weight: 500; margin-bottom: .25rem; }
.pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; margin: 0 0 2rem; font-size: .9rem; color: var(--muted); }
.case-table td { overflow-wrap: anywhere; }
.case-table td:first-child { white-space: nowrap; }
.preview { border: 1px solid var(--border); border-radius: var(--r); background: var(--bg-sunk); padding: .75rem 1rem; margin: 0 0 1rem; white-space: pre-wrap; overflow-wrap: anywhere; font-size: .93rem; }
.detail-list { display: grid; grid-template-columns: 10rem minmax(0, 1fr); gap: .5rem 1rem; margin: 0 0 2rem; }
.detail-list dt { color: var(--muted); font-size: .9rem; }
.detail-list dd { margin: 0; overflow-wrap: anywhere; }
.btn.danger { background: var(--danger); border-color: var(--danger); color: #fff; }
.btn.danger:hover { background: var(--danger); border-color: var(--danger); color: #fff; filter: brightness(.92); }
.tag.ok { color: var(--ok); border-color: currentColor; }
.prewrap { white-space: pre-wrap; }
.pick-list .pick-scroll { max-height: 18rem; overflow-y: auto; margin: 0 -.35rem .75rem; padding: 0 .35rem; }
.pick-group { margin: 0 0 .5rem; }
.pick-group-title { font-size: .78rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; margin: .5rem 0 .1rem; }
.check.pick { margin: 0; padding: .3rem 0; overflow-wrap: anywhere; }
.check.pick span { min-width: 0; }
.panel-list { list-style: none; padding: 0; margin: 0 0 2.5rem; display: grid; gap: .75rem; max-width: 44rem; }
.panel-item { margin: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 20rem); gap: .75rem 1rem; align-items: end; padding: .85rem 1rem; border: 1px solid var(--border); border-radius: var(--r); background: var(--surface); }
.panel-meta { min-width: 0; overflow-wrap: anywhere; align-self: center; }
.panel-meta .faint { display: block; font-size: .87rem; }
.panel-repost { display: flex; align-items: flex-end; gap: .5rem; margin: 0; min-width: 0; }
.panel-repost .field { flex: 1 1 auto; min-width: 0; margin: 0; }
.panel-repost .field > label { font-size: .85rem; }
.review-buttons { margin-top: .5rem; }
@media (max-width: 640px) {
  .field-row { grid-template-columns: minmax(0, 1fr); gap: 0; }
  .detail-list { grid-template-columns: minmax(0, 1fr); gap: .1rem; }
  .detail-list dd { margin-bottom: .6rem; }
  .detail-list code.inline { white-space: normal; overflow-wrap: anywhere; }
  .dash-form fieldset { padding: .85rem .85rem .25rem; }
  .dash-form > .btn, .dash-action .btn { width: 100%; }
  .panel-item { grid-template-columns: minmax(0, 1fr); }
  .panel-repost { flex-direction: column; align-items: stretch; }
  .panel-repost .btn, .review-buttons .btn { width: 100%; }
  .review-buttons { flex-direction: column; }
  .filter-bar .btn-row .btn { flex: 1 1 0; }
  .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem; }
  .stat { padding: .65rem .8rem; }
  .stat dd small { display: block; margin-top: .15rem; }
  .pager { flex-direction: column; align-items: stretch; }
  .pager .btn-row .btn { flex: 1 1 0; }
  /* Case lists become one card per record; each cell is labelled from data-label. */
  .case-table, .case-table tbody, .case-table tr, .case-table td { display: block; width: 100%; }
  .case-table thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .case-table tr { padding: .6rem .85rem; border-bottom: 1px solid var(--border); }
  .case-table tbody tr:last-child { border-bottom: 0; }
  .case-table td, .case-table td:first-child { position: relative; padding: .2rem 0 .2rem 6.75rem; border: 0; white-space: normal; }
  .case-table td::before {
    content: attr(data-label); position: absolute; left: 0; top: .2rem; width: 6rem;
    font-size: .78rem; line-height: 1.6rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .04em;
  }
  .case-table td code.inline { white-space: normal; overflow-wrap: anywhere; }
}

/* ── Responsive ─────────────────────────────────────────────────────── */
@media (max-width: 960px) {
  .hero { grid-template-columns: minmax(0, 1fr); gap: 2rem; padding-top: 2.5rem; }
  .split { grid-template-columns: minmax(0, 1fr); gap: 0; }
  .toc { display: none; }
  .toc-mobile { display: block; }
  .ref-row { grid-template-columns: minmax(0, 1fr); gap: .3rem; }
  .two-col { grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }
  .footer-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .footer-brand { grid-column: 1 / -1; }
}
@media (max-width: 640px) {
  body { font-size: 15.5px; }
  .section { padding: 2.25rem 0; }
  .page-head { padding: 1.75rem 0 1.25rem; margin-bottom: 1.5rem; }
  .cmd-card > summary { grid-template-columns: minmax(0, 1fr) 1rem; gap: .2rem .5rem; }
  .cmd-anchor, .cmd-meta { display: none; }
  .cmd-slash { grid-column: 1; }
  .cmd-summary-text { grid-column: 1; grid-row: 2; }
  .cmd-chevron { grid-column: 2; grid-row: 1; }
  .cmd-body { padding-left: 0; }
  .release { grid-template-columns: minmax(0, 1fr); gap: .5rem; }
  .feature-cmds div { grid-template-columns: minmax(0, 1fr); gap: .1rem; }
  .toc-mobile ul { columns: 1; }
  .dc-embed { max-width: none; }
  .metrics td.faint { display: none; }
  .tabs { flex-wrap: nowrap; overflow-x: auto; margin-right: -1.25rem; padding-right: 1.25rem; padding-bottom: .25rem; }
  .tab { flex-shrink: 0; }
  .prose code, .legal code, .callout code.inline { white-space: normal; overflow-wrap: anywhere; }
  .table-wrap code { white-space: nowrap; }
}

/* Phones and touch screens: 16px form text, so iOS Safari does not zoom in on focus. */
@media (max-width: 860px), (pointer: coarse) {
  .search input, .site-search-input-wrap input,
  .field input[type="text"], .field input[type="number"], .field select, .field textarea,
  .filter-bar input, .filter-bar select { font-size: 16px; }
}

@media print {
  .nav, footer.site, .site-search, .toc, .toc-mobile { display: none !important; }
  body { background: #fff; color: #000; }
}
`;
