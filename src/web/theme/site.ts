/**
 * Public page redesign (home, commands, docs, troubleshooting, 404), in the
 * same language as the changelog and status pages: the changelog's header and
 * stats strip, thin borders, 4–6px corners, mono for numbers and anything you
 * type into Discord, no shadows or gradients. Motion is limited to colour
 * changes and is switched off under prefers-reduced-motion.
 */
export const cssSite = String.raw`
/* ── Shared ────────────────────────────────────────────────────────── */
html.js .nojs-only { display: none; }
.ph-head { padding-top: 1rem; }
.ph-head h1 { margin-bottom: .35rem; }
.ph-head .lead { margin-bottom: 0; }
.stat-strip.stat-n4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.stat-strip.stat-n3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.stat-strip strong a { color: inherit; }
.stat-strip strong span { font: inherit; color: inherit; }
.f-icon.sm { width: 1rem; height: 1rem; stroke-width: 2.2; }
.copy-btn.sm-copy { min-height: 32px; padding: 0 .55rem; font-size: .75rem; }
.back-to-top { white-space: nowrap; }
.doc-pager-link.prev { text-align: left; }

/* Card links: icon, title, one line of text. Used on home, docs and 404. */
.home-highlights, .home-features, .doc-start, .nf-places {
  list-style: none; padding: 0; margin: 0; display: grid; gap: 1rem;
}
.home-highlights li, .home-features li, .doc-start li, .nf-places li { margin: 0; }
.home-highlight a, .doc-start a, .nf-places a {
  display: flex; flex-direction: column; gap: .4rem; height: 100%; padding: 1.1rem 1.2rem;
  border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface);
  color: var(--text); text-decoration: none; transition: border-color .12s ease;
}
.home-highlight a:hover, .doc-start a:hover, .nf-places a:hover,
.home-highlight a:focus-visible, .doc-start a:focus-visible, .nf-places a:focus-visible { border-color: var(--accent); }
.home-highlight a span, .doc-start a span, .nf-places a span { color: var(--text-2); font-size: .92rem; }
.home-highlight a:hover strong, .doc-start a:hover strong, .nf-places a:hover strong { color: var(--accent); }

/* Copy button beside a command block */
.code-block { position: relative; margin: 0 0 1.25rem; }
.code-block pre.block { margin: 0; padding-right: 4.75rem; }
.code-copy { position: absolute; top: .45rem; right: .45rem; min-height: 32px; padding: 0 .6rem; font-size: .75rem; }

/* ── Home ──────────────────────────────────────────────────────────── */
.home-hero { padding-bottom: 2rem; }
.home-hero-text { min-width: 0; }
.home-setup { align-items: start; }
.home-notes li { line-height: 1.55; }
.home-hero h1 { max-width: 16ch; }
.live-pill {
  display: inline-flex; flex-wrap: wrap; align-items: center; gap: .2rem .5rem; margin-bottom: 1.25rem;
  min-height: 36px; padding: .2rem .8rem; border: 1px solid var(--border); border-radius: 999px;
  background: var(--surface); color: var(--text-2); text-decoration: none; font: 400 .8rem/1.4 var(--mono);
}
.live-pill:hover { border-color: var(--accent); color: var(--text); }
.live-pill-sep { color: var(--border-strong); }
.home-assurances { list-style: none; display: flex; flex-wrap: wrap; gap: .4rem 1.25rem; padding: 0; margin: 1.5rem 0 0; font-size: .88rem; color: var(--muted); }
.home-assurances li { display: inline-flex; align-items: center; gap: .4rem; margin: 0; }
.home-assurances .f-icon { stroke: var(--ok); }
.home-hero + .stat-strip, .home-hero ~ .stat-strip { margin-bottom: 3rem; }

.home-highlights { grid-template-columns: repeat(auto-fit, minmax(min(17rem, 100%), 1fr)); }
.home-highlight a { border-top: 3px solid var(--accent); padding-top: 1rem; }
.home-highlight strong { font-size: 1.1rem; }

.home-features { grid-template-columns: repeat(auto-fill, minmax(min(19rem, 100%), 1fr)); }
.home-feature {
  display: flex; flex-direction: column; gap: .5rem; padding: 1rem 1.1rem;
  border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface);
}
.home-feature-head { display: flex; align-items: center; gap: .6rem; }
.home-feature-head h3 { margin: 0; font-size: 1rem; }
.home-feature-head h3 a { color: var(--text); text-decoration: none; }
.home-feature-head h3 a:hover { color: var(--accent); text-decoration: underline; }
.home-feature p { margin: 0; color: var(--text-2); font-size: .92rem; flex: 1 1 auto; }
.home-feature-start { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem .6rem; padding-top: .55rem; border-top: 1px solid var(--border); font-size: .8rem; }
.home-feature-start code { font: 400 .84rem var(--mono); color: var(--text); background: var(--code-bg); border: 1px solid var(--border); border-radius: 3px; padding: .1rem .4rem; }
.home-feature-start .copy-btn { margin-left: auto; }

.home-steps { list-style: none; padding: 0; margin: 0; display: grid; gap: 0; border-top: 1px solid var(--border); }
.home-step { display: grid; grid-template-columns: 2rem minmax(0, 1fr); gap: 1rem; padding: 1rem 0; border-bottom: 1px solid var(--border); margin: 0; }
.home-step-n {
  display: inline-grid; place-items: center; width: 2rem; height: 2rem; border-radius: 50%;
  border: 1px solid var(--accent); color: var(--accent); font: 500 .85rem var(--mono); background: var(--accent-soft);
}
.home-step h3 { font-size: 1rem; margin: .2rem 0 .2rem; }
.home-step p { margin: 0 0 .5rem; color: var(--text-2); font-size: .95rem; }
.home-step .code-block { margin: .4rem 0 0; }

.home-release { border: 1px solid var(--accent); border-radius: var(--r-lg); background: var(--surface); padding: 1.1rem 1.25rem; max-width: 52rem; }
.home-release-head { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem .75rem; margin-bottom: .6rem; }
.home-release-head h3 { margin: 0; font: 600 1.35rem/1.3 var(--mono); }
.home-release-head h3 a { color: var(--text); text-decoration: none; }
.home-release-head h3 a:hover { color: var(--accent); text-decoration: underline; }
.home-release-head time { font: 400 .82rem var(--mono); color: var(--faint); }
.home-release-items { list-style: none; padding: 0; margin: 0 0 .75rem; display: grid; gap: .45rem; }
.home-release-items li { margin: 0; display: flex; gap: .6rem; align-items: baseline; color: var(--text-2); font-size: .93rem; }
.home-release-items .kchip { flex: none; }
.home-release-items li ul { display: none; }
.home-release-more { margin: 0; }

/* ── Commands ──────────────────────────────────────────────────────── */
.cmd-split { grid-template-columns: 12rem minmax(0, 1fr); gap: 2.5rem; }
.cmd-side a { display: flex; justify-content: space-between; gap: .5rem; }
.cmd-main { min-width: 0; }
.cmd-toolbar { margin-bottom: .6rem; }
.cmd-sticky .tabs { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: thin; padding-bottom: .3rem; }
.cmd-sticky .tab { flex-shrink: 0; }
#cmd-filter .tab { min-height: 38px; }
.cmd-filtered { margin: 0 0 1rem; font-size: .9rem; color: var(--muted); }
.tab { display: inline-flex; align-items: center; gap: .3rem; text-decoration: none; }
.tab[aria-current="true"] { color: var(--accent-ink); background: var(--accent); border-color: var(--accent); }
.tab[aria-current="true"] .n { opacity: .9; }
.tab .perm-dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; background: var(--perm, var(--muted)); }
.tab[aria-current="true"] .perm-dot { background: currentColor; }

.perm-everyone, .access-everyone { --perm: var(--ok); }
.perm-moderator, .access-moderator { --perm: var(--k-changed); }
.perm-admin, .access-admin { --perm: var(--danger); }
.perm-badge {
  display: inline-flex; align-items: stretch; overflow: hidden; white-space: nowrap;
  border: 1px solid var(--perm, var(--border-strong)); border-radius: 3px; font: 500 .7rem/1.6 var(--mono);
}
.perm-level { padding: 0 .4rem; color: var(--perm); text-transform: uppercase; letter-spacing: .04em; }
.perm-name { padding: 0 .4rem; color: var(--text-2); border-left: 1px solid var(--perm); background: var(--bg-sunk); font-weight: 400; }
.perm-legend { border-left: 0 !important; }
.perm-legend li { display: flex; flex-direction: column; align-items: flex-start; gap: .15rem; padding: .3rem 0; color: var(--muted); font-size: .8rem; }
.cmd-card > summary { grid-template-columns: 1.25rem minmax(8rem, max-content) minmax(0, 1fr) auto auto 1rem; }
.cmd-meta { align-items: center; }

.usage { list-style: none; padding: 0; margin: 0; display: grid; gap: .35rem; }
.usage li { display: flex; align-items: stretch; gap: .4rem; margin: 0; min-width: 0; }
.usage .synopsis { flex: 1 1 auto; min-width: 0; }
.usage-copy { flex: none; min-height: 0; }
.usage-legend { margin: .35rem 0 0; font-size: .78rem; }
.usage-legend .opt { font-family: var(--mono); }

/* ── Docs ──────────────────────────────────────────────────────────── */
.doc-start { grid-template-columns: repeat(auto-fit, minmax(min(14rem, 100%), 1fr)); margin-bottom: 2.25rem; }
.docs-split { grid-template-columns: 14rem minmax(0, 1fr); }
.docs-toc { padding-bottom: 1rem; }
.toc-filter { margin: 0 0 1rem; }
.toc-filter input {
  width: 100%; min-height: 36px; padding: .25rem .6rem; font: 400 .85rem var(--sans); color: var(--text);
  background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--r);
}
.toc-filter input:focus { border-color: var(--accent); outline: 2px solid var(--accent-soft); }
.toc li[hidden], .toc .side-title[hidden], .toc ul[hidden] { display: none; }
.toc-empty { font-size: .85rem; color: var(--muted); }
.toc-empty[hidden] { display: none; }

.docs-prose { max-width: 74ch; font-size: 1.02rem; line-height: 1.72; }
.docs-prose h2 { font-size: 1.55rem; letter-spacing: -.01em; }
.docs-prose h3 { font-size: 1.12rem; }
.docs-prose p, .docs-prose li { color: var(--text-2); }
.docs-prose ol, .docs-prose ul { padding-left: 1.4rem; }
.docs-prose li::marker { color: var(--faint); }
.docs-prose strong { color: var(--text); }
.docs-prose a:not(.h-anchor):not(.cmd-link) { text-underline-offset: .18em; }
.docs-prose .table-wrap { margin: 0 0 1.5rem; border: 1px solid var(--border); border-radius: var(--r); }
.docs-prose .table-wrap table { margin: 0; }
.docs-prose .table-wrap tr:last-child td { border-bottom: 0; }
.docs-prose tbody tr:nth-child(even) td { background: var(--bg-sunk); }
.docs-prose .callout { margin: 1rem 0 1.5rem; }
.docs-prose .setup-steps { counter-reset: setup; list-style: none; padding-left: 0; }
.docs-prose .setup-steps li { counter-increment: setup; position: relative; padding-left: 2.4rem; margin-bottom: .8rem; }
.docs-prose .setup-steps li::before {
  content: counter(setup); position: absolute; left: 0; top: .15rem;
  display: inline-grid; place-items: center; width: 1.7rem; height: 1.7rem; border-radius: 50%;
  border: 1px solid var(--accent); background: var(--accent-soft); color: var(--accent); font: 500 .8rem var(--mono);
}
.doc-feedback { margin-top: 2.5rem; padding: 1rem 1.2rem; border: 1px dashed var(--border-strong); border-radius: var(--r-lg); font-size: .92rem; }
.doc-feedback p { margin: 0; }

/* ── Troubleshooting ───────────────────────────────────────────────── */
.help-split { grid-template-columns: 13rem minmax(0, 1fr); }
.help-split .toc a { display: flex; justify-content: space-between; gap: .5rem; }
.help-main { min-width: 0; }
.help-hierarchy { margin-bottom: 2rem; }
.help-hierarchy h2 { margin-top: 0; }
.help-toolbar { position: sticky; top: var(--nav-h); z-index: 4; background: var(--bg); padding: .6rem 0; margin-bottom: 1rem; border-bottom: 1px solid var(--border); }
.help-toolbar .help-search { margin-bottom: 0; max-width: none; }
.issue-group h2 { display: flex; align-items: baseline; gap: .6rem; scroll-margin-top: calc(var(--nav-h) + 5rem); }
.issue-q { min-width: 0; }
.issue-n { font: 400 .78rem var(--mono); color: var(--faint); }
.issue { scroll-margin-top: calc(var(--nav-h) + 5rem); }
.issue:target > summary, .issue.flash > summary { background: var(--accent-soft); }
.issue > summary { padding-left: .4rem; padding-right: .4rem; border-radius: var(--r); }
.issue > summary:hover { background: var(--bg-sunk); }
.issue-body { padding-left: .4rem; }
.issue-link { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; margin: .75rem 0 0; font-size: .85rem; }
.help-ask { margin-top: 2.5rem; padding: 1.1rem 1.25rem; border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface); }
.help-ask h2 { font-size: 1.1rem; margin: 0 0 .5rem; }
.help-ask ol { margin: 0; color: var(--text-2); }

/* ── 404 ───────────────────────────────────────────────────────────── */
.nf { padding-bottom: 1rem; }
.nf h2 { font-size: 1.1rem; margin: 2rem 0 .75rem; }
.nf-head { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 1rem 2.5rem; align-items: center; padding: 3rem 0 2rem; border-bottom: 1px solid var(--border); }
.nf-code { margin: 0; font: 600 clamp(4rem, 3rem + 6vw, 7.5rem)/1 var(--mono); color: var(--accent); letter-spacing: -.04em; }
.nf-head h1 { margin-bottom: .5rem; }
.nf-path { margin: 0 0 .75rem; color: var(--muted); overflow-wrap: anywhere; }
.nf-path code.inline { white-space: normal; overflow-wrap: anywhere; }
.nf-suggest .suggest { list-style: none; padding: 0; margin: 0; display: grid; gap: .3rem; }
.nf-suggest .suggest li { margin: 0; display: flex; flex-wrap: wrap; gap: .25rem .75rem; align-items: baseline; }
.nf-suggest .suggest .faint { font: 400 .8rem var(--mono); }
.nf-search-wrap { max-width: 44rem; }
.nf-popular { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: .3rem .75rem; }
.nf-popular li { margin: 0; }
.nf-places { grid-template-columns: repeat(auto-fit, minmax(min(15rem, 100%), 1fr)); margin-bottom: 1.25rem; }

/* ── Small screens ─────────────────────────────────────────────────── */
@media (max-width: 960px) {
  .cmd-split, .docs-split, .help-split { grid-template-columns: minmax(0, 1fr); gap: 0; }
  .stat-strip.stat-n4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .stat-strip.stat-n4 .cl-stat:nth-child(3) { border-left: 0; }
  .stat-strip.stat-n4 .cl-stat:nth-child(n+3) { border-top: 1px solid var(--border); }
}
@media (min-width: 961px) {
  .cmd-jump { display: none; }
}
@media (max-width: 640px) {
  .stat-strip.stat-n4, .stat-strip.stat-n3 { grid-template-columns: minmax(0, 1fr); }
  .stat-strip.stat-n4 .cl-stat { border-left: 0; }
  .nf-head { grid-template-columns: minmax(0, 1fr); padding-top: 2rem; gap: .5rem; }
  .home-hero ~ .stat-strip { margin-bottom: 2rem; }
  .live-pill { border-radius: var(--r-lg); }
  .help-toolbar { position: static; }
  .docs-prose { font-size: 1rem; }
  .docs-prose h2 { font-size: 1.3rem; }
  .usage li { flex-direction: column; }
  .usage-copy { align-self: flex-start; min-height: 36px; }
  .code-block pre.block { padding-right: 1rem; padding-top: 2.6rem; }
}
@media (pointer: coarse) {
  .copy-btn.sm-copy, .code-copy, .usage-copy { min-height: 44px; }
  .cmd-side a, .help-split .toc a, .nf-popular a, .nf-suggest a { min-height: 44px; display: inline-flex; align-items: center; }
  .toc-filter input { min-height: 44px; font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .home-highlight a, .doc-start a, .nf-places a, .cmd-card > summary { transition: none; }
}
@media print {
  .code-copy, .usage-copy, .toc-filter, .doc-start, .help-toolbar, .doc-feedback { display: none !important; }
}
`;
