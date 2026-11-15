/**
 * Dashboard modules (overview module board, module page header, smarter form
 * fields). Same flat language as dashboardRedesign.ts: hairline borders, no
 * shadows or lifts, mono for small labels. Loaded after the redesign and
 * before responsive.ts.
 */
export const cssDashboardModules = `
/* Overview: module board */
.mod-section { margin: 2rem 0; }
.mod-board { display: block; min-width: 0; }
.mod-count { font: 500 .8rem/1.4 var(--mono); white-space: nowrap; }
.mod-board-head { display: flex; flex-wrap: wrap; gap: .75rem 1.25rem; align-items: center; justify-content: space-between; margin: 0 0 1rem; }
.mod-summary { margin: 0; font: 500 .85rem/1.4 var(--mono); color: var(--muted); }
.mod-tools { display: flex; flex-wrap: wrap; gap: .5rem .75rem; align-items: center; }
.mod-tools[hidden] { display: none; }
.mod-filter { min-height: 36px; width: min(16rem, 100%); padding: .3rem .6rem; font: inherit; font-size: .88rem; color: var(--text); background: var(--bg); border: 1px solid var(--border-strong); border-radius: var(--r); }
.mod-filter:focus { border-color: var(--accent); outline: 2px solid var(--accent-soft); outline-offset: 0; }
.mod-chips { display: flex; flex-wrap: wrap; gap: .35rem; }
.mod-chip { min-height: 32px; padding: .2rem .65rem; font: 500 .8rem/1.2 var(--mono); color: var(--muted); background: transparent; border: 1px solid var(--border-strong); border-radius: 999px; cursor: pointer; }
.mod-chip:hover { color: var(--text); border-color: var(--accent); }
.mod-chip[aria-pressed="true"] { color: var(--accent-ink); background: var(--accent); border-color: var(--accent); }
.mod-chip-n { opacity: .75; }
.mod-group { margin: 0 0 1.5rem; }
.mod-group[hidden], .module-grid > li[hidden], .mod-empty[hidden] { display: none; }
.mod-group-title { margin: 0 0 .6rem; font: 600 .72rem/1.4 var(--mono); text-transform: uppercase; letter-spacing: .06em; color: var(--faint); }
.mod-group .module-grid { margin: 0; grid-template-columns: repeat(auto-fill, minmax(min(15rem, 100%), 1fr)); }
.mod-card { display: flex; flex-direction: column; gap: .45rem; padding: .9rem 1rem; border: 1px solid var(--border); border-radius: var(--r-lg, var(--r)); background: var(--surface); }
.mod-card:hover { border-color: var(--border-strong); }
.mod-card[data-readiness="problem"] { border-color: var(--danger); }
.mod-card-top { display: flex; align-items: center; gap: .6rem; min-width: 0; }
.mod-icon { flex: none; display: inline-grid; place-items: center; width: 2rem; height: 2rem; border: 1px solid var(--border); border-radius: var(--r); background: var(--bg-sunk); color: var(--accent); font-size: 1rem; }
.mod-card .module-name { flex: 1; min-width: 0; margin: 0; font-size: .98rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mod-card .status-pill { flex: none; font-size: .72rem; padding: .1rem .5rem; }
.mod-desc { margin: 0; font-size: .86rem; color: var(--muted); line-height: 1.4; }
.mod-state { display: flex; flex-wrap: wrap; align-items: center; gap: .25rem .45rem; margin: 0; font: 500 .78rem/1.4 var(--mono); }
.mod-state-label { font-weight: 600; }
.mod-state-dot { width: .45rem; height: .45rem; border-radius: 50%; background: currentColor; }
.mod-state.ready { color: var(--ok); }
.mod-state.setup { color: var(--warn); }
.mod-state.problem { color: var(--danger); }
.mod-state.off { color: var(--faint); }
.mod-state-note { color: var(--muted); font-family: var(--sans); }
.mod-state-note::before { content: "· "; color: var(--faint); }
.mod-card .module-detail { margin: 0; font-size: .8rem; color: var(--faint); }
.module-card.mod-card a.mod-configure { display: inline-flex; gap: .3rem; align-self: flex-start; margin-top: auto; padding: .15rem 0; height: auto; border: 0; border-radius: 0; background: none; box-shadow: none; transform: none; font-size: .85rem; font-weight: 600; color: var(--link); }
.module-card.mod-card a.mod-configure:hover { text-decoration: underline; box-shadow: none; transform: none; }

/* Module page header */
.mod-head { display: flex; flex-wrap: wrap; align-items: center; gap: .75rem 1rem; margin: 0 0 1.25rem; padding: .85rem 1rem; border: 1px solid var(--border); border-radius: var(--r-lg, var(--r)); background: var(--surface); }
.mod-head .mod-icon { width: 2.4rem; height: 2.4rem; font-size: 1.15rem; }
.mod-head-text { flex: 1; min-width: 12rem; display: grid; gap: .2rem; }
.mod-head-line { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; }
.mod-head-desc { margin: 0; font-size: .88rem; color: var(--muted); }
.mod-head-links { display: flex; flex-wrap: wrap; gap: .25rem .9rem; font: 500 .8rem var(--mono); }
.mod-head-links a { color: var(--faint); }
.mod-head-links a:hover { color: var(--accent); }
.mod-toggle-form { margin: 0; }
.mod-toggle { display: inline-flex; align-items: center; gap: .55rem; min-height: 40px; padding: .3rem .8rem .3rem .4rem; font: 600 .85rem var(--sans); color: var(--text); background: transparent; border: 1px solid var(--border-strong); border-radius: 999px; cursor: pointer; }
.mod-toggle:hover { border-color: var(--accent); }
.mod-toggle-track { position: relative; width: 2.1rem; height: 1.2rem; border-radius: 999px; background: var(--border-strong); transition: background .15s ease; }
.mod-toggle-track::after { content: ""; position: absolute; top: .15rem; left: .15rem; width: .9rem; height: .9rem; border-radius: 50%; background: var(--surface); transition: transform .15s ease; }
.mod-toggle[aria-checked="true"] .mod-toggle-track { background: var(--ok); }
.mod-toggle[aria-checked="true"] .mod-toggle-track::after { transform: translateX(.9rem); }

/* Settings split into cards */
.mod-settings > fieldset { border: 1px solid var(--border); border-radius: var(--r-lg, var(--r)); background: var(--surface); padding: 1rem 1.1rem 1.1rem; margin: 0 0 1rem; }
.mod-settings > fieldset > legend { padding: 0 .4rem; font-weight: 600; }
.mod-settings .field-help { display: block; margin-top: .3rem; font-size: .82rem; color: var(--muted); }

/* Smarter fields */
.field-error[data-client-error] { display: block; }
.field-error[hidden] { display: none; }
.pick-tools { display: flex; flex-wrap: wrap; gap: .4rem .6rem; align-items: center; margin: 0 0 .5rem; }
.pick-tools[hidden] { display: none; }
.pick-search, .select-search { min-height: 34px; width: min(16rem, 100%); padding: .25rem .55rem; font: inherit; font-size: .86rem; color: var(--text); background: var(--bg); border: 1px solid var(--border-strong); border-radius: var(--r); }
.select-search { display: block; margin: .3rem 0 .35rem; }
.select-search[hidden] { display: none; }
.pick-tools .btn.sm { min-height: 32px; padding: .15rem .6rem; font-size: .8rem; }
.pick-list .pick[hidden], .pick-group[hidden] { display: none; }
.pick-chips { display: flex; flex-wrap: wrap; gap: .3rem; margin: 0 0 .5rem; padding: 0; list-style: none; }
.pick-chips[hidden] { display: none; }
.pick-chip { display: inline-flex; align-items: center; gap: .3rem; padding: .1rem .2rem .1rem .55rem; font: 500 .78rem/1.4 var(--mono); color: var(--text); background: var(--accent-soft); border: 1px solid var(--border); border-radius: 999px; }
.pick-chip button { display: inline-grid; place-items: center; width: 1.3rem; height: 1.3rem; padding: 0; font-size: .85rem; line-height: 1; color: var(--muted); background: transparent; border: 0; border-radius: 50%; cursor: pointer; }
.pick-chip button:hover { color: var(--danger); background: var(--bg-sunk); }
.char-count.near { color: var(--warn); }
[aria-invalid="true"] { border-color: var(--danger); }
`;
