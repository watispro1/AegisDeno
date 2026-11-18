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
  --r: 8px;
  --r-lg: 14px;
  /* The dawn wash behind the page, at its strongest (flattened over --bg). */
  --aurora-a: #e7dffb;
  --aurora-b: #dcf1e8;
  --aurora-c: #fae3d6;
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
[data-theme="aurora"] .app-body .app-top { background-color: rgba(247, 245, 251, .94); }
[data-theme="aurora"] ::selection { background: #d9d1fb; color: var(--text); }
[data-theme="aurora"] h1, [data-theme="aurora"] h2 { letter-spacing: -.018em; }

/* Site chrome */
[data-theme="aurora"] .nav { background: rgba(247, 245, 251, .94); border-bottom-color: var(--border); }
[data-theme="aurora"] .nav-link[aria-current="page"] { box-shadow: inset 0 -2px 0 var(--accent); }
[data-theme="aurora"] .btn, [data-theme="aurora"] .mod-chip, [data-theme="aurora"] .chip { border-radius: 999px; }
[data-theme="aurora"] .btn:not(.ghost):not(.danger) { box-shadow: 0 1px 2px rgba(45, 30, 110, .12), 0 6px 16px -8px rgba(90, 72, 208, .55); }
[data-theme="aurora"] .card, [data-theme="aurora"] .panel, [data-theme="aurora"] .callout,
[data-theme="aurora"] .home-feature, [data-theme="aurora"] .component, [data-theme="aurora"] .table-wrap { border-radius: var(--r-lg); box-shadow: var(--shadow-aurora); }
[data-theme="aurora"] .theme-menu, [data-theme="aurora"] .switcher-list, [data-theme="aurora"] .user-panel { border-radius: 16px; box-shadow: 0 18px 44px -12px rgba(60, 40, 150, .3); }
[data-theme="aurora"] footer.site { background: rgba(255, 255, 255, .6); }

/* Dashboard */
[data-theme="aurora"] .app-body .app-side { background: rgba(255, 255, 255, .82); border-right-color: var(--border); }
[data-theme="aurora"] .app-body .side-link[aria-current="page"] { background: var(--accent-soft); color: #2c2296; }
[data-theme="aurora"] .app-body .side-brand { background: #fbfaff; }
[data-theme="aurora"] .ov-health { background-image: linear-gradient(110deg, rgba(235, 228, 251, .55), rgba(255, 255, 255, 0) 55%); }
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
