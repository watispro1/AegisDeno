/** Tokens, base element styles and buttons. */
export const cssBase = String.raw`
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

`;
