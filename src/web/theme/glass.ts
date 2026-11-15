/**
 * Glass (beta): dark frosted glass in the spirit of Apple's visionOS / macOS
 * materials and YouTube's translucent player menus. Site-wide rules; the
 * dashboard surfaces are in glassDashboard.ts.
 *
 * - Background: a deep blue-black page with a CSS-only colour mesh (four soft
 *   glows on body::before that drift slowly, plus a static top light and
 *   bottom vignette on body::after). No images. The drift stops under
 *   prefers-reduced-motion; both layers go away under
 *   prefers-reduced-transparency.
 * - Surfaces: translucent panels with a faint top-to-bottom sheen, a hairline
 *   edge, a 1px specular highlight on top, a dark inner line at the bottom and
 *   a soft two-step depth shadow. Hovering a card or button slides a specular
 *   highlight across it; controls move on a gentle spring curve.
 * - Blur budget: backdrop-filter (blur + saturate) is kept for the floating
 *   chrome only (the header pill and its sheet, menus, dialogs, a few single
 *   hero panels). Repeated cards, tables and lists stay translucent without
 *   blur: over soft glows it looks the same and keeps scrolling cheap.
 *
 * The solid tokens in themes.ts are the fallback: translucency and blur are
 * only switched on inside the @supports block below, an @supports not block
 * makes the menus fully opaque, and the prefers-reduced-transparency block
 * puts the solid palette back. Every rule that uses backdrop-filter is scoped
 * to [data-theme="glass"] (scripts/smoke-web.ts checks this).
 * tests/siteThemes.test.ts checks text contrast on the glass surface over
 * every glow colour.
 */
export const cssGlass = String.raw`
/* ── Glass (beta) ─────────────────────────────────────────────────────── */
[data-theme="glass"] {
  --k-changed: #9cc0f5;
  --k-fixed: #d4b2f0;
  /* Motion: a soft spring for movement, a long ease-out for light. */
  --spring: cubic-bezier(.34, 1.36, .64, 1);
  --ease-glass: cubic-bezier(.22, 1, .36, 1);
  /* Depth: a tight contact shadow plus a wide, soft ambient one. */
  --shadow-glass: 0 1px 2px rgba(0, 0, 0, .22), 0 12px 32px -8px rgba(0, 0, 0, .5), 0 32px 64px -24px rgba(0, 0, 0, .45);
  --shadow-float: 0 2px 6px rgba(0, 0, 0, .3), 0 24px 60px -12px rgba(0, 0, 0, .65);
  /* Rim: specular top line, hairline all round, a dark line at the bottom. */
  --glass-rim: inset 0 1px 0 var(--glass-hi), inset 0 0 0 1px rgba(255, 255, 255, .03), inset 0 -1px 0 rgba(0, 0, 0, .25);
  /* Sheen painted on every surface, and the highlight that slides on hover. */
  --glass-sheen: linear-gradient(180deg, rgba(255, 255, 255, .065), rgba(255, 255, 255, .018) 42%, rgba(255, 255, 255, 0) 70%);
  --glass-spec: linear-gradient(110deg, rgba(255, 255, 255, 0) 40%, rgba(255, 255, 255, .075) 50%, rgba(255, 255, 255, 0) 60%);
}
[data-theme="glass"] body { background-color: var(--bg); -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }

/* Ambient mesh: one fixed layer of glows, drifted with transform only. */
[data-theme="glass"] body::before {
  content: ""; position: fixed; z-index: -1; inset: -15vmax; pointer-events: none;
  background-image:
    radial-gradient(38vmax 30vmax at 18% 22%, var(--glass-a), transparent 70%),
    radial-gradient(34vmax 28vmax at 82% 18%, var(--glass-b), transparent 70%),
    radial-gradient(40vmax 30vmax at 70% 82%, var(--glass-c), transparent 70%),
    radial-gradient(28vmax 22vmax at 22% 85%, var(--glass-d), transparent 70%),
    radial-gradient(30vmax 24vmax at 50% 50%, rgba(27, 42, 85, .35), transparent 75%);
  animation: glass-drift 48s ease-in-out infinite alternate;
  will-change: transform;
}
/* A static top light and bottom vignette give the mesh depth (no animation). */
[data-theme="glass"] body::after {
  content: ""; position: fixed; z-index: -1; inset: 0; pointer-events: none;
  background-image:
    radial-gradient(120% 60% at 50% -12%, rgba(150, 175, 255, .07), transparent 62%),
    radial-gradient(140% 90% at 50% 125%, rgba(0, 0, 0, .5), transparent 60%);
}
@keyframes glass-drift {
  0% { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); }
  50% { transform: translate3d(3vmax, -2vmax, 0) rotate(8deg) scale(1.06); }
  100% { transform: translate3d(-3vmax, 2.5vmax, 0) rotate(-6deg) scale(1.03); }
}
@media (prefers-reduced-motion: reduce) {
  [data-theme="glass"] body::before { animation: none; will-change: auto; }
}

/* Vibrancy: headings sit slightly "lifted" off the glass. */
[data-theme="glass"] h1, [data-theme="glass"] h2 { text-shadow: 0 1px 2px rgba(0, 0, 0, .35); letter-spacing: -0.015em; }
[data-theme="glass"] .muted, [data-theme="glass"] .faint { text-shadow: 0 1px 1px rgba(0, 0, 0, .2); }

/* Shape: generous radii, pill controls. */
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
  transition: background-color .25s var(--ease-glass), border-color .25s var(--ease-glass), box-shadow .3s var(--ease-glass), transform .45s var(--spring);
}
[data-theme="glass"] .btn:not(.ghost):not(.danger) { background-image: linear-gradient(180deg, rgba(255, 255, 255, .3), rgba(255, 255, 255, 0) 60%); }
[data-theme="glass"] .btn:not(.ghost) { box-shadow: inset 0 1px 0 rgba(255, 255, 255, .5), inset 0 -1px 0 rgba(0, 0, 0, .12), 0 6px 18px -4px rgba(0, 0, 0, .45); }
[data-theme="glass"] .btn:not(.ghost):hover { box-shadow: inset 0 1px 0 rgba(255, 255, 255, .55), 0 10px 26px -6px rgba(120, 160, 255, .35), 0 6px 18px -4px rgba(0, 0, 0, .45); }
[data-theme="glass"] .btn.ghost { background-color: rgba(255, 255, 255, .06); border-color: var(--glass-edge); color: var(--text); box-shadow: inset 0 1px 0 var(--glass-hi); }
[data-theme="glass"] .btn.ghost:hover { background-color: rgba(255, 255, 255, .12); border-color: rgba(255, 255, 255, .24); }
[data-theme="glass"] .btn:active, [data-theme="glass"] .icon-btn:active { transform: scale(.97); transition-duration: .08s; }
/* Sheen: a soft diagonal highlight slides across on hover. */
[data-theme="glass"] .btn::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: linear-gradient(110deg, transparent 30%, rgba(255, 255, 255, .24) 50%, transparent 70%);
  transform: translateX(-120%); transition: transform .7s var(--ease-glass);
}
[data-theme="glass"] .btn:hover::after { transform: translateX(120%); }
[data-theme="glass"] .icon-btn { transition: background-color .2s var(--ease-glass), border-color .2s var(--ease-glass), transform .45s var(--spring); }
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
  background-color: var(--surface); background-image: var(--glass-sheen); border: 1px solid var(--border-strong);
  box-shadow: var(--glass-rim), var(--shadow-float);
}
[data-theme="glass"] .nav-link { border-radius: 999px; padding: 0 .75rem; min-height: 38px; transition: background-color .2s var(--ease-glass), color .2s var(--ease-glass); }
[data-theme="glass"] .nav-link:hover { background: rgba(255, 255, 255, .07); }
[data-theme="glass"] .nav-link[aria-current="page"] { background: rgba(255, 255, 255, .13); box-shadow: inset 0 1px 0 var(--glass-hi), 0 1px 4px rgba(0, 0, 0, .25); border-radius: 999px; }
[data-theme="glass"] .nav-actions .btn { min-height: 40px; }
@media (min-width: 1041px) and (max-width: 1200px) {
  [data-theme="glass"] .nav-link { padding: 0 .5rem; }
}

/* Cards and panels: radius, sheen, rim and depth. */
[data-theme="glass"] .card,
[data-theme="glass"] .panel,
[data-theme="glass"] .panel-card,
[data-theme="glass"] .callout,
[data-theme="glass"] .home-feature,
[data-theme="glass"] .whats-new,
[data-theme="glass"] .diff-card,
[data-theme="glass"] .audience-card,
[data-theme="glass"] .help-block,
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
[data-theme="glass"] .card,
[data-theme="glass"] .panel,
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
[data-theme="glass"] .stat-grid,
[data-theme="glass"] .mod-card {
  background-image: var(--glass-spec), var(--glass-sheen);
  background-size: 260% 100%, 100% 100%; background-position: 115% 0, 0 0; background-repeat: no-repeat;
  box-shadow: var(--glass-rim), var(--shadow-glass);
  transition: background-position 1.1s var(--ease-glass), border-color .3s var(--ease-glass), box-shadow .3s var(--ease-glass);
}
[data-theme="glass"] .callout,
[data-theme="glass"] .feature-cmds,
[data-theme="glass"] .cmd-facts,
[data-theme="glass"] .table-wrap { background-image: var(--glass-sheen); box-shadow: var(--glass-rim); }
/* Specular sheen on hover. */
[data-theme="glass"] .card:hover,
[data-theme="glass"] .panel-card:hover,
[data-theme="glass"] .home-feature:hover,
[data-theme="glass"] .diff-card:hover,
[data-theme="glass"] .audience-card:hover,
[data-theme="glass"] .help-ask:hover,
[data-theme="glass"] .mod-card:hover { background-position: -15% 0, 0 0; border-color: rgba(255, 255, 255, .22); }
/* The Discord mock keeps Discord's colours; it only floats like a window. */
[data-theme="glass"] .dc { box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08), var(--shadow-float); border-color: rgba(255, 255, 255, .1); }

/* Menus and overlays. */
[data-theme="glass"] .theme-menu,
[data-theme="glass"] .site-search-panel,
[data-theme="glass"] .switcher-list,
[data-theme="glass"] .user-panel { border-radius: 18px; background-image: var(--glass-sheen); box-shadow: var(--glass-rim), 0 18px 50px rgba(0, 0, 0, .5); }
[data-theme="glass"] .theme-opt { transition: background-color .15s var(--ease-glass); }
[data-theme="glass"] .theme-opt:hover { background: rgba(255, 255, 255, .08); }
[data-theme="glass"] .theme-opt[aria-pressed="true"] { background: rgba(255, 255, 255, .1); box-shadow: inset 0 1px 0 var(--glass-hi); }
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
[data-theme="glass"] footer.site { background: rgba(8, 10, 14, .55); border-top-color: var(--border); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .05); }

/* Header menu below 1040px: a glass sheet under the pill. */
@media (max-width: 1040px) {
  [data-theme="glass"] .nav-links {
    left: 0; right: 0; top: calc(100% + .5rem);
    background: var(--surface); border: 1px solid var(--border-strong); border-radius: 22px;
    box-shadow: var(--glass-rim), 0 18px 50px rgba(0, 0, 0, .5);
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
  /* Floating chrome and single hero panels only (the blur budget). */
  [data-theme="glass"] .nav-inner::before,
  [data-theme="glass"] .nav-links,
  [data-theme="glass"] .whats-new,
  [data-theme="glass"] .status-banner,
  [data-theme="glass"] .cl-stats,
  [data-theme="glass"] .stat-grid,
  [data-theme="glass"] .help-ask {
    -webkit-backdrop-filter: blur(24px) saturate(170%);
    backdrop-filter: blur(24px) saturate(170%);
  }
  [data-theme="glass"] .theme-menu,
  [data-theme="glass"] .site-search-panel,
  [data-theme="glass"] .switcher-list,
  [data-theme="glass"] .user-panel {
    background-color: var(--glass-strong);
    -webkit-backdrop-filter: blur(30px) saturate(180%);
    backdrop-filter: blur(30px) saturate(180%);
  }
  [data-theme="glass"] .site-search-backdrop {
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
  }
  [data-theme="glass"] .nav-links { background-color: var(--glass-strong); }
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
  [data-theme="glass"] .site-search-backdrop { background: rgba(4, 5, 8, .8); }
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
  [data-theme="glass"] body::after { display: none; }
  [data-theme="glass"] .theme-menu,
  [data-theme="glass"] .site-search-panel,
  [data-theme="glass"] .switcher-list,
  [data-theme="glass"] .user-panel { background-color: var(--surface); }
  [data-theme="glass"] .nav-links { background-color: var(--bg); }
  [data-theme="glass"] .btn.ghost { background-color: transparent; }
  [data-theme="glass"] footer.site { background: var(--bg-sunk); }
  [data-theme="glass"] .site-search-backdrop { background: rgba(4, 5, 8, .85); }
  [data-theme="glass"] * { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }
}
/* Less motion: no sliding sheen, no spring, no press. */
@media (prefers-reduced-motion: reduce) {
  [data-theme="glass"] .btn::after { display: none; }
  [data-theme="glass"] .btn, [data-theme="glass"] .icon-btn { transition: background-color .15s linear, border-color .15s linear; }
  [data-theme="glass"] .btn:active, [data-theme="glass"] .icon-btn:active { transform: none; }
  [data-theme="glass"] .card, [data-theme="glass"] .panel-card, [data-theme="glass"] .home-feature,
  [data-theme="glass"] .diff-card, [data-theme="glass"] .audience-card, [data-theme="glass"] .help-ask,
  [data-theme="glass"] .mod-card { transition: border-color .15s linear; }
}
`;
