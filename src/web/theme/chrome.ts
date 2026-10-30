/** Site chrome: header, search dialog, toasts, page furniture and the Discord mock. */
export const cssChrome = String.raw`/* ── Header ─────────────────────────────────────────────────────────── */
.nav {
  position: sticky; top: 0; z-index: 50;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  padding-top: env(safe-area-inset-top);
}
.nav-inner { display: flex; align-items: center; gap: 1.5rem; height: var(--nav-h); }
.brand { display: inline-flex; align-items: center; gap: .5rem; min-height: 44px; color: var(--text); text-decoration: none; font-weight: 600; font-size: 1rem; }
.brand:hover { color: var(--text); }
.brand-mark {
  display: inline-grid; place-items: center;
  width: 24px; height: 24px; border-radius: 3px;
  background: var(--text); color: var(--bg);
  font: 600 .8rem/1 var(--mono);
}
.nav-links { display: flex; gap: .25rem; list-style: none; margin: 0; padding: 0; }
.nav-links li + li { margin-top: 0; }
.nav-link {
  display: inline-flex; align-items: center; min-height: 44px;
  padding: 0 .6rem; color: var(--muted); text-decoration: none; font-size: .92rem;
  border-radius: var(--r);
}
.nav-link:hover { color: var(--text); }
.nav-link[aria-current="page"] { color: var(--text); font-weight: 500; box-shadow: inset 0 -2px 0 var(--accent); border-radius: 0; }
.nav-mobile-cta { display: none; }
.nav-actions { display: flex; align-items: center; gap: .25rem; margin-left: auto; }
.nav-actions .btn { margin-left: .5rem; }
.nav-toggle { display: none; }
.theme-toggle .icon-moon { display: none; }
[data-theme="dark"] .theme-toggle .icon-sun { display: none; }
[data-theme="dark"] .theme-toggle .icon-moon { display: block; }

@media (max-width: 860px) {
  .nav-toggle { display: inline-flex; }
  .site-search-trigger { width: 44px; padding: 0; border-color: transparent; }
  .site-search-trigger kbd { display: none; }
  .nav-actions .btn { display: none; }
  .nav-links {
    display: none;
    position: absolute; left: 0; right: 0; top: 100%;
    flex-direction: column; gap: 0;
    background: var(--bg); border-bottom: 1px solid var(--border);
    padding: .5rem max(1.25rem, env(safe-area-inset-right)) calc(1rem + env(safe-area-inset-bottom)) max(1.25rem, env(safe-area-inset-left));
    max-height: calc(100vh - var(--nav-h)); max-height: calc(100dvh - var(--nav-h) - env(safe-area-inset-top));
    overflow-y: auto; overscroll-behavior: contain;
  }
  .nav-links.open { display: flex; }
  .nav-link { width: 100%; min-height: 44px; border-bottom: 1px solid var(--border); border-radius: 0; }
  .nav-link[aria-current="page"] { box-shadow: inset 2px 0 0 var(--accent); padding-left: .8rem; }
  .nav-mobile-cta { display: block; margin-top: .75rem; }
}

/* ── Search dialog ──────────────────────────────────────────────────── */
.site-search[hidden] { display: none; }
.site-search { position: fixed; inset: 0; z-index: 90; display: flex; justify-content: center; align-items: flex-start; padding: 10vh 1rem 1rem; }
.site-search-backdrop { position: absolute; inset: 0; background: rgba(20, 20, 18, .45); }
.site-search-panel {
  position: relative; width: 100%; max-width: 580px;
  background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--r-lg);
  padding: 1rem;
}
.site-search-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: .5rem; }
.site-search-head label { font-weight: 600; font-size: .9rem; }
.site-search-input-wrap {
  display: flex; align-items: center; gap: .5rem;
  border: 1px solid var(--border-strong); border-radius: var(--r);
  padding: 0 .65rem; color: var(--faint); background: var(--bg);
}
.site-search-input-wrap:focus-within { border-color: var(--accent); }
.site-search-input-wrap input {
  flex: 1; min-width: 0; min-height: 44px; border: 0; outline: 0; background: transparent;
  color: var(--text); font: 400 1rem var(--sans);
}
.site-search-help { font-size: .8rem; color: var(--faint); margin: .5rem 0; }
.site-search-results { display: flex; flex-direction: column; max-height: 50vh; overflow-y: auto; }
.site-search-result {
  display: flex; gap: .75rem; align-items: baseline;
  padding: .55rem .5rem; border-radius: var(--r);
  color: var(--text); text-decoration: none; border-bottom: 1px solid var(--border);
}
.site-search-result:hover, .site-search-result:focus-visible { background: var(--bg-sunk); color: var(--text); }
.site-search-result-icon { font-family: var(--mono); color: var(--accent); width: 1rem; flex-shrink: 0; }
.site-search-result-copy { display: flex; flex-direction: column; min-width: 0; }
.site-search-result-copy strong { font-weight: 500; font-family: var(--mono); font-size: .9rem; }
.site-search-result-copy small { color: var(--muted); font-size: .82rem; }
.site-search-empty { color: var(--muted); font-size: .9rem; padding: .5rem; margin: 0; }

/* ── Toast ──────────────────────────────────────────────────────────── */
#toast-container { position: fixed; right: max(1rem, env(safe-area-inset-right)); bottom: max(1rem, env(safe-area-inset-bottom)); z-index: 95; display: flex; flex-direction: column; gap: .5rem; pointer-events: none; }
.toast {
  background: var(--text); color: var(--bg);
  font: 400 .85rem/1.4 var(--sans);
  padding: .5rem .8rem; border-radius: var(--r);
  max-width: min(320px, calc(100vw - 2rem));
}

/* ── Page furniture ─────────────────────────────────────────────────── */
main { display: block; min-height: 60vh; }
.page-head { padding: 2.5rem 0 1.75rem; border-bottom: 1px solid var(--border); margin-bottom: 2rem; }
.page-head h1 { margin-bottom: .35rem; }
.page-head .lead { margin-bottom: 0; }
.breadcrumbs { font-size: .82rem; color: var(--faint); padding-top: 1.5rem; }
.breadcrumbs a { color: var(--faint); }
.breadcrumbs .sep { margin: 0 .4rem; }
.breadcrumbs + .page-head { padding-top: 1rem; }
.eyebrow { display: block; font: 500 .78rem/1.4 var(--mono); color: var(--faint); margin-bottom: .5rem; }
.lead { font-size: 1.08rem; color: var(--text-2); max-width: 62ch; }
.section { padding: 3rem 0; border-top: 1px solid var(--border); }
.section:first-child { border-top: 0; }
.section-head { display: grid; grid-template-columns: minmax(0, 1fr); gap: .25rem; margin-bottom: 1.5rem; max-width: 68ch; }
.section-head h2 { margin: 0; }
.section-head p { margin: 0; color: var(--muted); }
.callout {
  border: 1px solid var(--border); border-left: 3px solid var(--accent);
  background: var(--surface); border-radius: var(--r);
  padding: .75rem 1rem; margin: 0 0 1.25rem; font-size: .93rem;
}
.callout.warn { border-left-color: var(--warn); }
.callout p:last-child { margin-bottom: 0; }

/* ── Discord mock ───────────────────────────────────────────────────── */
.dc {
  background: var(--dc-bg); color: var(--dc-text);
  border-radius: var(--r-lg); border: 1px solid #1f2023;
  font-size: .9rem; line-height: 1.45; overflow: hidden;
}
.dc-bar {
  display: flex; align-items: center; gap: .4rem;
  padding: .55rem .9rem; border-bottom: 1px solid #26272b;
  color: var(--dc-muted); font: 500 .8rem/1.2 var(--sans);
}
.dc-bar b { color: var(--dc-text); font-weight: 600; }
.dc-body { padding: .9rem; display: flex; flex-direction: column; gap: .9rem; }
.dc-msg { display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: .65rem; }
.dc-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  display: grid; place-items: center;
  font: 600 .85rem/1 var(--sans); color: #fff; background: #4e5058;
}
.dc-avatar.bot { background: #17695a; }
.dc-name { font-weight: 600; color: #f2f3f5; font-size: .9rem; }
.dc-name small { color: var(--dc-muted); font-weight: 400; font-size: .72rem; margin-left: .35rem; }
.dc-tag {
  display: inline-block; vertical-align: 1px;
  background: var(--dc-blurple); color: #fff;
  font: 600 .62rem/1.4 var(--sans); padding: 0 .3rem; border-radius: 3px; margin-left: .3rem;
}
.dc-used { color: var(--dc-muted); font-size: .8rem; margin-bottom: .2rem; }
.dc-used code { color: #c9cdfb; font-family: var(--mono); font-size: .78rem; }
.dc-embed {
  margin-top: .3rem; background: var(--dc-embed);
  border-left: 4px solid #3ba55c; border-radius: 4px;
  padding: .6rem .8rem; max-width: 460px;
}
.dc-embed.yellow { border-left-color: #faa61a; }
.dc-embed-title { font-weight: 600; color: #f2f3f5; margin-bottom: .3rem; }
.dc-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: .35rem .9rem; }
.dc-field { font-size: .82rem; min-width: 0; }
.dc-reason { margin-top: .35rem; }
.dc-field b { display: block; color: #f2f3f5; font-weight: 600; font-size: .78rem; }
.dc-input {
  display: flex; flex-wrap: wrap; align-items: center; gap: .35rem;
  margin: 0 .9rem .9rem; padding: .55rem .7rem;
  background: var(--dc-input); border-radius: 6px;
  font-family: var(--mono); font-size: .82rem;
}
.dc-cmd { color: #f2f3f5; font-weight: 500; }
.dc-opt { display: inline-flex; border-radius: 3px; overflow: hidden; background: #2b2d31; }
.dc-opt .k { padding: 0 .35rem; color: var(--dc-muted); background: #232428; }
.dc-opt .v { padding: 0 .4rem; color: #dbdee1; }

`;
