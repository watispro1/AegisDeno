/**
 * Dashboard app layout (v2 redesign): modern SaaS sidebar with server switcher and
 * module groups, top bar, module cards, charts, embed builder preview,
 * toasts, the unsaved-changes bar and the confirm dialog. Uses the site's
 * colour variables, so light and dark themes both work cleanly.
 */
export const cssDashboardApp = String.raw`/* ── Dashboard app shell ────────────────────────────────────────────── */
.app { display: grid; grid-template-columns: 17rem minmax(0, 1fr); gap: 0; max-width: 96rem; margin: 0 auto; min-height: calc(100vh - var(--nav-h, 3.5rem)); }
.app-side { border-right: 1px solid var(--border); background: var(--surface); padding: 1.25rem .85rem 2.5rem; position: sticky; top: 0; align-self: start; max-height: 100vh; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
.app-side::-webkit-scrollbar { width: 5px; }
.app-side::-webkit-scrollbar-thumb { background: var(--border); border-radius: 999px; }
.app-main { min-width: 0; padding: 0 2rem 2.5rem; }
.app-top { display: flex; align-items: center; gap: .85rem; min-height: 3.75rem; border-bottom: 1px solid var(--border); margin: 0 0 1.5rem; padding: 0 .25rem; }
.app-top-title { font-weight: 600; font-size: 1.05rem; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.app-content > .breadcrumbs { margin-top: 0; }
.drawer-toggle { display: none; }
.dash-foot { margin-top: 3.5rem; font-size: .85rem; padding-top: 1.25rem; border-top: 1px solid var(--border); }

.switcher { position: relative; margin: 0 0 1rem; }
.switcher summary { list-style: none; display: flex; align-items: center; gap: .65rem; min-height: 48px; padding: .45rem .75rem; border: 1px solid var(--border); border-radius: var(--r-lg, var(--r)); cursor: pointer; background: var(--bg); transition: border-color .15s ease, background .15s ease; }
.switcher summary::-webkit-details-marker { display: none; }
.switcher summary:focus-visible, .user-menu summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.g-icon { display: inline-grid; place-items: center; width: 2.25rem; height: 2.25rem; flex-shrink: 0; border-radius: 8px; background: var(--accent); color: var(--accent-ink); font-weight: 700; font-size: .95rem; }
.g-icon.sm { width: 1.6rem; height: 1.6rem; font-size: .78rem; border-radius: 6px; margin-right: .55rem; }
.g-icon.has-img { object-fit: cover; border-radius: 8px; }
.g-name { flex: 1; min-width: 0; font-weight: 600; font-size: .92rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.caret { color: var(--muted); font-size: .8rem; transition: transform .15s ease; }
.switcher-current:hover { border-color: var(--border-strong); background: var(--bg-sunk); }
.switcher-list { position: absolute; z-index: 30; left: 0; right: 0; top: calc(100% + .35rem); margin: 0; padding: .4rem; list-style: none; border: 1px solid var(--border-strong); border-radius: var(--r-lg, var(--r)); background: var(--surface); max-height: 60vh; overflow-y: auto; box-shadow: 0 10px 30px rgba(0,0,0,.18); }
.switcher-list li { margin: 0; }
.switcher-list a { display: flex; align-items: center; min-height: 40px; padding: .35rem .6rem; border-radius: var(--r); color: var(--text); text-decoration: none; font-size: .9rem; overflow-wrap: anywhere; transition: background .12s ease; }
.switcher-list a:hover, .switcher-list a:focus-visible { background: var(--bg-sunk); }
.switcher-all { border-top: 1px solid var(--border); margin-top: .3rem !important; padding-top: .35rem; }

.side-head { display: flex; align-items: center; justify-content: space-between; gap: .5rem; margin: 0 0 .85rem; padding: 0 .2rem .85rem; border-bottom: 1px solid var(--border); }
.side-brand { display: flex; align-items: center; gap: .65rem; min-width: 0; font-weight: 600; font-size: .95rem; color: var(--text); text-decoration: none; border-radius: var(--r); padding: .25rem; transition: color .12s ease; }
.side-brand:hover .side-brand-name { color: var(--accent); }
.side-brand-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.drawer-close { display: none; background: transparent; border: 0; font-size: 1.15rem; color: var(--muted); cursor: pointer; padding: .25rem .45rem; border-radius: var(--r); }
.drawer-close:hover { color: var(--text); background: var(--bg-sunk); }
.drawer-backdrop { display: none; position: fixed; inset: 0; z-index: 48; background: rgba(0,0,0,.5); opacity: 0; pointer-events: none; transition: opacity .2s ease; }

.app-top-switcher { flex: 0 1 auto; min-width: 0; max-width: 18rem; }
.top-switcher { position: relative; margin: 0; }
.top-switcher summary { list-style: none; display: flex; align-items: center; gap: .5rem; min-height: 38px; padding: .25rem .6rem; border: 1px solid var(--border); border-radius: var(--r-lg, var(--r)); cursor: pointer; background: var(--bg); font-size: .88rem; transition: border-color .15s ease, background .15s ease; }
.top-switcher summary::-webkit-details-marker { display: none; }
.top-switcher summary:hover { border-color: var(--border-strong); background: var(--bg-sunk); }
.top-switcher summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.top-switcher .g-name { max-width: 12rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.top-switcher .switcher-list { position: absolute; z-index: 40; left: 0; top: calc(100% + .35rem); min-width: 15rem; max-width: 22rem; margin: 0; padding: .4rem; list-style: none; border: 1px solid var(--border-strong); border-radius: var(--r-lg, var(--r)); background: var(--surface); max-height: 60vh; overflow-y: auto; box-shadow: 0 10px 30px rgba(0,0,0,.18); }
.top-switcher .switcher-list li { margin: 0; }
.top-switcher .switcher-list a { display: flex; align-items: center; min-height: 38px; padding: .35rem .6rem; border-radius: var(--r); color: var(--text); text-decoration: none; overflow-wrap: anywhere; }
.top-switcher .switcher-list a:hover, .top-switcher .switcher-list a:focus-visible { background: var(--bg-sunk); }

.side-nav, .side-nav ul { list-style: none; margin: 0; padding: 0; }
.nav-group { margin: 0 0 .65rem; }
.nav-group-details summary { list-style: none; cursor: pointer; user-select: none; display: flex; align-items: center; justify-content: space-between; padding: .4rem .65rem; border-radius: var(--r); transition: background .15s ease; }
.nav-group-details summary::-webkit-details-marker { display: none; }
.nav-group-details summary:hover { background: var(--bg-sunk); }
.nav-group-title { font-size: .7rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--faint); font-family: var(--mono); }
.nav-caret { font-size: .65rem; color: var(--faint); transition: transform .15s ease; }
.nav-group-details:not([open]) .nav-caret { transform: rotate(-90deg); }
.nav-group-items { list-style: none; margin: .2rem 0 0; padding: 0; }
.side-nav li { margin: 0; }
.side-link { display: flex; align-items: center; gap: .65rem; min-height: 38px; padding: .35rem .65rem; border-radius: var(--r-lg, var(--r)); color: var(--text-2); text-decoration: none; font-size: .91rem; font-weight: 500; transition: background .12s ease, color .12s ease, transform .12s ease; }
.side-link:hover { background: var(--bg-sunk); color: var(--text); }
.side-link:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.side-link[aria-current="page"] { background: var(--accent-soft); color: var(--text); font-weight: 600; box-shadow: inset 3px 0 0 var(--accent); }
.side-icon { width: 1.35rem; text-align: center; color: var(--muted); font-size: .95rem; }

.user-menu { position: relative; }
.user-menu summary { list-style: none; display: flex; align-items: center; gap: .55rem; min-height: 42px; padding: .25rem .55rem; border-radius: 999px; cursor: pointer; transition: background .12s ease; }
.user-menu summary::-webkit-details-marker { display: none; }
.user-menu summary:hover { background: var(--bg-sunk); }
.avatar { display: inline-grid; place-items: center; width: 2.1rem; height: 2.1rem; border-radius: 50%; background: var(--text); color: var(--bg); font-weight: 700; font-size: .88rem; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
.avatar.has-img { object-fit: cover; }
.user-name { max-width: 10rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .9rem; font-weight: 500; }
.user-panel { position: absolute; right: 0; top: calc(100% + .35rem); z-index: 30; width: 17.5rem; padding: 1rem 1.1rem; border: 1px solid var(--border-strong); border-radius: var(--r-lg, var(--r)); background: var(--surface); box-shadow: 0 12px 32px rgba(0,0,0,.18); font-size: .9rem; }
.user-panel p { margin: 0 0 .65rem; overflow-wrap: anywhere; }
.user-panel form { margin: 0; }
.user-theme-picker { display: flex; align-items: center; gap: .35rem; padding-top: .65rem; margin-top: .65rem; border-top: 1px solid var(--border); font-size: .85rem; }
.user-theme-picker span { margin-right: .25rem; }
.btn.xs { min-height: 26px; padding: .1rem .45rem; font-size: .78rem; border-radius: 4px; }

/* Module furniture */
.module-head { display: flex; flex-wrap: wrap; align-items: center; gap: .85rem; margin: 0 0 1.5rem; }
.status-pill { display: inline-flex; align-items: center; gap: .4rem; padding: .2rem .7rem; border-radius: 999px; font-size: .78rem; font-weight: 600; border: 1px solid currentColor; line-height: 1.2; letter-spacing: .02em; }
.status-pill::before { content: ""; width: .45rem; height: .45rem; border-radius: 50%; background: currentColor; }
.status-pill.on { color: var(--ok); background: rgba(29, 122, 67, .08); }
.status-pill.off { color: var(--muted); background: var(--bg-sunk); }
.status-pill.neutral { color: var(--accent); background: var(--accent-soft); }
.count-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 1.5rem; height: 1.35rem; padding: 0 .45rem; border-radius: 999px; background: var(--bg-sunk); color: var(--text-2); font-size: .8rem; font-weight: 600; text-align: center; vertical-align: middle; }
.tabs { display: flex; flex-wrap: wrap; gap: .25rem; margin: 0 0 1.5rem; border-bottom: 1px solid var(--border); }
.tabs a { display: inline-flex; align-items: center; min-height: 44px; padding: .3rem 1rem; color: var(--text-2); text-decoration: none; font-weight: 500; font-size: .92rem; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color .12s ease; }
.tabs a:hover { color: var(--text); }
.tabs a[aria-current="page"] { color: var(--accent); font-weight: 600; border-bottom-color: var(--accent); }
.panel-card { border: 1px solid var(--border); border-radius: 12px; background: var(--surface); padding: 1.25rem 1.4rem; margin: 0 0 1.5rem; min-width: 0; box-shadow: 0 1px 3px rgba(0,0,0,.02); }
.panel-card > h2:first-child, .panel-card > summary { margin-top: 0; font-size: 1.15rem; font-weight: 600; }
details.panel-card > summary { cursor: pointer; font-weight: 600; min-height: 36px; }
.overview-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.25rem; margin: 0 0 1.5rem; }
.overview-grid .span-2 { grid-column: span 2; }
.stat-link { display: block; color: inherit; text-decoration: none; }
.stat-link:hover dd { color: var(--accent); }
.stat:has(.stat-link:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }
.module-grid { list-style: none; padding: 0; margin: 0 0 2rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(14rem, 100%), 1fr)); gap: .85rem; }
.module-card { margin: 0; }
.module-card a { display: grid; gap: .4rem; height: 100%; padding: 1rem 1.15rem; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: var(--text); text-decoration: none; transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease; }
.module-card a:hover { border-color: var(--accent); box-shadow: 0 6px 18px rgba(0,0,0,.06); transform: translateY(-1px); }
.module-name { font-weight: 600; font-size: .98rem; }
.module-detail { font-size: .85rem; color: var(--muted); }
.checklist { list-style: none; margin: 0; padding: 0; }
.checklist li { display: flex; gap: .75rem; align-items: flex-start; margin: 0 0 .85rem; font-size: .92rem; line-height: 1.45; }
.check-icon { display: inline-grid; place-items: center; width: 1.4rem; height: 1.4rem; flex-shrink: 0; border-radius: 50%; font-weight: 700; font-size: .8rem; color: #fff; background: var(--accent); }
.checklist li.warn .check-icon { background: var(--warn); }
.checklist li.info .check-icon { background: var(--accent); }
.check-ok { color: var(--ok); font-weight: 600; }
.chart { margin: 0; }
.chart svg { display: block; width: 100%; height: 9.5rem; border-radius: 6px; }
.chart .bar { fill: var(--accent); rx: 2px; ry: 2px; transition: fill .15s ease; }
.chart .bar.zero { fill: var(--border); }
.chart .bar:hover { fill: var(--accent-hover, var(--accent)); cursor: pointer; }
.chart figcaption { display: flex; justify-content: space-between; gap: .5rem; font-size: .8rem; color: var(--muted); margin-top: .5rem; font-family: var(--mono); }
.feed { list-style: none; padding: 0; margin: 0 0 1rem; }
.feed li { padding: .65rem 0; border-bottom: 1px solid var(--border); margin: 0; font-size: .92rem; }
.item-list { list-style: none; padding: 0; margin: 0 0 1.5rem; display: grid; gap: .85rem; }
.item-card { margin: 0; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); padding: 1rem 1.25rem; transition: border-color .15s ease, box-shadow .15s ease; }
.item-card:hover { border-color: var(--border-strong); box-shadow: 0 4px 12px rgba(0,0,0,.04); }
.item-head { display: flex; flex-wrap: wrap; gap: .65rem; align-items: center; margin-bottom: .45rem; font-size: .88rem; }
.review-form { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; margin: .6rem 0 0; }
.review-form input[type="text"] { flex: 1 1 16rem; min-height: 40px; padding: .35rem .65rem; font: inherit; color: var(--text); background: var(--bg); border: 1px solid var(--border-strong); border-radius: var(--r); }
.inline-form { display: inline; margin: 0; }
.table-tools { display: flex; align-items: center; gap: .75rem; margin: 0 0 .85rem; }
.table-search { flex: 0 1 22rem; min-height: 40px; padding: .4rem .75rem; font: inherit; color: var(--text); background: var(--bg); border: 1px solid var(--border-strong); border-radius: 8px; transition: border-color .15s ease; }
.table-search:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
tr[data-filtered-out] { display: none; }
.field-row.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.dash-form.wide { max-width: none; }
.log-grid { display: grid; gap: .35rem 1rem; }
.log-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1rem; align-items: end; border-bottom: 1px solid var(--border); padding-bottom: .5rem; }
.var-ref { margin: 0 0 1rem; font-size: .9rem; }
.var-ref summary { cursor: pointer; color: var(--link, var(--accent)); min-height: 32px; font-weight: 500; }
.var-table { margin-top: .5rem; }
.char-count { display: block; font-size: .8rem; color: var(--faint); text-align: right; margin-top: .2rem; font-family: var(--mono); }
.char-count.over { color: var(--danger); font-weight: 600; }

/* Embed builder */
.embed-builder { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 1.5rem; align-items: start; margin: 0 0 1.5rem; }
.embed-preview-wrap { position: sticky; top: 1rem; }
.embed-inputs { margin: 0; }
.embed-fields summary { cursor: pointer; font-weight: 500; min-height: 36px; }
.embed-field-row { border-top: 1px dashed var(--border); padding-top: .5rem; }
.embed-preview { background: var(--dc-bg, #313338); color: var(--dc-text, #dbdee1); border-radius: 8px; padding: 1.15rem; font-size: .92rem; overflow-wrap: anywhere; box-shadow: 0 4px 16px rgba(0,0,0,.2); }
.ep-message { display: flex; gap: .85rem; }
.ep-avatar { display: grid; place-items: center; width: 2.5rem; height: 2.5rem; flex-shrink: 0; border-radius: 50%; background: var(--dc-blurple, #5865f2); color: #fff; font-weight: 700; }
.ep-body { min-width: 0; flex: 1; }
.ep-name { font-weight: 600; color: #fff; margin-bottom: .2rem; }
.ep-bot { font-size: .62rem; background: var(--dc-blurple, #5865f2); color: #fff; padding: .08rem .32rem; border-radius: 3px; vertical-align: middle; font-weight: 700; }
.ep-content { white-space: pre-wrap; margin-bottom: .4rem; line-height: 1.4; }
.ep-content:empty { display: none; }
.ep-embed { display: flex; gap: 1rem; background: var(--dc-embed, #2b2d31); border-left: 4px solid #1e1f22; border-radius: 4px; padding: .75rem 1rem .85rem .85rem; max-width: 32rem; }
.ep-main { min-width: 0; flex: 1; display: grid; gap: .35rem; }
.ep-author { font-size: .82rem; font-weight: 600; color: #fff; }
.ep-title { font-weight: 700; color: #fff; }
.ep-desc { white-space: pre-wrap; font-size: .88rem; line-height: 1.4; }
.ep-fields { display: flex; flex-wrap: wrap; gap: .45rem .85rem; }
.ep-field { flex: 1 1 100%; min-width: 0; }
.ep-field.inline { flex: 1 1 30%; }
.ep-fname { font-weight: 600; font-size: .82rem; color: #fff; }
.ep-fvalue { white-space: pre-wrap; font-size: .85rem; }
.ep-footer { font-size: .75rem; color: var(--dc-muted, #949ba4); }
.ep-image, .ep-thumb { font-size: .78rem; color: var(--dc-muted, #949ba4); border: 1px dashed #4e5058; border-radius: 4px; padding: .5rem; text-align: center; }
.ep-thumb { width: 5rem; height: 5rem; flex-shrink: 0; display: grid; place-items: center; overflow: hidden; }
.ep-author:empty, .ep-title:empty, .ep-desc:empty, .ep-footer:empty, .ep-fields:empty { display: none; }
.ep-embed[data-empty] { display: none; }

/* Toasts, unsaved bar, confirm dialog */
.toast-region { position: fixed; z-index: 60; right: 1.25rem; bottom: 1.25rem; display: grid; gap: .6rem; width: min(25rem, calc(100vw - 2.5rem)); }
.toast { border: 1px solid var(--border-strong); border-left: 4px solid var(--ok); border-radius: 8px; background: var(--surface); color: var(--text); padding: .8rem 1rem; box-shadow: 0 10px 30px rgba(0,0,0,.22); display: flex; gap: .85rem; align-items: flex-start; }
.toast.bad { border-left-color: var(--danger); }
.toast p { margin: 0; flex: 1; font-size: .92rem; }
.toast button { background: none; border: 0; color: var(--muted); cursor: pointer; font-size: 1.15rem; line-height: 1; min-width: 32px; min-height: 32px; }
.notice[data-toasted] { display: none; }
.unsaved-bar { position: fixed; z-index: 55; left: 50%; bottom: 1.25rem; transform: translateX(-50%); width: min(42rem, calc(100vw - 2.5rem)); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .85rem; padding: .8rem 1.25rem; border-radius: 10px; background: var(--text); color: var(--bg); box-shadow: 0 12px 36px rgba(0,0,0,.35); }
.unsaved-bar[hidden] { display: none; }
.unsaved-bar .btn.ghost { color: var(--bg); border-color: var(--bg); background: transparent; }
.confirm-dialog { border: 1px solid var(--border-strong); border-radius: 12px; background: var(--surface); color: var(--text); padding: 1.4rem 1.6rem; width: min(29rem, calc(100vw - 2.5rem)); box-shadow: 0 16px 48px rgba(0,0,0,.25); }
.confirm-dialog::backdrop { background: rgba(0,0,0,.55); }
.confirm-dialog h2 { margin: 0 0 .6rem; font-size: 1.15rem; font-weight: 600; }
.confirm-dialog .btn-row { justify-content: flex-end; margin-top: 1.25rem; }
form[aria-busy="true"] [data-save-button]::after { content: " …"; }

/* Small screens: the sidebar becomes a drawer */
@media (max-width: 960px) {
  .overview-grid { grid-template-columns: minmax(0, 1fr); }
  .overview-grid .span-2 { grid-column: auto; }
  .embed-builder { grid-template-columns: minmax(0, 1fr); }
  .embed-preview-wrap { position: static; }
}
@media (max-width: 820px) {
  .app { display: block; }
  .app-main { padding: 0 1rem 2rem; }
  .app-top-switcher { max-width: 10rem; min-width: 4.75rem; }
  .top-switcher .g-icon, .top-switcher .caret { flex: none; }
  .drawer-toggle { flex: none; }
  .drawer-close { display: inline-flex; }
  .drawer-backdrop { display: block; }
  .app[data-drawer-open] .drawer-backdrop { opacity: 1; pointer-events: auto; }
  .js .app-side { position: fixed; z-index: 50; inset: 0 auto 0 0; width: min(18rem, 85vw); max-height: none; transform: translateX(-105%); transition: transform .2s ease; box-shadow: 0 0 40px rgba(0,0,0,.35); }
  .js .app[data-drawer-open] .app-side { transform: none; }
  .js .drawer-toggle { display: inline-flex; }
  html:not(.js) .app-side { position: static; max-height: none; border-right: 0; border-bottom: 1px solid var(--border); }
  .log-row, .field-row.two { grid-template-columns: minmax(0, 1fr); }
  .user-name { display: none; }
}
@media (max-width: 480px) {
  .top-switcher .g-name { display: none; }
  .app-top-switcher { min-width: 0; flex: none; }
  .app-top { gap: .5rem; }
}
@media (prefers-reduced-motion: reduce) { .js .app-side { transition: none; } }
`;