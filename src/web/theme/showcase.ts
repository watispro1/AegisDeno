/**
 * Recreated Discord replies (pages/botReplies.ts) and the home page's
 * differentiators, audience split and "What's new" strip. The Discord parts
 * imitate the Discord client's own colours on purpose (--dc-* tokens), so
 * they look the same in every site theme apart from the bot avatar.
 */
export const cssShowcase = String.raw`
/* ── Showcase: two real replies, recreated ───────────────────────────── */
.showcase { margin: 0 0 1rem; }
.showcase-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.25rem; align-items: start; }
.showcase-item { margin: 0; min-width: 0; display: grid; gap: .55rem; }
.showcase-item figcaption { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem .6rem; font-size: .95rem; }
.showcase-cmd { font: 500 .8rem/1.3 var(--mono); color: var(--muted); }
.showcase-note { margin: 0; font-size: .88rem; color: var(--muted); }

.dcx { padding: .75rem .9rem .8rem; font-size: .88rem; }
.dcx-reply { position: relative; display: flex; align-items: center; gap: .35rem; margin: 0 0 .25rem 2.9rem; font-size: .78rem; color: var(--dc-muted); min-width: 0; }
.dcx-reply b { color: #e0a1a1; font-weight: 500; }
.dcx-reply-line { position: absolute; left: -1.75rem; top: .55rem; width: 1.5rem; height: .6rem; border-left: 2px solid #4e5058; border-top: 2px solid #4e5058; border-top-left-radius: 6px; }
.dcx-cmdref { color: #c9cdfb; background: rgba(88, 101, 242, .18); border-radius: 3px; padding: 0 .2rem; }
.dcx-mini-av { display: inline-block; flex: none; width: 16px; height: 16px; border-radius: 50%; background: #6d6f78; }
.dcx-mini-av.alt { width: 20px; height: 20px; background: #8a6d5b; margin-right: .45rem; vertical-align: -5px; }
.dcx-msg { grid-template-columns: 40px minmax(0, 1fr); }
.dcx .dcx-av { width: 40px; height: 40px; background: #111214; color: #7fc8d8; }
.dcx-main { min-width: 0; }
.dcx-content { color: var(--dc-text); margin-top: .1rem; overflow-wrap: anywhere; }
.dcx-embed { max-width: 432px; padding: .7rem .9rem .75rem; color: var(--dc-text); }
.dcx-embed.green { border-left-color: #57f287; }
.dcx-embed.blurple { border-left-color: #5865f2; }
.dcx-embed.yellow { border-left-color: #fee75c; }
.dcx-embed.orange { border-left-color: #ffa500; }
.dcx-embed.red { border-left-color: #ed4245; }
.dcx-author { font-size: .82rem; font-weight: 600; color: #f2f3f5; margin-bottom: .45rem; }
.dcx-title { font-size: 1rem; font-weight: 600; color: #f2f3f5; margin-bottom: .4rem; }
.dcx-desc { margin-bottom: .55rem; }
.dcx-desc strong, .dcx-factors strong { color: #f2f3f5; font-weight: 600; }
.dcx-code { font: .8rem/1.35 var(--mono); background: #1e1f22; border: 1px solid #232428; border-radius: 4px; padding: 0 .25rem; color: #dbdee1; }
.dcx-bar { display: flex; gap: 2px; margin: .1rem 0 .2rem; line-height: 0; }
.dcx-sq { display: block; flex: none; }
.dcx-ts { background: rgba(255, 255, 255, .08); border-radius: 3px; padding: 0 .15rem; }
.dcx-field-name { font-weight: 600; color: #f2f3f5; margin: .55rem 0 .15rem; font-size: .86rem; }
.dcx-field-val { font-size: .86rem; }
.dcx-factors { list-style: none; margin: 0; padding: 0; display: grid; gap: .2rem; font-size: .86rem; }
.dcx-factors li { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: .45rem; align-items: baseline; }
.dcx-siren { display: inline-block; vertical-align: -3px; margin-right: .3rem; }
.dcx-pts { display: inline-block; min-width: 4.4em; text-align: right; font: .78rem/1.35 var(--mono); background: #1e1f22; border: 1px solid #232428; border-radius: 4px; padding: 0 .3rem; color: #dbdee1; }
.dcx-inline { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: .9rem; }
.dcx-footer { margin-top: .6rem; font-size: .74rem; font-weight: 500; color: #dbdee1; }
.dcx-eph { margin-top: .35rem; font-size: .74rem; color: var(--dc-muted); }
.dcx-link { color: #00a8fc; }

/* ── Home: differentiators, audience split, what's new ────────────────── */
.diff-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
.diff-card { display: grid; gap: .35rem; align-content: start; padding: 1rem; border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface); }
.diff-grid > li, .whats-new li, .audience-card li { margin: 0; }
.diff-card .f-icon { width: 24px; height: 24px; }
.diff-card h3 { margin: 0; font-size: 1.02rem; }
.diff-card p { margin: 0; font-size: .92rem; color: var(--text-2); }
.diff-card .text-link { font-size: .88rem; }
.audience { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.audience-card { padding: 1.1rem 1.2rem; border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface); }
.audience-card h3 { margin: 0 0 .5rem; font-size: 1.05rem; }
.audience-card ul { margin: 0 0 .6rem; padding-left: 1.1rem; display: grid; gap: .3rem; font-size: .93rem; }
.audience-card p { margin: 0; font-size: .9rem; }
.whats-new { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem .8rem; padding: .7rem 1rem; margin: 0 0 2.5rem; border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: var(--r); background: var(--surface); font-size: .92rem; }
.whats-new-label { font: 600 .74rem/1.4 var(--mono); text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.whats-new-label a { text-transform: none; }
.whats-new ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: .3rem 1rem; }
.whats-new li { color: var(--text-2); }
.home-feature-links { margin: .5rem 0 0; font-size: .85rem; color: var(--faint); }
.help-block { margin: 1.5rem 0; padding: 1rem 1.15rem; border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: var(--r); background: var(--surface); }
.help-block h2, .help-block h3 { margin: 0 0 .35rem; font-size: 1.05rem; }
.help-block .help-block-title { margin-bottom: .3rem; color: var(--text); }
.help-block p { margin: 0 0 .6rem; color: var(--text-2); font-size: .93rem; }
.help-block .btn-row { margin: 0; }
.doc-help { margin-top: 1rem; padding: .75rem; border: 1px solid var(--border); border-radius: var(--r); background: var(--surface); font-size: .88rem; }
.doc-help p { margin: 0 0 .4rem; color: var(--text-2); }

@media (max-width: 900px) {
  .showcase-grid, .audience { grid-template-columns: minmax(0, 1fr); }
  .diff-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
/* ── Mobile hero: less density, one dominant call to action ─────────── */
@media (max-width: 480px) {
  .home-hero { padding-top: 1.25rem; gap: 1.25rem; padding-bottom: 1rem; }
  .home-hero-text { display: flex; flex-direction: column; }
  .home-hero h1 { font-size: 1.85rem; line-height: 1.15; max-width: none; margin-bottom: .6rem; }
  .home-hero .eyebrow { font-size: .72rem; margin-bottom: .35rem; }
  .home-hero .lead { font-size: 1rem; line-height: 1.55; margin-bottom: 1.1rem; }
  .home-hero .btn-row { gap: .5rem; }
  .home-hero .btn-row > .btn { flex: 1 1 0; min-height: 44px; padding: .45rem .6rem; font-size: .85rem; justify-content: center; text-align: center; }
  .home-hero .btn-row > .btn:not(.ghost) { flex: 1 1 100%; min-height: 52px; font-size: 1.05rem; font-weight: 600; }
  .home-hero .home-assurances { margin-top: 1rem; gap: .3rem 1rem; font-size: .82rem; }
  .home-hero .live-pill { order: 10; align-self: flex-start; margin: 1rem 0 0; font-size: .72rem; }
  .home-hero .hero-aside { display: none; }
  .home-hero ~ .stat-strip { margin-bottom: 1.25rem; }
  .diff-grid { grid-template-columns: minmax(0, 1fr); }
  .dcx { padding: .6rem .6rem .7rem; font-size: .84rem; }
  .dcx-reply { margin-left: 2.6rem; }
  .dcx-msg { grid-template-columns: 32px minmax(0, 1fr); gap: .5rem; }
  .dcx .dcx-av { width: 32px; height: 32px; }
  .dcx-embed { padding: .6rem .65rem; }
  .dcx-factors li { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: .45rem; align-items: baseline; }
.dcx-siren { display: inline-block; vertical-align: -3px; margin-right: .3rem; }
.dcx-pts { min-width: 3.9em; }
  .dcx-inline { grid-template-columns: minmax(0, 1fr); gap: 0; }
}
`;
