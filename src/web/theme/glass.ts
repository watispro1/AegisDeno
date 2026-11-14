/**
 * Glass (beta): dark frosted glass in the spirit of Apple's Liquid Glass
 * (iOS / macOS 26) and YouTube's translucent player menus.
 *
 * - A deep blue-black page with four soft colour glows that drift slowly
 *   behind everything (body::before). The drift stops under
 *   prefers-reduced-motion; the glows go away under
 *   prefers-reduced-transparency.
 * - Panels, cards, menus and the floating pill-shaped header are dark
 *   translucent glass: blur + saturation, a thin light edge with a 1px
 *   specular highlight on top, and a large soft shadow.
 * - Buttons are pills; ghost buttons are glass pills with a sheen on hover.
 *
 * The solid tokens in themes.ts are the fallback: blur and translucency are
 * only switched on inside the @supports block below, and the
 * prefers-reduced-transparency block puts the solid palette back. Every rule
 * that uses backdrop-filter is scoped to [data-theme="glass"]
 * (scripts/smoke-web.ts checks this). tests/siteThemes.test.ts checks text
 * contrast on the glass surface over every glow colour.
 */
export const cssGlass = String.raw`
/* ── Glass (beta) ─────────────────────────────────────────────────────── */
[data-theme="glass"] {
  --k-changed: #9cc0f5;
  --k-fixed: #d4b2f0;
  --shadow-glass: 0 1px 0 rgba(255, 255, 255, .02), 0 12px 40px rgba(0, 0, 0, .38), 0 2px 8px rgba(0, 0, 0, .25);
}
[data-theme="glass"] body { background-color: var(--bg); }

/* Ambient glows: one fixed layer, drifted with transform only. */
[data-theme="glass"] body::before {
  content: ""; position: fixed; z-index: -1; inset: -15vmax; pointer-events: none;
  background-image:
    radial-gradient(38vmax 30vmax at 18% 22%, var(--glass-a), transparent 70%),
    radial-gradient(34vmax 28vmax at 82% 18%, var(--glass-b), transparent 70%),
    radial-gradient(40vmax 30vmax at 70% 82%, var(--glass-c), transparent 70%),
    radial-gradient(28vmax 22vmax at 22% 85%, var(--glass-d), transparent 70%);
  animation: glass-drift 48s ease-in-out infinite alternate;
  will-change: transform;
}
@keyframes glass-drift {
  0% { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); }
  50% { transform: translate3d(3vmax, -2vmax, 0) rotate(8deg) scale(1.06); }
  100% { transform: translate3d(-3vmax, 2.5vmax, 0) rotate(-6deg) scale(1.03); }
}
@media (prefers-reduced-motion: reduce) {
  [data-theme="glass"] body::before { animation: none; will-change: auto; }
}

/* Shape: generous radii, pill controls. */
[data-theme="glass"] .btn,
[data-theme="glass"] .icon-btn,
[data-theme="glass"] .site-search-trigger,
[data-theme="glass"] .theme-opt,
[data-theme="glass"] .mod-chip,
[data-theme="glass"] .tab,
[data-theme="glass"] .site-search-recent,
[data-theme="glass"] .live-pill { border-radius: 999px; }
[data-theme="glass"] .btn { position: relative; overflow: hidden; transition: background-color .2s ease, border-color .2s ease, box-shadow .2s ease; }
[data-theme="glass"] .btn:not(.ghost) { box-shadow: inset 0 1px 0 rgba(255, 255, 255, .45), 0 6px 18px rgba(0, 0, 0, .3); }
[data-theme="glass"] .btn.ghost { background: rgba(255, 255, 255, .06); border-color: var(--glass-edge); color: var(--text); box-shadow: inset 0 1px 0 var(--glass-hi); }
[data-theme="glass"] .btn.ghost:hover { background: rgba(255, 255, 255, .12); border-color: rgba(255, 255, 255, .24); }
/* Sheen: a soft diagonal highlight slides across on hover. */
[data-theme="glass"] .btn::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: linear-gradient(115deg, transparent 30%, rgba(255, 255, 255, .22) 50%, transparent 70%);
  transform: translateX(-120%); transition: transform .6s ease;
}
[data-theme="glass"] .btn:hover::after { transform: translateX(120%); }
[data-theme="glass"] .icon-btn:hover { background: rgba(255, 255, 255, .1); border-color: var(--glass-edge); }

/* Focus stays obvious on glass: a light ring plus a soft halo. */
[data-theme="glass"] :focus-visible { outline: 2px solid var(--accent-hover); outline-offset: 2px; box-shadow: 0 0 0 5px rgba(169, 200, 255, .22); }
[data-theme="glass"] ::selection { background: rgba(169, 200, 255, .35); color: var(--text); }

/* Floating pill header: the pill is drawn on a pseudo-element so the
   header itself is not a backdrop root and its menus can blur the page. */
[data-theme="glass"] .nav { background: transparent; border-bottom: 0; padding: calc(env(safe-area-inset-top) + .6rem) .75rem 0; }
[data-theme="glass"] .nav-inner { position: relative; isolation: isolate; padding-left: 1.1rem; padding-right: .5rem; }
[data-theme="glass"] .nav-inner::before {
  content: ""; position: absolute; inset: 0; z-index: -1; border-radius: 999px;
  background: var(--surface); border: 1px solid var(--border-strong);
  box-shadow: inset 0 1px 0 var(--glass-hi), var(--shadow-glass);
}
[data-theme="glass"] .nav-link { border-radius: 999px; padding: 0 .75rem; min-height: 38px; }
[data-theme="glass"] .nav-link:hover { background: rgba(255, 255, 255, .07); }
[data-theme="glass"] .nav-link[aria-current="page"] { background: rgba(255, 255, 255, .13); box-shadow: inset 0 1px 0 var(--glass-hi); border-radius: 999px; }
[data-theme="glass"] .nav-actions .btn { min-height: 40px; }
@media (min-width: 1041px) and (max-width: 1200px) {
  [data-theme="glass"] .nav-link { padding: 0 .5rem; }
}

/* Cards and panels: radius, light edge, specular top line, soft shadow. */
[data-theme="glass"] .card,
[data-theme="glass"] .panel,
[data-theme="glass"] .panel-card,
[data-theme="glass"] .callout,
[data-theme="glass"] .home-feature,
[data-theme="glass"] .home-release,
[data-theme="glass"] .help-ask,
[data-theme="glass"] .feature-cmds,
[data-theme="glass"] .cmd-facts,
[data-theme="glass"] .component,
[data-theme="glass"] .status-banner,
[data-theme="glass"] .cl-stats,
[data-theme="glass"] .stat-grid,
[data-theme="glass"] .mod-card,
[data-theme="glass"] .table-wrap,
[data-theme="glass"] .dc { border-radius: var(--r-lg); }
[data-theme="glass"] .theme-menu,
[data-theme="glass"] .site-search-panel,
[data-theme="glass"] .switcher-list,
[data-theme="glass"] .user-panel { border-radius: 18px; box-shadow: inset 0 1px 0 var(--glass-hi), 0 18px 50px rgba(0, 0, 0, .5); }
[data-theme="glass"] .top-switcher summary,
[data-theme="glass"] .switcher summary { border-radius: 999px; }
[data-theme="glass"] input[type="search"],
[data-theme="glass"] input[type="text"],
[data-theme="glass"] input[type="number"],
[data-theme="glass"] input[type="url"],
[data-theme="glass"] select,
[data-theme="glass"] textarea { border-radius: 12px; }
[data-theme="glass"] .site-search-backdrop { background: rgba(4, 5, 8, .55); }
[data-theme="glass"] .app-side { border-right-color: var(--border); }

/* Header menu below 1040px: a glass sheet under the pill. */
@media (max-width: 1040px) {
  [data-theme="glass"] .nav-links {
    left: 0; right: 0; top: calc(100% + .5rem);
    background: var(--surface); border: 1px solid var(--border-strong); border-radius: 22px;
    box-shadow: inset 0 1px 0 var(--glass-hi), 0 18px 50px rgba(0, 0, 0, .5);
    padding: .5rem;
  }
  [data-theme="glass"] .nav-link { min-height: 44px; border-bottom: 0; border-radius: 14px; }
  [data-theme="glass"] .nav-link[aria-current="page"] { padding-left: .75rem; border-radius: 14px; }
}

@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  [data-theme="glass"] {
    --surface: var(--glass-surface);
    --bg-sunk: rgba(255, 255, 255, .06);
    --code-bg: rgba(255, 255, 255, .07);
    --border: rgba(255, 255, 255, .12);
    --border-strong: rgba(255, 255, 255, .18);
  }
  [data-theme="glass"] .nav-inner::before,
  [data-theme="glass"] .nav-links,
  [data-theme="glass"] .app-side,
  [data-theme="glass"] .card,
  [data-theme="glass"] .panel,
  [data-theme="glass"] .panel-card,
  [data-theme="glass"] .callout,
  [data-theme="glass"] .home-feature,
  [data-theme="glass"] .home-release,
  [data-theme="glass"] .help-ask,
  [data-theme="glass"] .feature-cmds,
  [data-theme="glass"] .cmd-facts,
  [data-theme="glass"] .component,
  [data-theme="glass"] .status-banner,
  [data-theme="glass"] .cl-stats,
  [data-theme="glass"] .stat-grid,
  [data-theme="glass"] .mod-card,
  [data-theme="glass"] .table-wrap {
    -webkit-backdrop-filter: blur(24px) saturate(170%);
    backdrop-filter: blur(24px) saturate(170%);
  }
  [data-theme="glass"] .card,
  [data-theme="glass"] .panel,
  [data-theme="glass"] .panel-card,
  [data-theme="glass"] .home-feature,
  [data-theme="glass"] .home-release,
  [data-theme="glass"] .help-ask,
  [data-theme="glass"] .component,
  [data-theme="glass"] .status-banner,
  [data-theme="glass"] .cl-stats,
  [data-theme="glass"] .stat-grid,
  [data-theme="glass"] .mod-card { box-shadow: inset 0 1px 0 var(--glass-hi), var(--shadow-glass); }
  [data-theme="glass"] .theme-menu,
  [data-theme="glass"] .site-search-panel,
  [data-theme="glass"] .switcher-list,
  [data-theme="glass"] .user-panel {
    background: var(--glass-strong);
    -webkit-backdrop-filter: blur(30px) saturate(180%);
    backdrop-filter: blur(30px) saturate(180%);
  }
  [data-theme="glass"] .btn.ghost,
  [data-theme="glass"] .site-search-trigger {
    -webkit-backdrop-filter: blur(12px) saturate(160%);
    backdrop-filter: blur(12px) saturate(160%);
  }
  [data-theme="glass"] .nav-links { background: var(--glass-strong); }
  @media (min-width: 1041px) {
    [data-theme="glass"] .nav-links { background: transparent; -webkit-backdrop-filter: none; backdrop-filter: none; }
  }
}
/* Visitors who ask for less transparency get the solid palette. */
@media (prefers-reduced-transparency: reduce) {
  [data-theme="glass"] {
    --surface: #161a22;
    --bg-sunk: #11141b;
    --code-bg: #141821;
    --border: #272c37;
    --border-strong: #3b4250;
  }
  [data-theme="glass"] body::before { display: none; }
  [data-theme="glass"] .theme-menu,
  [data-theme="glass"] .site-search-panel,
  [data-theme="glass"] .switcher-list,
  [data-theme="glass"] .user-panel { background: var(--surface); }
  [data-theme="glass"] .nav-links { background: var(--bg); }
  [data-theme="glass"] .btn.ghost { background: transparent; }
  [data-theme="glass"] * { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }
}
`;
