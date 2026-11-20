/**
 * Aurora (beta): a bright, airy light theme. White cards float on a still
 * dawn wash of lilac, mint and peach; the accent is an indigo violet; corners
 * are rounder and shadows are soft and tinted. No blur and no animation, so
 * it costs nothing to scroll: the wash is one fixed layer of gradients that
 * goes flat under prefers-reduced-transparency and in forced colours.
 *
 * Marked Beta in the picker (BETA_THEMES in layout.ts) while it is tuned.
 * tests/siteThemes.test.ts checks its text and status tokens against WCAG AA
 * on every background, including each colour of the wash.
 */

/** Token block; included right after the other theme tokens. */
export const cssAuroraTokens = String.raw`
[data-theme="aurora"] {
  --bg: #f7f5fb;
  --bg-sunk: #eeebf6;
  --surface: #ffffff;
  --text: #1d1a2b;
  --text-2: #38344b;
  --muted: #57526b;
  --faint: #5f5a74;
  --border: #e4e0ef;
  --border-strong: #cfc9e1;
  --accent: #5a48d0;
  --accent-hover: #4a39bd;
  --accent-ink: #ffffff;
  --accent-soft: #eeebfd;
  --link: #4c3cc4;
  --ok: #166a3e;
  --warn: #8c5208;
  --danger: #b02838;
  --code-bg: #f1eef8;
  --mark: #ffe6a6;
  --on-fill: #ffffff;
  --selection: #dcd3fc;
  --selection-ink: #1d1a2b;
  --scroll-thumb: #cbc4e2;
  --hover: #f3f0fb;
  --r: 8px;
  --r-lg: 14px;
  /* The dawn wash behind the page, at its strongest (flattened over --bg). */
  --aurora-a: #e3d9fb;
  --aurora-b: #d6efe4;
  --aurora-c: #f9dfd0;
  color-scheme: light;
}
`;

/** Component touches; included after Glass so they win over shared rules. */
export const cssAurora = String.raw`
/* ── Aurora (beta) ────────────────────────────────────────────────────── */
[data-theme="aurora"] {
  --k-changed: #5a48d0;
  --k-fixed: #166a3e;
  --shadow-aurora: 0 1px 2px rgba(45, 30, 110, .05), 0 6px 20px -10px rgba(60, 40, 150, .22);
}
[data-theme="aurora"] .app-body {
  --d-r: 10px;
  --d-r-lg: 16px;
  --d-shadow: 0 1px 2px rgba(45, 30, 110, .05), 0 6px 20px -10px rgba(60, 40, 150, .2);
  --d-shadow-hover: 0 2px 4px rgba(45, 30, 110, .07), 0 14px 32px -12px rgba(60, 40, 150, .3);
}
/* The wash: one fixed layer, no animation, no blur. */
[data-theme="aurora"] body { background-color: var(--bg); }
[data-theme="aurora"] body::before {
  content: ""; position: fixed; z-index: -1; inset: 0; pointer-events: none;
  background-image:
    radial-gradient(60vmax 40vmax at 8% -6%, var(--aurora-a), transparent 70%),
    radial-gradient(50vmax 36vmax at 96% 4%, var(--aurora-b), transparent 70%),
    radial-gradient(56vmax 40vmax at 70% 108%, var(--aurora-c), transparent 70%);
}
[data-theme="aurora"] .app-body,
[data-theme="aurora"] .app-body .app-top { background-color: transparent; }
/* Chrome is one white frame (sidebar and top bar alike); the wash lives in
   the content area. Near-opaque so scrolled text never shows through. */
[data-theme="aurora"] .app-body .app-top { background-color: rgba(255, 255, 255, .92); border-bottom-color: var(--border); box-shadow: 0 1px 0 rgba(255, 255, 255, .7), 0 8px 24px -18px rgba(60, 40, 150, .35); }
[data-theme="aurora"] h1, [data-theme="aurora"] h2 { letter-spacing: -.018em; }
/* Display type in a deep indigo ink. */
[data-theme="aurora"] h1, [data-theme="aurora"] .app-body .dash-head h1 { color: #241c52; }
[data-theme="aurora"] :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; box-shadow: 0 0 0 5px rgba(90, 72, 208, .16); }
[data-theme="aurora"] .dc-avatar.bot { background: var(--accent); color: var(--accent-ink); }

/* Site chrome */
[data-theme="aurora"] .nav { background: rgba(255, 255, 255, .92); border-bottom-color: var(--border); }
[data-theme="aurora"] .nav-link[aria-current="page"] { box-shadow: inset 0 -2px 0 var(--accent); }
[data-theme="aurora"] .btn, [data-theme="aurora"] .mod-chip, [data-theme="aurora"] .chip { border-radius: 999px; }
/* The accent buttons are lit indigo-to-violet; hover deepens both stops. */
[data-theme="aurora"] .btn:not(.ghost):not(.danger) { background-image: linear-gradient(135deg, #5a48d0, #6b3fc6); border-color: #5a48d0; box-shadow: inset 0 1px 0 rgba(255, 255, 255, .22), 0 1px 2px rgba(45, 30, 110, .12), 0 6px 16px -8px rgba(90, 72, 208, .55); }
[data-theme="aurora"] .btn:not(.ghost):not(.danger):hover { background-image: linear-gradient(135deg, #4a39bd, #5b33b0); border-color: #4a39bd; box-shadow: inset 0 1px 0 rgba(255, 255, 255, .22), 0 2px 4px rgba(45, 30, 110, .14), 0 10px 22px -10px rgba(90, 72, 208, .6); }
[data-theme="aurora"] .btn.ghost { background-color: rgba(255, 255, 255, .7); }
[data-theme="aurora"] .btn.ghost:hover { background-color: #fff; border-color: #b9b0d8; }
[data-theme="aurora"] .pricing-card.recommended { box-shadow: 0 18px 44px -20px rgba(90, 72, 208, .45); }
[data-theme="aurora"] .pricing-tag { background-image: linear-gradient(135deg, #5a48d0, #6b3fc6); }
[data-theme="aurora"] .callout,
[data-theme="aurora"] .home-feature, [data-theme="aurora"] .component, [data-theme="aurora"] .table-wrap { border-radius: var(--r-lg); box-shadow: var(--shadow-aurora); }
[data-theme="aurora"] .theme-menu, [data-theme="aurora"] .switcher-list, [data-theme="aurora"] .user-panel { border-radius: 16px; box-shadow: 0 18px 44px -12px rgba(60, 40, 150, .3); }
[data-theme="aurora"] footer.site { background: rgba(255, 255, 255, .6); }

/* Dashboard */
[data-theme="aurora"] .app-body .app-side { background: rgba(255, 255, 255, .9); border-right-color: var(--border); }
[data-theme="aurora"] .app-body .app-side { background-image: linear-gradient(180deg, rgba(238, 234, 253, .55), rgba(255, 255, 255, 0) 28%); }
[data-theme="aurora"] .app-body .side-link[aria-current="page"] { background: linear-gradient(90deg, #ebe6fd, #f1eefd); color: #2c2296; }
[data-theme="aurora"] .app-body .side-link[aria-current="page"]::before { background: linear-gradient(180deg, #5a48d0, #8b6be0); }
[data-theme="aurora"] .app-body .side-brand { background: #fbfaff; }
[data-theme="aurora"] .ov-health { background-image: linear-gradient(100deg, color-mix(in srgb, var(--tone) 7%, transparent), rgba(255, 255, 255, 0) 50%); }
[data-theme="aurora"] .app-body .app-content tbody tr:hover { background: var(--hover); }
[data-theme="aurora"] th, [data-theme="aurora"] .app-body .app-content th { background: #f5f3fb; }
[data-theme="aurora"] .stat-ico, [data-theme="aurora"] .qa-ico, [data-theme="aurora"] .empty-icon { background: linear-gradient(140deg, #efeafe, #e3f4ee); }
[data-theme="aurora"] .chart .bar { fill: var(--accent); }
[data-theme="aurora"] .chart .bar.zero { fill: var(--border); }
[data-theme="aurora"] .mod-toggle[aria-checked="true"] .mod-toggle-track { background: var(--accent); }
[data-theme="aurora"] .toast, [data-theme="aurora"] .unsaved-bar,
[data-theme="aurora"] .palette, [data-theme="aurora"] .confirm-dialog { border-radius: 18px; box-shadow: 0 24px 60px -16px rgba(60, 40, 150, .35); }
[data-theme="aurora"] .unsaved-bar { border-radius: 999px; }

/* Less transparency or forced colours: a flat page. */
@media (prefers-reduced-transparency: reduce) {
  [data-theme="aurora"] body::before { display: none; }
  [data-theme="aurora"] .app-body .app-side, [data-theme="aurora"] .app-body .app-top, [data-theme="aurora"] .nav { background-color: var(--surface); }
}
@media (forced-colors: active) {
  [data-theme="aurora"] body::before { display: none; }
}
`;
