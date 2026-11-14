/**
 * Optional themes and the theme picker.
 *
 * - Steel & Ink: near-black ink, warm paper text, steel accent and stone
 *   secondary text, serif headings. Editorial, no saturated colour.
 * - Glass (beta): dark frosted glass in the spirit of Apple's Liquid Glass and
 *   YouTube's player menus, over slowly drifting colour glows. The tokens
 *   below are solid; translucency and blur live in glass.ts and are only
 *   switched on where backdrop-filter is supported and the visitor has not
 *   asked for reduced transparency, so the fallback is the solid palette.
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
  --bg-sunk: #11141b;
  --surface: #161a22;
  --text: #f4f6fa;
  --text-2: #dde2ea;
  --muted: #b6bdc8;
  --faint: #a6aebb;
  --border: #272c37;
  --border-strong: #3b4250;
  --accent: #a9c8ff;
  --accent-hover: #c8dcff;
  --accent-ink: #0b0d12;
  --accent-soft: #1c2638;
  --link: #a9c8ff;
  --ok: #7fdca6;
  --warn: #f2c26b;
  --danger: #ff9a92;
  --code-bg: #141821;
  --mark: #4d4224;
  --r: 12px;
  --r-lg: 20px;
  /* Ambient glow colours behind the glass, at their brightest (already
     flattened over --bg); tests check text against each of them. */
  --glass-a: #1b2a55;
  --glass-b: #3a1d48;
  --glass-c: #0e3b3d;
  --glass-d: #3d2a14;
  /* Frosted surfaces used when blur is available. */
  --glass-surface: rgba(22, 25, 34, .55);
  --glass-strong: rgba(18, 21, 29, .82);
  --glass-edge: rgba(255, 255, 255, .14);
  --glass-hi: rgba(255, 255, 255, .16);
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
.theme-beta {
  margin-left: .1rem; padding: 0 .3rem; border: 1px solid var(--border-strong); border-radius: 3px;
  font: 600 .64rem/1.5 var(--mono); letter-spacing: .04em; text-transform: uppercase; color: var(--muted);
}
.user-theme-picker { flex-wrap: wrap; }

/* ── On-fill text: dark themes use ink on their light status fills ────── */
[data-theme="dark"] .btn.danger, [data-theme="dark"] .btn.danger:hover,
[data-theme="steel"] .btn.danger, [data-theme="steel"] .btn.danger:hover,
[data-theme="glass"] .btn.danger, [data-theme="glass"] .btn.danger:hover,
[data-theme="dark"] .opt-req, [data-theme="steel"] .opt-req, [data-theme="glass"] .opt-req,
[data-theme="dark"] .check-icon, [data-theme="steel"] .check-icon, [data-theme="glass"] .check-icon { color: var(--bg); }

/* ── Steel & Ink ──────────────────────────────────────────────────────── */
[data-theme="steel"] {
  --k-changed: #a9bcc9;
  --k-fixed: #c9b9a0;
}
[data-theme="steel"] h1, [data-theme="steel"] h2 { font-family: var(--serif); font-weight: 500; letter-spacing: -0.012em; }
[data-theme="steel"] .nav-link[aria-current="page"] { box-shadow: inset 0 -1px 0 var(--accent); }
[data-theme="steel"] ::selection { background: #c5cdc8; color: #0c0d0f; }
`;
