/**
 * Dashboard app layout (3.6.2 overhaul): sidebar with server switcher and
 * module groups, top bar, module cards, charts, embed builder preview,
 * toasts, the unsaved-changes bar and the confirm dialog. Uses the site's
 * colour variables, so light and dark themes both work.
 */
export const cssDashboardApp = String.raw`/* ── Dashboard app shell ────────────────────────────────────────────── */
.app { display: grid; grid-template-columns: 16.5rem minmax(0, 1fr); gap: 0; max-width: 92rem; margin: 0 auto; min-height: calc(100vh - var(--nav-h, 4rem)); }
.app-side { border-right: 1px solid var(--border); background: var(--surface); padding: 1rem .75rem 2rem; position: sticky; top: 0; align-self: start; max-height: 100vh; overflow-y: auto; }
.app-main { min-width: 0; padding: 0 1.5rem 2rem; }
.app-top { display: flex; align-items: center; gap: .75rem; min-height: 3.5rem; border-bottom: 1px solid var(--border); margin: 0 0 1.25rem; }
.app-top-title { font-weight: 600; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.app-content > .breadcrumbs { margin-top: 0; }
.drawer-toggle { display: none; }
.dash-foot { margin-top: 3rem; font-size: .85rem; }

.switcher { position: relative; margin: 0 0 1rem; }
.switcher summary { list-style: none; display: flex; align-items: center; gap: .6rem; min-height: 48px; padding: .4rem .6rem; border: 1px solid var(--border); border-radius: var(--r); cursor: pointer; background: var(--bg); }
.switcher summary::-webkit-details-marker { display: none; }
.switcher summary:focus-visible, .user-menu summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.g-icon { display: inline-grid; place-items: center; width: 2rem; height: 2rem; flex-shrink: 0; border-radius: 50%; background: var(--accent); color: var(--accent-ink); font-weight: 700; }
.g-icon.sm { width: 1.5rem; height: 1.5rem; font-size: .75rem; margin-right: .5rem; }
.g-name { flex: 1; min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.caret { color: var(--muted); }
.switcher-list { position: absolute; z-index: 30; left: 0; right: 0; top: calc(100% + .25rem); margin: 0; padding: .35rem; list-style: none; border: 1px solid var(--border-strong); border-radius: var(--r); background: var(--surface); max-height: 60vh; overflow-y: auto; box-shadow: 0 8px 24px rgba(0,0,0,.18); }
.switcher-list li { margin: 0; }
.switcher-list a { display: flex; align-items: center; min-height: 40px; padding: .3rem .5rem; border-radius: var(--r); color: var(--text); text-decoration: none; overflow-wrap: anywhere; }
.switcher-list a:hover, .switcher-list a:focus-visible { background: var(--bg-sunk); }
.switcher-all { border-top: 1px solid var(--border); margin-top: .25rem !important; padding-top: .25rem; }

.side-nav, .side-nav ul { list-style: none; margin: 0; padding: 0; }
.nav-group { margin: 0 0 .9rem; }
.nav-group-title { display: block; font-size: .72rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--faint); padding: 0 .6rem .3rem; }
.side-nav li { margin: 0; }
.side-link { display: flex; align-items: center; gap: .6rem; min-height: 40px; padding: .3rem .6rem; border-radius: var(--r); color: var(--text-2); text-decoration: none; font-size: .93rem; }
.side-link:hover { background: var(--bg-sunk); color: var(--text); }
.side-link:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.side-link[aria-current="page"] { background: var(--accent-soft); color: var(--text); font-weight: 600; box-shadow: inset 3px 0 0 var(--accent); }
.side-icon { width: 1.25rem; text-align: center; color: var(--muted); }

.user-menu { position: relative; }
.user-menu summary { list-style: none; display: flex; align-items: center; gap: .5rem; min-height: 44px; padding: .25rem .5rem; border-radius: var(--r); cursor: pointer; }
.user-menu summary::-webkit-details-marker { display: none; }
.user-menu summary:hover { background: var(--bg-sunk); }
.avatar { display: inline-grid; place-items: center; width: 2rem; height: 2rem; border-radius: 50%; background: var(--text); color: var(--bg); font-weight: 700; }
.user-name { max-width: 10rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user-panel { position: absolute; right: 0; top: calc(100% + .25rem); z-index: 30; width: 17rem; padding: .9rem 1rem; border: 1px solid var(--border-strong); border-radius: var(--r); background: var(--surface); box-shadow: 0 8px 24px rgba(0,0,0,.18); font-size: .9rem; }
.user-panel p { margin: 0 0 .6rem; overflow-wrap: anywhere; }
.user-panel form { margin: 0; }

/* ── Module furniture ───────────────────────────────────────────────── */
.module-head { display: flex; flex-wrap: wrap; align-items: center; gap: .75rem; margin: 0 0 1.5rem; }
.status-pill { display: inline-flex; align-items: center; gap: .35rem; padding: .15rem .6rem; border-radius: 999px; font-size: .8rem; font-weight: 600; border: 1px solid currentColor; }
.status-pill::before { content: ""; width: .5rem; height: .5rem; border-radius: 50%; background: currentColor; }
.status-pill.on { color: var(--ok); }
.status-pill.off { color: var(--muted); }
.status-pill.neutral { color: var(--accent); }
.count-badge { display: inline-block; min-width: 1.6rem; padding: 0 .4rem; border-radius: 999px; background: var(--bg-sunk); font-size: .85rem; text-align: center; vertical-align: middle; }
.tabs { display: flex; flex-wrap: wrap; gap: .25rem; margin: 0 0 1.25rem; border-bottom: 1px solid var(--border); }
.tabs a { display: inline-flex; align-items: center; min-height: 44px; padding: .25rem .9rem; color: var(--text-2); text-decoration: none; border-bottom: 2px solid transparent; margin-bottom: -1px; }
.tabs a:hover { color: var(--text); }
.tabs a[aria-current="page"] { color: var(--text); font-weight: 600; border-bottom-color: var(--accent); }
.panel-card { border: 1px solid var(--border); border-radius: var(--r-lg, var(--r)); background: var(--surface); padding: 1rem 1.25rem; margin: 0 0 1.5rem; min-width: 0; }
.panel-card > h2:first-child, .panel-card > summary { margin-top: 0; font-size: 1.05rem; }
details.panel-card > summary { cursor: pointer; font-weight: 600; min-height: 32px; }
.overview-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; margin: 0 0 1rem; }
.overview-grid .span-2 { grid-column: span 2; }
.stat-link { display: block; color: inherit; text-decoration: none; }
.stat-link:hover dd { color: var(--accent); }
.stat:has(.stat-link:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }
.module-grid { list-style: none; padding: 0; margin: 0 0 2rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(13rem, 100%), 1fr)); gap: .75rem; }
.module-card { margin: 0; }
.module-card a { display: grid; gap: .35rem; height: 100%; padding: .8rem 1rem; border: 1px solid var(--border); border-radius: var(--r); background: var(--surface); color: var(--text); text-decoration: none; }
.module-card a:hover { border-color: var(--accent); }
.module-name { font-weight: 600; }
.module-detail { font-size: .85rem; color: var(--muted); }
.checklist { list-style: none; margin: 0; padding: 0; }
.checklist li { display: flex; gap: .6rem; align-items: flex-start; margin: 0 0 .7rem; font-size: .92rem; }
.check-icon { display: inline-grid; place-items: center; width: 1.35rem; height: 1.35rem; flex-shrink: 0; border-radius: 50%; font-weight: 700; font-size: .8rem; color: #fff; background: var(--accent); }
.checklist li.warn .check-icon { background: var(--warn); }
.check-ok { color: var(--ok); font-weight: 500; }
.chart { margin: 0; }
.chart svg { display: block; width: 100%; height: 9rem; }
.chart .bar { fill: var(--accent); }
.chart .bar.zero { fill: var(--border); }
.chart .bar:hover { fill: var(--accent-hover, var(--accent)); }
.chart figcaption { display: flex; justify-content: space-between; gap: .5rem; font-size: .8rem; color: var(--muted); margin-top: .4rem; }
.feed { list-style: none; padding: 0; margin: 0 0 1rem; }
.feed li { padding: .5rem 0; border-bottom: 1px solid var(--border); margin: 0; }
.item-list { list-style: none; padding: 0; margin: 0 0 1.5rem; display: grid; gap: .75rem; }
.item-card { margin: 0; border: 1px solid var(--border); border-radius: var(--r); background: var(--surface); padding: .9rem 1rem; }
.item-head { display: flex; flex-wrap: wrap; gap: .6rem; align-items: center; margin-bottom: .4rem; font-size: .88rem; }
.review-form { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; margin: .5rem 0 0; }
.review-form input[type="text"] { flex: 1 1 16rem; min-height: 40px; padding: .35rem .6rem; font: inherit; color: var(--text); background: var(--bg); border: 1px solid var(--border-strong); border-radius: var(--r); }
.inline-form { display: inline; margin: 0; }
.table-tools { display: flex; align-items: center; gap: .75rem; margin: 0 0 .75rem; }
.table-search { flex: 0 1 22rem; min-height: 40px; padding: .35rem .65rem; font: inherit; color: var(--text); background: var(--bg); border: 1px solid var(--border-strong); border-radius: var(--r); }
.table-search:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
tr[data-filtered-out] { display: none; }
.field-row.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.dash-form.wide { max-width: none; }
.log-grid { display: grid; gap: .25rem 1rem; }
.log-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1rem; align-items: end; border-bottom: 1px solid var(--border); padding-bottom: .4rem; }
.var-ref { margin: 0 0 1rem; font-size: .9rem; }
.var-ref summary { cursor: pointer; color: var(--link, var(--accent)); min-height: 32px; }
.var-table { margin-top: .5rem; }
.char-count { display: block; font-size: .8rem; color: var(--faint); text-align: right; margin-top: .15rem; }
.char-count.over { color: var(--danger); font-weight: 600; }

/* ── Embed builder ──────────────────────────────────────────────────── */
.embed-builder { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 1.25rem; align-items: start; margin: 0 0 1.25rem; }
.embed-preview-wrap { position: sticky; top: 1rem; }
.embed-fields summary { cursor: pointer; font-weight: 500; min-height: 36px; }
.embed-field-row { border-top: 1px dashed var(--border); padding-top: .5rem; }
.embed-preview { background: var(--dc-bg, #313338); color: var(--dc-text, #dbdee1); border-radius: var(--r); padding: 1rem; font-size: .92rem; overflow-wrap: anywhere; }
.ep-message { display: flex; gap: .8rem; }
.ep-avatar { display: grid; place-items: center; width: 2.5rem; height: 2.5rem; flex-shrink: 0; border-radius: 50%; background: var(--dc-blurple, #5865f2); color: #fff; font-weight: 700; }
.ep-body { min-width: 0; flex: 1; }
.ep-name { font-weight: 600; color: #fff; margin-bottom: .15rem; }
.ep-bot { font-size: .62rem; background: var(--dc-blurple, #5865f2); color: #fff; padding: .05rem .3rem; border-radius: 3px; vertical-align: middle; }
.ep-content { white-space: pre-wrap; margin-bottom: .35rem; }
.ep-content:empty { display: none; }
.ep-embed { display: flex; gap: 1rem; background: var(--dc-embed, #2b2d31); border-left: 4px solid #1e1f22; border-radius: 4px; padding: .6rem .9rem .75rem .75rem; max-width: 32rem; }
.ep-main { min-width: 0; flex: 1; display: grid; gap: .3rem; }
.ep-author { font-size: .82rem; font-weight: 600; color: #fff; }
.ep-title { font-weight: 700; color: #fff; }
.ep-desc { white-space: pre-wrap; font-size: .88rem; }
.ep-fields { display: flex; flex-wrap: wrap; gap: .4rem .8rem; }
.ep-field { flex: 1 1 100%; min-width: 0; }
.ep-field.inline { flex: 1 1 30%; }
.ep-fname { font-weight: 600; font-size: .82rem; color: #fff; }
.ep-fvalue { white-space: pre-wrap; font-size: .85rem; }
.ep-footer { font-size: .75rem; color: var(--dc-muted, #949ba4); }
.ep-image, .ep-thumb { font-size: .78rem; color: var(--dc-muted, #949ba4); border: 1px dashed #4e5058; border-radius: 4px; padding: .5rem; text-align: center; }
.ep-thumb { width: 5rem; height: 5rem; flex-shrink: 0; display: grid; place-items: center; overflow: hidden; }
.ep-author:empty, .ep-title:empty, .ep-desc:empty, .ep-footer:empty, .ep-fields:empty { display: none; }
.ep-embed[data-empty] { display: none; }

/* ── Toasts, unsaved bar, confirm dialog ────────────────────────────── */
.toast-region { position: fixed; z-index: 60; right: 1rem; bottom: 1rem; display: grid; gap: .5rem; width: min(24rem, calc(100vw - 2rem)); }
.toast { border: 1px solid var(--border-strong); border-left: 4px solid var(--ok); border-radius: var(--r); background: var(--surface); color: var(--text); padding: .7rem .9rem; box-shadow: 0 8px 24px rgba(0,0,0,.2); display: flex; gap: .75rem; align-items: flex-start; }
.toast.bad { border-left-color: var(--danger); }
.toast p { margin: 0; flex: 1; }
.toast button { background: none; border: 0; color: var(--muted); cursor: pointer; font-size: 1.1rem; line-height: 1; min-width: 32px; min-height: 32px; }
.js .notice[data-toast-source] { display: none; }
.unsaved-bar { position: fixed; z-index: 55; left: 50%; bottom: 1rem; transform: translateX(-50%); width: min(40rem, calc(100vw - 2rem)); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; padding: .7rem 1rem; border-radius: var(--r); background: var(--text); color: var(--bg); box-shadow: 0 10px 30px rgba(0,0,0,.3); }
.unsaved-bar[hidden] { display: none; }
.unsaved-bar .btn.ghost { color: var(--bg); border-color: var(--bg); background: transparent; }
.confirm-dialog { border: 1px solid var(--border-strong); border-radius: var(--r-lg, var(--r)); background: var(--surface); color: var(--text); padding: 1.25rem 1.4rem; width: min(28rem, calc(100vw - 2rem)); }
.confirm-dialog::backdrop { background: rgba(0,0,0,.5); }
.confirm-dialog h2 { margin: 0 0 .5rem; font-size: 1.1rem; }
.confirm-dialog .btn-row { justify-content: flex-end; margin-top: 1rem; }
form[aria-busy="true"] [data-save-button]::after { content: " …"; }

/* ── Small screens: the sidebar becomes a drawer ────────────────────── */
@media (max-width: 960px) {
  .overview-grid { grid-template-columns: minmax(0, 1fr); }
  .overview-grid .span-2 { grid-column: auto; }
  .embed-builder { grid-template-columns: minmax(0, 1fr); }
  .embed-preview-wrap { position: static; }
}
@media (max-width: 820px) {
  .app { display: block; }
  .app-main { padding: 0 1rem 2rem; }
  .js .app-side { position: fixed; z-index: 50; inset: 0 auto 0 0; width: min(18rem, 85vw); max-height: none; transform: translateX(-105%); transition: transform .2s ease; box-shadow: 0 0 40px rgba(0,0,0,.35); }
  .js .app[data-drawer-open] .app-side { transform: none; }
  .js .drawer-toggle { display: inline-flex; }
  html:not(.js) .app-side { position: static; max-height: none; border-right: 0; border-bottom: 1px solid var(--border); }
  .log-row, .field-row.two { grid-template-columns: minmax(0, 1fr); }
  .user-name { display: none; }
}
@media (prefers-reduced-motion: reduce) { .js .app-side { transition: none; } }
`;
