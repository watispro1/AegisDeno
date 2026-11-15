/**
 * Glass (beta) in the dashboard. The dashboard reads the same `aegis-theme`
 * choice from localStorage as the site (theme-init.js, never a cookie) and
 * has the same header theme picker in its top bar, plus a row in the account
 * menu. glass.ts styles what the site and the dashboard share (header,
 * buttons, menus, cards); this file adds the dashboard's own surfaces:
 * sidebar, top bar, stats, panels, forms and fields, toggles, selects,
 * tables, chips, the checklist and activity feed, charts, the embed builder,
 * empty states, toasts, the unsaved-changes bar and the dialogs.
 *
 * Blur budget: only the sticky sidebar, the top bar (drawn on ::before so
 * its menus can still blur the page), toasts, the unsaved bar and the
 * dialogs blur. Repeated surfaces (module cards, item cards, table rows,
 * fieldsets) are translucent without blur. Mobile sizes and the drawer at
 * 820px are left as they are; only colours, radii and shadows change.
 */
export const cssGlassDashboard = String.raw`
/* ── Glass (beta): dashboard ──────────────────────────────────────────── */
/* Sidebar: a tall glass pane with a light inner edge. */
[data-theme="glass"] .app-side {
  background-color: var(--surface); background-image: var(--glass-sheen);
  border-right: 1px solid var(--border); box-shadow: inset -1px 0 0 rgba(255, 255, 255, .04);
}
[data-theme="glass"] .side-link { border-radius: 12px; transition: background-color .2s var(--ease-glass), color .2s var(--ease-glass); }
[data-theme="glass"] .side-link:hover { background: rgba(255, 255, 255, .07); }
[data-theme="glass"] .side-link[aria-current="page"] {
  background: linear-gradient(90deg, rgba(169, 200, 255, .2), rgba(169, 200, 255, .07));
  box-shadow: inset 0 1px 0 var(--glass-hi), inset 3px 0 0 var(--accent), 0 2px 8px rgba(0, 0, 0, .25);
}
[data-theme="glass"] .nav-group-details summary { border-radius: 10px; }
[data-theme="glass"] .nav-group-details summary:hover { background: rgba(255, 255, 255, .06); }
[data-theme="glass"] .side-foot { border-top-color: rgba(255, 255, 255, .08); }
[data-theme="glass"] .side-link mark { background: rgba(169, 200, 255, .28); }

/* Top bar: a floating glass strip (desktop). */
[data-theme="glass"] .app-top { position: relative; z-index: 30; border-bottom-color: transparent; }
@media (min-width: 821px) {
  [data-theme="glass"] .app-top { padding: .35rem .5rem .35rem .6rem; margin-top: .6rem; }
  [data-theme="glass"] .app-top::before {
    content: ""; position: absolute; inset: 0; z-index: -1; border-radius: 20px; pointer-events: none;
    background-color: var(--surface); background-image: var(--glass-sheen);
    border: 1px solid var(--border); box-shadow: var(--glass-rim), var(--shadow-glass);
  }
}
@media (max-width: 820px) {
  [data-theme="glass"] .app-top { border-bottom-color: var(--border); }
}
[data-theme="glass"] .side-collapse { border-radius: 999px; border-color: var(--glass-edge); background: rgba(255, 255, 255, .05); }
[data-theme="glass"] .side-collapse:hover { background: rgba(255, 255, 255, .1); }
[data-theme="glass"] .user-menu summary { border-radius: 999px; }
[data-theme="glass"] .user-menu summary:hover { background: rgba(255, 255, 255, .08); }
[data-theme="glass"] .user-theme-picker .btn[aria-pressed="true"] { background-color: rgba(169, 200, 255, .2); border-color: var(--accent); }
[data-theme="glass"] .top-switcher summary,
[data-theme="glass"] .switcher summary { background: rgba(255, 255, 255, .06); border-color: var(--glass-edge); box-shadow: inset 0 1px 0 var(--glass-hi); }

/* Fields: recessed glass wells with a crisp focus ring. */
[data-theme="glass"] .field input[type="text"], [data-theme="glass"] .field input[type="number"],
[data-theme="glass"] .field input[type="url"], [data-theme="glass"] .field select,
[data-theme="glass"] .field textarea, [data-theme="glass"] .filter-bar input, [data-theme="glass"] .filter-bar select,
[data-theme="glass"] .top-search input, [data-theme="glass"] .side-filter-input, [data-theme="glass"] .switcher-filter input,
[data-theme="glass"] .table-search, [data-theme="glass"] .search-bar select, [data-theme="glass"] .list-sort select,
[data-theme="glass"] .mod-filter, [data-theme="glass"] .pick-search, [data-theme="glass"] .select-search,
[data-theme="glass"] .review-form input[type="text"], [data-theme="glass"] .palette input {
  color: var(--text); background-color: rgba(4, 6, 10, .38); border: 1px solid rgba(255, 255, 255, .14); border-radius: 12px;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, .35), 0 1px 0 rgba(255, 255, 255, .05);
  transition: border-color .2s var(--ease-glass), box-shadow .2s var(--ease-glass), background-color .2s var(--ease-glass);
}
[data-theme="glass"] .field input:hover, [data-theme="glass"] .field select:hover, [data-theme="glass"] .field textarea:hover,
[data-theme="glass"] .filter-bar input:hover, [data-theme="glass"] .filter-bar select:hover { border-color: rgba(255, 255, 255, .24); }
[data-theme="glass"] .field input:focus, [data-theme="glass"] .field select:focus, [data-theme="glass"] .field textarea:focus,
[data-theme="glass"] .filter-bar input:focus, [data-theme="glass"] .filter-bar select:focus, [data-theme="glass"] .top-search input:focus,
[data-theme="glass"] .side-filter-input:focus, [data-theme="glass"] .table-search:focus, [data-theme="glass"] .palette input:focus {
  outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); background-color: rgba(4, 6, 10, .5);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, .35), 0 0 0 5px rgba(169, 200, 255, .18);
}
[data-theme="glass"] .field [aria-invalid="true"] { border-color: var(--danger); box-shadow: inset 0 1px 2px rgba(0, 0, 0, .35), 0 0 0 3px rgba(255, 154, 146, .15); }
[data-theme="glass"] ::placeholder { color: var(--faint); opacity: 1; }
/* Native dropdown lists are drawn by the OS: give them the solid palette. */
[data-theme="glass"] select option, [data-theme="glass"] select optgroup { background-color: #161a22; color: var(--text); }
[data-theme="glass"] .check input, [data-theme="glass"] input[type="radio"] { accent-color: var(--accent); }
[data-theme="glass"] .field-help, [data-theme="glass"] .check span small { color: var(--muted); }

/* Toggles: a frosted track with a lit knob that springs across. */
[data-theme="glass"] .mod-toggle { border-radius: 999px; border-color: var(--glass-edge); background: rgba(255, 255, 255, .05); box-shadow: inset 0 1px 0 var(--glass-hi); }
[data-theme="glass"] .mod-toggle:hover { background: rgba(255, 255, 255, .1); border-color: rgba(255, 255, 255, .24); }
[data-theme="glass"] .mod-toggle-track { background: rgba(255, 255, 255, .16); box-shadow: inset 0 1px 2px rgba(0, 0, 0, .45); transition: background-color .3s var(--ease-glass); }
[data-theme="glass"] .mod-toggle-track::after { background: #f4f6fa; box-shadow: 0 1px 3px rgba(0, 0, 0, .45), inset 0 -1px 0 rgba(0, 0, 0, .12); transition: transform .45s var(--spring); }
[data-theme="glass"] .mod-toggle[aria-checked="true"] .mod-toggle-track { background: linear-gradient(180deg, #8fe6b3, #5cc98d); box-shadow: inset 0 1px 2px rgba(0, 0, 0, .25), 0 0 10px rgba(127, 220, 166, .3); }

/* Panels, fieldsets and cards that only the dashboard has. */
[data-theme="glass"] .dash-form fieldset, [data-theme="glass"] .mod-settings > fieldset, [data-theme="glass"] .item-card,
[data-theme="glass"] .help-panel, [data-theme="glass"] .guild-item, [data-theme="glass"] .panel-item, [data-theme="glass"] .dash-error,
[data-theme="glass"] .dash-landing-preview, [data-theme="glass"] .confirm-form, [data-theme="glass"] .mod-head,
[data-theme="glass"] .notice, [data-theme="glass"] .error-summary, [data-theme="glass"] .stat {
  border-radius: var(--r-lg); border-color: var(--border);
}
[data-theme="glass"] .dash-form fieldset, [data-theme="glass"] .mod-settings > fieldset, [data-theme="glass"] .item-card,
[data-theme="glass"] .help-panel, [data-theme="glass"] .guild-item, [data-theme="glass"] .panel-item, [data-theme="glass"] .dash-error,
[data-theme="glass"] .dash-landing-preview, [data-theme="glass"] .confirm-form, [data-theme="glass"] .mod-head {
  background-image: var(--glass-sheen); box-shadow: var(--glass-rim), var(--shadow-glass);
}
[data-theme="glass"] .item-card, [data-theme="glass"] .guild-item {
  background-image: var(--glass-spec), var(--glass-sheen); background-size: 260% 100%, 100% 100%;
  background-position: 115% 0, 0 0; background-repeat: no-repeat;
  transition: background-position 1.1s var(--ease-glass), border-color .3s var(--ease-glass), transform .45s var(--spring);
}
[data-theme="glass"] .item-card:hover, [data-theme="glass"] a.guild-item:hover { background-position: -15% 0, 0 0; border-color: rgba(255, 255, 255, .22); }
[data-theme="glass"] a.guild-item:hover { transform: translateY(-1px); }
[data-theme="glass"] .dash-form legend { padding: .15rem .7rem; border-radius: 999px; background: rgba(255, 255, 255, .07); box-shadow: inset 0 1px 0 var(--glass-hi); }
[data-theme="glass"] .notice { background-image: linear-gradient(90deg, rgba(127, 220, 166, .1), rgba(127, 220, 166, 0) 45%); }
[data-theme="glass"] .notice.bad, [data-theme="glass"] .error-summary { background-image: linear-gradient(90deg, rgba(255, 154, 146, .1), rgba(255, 154, 146, 0) 45%); }
[data-theme="glass"] .preview, [data-theme="glass"] .quote-block, [data-theme="glass"] .dash-error-code { border-radius: 12px; background-color: rgba(4, 6, 10, .35); border-color: rgba(255, 255, 255, .1); }
[data-theme="glass"] .mod-icon { border-radius: 10px; background: rgba(255, 255, 255, .07); box-shadow: inset 0 1px 0 var(--glass-hi); }
[data-theme="glass"] .module-card.mod-card a { background: transparent; }
[data-theme="glass"] .count-badge { background: rgba(255, 255, 255, .1); }
[data-theme="glass"] .g-icon, [data-theme="glass"] .avatar, [data-theme="glass"] .avatar-fallback { box-shadow: 0 0 0 1px rgba(255, 255, 255, .18), 0 2px 6px rgba(0, 0, 0, .35); }

/* Stats strip: one glass band, hairline cells. */
[data-theme="glass"] .stat-grid > * { border-color: rgba(255, 255, 255, .08); }
[data-theme="glass"] .stat dd { text-shadow: 0 1px 2px rgba(0, 0, 0, .35); }

/* Tables: a frosted header, hairline rows, readable hover. */
[data-theme="glass"] th { background: rgba(255, 255, 255, .055); color: var(--muted); border-bottom-color: rgba(255, 255, 255, .12); }
[data-theme="glass"] td { border-bottom-color: rgba(255, 255, 255, .07); }
[data-theme="glass"] tbody tr:last-child td { border-bottom-color: transparent; }
[data-theme="glass"] .case-table tbody tr:hover, [data-theme="glass"] .member-list a:hover { background-color: rgba(255, 255, 255, .05); }
[data-theme="glass"] .tag { border-radius: 999px; padding-left: .45rem; padding-right: .45rem; background: rgba(255, 255, 255, .04); }
[data-theme="glass"] .var-table code, [data-theme="glass"] td code.inline { background: rgba(255, 255, 255, .07); border-color: rgba(255, 255, 255, .1); }

/* Chips and filters. */
[data-theme="glass"] .chip, [data-theme="glass"] .mod-chip, [data-theme="glass"] .quick-filters a {
  border-radius: 999px; border-color: var(--glass-edge); background: rgba(255, 255, 255, .04);
  transition: background-color .2s var(--ease-glass), border-color .2s var(--ease-glass), color .2s var(--ease-glass);
}
[data-theme="glass"] .chip:hover, [data-theme="glass"] .mod-chip:hover { background: rgba(255, 255, 255, .09); border-color: rgba(255, 255, 255, .26); color: var(--text); }
[data-theme="glass"] .chip[aria-pressed="true"], [data-theme="glass"] .mod-chip[aria-pressed="true"], [data-theme="glass"] .quick-filters a[aria-current="true"] { color: var(--text); background: rgba(169, 200, 255, .2); border-color: rgba(169, 200, 255, .55); box-shadow: inset 0 1px 0 var(--glass-hi); }
[data-theme="glass"] .pick-chip { border-radius: 999px; background: rgba(169, 200, 255, .16); }

/* Checklist, activity feed, charts. */
[data-theme="glass"] .check-icon { box-shadow: 0 0 0 3px rgba(255, 255, 255, .06), 0 2px 6px rgba(0, 0, 0, .35); }
[data-theme="glass"] .feed li, [data-theme="glass"] .checklist li { border-bottom-color: rgba(255, 255, 255, .07); }
[data-theme="glass"] .chart .bar { fill: var(--accent); fill-opacity: .9; transition: fill-opacity .2s var(--ease-glass); }
[data-theme="glass"] .chart .bar:hover { fill-opacity: 1; fill: var(--accent-hover); }
[data-theme="glass"] .chart .bar.zero { fill: rgba(255, 255, 255, .14); fill-opacity: 1; }
[data-theme="glass"] .chart .bar.alt { fill: var(--warn); }
[data-theme="glass"] .trust-chart .bar.low { fill: var(--danger); }

/* Embed builder and panel previews: Discord's colours in a floating window. */
[data-theme="glass"] .embed-preview, [data-theme="glass"] .panel-preview { border-radius: 16px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08), var(--shadow-float); }

/* Empty states. */
[data-theme="glass"] .empty-state { border-radius: var(--r-lg); border-color: rgba(255, 255, 255, .18); background: rgba(255, 255, 255, .025); }

/* Toasts, the unsaved bar and dialogs: solid by default (fallback). */
[data-theme="glass"] .toast { border: 1px solid var(--border-strong); border-left-width: 1px; border-radius: 16px; background-color: #161a22; background-image: var(--glass-sheen); box-shadow: inset 3px 0 0 var(--ok), var(--glass-rim), var(--shadow-float); }
[data-theme="glass"] .toast.bad { box-shadow: inset 3px 0 0 var(--danger), var(--glass-rim), var(--shadow-float); }
[data-theme="glass"] .unsaved-bar { border-radius: 999px; color: var(--text); background-color: #161a22; background-image: var(--glass-sheen); border: 1px solid var(--border-strong); box-shadow: var(--glass-rim), var(--shadow-float); }
[data-theme="glass"] .unsaved-bar .btn.ghost { color: var(--text); border-color: var(--glass-edge); background-color: rgba(255, 255, 255, .06); }
[data-theme="glass"] .palette, [data-theme="glass"] .confirm-dialog {
  border-radius: 22px; border-color: var(--border-strong); background-color: #12151d; background-image: var(--glass-sheen);
  box-shadow: var(--glass-rim), 0 30px 80px rgba(0, 0, 0, .6);
}
[data-theme="glass"] .palette::backdrop, [data-theme="glass"] .confirm-dialog::backdrop { background: rgba(4, 5, 8, .6); }
[data-theme="glass"] .palette-item { border-radius: 10px; }
[data-theme="glass"] .palette-item.active, [data-theme="glass"] .palette-item:hover { background: rgba(169, 200, 255, .18); box-shadow: inset 0 1px 0 var(--glass-hi); }
[data-theme="glass"] .drawer-backdrop { background: rgba(4, 5, 8, .55); }
[data-theme="glass"] kbd { border-radius: 6px; background: rgba(255, 255, 255, .08); border-color: rgba(255, 255, 255, .16); box-shadow: inset 0 -1px 0 rgba(0, 0, 0, .3); }

@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  [data-theme="glass"] .app-side,
  [data-theme="glass"] .app-top::before {
    -webkit-backdrop-filter: blur(24px) saturate(170%);
    backdrop-filter: blur(24px) saturate(170%);
  }
  [data-theme="glass"] .toast,
  [data-theme="glass"] .unsaved-bar,
  [data-theme="glass"] .palette,
  [data-theme="glass"] .confirm-dialog {
    background-color: var(--glass-strong);
    -webkit-backdrop-filter: blur(30px) saturate(180%);
    backdrop-filter: blur(30px) saturate(180%);
  }
  [data-theme="glass"] .palette::backdrop,
  [data-theme="glass"] .confirm-dialog::backdrop {
    background: rgba(4, 5, 8, .45);
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
  }
  @media (max-width: 820px) {
    [data-theme="glass"] .app-side { background-color: var(--glass-strong); }
  }
}
@media (prefers-reduced-transparency: reduce) {
  [data-theme="glass"] .toast,
  [data-theme="glass"] .unsaved-bar,
  [data-theme="glass"] .palette,
  [data-theme="glass"] .confirm-dialog,
  [data-theme="glass"] .app-side { background-color: #161a22; }
  [data-theme="glass"] .app-top::before { background-color: #161a22; }
  [data-theme="glass"] .palette::backdrop,
  [data-theme="glass"] .confirm-dialog::backdrop { background: rgba(4, 5, 8, .85); }
  [data-theme="glass"] .field input[type="text"], [data-theme="glass"] .field input[type="number"],
  [data-theme="glass"] .field select, [data-theme="glass"] .field textarea,
  [data-theme="glass"] .filter-bar input, [data-theme="glass"] .filter-bar select { background-color: #0b0d12; }
}
@media (prefers-reduced-motion: reduce) {
  [data-theme="glass"] .mod-toggle-track::after { transition: none; }
  [data-theme="glass"] .item-card, [data-theme="glass"] .guild-item { transition: border-color .15s linear; }
  [data-theme="glass"] a.guild-item:hover { transform: none; }
}
`;
