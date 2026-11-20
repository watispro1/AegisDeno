/**
 * Glass: dark frosted glass over slowly drifting colour light. Site-wide
 * rules; the dashboard's own surfaces are in glassDashboard.ts.
 *
 * Materials. Three levels, each a token in themes.ts:
 * - resting (--glass-surface): cards, panels, the sidebar. Translucent,
 *   never blurred, so long pages of cards scroll as cheaply as solid ones.
 * - raised (--glass-raised): the header pill and the dashboard top bar.
 * - overlay (--glass-strong): menus, dialogs, toasts. Nearly opaque.
 * Every surface gets the same edge: a hairline rim, a specular top line and
 * a faint dark bottom line (--glass-rim), plus a soft two-step shadow.
 *
 * Light. One fixed layer of four glows (body::before) drifts with transform
 * only; a static top light and vignette sit on body::after. The drift stops
 * under prefers-reduced-motion; both layers go under
 * prefers-reduced-transparency.
 *
 * Blur budget. backdrop-filter is used only on floating chrome: the header
 * pill, the phone menu sheet, menus and the search panel here, and the
 * sidebar, top bar, overlays and dialogs in glassDashboard.ts. It is only
 * switched on inside @supports; an @supports not block makes the menus
 * opaque, and prefers-reduced-transparency puts the solid palette back and
 * removes every backdrop-filter. Every rule is scoped to [data-theme="glass"]
 * (scripts/smoke-web.ts and tests/glassDashboard.test.ts check this).
 */
export const cssGlass = String.raw`
/* ── Glass ────────────────────────────────────────────────────────────── */
[data-theme="glass"] {
  --k-changed: #9cc0f5;
  --k-fixed: #d4b2f0;
  --spring: cubic-bezier(.34, 1.3, .64, 1);
  --ease-glass: cubic-bezier(.22, 1, .36, 1);
  --shadow-glass: 0 1px 2px rgba(0, 0, 0, .2), 0 10px 30px -10px rgba(0, 0, 0, .55);
  --shadow-float: 0 2px 6px rgba(0, 0, 0, .3), 0 24px 56px -14px rgba(0, 0, 0, .7);
  --glass-rim: inset 0 1px 0 var(--glass-hi), inset 0 0 0 1px rgba(255, 255, 255, .025), inset 0 -1px 0 rgba(0, 0, 0, .28);
  --glass-sheen: linear-gradient(180deg, rgba(255, 255, 255, .06), rgba(255, 255, 255, .015) 40%, rgba(255, 255, 255, 0) 72%);
  --glass-tint: rgba(169, 200, 255, .16);
}
[data-theme="glass"] body { background-color: var(--bg); -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }

/* Ambient light: one fixed layer, drifted with transform only. */
[data-theme="glass"] body::before {
  content: ""; position: fixed; z-index: -1; inset: -12vmax; pointer-events: none;
  background-image:
    radial-gradient(36vmax 28vmax at 16% 20%, var(--glass-a), transparent 70%),
    radial-gradient(32vmax 26vmax at 84% 16%, var(--glass-b), transparent 70%),
    radial-gradient(38vmax 28vmax at 72% 84%, var(--glass-c), transparent 70%),
    radial-gradient(26vmax 20vmax at 20% 86%, var(--glass-d), transparent 70%);
  animation: glass-drift 60s ease-in-out infinite alternate;
  will-change: transform;
}
[data-theme="glass"] body::after {
  content: ""; position: fixed; z-index: -1; inset: 0; pointer-events: none;
  background-image:
    radial-gradient(120% 60% at 50% -14%, rgba(150, 175, 255, .07), transparent 62%),
    radial-gradient(140% 90% at 50% 128%, rgba(0, 0, 0, .5), transparent 60%);
}
@keyframes glass-drift {
  0% { transform: translate3d(0, 0, 0) scale(1); }
  50% { transform: translate3d(2.5vmax, -2vmax, 0) scale(1.05); }
  100% { transform: translate3d(-2.5vmax, 2vmax, 0) scale(1.02); }
}
@media (prefers-reduced-motion: reduce) {
  [data-theme="glass"] body::before { animation: none; will-change: auto; }
}

/* Type on glass: a hairline shadow lifts headings off the light. */
[data-theme="glass"] h1, [data-theme="glass"] h2 { text-shadow: 0 1px 2px rgba(0, 0, 0, .35); letter-spacing: -.015em; }
[data-theme="glass"] :focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; box-shadow: 0 0 0 5px rgba(169, 200, 255, .2); }
[data-theme="glass"] .dc-avatar.bot { background: var(--accent); color: var(--accent-ink); }

/* Controls: pills with a lit top edge; the press springs. */
[data-theme="glass"] .btn,
[data-theme="glass"] .icon-btn,
[data-theme="glass"] .site-search-trigger,
[data-theme="glass"] .theme-opt,
[data-theme="glass"] .mod-chip,
[data-theme="glass"] .tab,
[data-theme="glass"] .site-search-recent,
[data-theme="glass"] .live-pill { border-radius: 999px; }
[data-theme="glass"] .btn {
  position: relative; overflow: hidden;
  transition: background-color .25s var(--ease-glass), border-color .25s var(--ease-glass), box-shadow .3s var(--ease-glass), transform .4s var(--spring);
}
[data-theme="glass"] .btn:not(.ghost):not(.danger) { background-image: linear-gradient(180deg, rgba(255, 255, 255, .28), rgba(255, 255, 255, 0) 62%); }
[data-theme="glass"] .btn:not(.ghost) { box-shadow: inset 0 1px 0 rgba(255, 255, 255, .5), inset 0 -1px 0 rgba(0, 0, 0, .12), 0 6px 18px -6px rgba(0, 0, 0, .5); }
[data-theme="glass"] .btn:not(.ghost):hover { box-shadow: inset 0 1px 0 rgba(255, 255, 255, .55), 0 10px 26px -8px rgba(120, 160, 255, .4), 0 6px 18px -6px rgba(0, 0, 0, .5); }
[data-theme="glass"] .btn.ghost { background-color: rgba(255, 255, 255, .06); border-color: var(--glass-edge); color: var(--text); box-shadow: inset 0 1px 0 var(--glass-hi); }
[data-theme="glass"] .btn.ghost:hover { background-color: rgba(255, 255, 255, .11); border-color: rgba(255, 255, 255, .24); }
[data-theme="glass"] .btn:active, [data-theme="glass"] .icon-btn:active { transform: scale(.97); transition-duration: .08s; }
/* A highlight sweeps across a button on hover. */
[data-theme="glass"] .btn::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: linear-gradient(110deg, transparent 30%, rgba(255, 255, 255, .2) 50%, transparent 70%);
  transform: translateX(-120%); transition: transform .7s var(--ease-glass);
}
[data-theme="glass"] .btn:hover::after { transform: translateX(120%); }
[data-theme="glass"] .icon-btn { transition: background-color .2s var(--ease-glass), border-color .2s var(--ease-glass), transform .4s var(--spring); }
[data-theme="glass"] .icon-btn:hover { background: rgba(255, 255, 255, .09); border-color: var(--glass-edge); }

/* Header: a floating pill, drawn on ::before so its menus can blur too. */
[data-theme="glass"] .nav { background: transparent; border-bottom: 0; padding: calc(env(safe-area-inset-top) + .6rem) .75rem 0; }
[data-theme="glass"] .nav-inner { position: relative; isolation: isolate; padding-left: 1.1rem; padding-right: .5rem; }
[data-theme="glass"] .nav-inner::before {
  content: ""; position: absolute; inset: 0; z-index: -1; border-radius: 999px;
  background-color: var(--surface); background-image: var(--glass-sheen); border: 1px solid var(--border-strong);
  box-shadow: var(--glass-rim), var(--shadow-float);
}
[data-theme="glass"] .nav-link { border-radius: 999px; padding: 0 .75rem; min-height: 38px; transition: background-color .2s var(--ease-glass), color .2s var(--ease-glass); }
[data-theme="glass"] .nav-link:hover { background: rgba(255, 255, 255, .07); }
[data-theme="glass"] .nav-link[aria-current="page"] { background: rgba(255, 255, 255, .12); box-shadow: inset 0 1px 0 var(--glass-hi); border-radius: 999px; }
[data-theme="glass"] .nav-actions .btn { min-height: 40px; }
@media (min-width: 1041px) and (max-width: 1200px) {
  [data-theme="glass"] .nav-link { padding: 0 .5rem; }
}

/* Resting surfaces: radius, sheen, rim and depth, no blur. */
[data-theme="glass"] .panel-card,
[data-theme="glass"] .callout,
[data-theme="glass"] .home-feature,
[data-theme="glass"] .whats-new,
[data-theme="glass"] .diff-card,
[data-theme="glass"] .audience-card,
[data-theme="glass"] .help-block,
[data-theme="glass"] .help-ask,
[data-theme="glass"] .cmd-facts,
[data-theme="glass"] .component,
[data-theme="glass"] .status-banner,
[data-theme="glass"] .cl-stats,
[data-theme="glass"] .stat-grid,
[data-theme="glass"] .mod-card,
[data-theme="glass"] .table-wrap,
[data-theme="glass"] .dc { border-radius: var(--r-lg); }
[data-theme="glass"] .panel-card,
[data-theme="glass"] .home-feature,
[data-theme="glass"] .whats-new,
[data-theme="glass"] .diff-card,
[data-theme="glass"] .audience-card,
[data-theme="glass"] .help-block,
[data-theme="glass"] .help-ask,
[data-theme="glass"] .component,
[data-theme="glass"] .status-banner,
[data-theme="glass"] .cl-stats,
[data-theme="glass"] .mod-card {
  background-image: var(--glass-sheen);
  box-shadow: var(--glass-rim), var(--shadow-glass);
  transition: border-color .3s var(--ease-glass), box-shadow .3s var(--ease-glass);
}
[data-theme="glass"] .callout,
[data-theme="glass"] .cmd-facts,
[data-theme="glass"] .table-wrap { background-image: var(--glass-sheen); box-shadow: var(--glass-rim); }
[data-theme="glass"] .panel-card:hover,
[data-theme="glass"] .home-feature:hover,
[data-theme="glass"] .diff-card:hover,
[data-theme="glass"] .audience-card:hover,
[data-theme="glass"] .help-ask:hover,
[data-theme="glass"] .mod-card:hover { border-color: rgba(255, 255, 255, .2); }
[data-theme="glass"] .dc { box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08), var(--shadow-float); border-color: rgba(255, 255, 255, .1); }

/* Menus (overlay material). */
[data-theme="glass"] .theme-menu,
[data-theme="glass"] .site-search-panel,
[data-theme="glass"] .switcher-list,
[data-theme="glass"] .user-panel { border-radius: 18px; background-image: var(--glass-sheen); box-shadow: var(--glass-rim), 0 18px 50px rgba(0, 0, 0, .55); }
[data-theme="glass"] .theme-opt { transition: background-color .15s var(--ease-glass); }
[data-theme="glass"] .theme-opt:hover { background: rgba(255, 255, 255, .08); }
[data-theme="glass"] .theme-opt[aria-pressed="true"] { background: rgba(255, 255, 255, .1); box-shadow: inset 0 1px 0 var(--glass-hi); }
[data-theme="glass"] .theme-beta { border-color: var(--glass-edge); }
[data-theme="glass"] .top-switcher summary,
[data-theme="glass"] .switcher summary { border-radius: 999px; }
[data-theme="glass"] input[type="search"],
[data-theme="glass"] input[type="text"],
[data-theme="glass"] input[type="number"],
[data-theme="glass"] input[type="url"],
[data-theme="glass"] select,
[data-theme="glass"] textarea { border-radius: 12px; }
[data-theme="glass"] .site-search-backdrop { background: rgba(4, 5, 8, .6); }
[data-theme="glass"] footer.site { background: rgba(8, 10, 14, .55); border-top-color: var(--border); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .05); }

/* Header menu below 1040px: a glass sheet under the pill. */
@media (max-width: 1040px) {
  [data-theme="glass"] .nav-links {
    left: 0; right: 0; top: calc(100% + .5rem);
    background: var(--surface); border: 1px solid var(--border-strong); border-radius: 22px;
    box-shadow: var(--glass-rim), 0 18px 50px rgba(0, 0, 0, .55);
    padding: .5rem;
  }
  [data-theme="glass"] .nav-link { min-height: 44px; border-bottom: 0; border-radius: 14px; }
  [data-theme="glass"] .nav-link[aria-current="page"] { padding-left: .75rem; border-radius: 14px; }
}

@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  [data-theme="glass"] {
    --surface: var(--glass-surface);
    --bg-sunk: rgba(255, 255, 255, .055);
    --code-bg: rgba(255, 255, 255, .07);
    --border: rgba(255, 255, 255, .11);
    --border-strong: rgba(255, 255, 255, .18);
    --hover: rgba(255, 255, 255, .07);
    --scroll-thumb: rgba(255, 255, 255, .2);
  }
  /* Floating chrome only (the blur budget). */
  [data-theme="glass"] .nav-inner::before,
  [data-theme="glass"] .nav-links {
    background-color: var(--glass-raised);
    -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(165%);
    backdrop-filter: blur(var(--glass-blur)) saturate(165%);
  }
  [data-theme="glass"] .theme-menu,
  [data-theme="glass"] .site-search-panel,
  [data-theme="glass"] .switcher-list,
  [data-theme="glass"] .user-panel {
    background-color: var(--glass-strong);
    -webkit-backdrop-filter: blur(28px) saturate(175%);
    backdrop-filter: blur(28px) saturate(175%);
  }
  @media (min-width: 1041px) {
    [data-theme="glass"] .nav-links { background: transparent; box-shadow: none; -webkit-backdrop-filter: none; backdrop-filter: none; }
  }
}
/* No backdrop-filter at all: keep the solid palette and make menus opaque. */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  [data-theme="glass"] .theme-menu,
  [data-theme="glass"] .site-search-panel,
  [data-theme="glass"] .switcher-list,
  [data-theme="glass"] .user-panel { background-color: #12151d; }
  [data-theme="glass"] .site-search-backdrop { background: rgba(4, 5, 8, .82); }
}
/* Less transparency: the solid palette, no light layers, no blur anywhere. */
@media (prefers-reduced-transparency: reduce) {
  [data-theme="glass"] {
    --surface: #151922;
    --bg-sunk: #10131a;
    --code-bg: #131720;
    --border: #262b36;
    --border-strong: #3a414f;
    --hover: #1d2230;
    --scroll-thumb: #3a414f;
  }
  [data-theme="glass"] body::before { display: none; }
  [data-theme="glass"] body::after { display: none; }
  [data-theme="glass"] .theme-menu,
  [data-theme="glass"] .site-search-panel,
  [data-theme="glass"] .switcher-list,
  [data-theme="glass"] .user-panel { background-color: var(--surface); }
  [data-theme="glass"] .nav-inner::before, [data-theme="glass"] .nav-links { background-color: var(--surface); }
  [data-theme="glass"] .btn.ghost { background-color: transparent; }
  [data-theme="glass"] footer.site { background: var(--bg-sunk); }
  [data-theme="glass"] .site-search-backdrop { background: rgba(4, 5, 8, .88); }
  [data-theme="glass"] * { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }
}
/* Forced colours: the system palette; no glow layers or sheen behind it. */
@media (forced-colors: active) {
  [data-theme="glass"] body::before, [data-theme="glass"] body::after { display: none; }
  [data-theme="glass"] .nav-inner::before { border-color: CanvasText; }
  [data-theme="glass"] .btn::after { display: none; }
}
/* Less motion: no sweep, no spring, no press. */
@media (prefers-reduced-motion: reduce) {
  [data-theme="glass"] .btn::after { display: none; }
  [data-theme="glass"] .btn, [data-theme="glass"] .icon-btn { transition: background-color .15s linear, border-color .15s linear; }
  [data-theme="glass"] .btn:active, [data-theme="glass"] .icon-btn:active { transform: none; }
}
`;
