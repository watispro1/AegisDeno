/**
 * Glass (beta) in the dashboard: the dashboard surfaces have glass rules,
 * blur stays on floating chrome (not on repeated cards, rows or tables), the
 * translucent overlays have a solid fallback and a reduced-transparency
 * reset, and every Glass rule is scoped so Light (the default) is untouched.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { styles } from "../src/web/theme";
import { cssGlass } from "../src/web/theme/glass";
import { cssGlassDashboard } from "../src/web/theme/glassDashboard";

/** The stylesheet without comments. */
function uncomment(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Selectors of every rule in a stylesheet whose body uses backdrop-filter blur. */
function blurred(css: string): string[] {
  return [...uncomment(css).matchAll(/([^{}]*)\{[^{}]*backdrop-filter:\s*blur/g)].flatMap(m => m[1].split(",").map(s => s.trim()));
}

test("glass dashboard: included after the shared glass rules", () => {
  const a = styles.indexOf(cssGlass), b = styles.indexOf(cssGlassDashboard);
  assert.ok(a >= 0 && b > a, "glassDashboard follows glass");
});

test("glass dashboard: every dashboard surface has a glass rule", () => {
  for (const sel of [".app-side", ".app-top", ".side-link[aria-current=\"page\"]", ".dash-form fieldset", ".item-card", ".field select",
    ".field textarea", ".filter-bar input", ".top-search input", ".mod-toggle-track", "th", ".chip", ".check-icon", ".feed li",
    ".chart .bar", ".embed-preview", ".empty-state", ".toast", ".unsaved-bar", ".palette", ".confirm-dialog", "select option"]) {
    assert.ok(cssGlassDashboard.includes(`[data-theme="glass"] ${sel}`), `glass rule for ${sel}`);
  }
});

test("glass: every rule is scoped to [data-theme=\"glass\"]", () => {
  for (const css of [cssGlass, cssGlassDashboard]) {
    const body = uncomment(css).replace(/@keyframes[\s\S]*?\n}\n/g, "");
    for (const m of body.matchAll(/([^{}]+)\{/g)) {
      const prelude = m[1].trim();
      if (!prelude || prelude.startsWith("@")) continue;
      for (const sel of prelude.split(",").map(s => s.trim()).filter(Boolean)) {
        assert.ok(sel.startsWith('[data-theme="glass"]'), `unscoped selector: ${sel}`);
      }
    }
  }
});

test("glass: blur only on floating chrome and single panels, never on repeated cards, rows or tables", () => {
  const sels = [...blurred(cssGlass), ...blurred(cssGlassDashboard)];
  assert.ok(sels.length > 0 && sels.length <= 20, `blur budget: ${sels.length} selectors`);
  for (const repeated of [".mod-card", ".item-card", ".table-wrap", ".card", ".callout", ".component", ".guild-item", ".btn.ghost", "fieldset", "tr"]) {
    assert.ok(!sels.some(s => s.endsWith(repeated)), `no blur on ${repeated}`);
  }
  for (const chrome of [".app-side", ".app-top::before", ".toast", ".palette", ".nav-inner::before", ".theme-menu"]) {
    assert.ok(sels.includes(`[data-theme="glass"] ${chrome}`), `${chrome} is frosted`);
  }
});

test("glass: overlays are solid without backdrop-filter or with reduced transparency", () => {
  assert.match(cssGlass, /@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\)/);
  /* Outside @supports the dashboard overlays use opaque colours. */
  const outside = cssGlassDashboard.replace(/@supports \(\(backdrop-filter[\s\S]*?\n}\n/g, "").replace(/@media \(prefers-reduced-transparency[\s\S]*?\n}\n/g, "");
  for (const sel of [".toast", ".unsaved-bar", ".palette, [data-theme=\"glass\"] .confirm-dialog"]) {
    const rule = new RegExp(`\\[data-theme="glass"\\] ${sel.replace(/[.[\]"=]/g, c => "\\" + c)} \\{[^}]*background-color: #[0-9a-f]{6}`);
    assert.match(outside, rule, `${sel} solid by default`);
  }
  const rt = /@media \(prefers-reduced-transparency: reduce\) \{([\s\S]*?)\n}\n/.exec(cssGlassDashboard);
  assert.ok(rt, "dashboard reduced-transparency block");
  for (const sel of [".toast", ".palette", ".app-side", ".app-top::before"]) assert.ok(rt[1].includes(`[data-theme="glass"] ${sel}`), `${sel} reset`);
});

test("glass: motion respects prefers-reduced-motion", () => {
  assert.match(cssGlass, /@media \(prefers-reduced-motion: reduce\) \{\s*\[data-theme="glass"\] \.btn::after \{ display: none; \}/);
  assert.match(cssGlassDashboard, /@media \(prefers-reduced-motion: reduce\) \{\s*\[data-theme="glass"\] \.mod-toggle-track::after \{ transition: none; \}/);
});

test("glass: no gradient text, no images, no imports", () => {
  for (const css of [cssGlass, cssGlassDashboard]) {
    assert.doesNotMatch(css, /background-clip:\s*text|url\(|@import/);
  }
});
