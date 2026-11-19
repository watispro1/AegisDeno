/**
 * Optional themes and the theme picker.
 *
 * - Steel & Ink: near-black ink, warm paper text, steel accent and stone
 *   secondary text, serif headings. Editorial, no saturated colour.
 * - Glass: dark frosted glass over slowly drifting colour glows, with three
 *   material levels (resting, raised, overlay). The tokens below are solid;
 *   translucency and blur live in glass.ts / glassDashboard.ts and are only
 *   switched on where backdrop-filter is supported and the visitor has not
 *   asked for reduced transparency, so the fallback is the solid palette.
 * - Aurora (beta): a bright, airy light theme: white cards on a still dawn
 *   wash of lilac, mint and peach, an indigo-violet accent and rounder
 *   corners. Tokens and surfaces are in aurora.ts.
 *
 * Light (:root) and Dark live in base.ts. tests/siteThemes.test.ts checks the
 * text and status tokens of every theme against WCAG AA.
 */

/** Token blocks; included right after cssBase so later files can read them. */
export const cssThemeTokens = String.raw`
[data-theme="steel"] {
  --bg: #0c0d0f;
  --bg-sunk: #111316;
  --surface: #15171a;
  --text: #f2f0ea;
  --text-2: #d8d6cf;
  --muted: #a9aba7;
  --faint: #8e908c;
  --border: #25282c;
  --border-strong: #3a3e43;
  --accent: #c5cdc8;
  --accent-hover: #e3e8e4;
  --accent-ink: #0c0d0f;
  --accent-soft: #1c201f;
  --link: #c5cdc8;
  --ok: #8cc59c;
  --warn: #d6ad6a;
  --danger: #e8938a;
  --code-bg: #1a1d20;
  --mark: #4a4334;
  --serif: "Iowan Old Style", Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif;
  color-scheme: dark;
}

[data-theme="glass"] {
  /* Solid palette: what everyone gets without backdrop-filter or with
     prefers-reduced-transparency. Deep blue-black, light text. */
  --bg: #0b0d12;
  --bg-sunk: #10131a;
  --surface: #151922;
  --text: #f5f7fb;
  --text-2: #dfe4ec;
  --muted: #b8bfcb;
  --faint: #a8b0bd;
  --border: #262b36;
  --border-strong: #3a414f;
  --accent: #a9c8ff;
  --accent-hover: #cadeff;
  --accent-ink: #0b0d12;
  --accent-soft: #1b2539;
  --link: #b0ccff;
  --ok: #80dca8;
  --warn: #f2c46e;
  --danger: #ff9e96;
  --code-bg: #131720;
  --mark: #4d4224;
  --r: 12px;
  --r-lg: 20px;
  /* Ambient glow colours behind the glass, at their brightest (already
     flattened over --bg); tests check text against each of them. */
  --glass-a: #1a2a56;
  --glass-b: #36204a;
  --glass-c: #0d3a3e;
  --glass-d: #3a2a16;
  /* Materials, used only where backdrop-filter is available:
     resting (cards, sidebar), raised (top bar, header pill) and overlay
     (menus, dialogs, toasts). Each is dark enough on its own for AA text. */
  --glass-surface: rgba(21, 25, 34, .52);
  --glass-raised: rgba(19, 23, 31, .66);
  --glass-strong: rgba(15, 18, 25, .84);
  --glass-edge: rgba(255, 255, 255, .13);
  --glass-hi: rgba(255, 255, 255, .17);
  --glass-blur: 22px;
  color-scheme: dark;
}

`;

/** Component overrides and the picker; included near the end so they win. */
export const cssThemeSurfaces = String.raw`
/* ── Brand mark: the shield, tinted with the theme's text colour ─────── */
@supports ((mask-image: none) or (-webkit-mask-image: none)) {
  .brand-mark {
    background: var(--text); color: transparent; font-size: 0; border-radius: 0;
    -webkit-mask: url("/assets/mark.svg") center / contain no-repeat;
    mask: url("/assets/mark.svg") center / contain no-repeat;
  }
}

/* ── Theme picker ─────────────────────────────────────────────────────── */
.theme-picker { position: relative; }
.theme-picker > summary { list-style: none; }
.theme-picker > summary::-webkit-details-marker { display: none; }
html:not(.js) .theme-picker { display: none; }
.theme-menu {
  position: absolute; right: 0; top: calc(100% + 6px); z-index: 60;
  display: grid; gap: 2px; min-width: 13rem; padding: .35rem;
  background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--r-lg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, .14);
}
.theme-menu-title { margin: .2rem .55rem .3rem; font: 500 .72rem/1.4 var(--mono); text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.theme-opt {
  display: flex; align-items: center; gap: .6rem; width: 100%; min-height: 44px;
  padding: .35rem .55rem; border: 0; border-radius: var(--r);
  font: 400 .9rem/1.2 var(--sans); color: var(--text-2); background: transparent;
  text-align: left; cursor: pointer;
}
.theme-opt:hover { background: var(--bg-sunk); color: var(--text); }
.theme-opt:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.theme-opt[aria-pressed="true"] { color: var(--text); font-weight: 500; }
.theme-opt[aria-pressed="true"]::after {
  content: ""; margin-left: auto; width: 9px; height: 5px;
  border-left: 2px solid var(--accent); border-bottom: 2px solid var(--accent);
  transform: translateY(-2px) rotate(-45deg);
}
.theme-swatch { flex: none; width: 18px; height: 18px; border-radius: 50%; border: 1px solid var(--border-strong); }
.theme-swatch[data-swatch="system"] { background: linear-gradient(135deg, #fbfaf8 50%, #161716 50%); }
.theme-swatch[data-swatch="light"] { background: #fbfaf8; }
.theme-swatch[data-swatch="dark"] { background: #161716; }
.theme-swatch[data-swatch="steel"] { background: linear-gradient(135deg, #0c0d0f 55%, #c5cdc8 55%); }
.theme-swatch[data-swatch="glass"] { background: radial-gradient(circle at 30% 30%, #6d8fe0, transparent 60%), radial-gradient(circle at 75% 70%, #a46cc0, transparent 55%), #0b0d12; }
.theme-swatch[data-swatch="aurora"] { background: radial-gradient(circle at 25% 30%, #c9b8ff, transparent 62%), radial-gradient(circle at 75% 35%, #a9e6cf, transparent 58%), radial-gradient(circle at 50% 85%, #ffc9a8, transparent 60%), #f7f5fb; }
/* Beta badge: themes still being tuned (BETA_THEMES in layout.ts). */
.theme-beta {
  margin-left: .1rem; padding: 0 .3rem; border: 1px solid var(--border-strong); border-radius: 3px;
  font: 600 .64rem/1.5 var(--mono); letter-spacing: .04em; text-transform: uppercase; color: var(--muted);
}
.user-theme-picker { flex-wrap: wrap; }

/* ── On-fill text: dark themes use ink on their light status fills ────── */
[data-theme="dark"] .btn.danger, [data-theme="dark"] .btn.danger:hover,
[data-theme="steel"] .btn.danger, [data-theme="steel"] .btn.danger:hover,
[data-theme="glass"] .btn.danger, [data-theme="glass"] .btn.danger:hover,
[data-theme="aurora"] .btn.danger, [data-theme="aurora"] .btn.danger:hover,
[data-theme="dark"] .opt-req, [data-theme="steel"] .opt-req, [data-theme="glass"] .opt-req, [data-theme="aurora"] .opt-req,
[data-theme="dark"] .check-icon, [data-theme="steel"] .check-icon, [data-theme="glass"] .check-icon, [data-theme="aurora"] .check-icon { color: var(--bg); }

/* ── Steel & Ink ──────────────────────────────────────────────────────── */
[data-theme="steel"] {
  --k-changed: #a9bcc9;
  --k-fixed: #c9b9a0;
}
[data-theme="steel"] h1, [data-theme="steel"] h2 { font-family: var(--serif); font-weight: 500; letter-spacing: -0.012em; }
[data-theme="steel"] .nav-link[aria-current="page"] { box-shadow: inset 0 -1px 0 var(--accent); }
[data-theme="steel"] ::selection { background: #c5cdc8; color: #0c0d0f; }
/* Brand pieces inside the Discord mocks follow the palette: no leftover teal. */
[data-theme="steel"] .dc-avatar.bot { background: #c5cdc8; color: #0c0d0f; }
[data-theme="steel"] .dcx .dcx-av { background: #0c0d0f; color: #c5cdc8; box-shadow: inset 0 0 0 1px #3a3e43; }
[data-theme="steel"] .home-assurances .f-icon { stroke: #c5cdc8; }

/* ── Aurora ─────────────────────────────────────────────────────────────── */
[data-theme="aurora"] {
  --k-changed: #34d399;
  --k-fixed: #a78bfa;
}
[data-theme="aurora"] ::selection { background: #34d399; color: #041d13; }
[data-theme="aurora"] .dc-avatar.bot { background: #34d399; color: #041d13; }
[data-theme="aurora"] .dcx .dcx-av { background: #080d14; color: #34d399; box-shadow: inset 0 0 0 1px #334155; }
[data-theme="aurora"] .home-assurances .f-icon { stroke: #34d399; }
[data-theme="aurora"] .nav-link[aria-current="page"] { box-shadow: inset 0 -1px 0 var(--accent); }
[data-theme="aurora"] body {
  background-color: var(--bg);
  background-image:
    radial-gradient(ellipse 65% 45% at 50% -12%, rgba(52, 211, 153, .14), transparent 70%),
    radial-gradient(ellipse 50% 35% at 90% 20%, rgba(94, 234, 212, .1), transparent 60%),
    radial-gradient(ellipse 55% 35% at 10% 70%, rgba(167, 139, 250, .08), transparent 65%);
  background-attachment: fixed;
}
[data-theme="aurora"] .panel-card,
[data-theme="aurora"] .pricing-card {
  box-shadow: 0 4px 20px -2px rgba(8, 13, 20, .6), 0 0 0 1px rgba(52, 211, 153, .08);
}
[data-theme="aurora"] .pricing-card.recommended {
  box-shadow: 0 8px 32px -4px rgba(52, 211, 153, .22), 0 0 0 1px var(--accent);
}
[data-theme="aurora"] .nav { border-bottom-color: rgba(52, 211, 153, .15); }
[data-theme="aurora"] .live-pill { border-color: rgba(52, 211, 153, .2); }
[data-theme="aurora"] a:focus-visible { outline-color: var(--accent); outline-offset: 3px; }
[data-theme="aurora"] .home-step-n { box-shadow: 0 0 10px rgba(52, 211, 153, .18); }
[data-theme="aurora"] .callout { box-shadow: inset 0 0 0 0 transparent, 0 0 8px rgba(52, 211, 153, .1); }
[data-theme="aurora"] .tag { background: rgba(52, 211, 153, .12); border-color: rgba(52, 211, 153, .25); color: var(--accent); }

/* ── Steel surface polish ───────────────────────────────────────────────── */
[data-theme="steel"] .live-pill { border-color: var(--border-strong); background: var(--bg-sunk); }
[data-theme="steel"] .callout { border-left-color: var(--accent); }
[data-theme="steel"] .home-step-n { font-family: var(--serif); }
`;
