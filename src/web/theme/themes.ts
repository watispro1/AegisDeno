/**
 * Optional themes and the theme picker.
 *
 * - Steel & Ink: near-black ink, warm paper text, steel accent and stone
 *   secondary text, serif headings. Editorial, no saturated colour.
 * - Glass (beta): soft gradient background with frosted, translucent panels.
 *   The tokens below are solid; translucency and blur are only switched on
 *   where backdrop-filter is supported and the visitor has not asked for
 *   reduced transparency, so the fallback is always the solid palette.
 *
 * Light (:root) and Dark live in base.ts. tests/siteThemes.test.ts checks the
 * text and status tokens of every theme against WCAG AA.
 */

/** Token blocks; included right after cssBase so later files can read them. */
export const cssThemeTokens = String.raw`
[data-theme="steel"] {
  --bg: #0c0d0f;
  --bg-sunk: #111316;
  --surface: #15171a;
  --text: #f2f0ea;
  --text-2: #d8d6cf;
  --muted: #a9aba7;
  --faint: #8e908c;
  --border: #25282c;
  --border-strong: #3a3e43;
  --accent: #c5cdc8;
  --accent-hover: #e3e8e4;
  --accent-ink: #0c0d0f;
  --accent-soft: #1c201f;
  --link: #c5cdc8;
  --ok: #8cc59c;
  --warn: #d6ad6a;
  --danger: #e8938a;
  --code-bg: #1a1d20;
  --mark: #4a4334;
  --serif: "Iowan Old Style", Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif;
  color-scheme: dark;
}

[data-theme="glass"] {
  --bg: #e7eae8;
  --bg-sunk: #dde1df;
  --surface: #f7f8f6;
  --text: #16181a;
  --text-2: #2f3336;
  --muted: #4f5458;
  --faint: #585d61;
  --border: #cdd2d0;
  --border-strong: #b5bbb9;
  --accent: #245a63;
  --accent-hover: #1a454c;
  --accent-ink: #ffffff;
  --accent-soft: #d6e3e3;
  --link: #245a63;
  --ok: #1b6e3d;
  --warn: #8a5100;
  --danger: #a8231b;
  --code-bg: #eceeec;
  --mark: #f3e2a6;
  /* Gradient stops behind the glass. */
  --glass-a: #dfe6e4;
  --glass-b: #efece4;
  --glass-c: #d9dfdf;
  /* Frosted surface used when blur is available (white over the gradient). */
  --glass-surface: rgba(255, 255, 255, .6);
  --glass-edge: rgba(255, 255, 255, .75);
  color-scheme: light;
}
`;

/** Component overrides and the picker; included near the end so they win. */
export const cssThemeSurfaces = String.raw`
/* ── Brand mark: the shield, tinted with the theme's text colour ─────── */
@supports ((mask-image: none) or (-webkit-mask-image: none)) {
  .brand-mark {
    background: var(--text); color: transparent; font-size: 0; border-radius: 0;
    -webkit-mask: url("/assets/mark.svg") center / contain no-repeat;
    mask: url("/assets/mark.svg") center / contain no-repeat;
  }
}

/* ── Theme picker ─────────────────────────────────────────────────────── */
.theme-picker { position: relative; }
.theme-picker > summary { list-style: none; }
.theme-picker > summary::-webkit-details-marker { display: none; }
html:not(.js) .theme-picker { display: none; }
.theme-menu {
  position: absolute; right: 0; top: calc(100% + 6px); z-index: 60;
  display: grid; gap: 2px; min-width: 13rem; padding: .35rem;
  background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--r-lg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, .14);
}
.theme-menu-title { margin: .2rem .55rem .3rem; font: 500 .72rem/1.4 var(--mono); text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.theme-opt {
  display: flex; align-items: center; gap: .6rem; width: 100%; min-height: 44px;
  padding: .35rem .55rem; border: 0; border-radius: var(--r);
  font: 400 .9rem/1.2 var(--sans); color: var(--text-2); background: transparent;
  text-align: left; cursor: pointer;
}
.theme-opt:hover { background: var(--bg-sunk); color: var(--text); }
.theme-opt:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.theme-opt[aria-pressed="true"] { color: var(--text); font-weight: 500; }
.theme-opt[aria-pressed="true"]::after {
  content: ""; margin-left: auto; width: 9px; height: 5px;
  border-left: 2px solid var(--accent); border-bottom: 2px solid var(--accent);
  transform: translateY(-2px) rotate(-45deg);
}
.theme-swatch { flex: none; width: 18px; height: 18px; border-radius: 50%; border: 1px solid var(--border-strong); }
.theme-swatch[data-swatch="system"] { background: linear-gradient(135deg, #fbfaf8 50%, #161716 50%); }
.theme-swatch[data-swatch="light"] { background: #fbfaf8; }
.theme-swatch[data-swatch="dark"] { background: #161716; }
.theme-swatch[data-swatch="steel"] { background: linear-gradient(135deg, #0c0d0f 55%, #c5cdc8 55%); }
.theme-swatch[data-swatch="glass"] { background: linear-gradient(135deg, #ffffff, #c5cdc8 60%, #efece4); }
.theme-beta {
  margin-left: .1rem; padding: 0 .3rem; border: 1px solid var(--border-strong); border-radius: 3px;
  font: 600 .64rem/1.5 var(--mono); letter-spacing: .04em; text-transform: uppercase; color: var(--muted);
}
.user-theme-picker { flex-wrap: wrap; }

/* ── On-fill text: dark themes use ink on their light status fills ────── */
[data-theme="dark"] .btn.danger, [data-theme="dark"] .btn.danger:hover,
[data-theme="steel"] .btn.danger, [data-theme="steel"] .btn.danger:hover,
[data-theme="dark"] .opt-req, [data-theme="steel"] .opt-req,
[data-theme="dark"] .check-icon, [data-theme="steel"] .check-icon { color: var(--bg); }

/* ── Steel & Ink ──────────────────────────────────────────────────────── */
[data-theme="steel"] {
  --k-changed: #a9bcc9;
  --k-fixed: #c9b9a0;
}
[data-theme="steel"] h1, [data-theme="steel"] h2 { font-family: var(--serif); font-weight: 500; letter-spacing: -0.012em; }
[data-theme="steel"] .nav-link[aria-current="page"] { box-shadow: inset 0 -1px 0 var(--accent); }
[data-theme="steel"] ::selection { background: #c5cdc8; color: #0c0d0f; }

/* ── Glass (beta) ─────────────────────────────────────────────────────── */
[data-theme="glass"] {
  --k-changed: #2b5689;
  --k-fixed: #6a4a3a;
}
[data-theme="glass"] body {
  background-color: var(--bg);
  background-image:
    radial-gradient(60rem 40rem at 8% -10%, var(--glass-a), transparent 65%),
    radial-gradient(50rem 36rem at 105% 15%, var(--glass-b), transparent 60%),
    linear-gradient(180deg, var(--bg), var(--glass-c));
  background-attachment: fixed;
}
@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  [data-theme="glass"] {
    --surface: var(--glass-surface);
    --border: rgba(40, 52, 56, .13);
    --border-strong: rgba(40, 52, 56, .24);
  }
  [data-theme="glass"] .nav,
  [data-theme="glass"] .site-search-panel,
  [data-theme="glass"] .theme-menu,
  [data-theme="glass"] .user-panel,
  [data-theme="glass"] .switcher-list,
  [data-theme="glass"] .app-side,
  [data-theme="glass"] .card,
  [data-theme="glass"] .panel,
  [data-theme="glass"] .callout,
  [data-theme="glass"] .home-feature,
  [data-theme="glass"] .home-release,
  [data-theme="glass"] .help-ask,
  [data-theme="glass"] .feature-cmds,
  [data-theme="glass"] .cmd-facts,
  [data-theme="glass"] .component,
  [data-theme="glass"] .status-banner {
    -webkit-backdrop-filter: blur(16px) saturate(140%);
    backdrop-filter: blur(16px) saturate(140%);
    box-shadow: inset 0 1px 0 var(--glass-edge), 0 1px 2px rgba(20, 30, 34, .06);
  }
  [data-theme="glass"] .nav { background: rgba(236, 239, 237, .62); }
  [data-theme="glass"] .theme-menu,
  [data-theme="glass"] .site-search-panel { background: rgba(250, 251, 250, .78); }
}
/* Visitors who ask for less transparency get the solid palette. */
@media (prefers-reduced-transparency: reduce) {
  [data-theme="glass"] {
    --surface: #f7f8f6;
    --border: #cdd2d0;
    --border-strong: #b5bbb9;
  }
  [data-theme="glass"] body { background-image: none; }
  [data-theme="glass"] .nav { background: var(--bg); }
  [data-theme="glass"] .theme-menu,
  [data-theme="glass"] .site-search-panel { background: var(--surface); }
  [data-theme="glass"] * { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }
}
`;
