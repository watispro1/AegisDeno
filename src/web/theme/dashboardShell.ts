/**
 * Dashboard 2.0 app shell: the full-height sidebar, the sticky top bar, the
 * content column and footer, the collapsed sidebar and the phone drawer.
 * Server pages render with layout({ app: true }), so <body class="app-body">
 * carries no marketing nav or site footer and every rule here is scoped to
 * .app-body. Colours are theme tokens only; shape and depth come from the
 * --d-* tokens below, which themes may override (Steel & Ink squares them,
 * Glass and Aurora round them off).
 */
export const cssDashboardShell = String.raw`/* ── Dashboard 2.0: shell ──────────────────────────────────────────── */
.app-body {
  --d-side-w: 16.5rem;
  --d-top-h: 3.6rem;
  --d-r: 8px;
  --d-r-lg: 12px;
  --d-gap: 1.25rem;
  --d-pad: clamp(1rem, 2.4vw, 2rem);
  --d-content: 84rem;
  --d-shadow: 0 1px 2px rgba(20, 20, 18, .04), 0 2px 10px -4px rgba(20, 20, 18, .07);
  --d-shadow-hover: 0 2px 4px rgba(20, 20, 18, .06), 0 12px 28px -10px rgba(20, 20, 18, .16);
  --d-ease: cubic-bezier(.2, .8, .2, 1);
  min-height: 100vh;
  background-color: var(--bg);
}
[data-theme="dark"] .app-body { --d-shadow: 0 1px 2px rgba(0, 0, 0, .3); --d-shadow-hover: 0 10px 28px -10px rgba(0, 0, 0, .6); }
[data-theme="steel"] .app-body { --d-r: 4px; --d-r-lg: 6px; --d-shadow: none; --d-shadow-hover: none; }
.app-body :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.app-body .skip-link:focus { z-index: 100; }

/* Grid: sidebar and main column, edge to edge. */
.app-body .app { display: grid; grid-template-columns: var(--d-side-w) minmax(0, 1fr); max-width: none; margin: 0; min-height: 100vh; }
.app-body .app-main { display: flex; flex-direction: column; min-width: 0; padding: 0; }

/* Sidebar: logo, server card, filter, scrolling nav, footer links. */
.app-body .app-side {
  position: sticky; top: 0; align-self: start; height: 100vh; max-height: 100vh;
  display: flex; flex-direction: column; gap: .7rem; padding: .85rem .75rem .75rem;
  overflow: hidden; border-right: 1px solid var(--border); background-color: var(--surface);
}
.app-body .side-head { display: flex; align-items: center; justify-content: space-between; gap: .5rem; margin: 0; padding: 0 .2rem; border: 0; }
.side-logo { display: inline-flex; align-items: center; gap: .55rem; min-height: 36px; padding: 0 .2rem; border-radius: var(--d-r); color: var(--text); text-decoration: none; font-weight: 700; font-size: 1rem; letter-spacing: -.01em; }
.side-logo:hover { color: var(--text); }
.side-logo-text { display: inline-flex; align-items: center; gap: .5rem; }
.side-logo-tag { padding: .05rem .45rem; border: 1px solid var(--border); border-radius: 999px; font: 500 .66rem/1.5 var(--mono); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.side-server { margin: 0; }
.app-body .side-brand { display: flex; align-items: center; gap: .65rem; min-height: 52px; padding: .5rem .6rem; border: 1px solid var(--border); border-radius: var(--d-r-lg); background-color: var(--bg); color: var(--text); text-decoration: none; transition: border-color .15s var(--d-ease), background-color .15s var(--d-ease); }
.app-body .side-brand:hover { border-color: var(--border-strong); background: var(--hover); }
.app-body .side-brand:hover .side-brand-name { color: var(--text); }
.side-brand-text { display: grid; min-width: 0; line-height: 1.3; }
.side-brand-meta { overflow: hidden; font-size: .78rem; font-weight: 400; color: var(--muted); text-overflow: ellipsis; white-space: nowrap; }
.app-body .side-filter { margin: 0; }
.app-body .side-filter-input { width: 100%; min-height: 36px; padding: .3rem .65rem; border-radius: var(--d-r); font-size: .86rem; }
.side-scroll { flex: 1 1 auto; min-height: 0; margin: 0 -.4rem; padding: 0 .4rem .5rem; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--scroll-thumb) transparent; }
.app-body .nav-group { margin: 0 0 .55rem; }
.app-body .nav-group-details summary { min-height: 30px; padding: .2rem .55rem; border-radius: var(--d-r); }
.app-body .nav-group-title { font: 600 .68rem/1.4 var(--sans); letter-spacing: .08em; color: var(--faint); }
.app-body .side-link { position: relative; gap: .6rem; min-height: 36px; padding: .3rem .6rem; border-radius: var(--d-r); font-size: .89rem; font-weight: 500; color: var(--text-2); box-shadow: none; }
.app-body .side-link:hover { background: var(--hover); color: var(--text); }
.app-body .side-link[aria-current="page"] { background: var(--accent-soft); color: var(--text); font-weight: 600; box-shadow: none; }
.app-body .side-link[aria-current="page"]::before { content: ""; position: absolute; left: -.4rem; top: 22%; bottom: 22%; width: 3px; border-radius: 3px; background: var(--accent); }
.app-body .side-icon { display: inline-grid; place-items: center; flex: none; width: 1.25rem; color: var(--muted); }
.app-body .side-link:hover .side-icon { color: var(--text); }
.app-body .side-link[aria-current="page"] .side-icon { color: var(--accent); }
.side-icon .ico, .drawer-close .ico { width: 18px; height: 18px; }
.app-body .side-foot { margin: 0; padding: .6rem .35rem 0; border-top: 1px solid var(--border); }

/* Top bar: sticky, solid in every theme but Glass (which frosts it). */
.app-body .app-top {
  position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: .5rem;
  min-height: var(--d-top-h); margin: 0; padding: .45rem var(--d-pad);
  border-bottom: 1px solid var(--border); background-color: var(--bg);
}
.app-body .app-top-switcher { flex: 0 1 auto; min-width: 0; max-width: 16rem; }
.app-body .top-switcher summary { min-height: 38px; border-radius: var(--d-r); background-color: var(--surface); }
.switcher-heading { padding: .35rem .6rem .15rem; font: 600 .68rem/1.4 var(--sans); letter-spacing: .07em; text-transform: uppercase; color: var(--faint); }
.app-body .top-search { position: relative; flex: 1 1 16rem; max-width: 30rem; margin: 0; }
.app-body .top-search input { width: 100%; min-height: 38px; padding: .35rem .75rem .35rem 2.15rem; border: 1px solid var(--border); border-radius: var(--d-r); background-color: var(--surface); color: var(--text); font: inherit; font-size: .9rem; }
.app-body .top-search input:hover { border-color: var(--border-strong); }
.app-body .top-search input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
.top-search-icon { position: absolute; left: .7rem; top: 50%; display: flex; color: var(--faint); transform: translateY(-50%); pointer-events: none; }
.top-search-icon .ico { width: 16px; height: 16px; }
.app-top-actions { display: flex; align-items: center; gap: .3rem; margin-left: auto; }
.app-body .palette-btn { gap: .45rem; min-height: 38px; padding: .25rem .6rem; border-radius: var(--d-r); color: var(--text-2); }
.palette-btn .ico, .shortcuts-btn .ico, .side-collapse .ico, .drawer-toggle .ico { width: 17px; height: 17px; }
.palette-kbd { padding: .05rem .35rem; border: 1px solid var(--border); border-radius: 4px; font: 500 .68rem/1.4 var(--mono); color: var(--muted); }
.app-body .shortcuts-btn, .app-body .side-collapse { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; padding: 0; border: 1px solid transparent; border-radius: var(--d-r); background: transparent; color: var(--muted); cursor: pointer; }
.app-body .shortcuts-btn:hover, .app-body .side-collapse:hover { border-color: var(--border); background: var(--hover); color: var(--text); }
.app-body .side-collapse[aria-pressed="true"] .ico { transform: scaleX(-1); }
.app-body .user-menu summary { min-height: 38px; padding: .2rem .45rem .2rem .2rem; }
.app-body .avatar { width: 1.9rem; height: 1.9rem; font-size: .8rem; }
.app-body .user-panel { width: 19rem; padding: .9rem; border-radius: var(--d-r-lg); }
.user-panel-head { display: flex; align-items: center; gap: .65rem; margin: 0 0 .7rem; }
.user-panel-head p { margin: 0; line-height: 1.35; font-size: .88rem; }
.user-panel-links { font-size: .86rem; }
.app-body .user-panel form { margin-top: .7rem; }
.app-body .user-theme-picker { gap: .3rem; }
.app-body .user-theme-picker .btn[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); }

/* Content column and footer. */
.app-body .app-content { flex: 1 0 auto; width: 100%; max-width: var(--d-content); margin: 0 auto; padding: 1.5rem var(--d-pad) 2rem; }
.app-body .app-content:focus { outline: none; }
.dash-foot-wrap { width: 100%; max-width: var(--d-content); margin: 0 auto; padding: 0 var(--d-pad) 1.5rem; }
.app-body .dash-foot { margin: 0; padding-top: 1rem; border-top: 1px solid var(--border); font-size: .82rem; }

/* Collapsed sidebar (desktop, toggled with [). */
.app-body .app[data-collapsed] { grid-template-columns: 4.25rem minmax(0, 1fr); }
.app-body .app[data-collapsed] .app-side { padding-left: .55rem; padding-right: .55rem; }
.app[data-collapsed] .side-logo-text, .app[data-collapsed] .side-brand-text, .app[data-collapsed] .side-filter,
.app[data-collapsed] .side-foot, .app[data-collapsed] .nav-group-details summary { display: none; }
.app-body .app[data-collapsed] .side-head { justify-content: center; }
.app-body .app[data-collapsed] .side-brand { justify-content: center; min-height: 44px; padding: .35rem; }
.app-body .app[data-collapsed] .side-link { justify-content: center; padding: .35rem; }
.app-body .app[data-collapsed] .side-link[aria-current="page"]::before { left: -.55rem; }

/* Tablets: the search shrinks, the Jump-to label goes. */
@media (max-width: 1100px) {
  .palette-btn-text { display: none; }
}

/* Phones: the sidebar becomes a drawer and search gets its own row. */
@media (max-width: 820px) {
  .app-body .app { display: block; }
  .app-body .app-top { flex-wrap: wrap; row-gap: .45rem; padding: .5rem 1rem; }
  .app-body .side-collapse, .app-body .shortcuts-btn { display: none; }
  /* Jump-to stays reachable by touch: an icon button, without the Ctrl K hint. */
  .app-body .palette-btn { min-width: 38px; justify-content: center; padding: .25rem .5rem; }
  .app-body .palette-kbd { display: none; }
  /* 16px inputs so iOS does not zoom the page on focus. */
  .app-body .top-search input, .app-body .side-filter-input, .app-body .table-search { font-size: 1rem; }
  .app-body .drawer-toggle { gap: .4rem; min-height: 38px; }
  .app-body .app-top-switcher { flex: 1 1 0; min-width: 0; max-width: none; }
  .app-body .top-switcher summary { width: 100%; }
  .app-body .app-top-actions { gap: .15rem; }
  .app-body .top-search { display: block; order: 10; flex: 1 1 100%; max-width: none; }
  .app-body .app-content { padding: 1.1rem 1rem 1.5rem; }
  .dash-foot-wrap { padding: 0 1rem 1.25rem; }
  .js .app-body .app-side {
    position: fixed; z-index: 50; inset: 0 auto 0 0; width: min(19rem, 86vw); height: 100%; max-height: none;
    transform: translateX(-105%); transition: transform .22s var(--d-ease); box-shadow: 0 0 40px rgba(0, 0, 0, .35);
  }
  .js .app-body .app[data-drawer-open] .app-side { transform: none; }
  html:not(.js) .app-body .app-side { position: static; height: auto; max-height: none; border-right: 0; border-bottom: 1px solid var(--border); }
  .app-body .drawer-close { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; }
}
@media (max-width: 480px) {
  .app-body .drawer-toggle span { display: none; }
  .app-body .top-switcher .g-name { display: inline; max-width: 9rem; }
}

@media (prefers-reduced-motion: reduce) {
  .app-body *, .app-body *::before, .app-body *::after { transition-duration: .01ms !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; }
}
@media (forced-colors: active) {
  .app-body .side-link[aria-current="page"] { outline: 2px solid CanvasText; outline-offset: -2px; }
}
`;
