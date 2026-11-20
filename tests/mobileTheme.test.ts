/** Mobile regressions found after the theme overhaul (360–414px). */
import test from "node:test";
import assert from "node:assert/strict";
import { styles } from "../src/web/theme";
import { cssDashboardShell } from "../src/web/theme/dashboardShell";
import { cssResponsive } from "../src/web/theme/responsive";

const phone = (css: string, max: string) => {
  const at = css.indexOf(`@media (max-width: ${max})`);
  assert.ok(at >= 0, `media ${max}`);
  return css.slice(at, css.indexOf("\n}", at));
};

test("mobile: tables scroll inside their wrapper, never the page", () => {
  assert.match(styles, /\.table-wrap \{ position: relative; overflow-x: auto;/);
  assert.match(phone(cssResponsive, "640px"), /\.detail-list code\.inline[^{]*\{ white-space: normal; overflow-wrap: anywhere; \}/);
});

test("mobile: the dashboard command palette keeps a touch entry point", () => {
  const m = phone(cssDashboardShell, "820px");
  assert.doesNotMatch(m, /\.palette-btn[^{]*\{ display: none/, "Jump to is not hidden on phones");
  assert.match(m, /\.app-body \.palette-kbd \{ display: none; \}/);
  assert.match(m, /\.top-search input[^{]*\{ font-size: 1rem; \}/, "16px inputs avoid iOS zoom");
});

test("deep links: /commands#cmd-x-y clears the sticky toolbar (no bare section[id] offset)", () => {
  assert.match(styles, /\.cmd-group, \.cmd-card, \.cmd-sub \{ scroll-margin-top: calc\(var\(--nav-h\) \+ 8\.5rem\); \}/);
  for (const m of styles.matchAll(/([^{}]*)\{[^}]*scroll-margin-top/g)) {
    for (const sel of m[1].split(",")) {
      if (/(^|\s)section\[id\]\s*$/.test(sel.trim()) || /^section\[id\]/.test(sel.trim())) {
        assert.match(sel, /\.app-body/, `unscoped scroll-margin on ${sel.trim()}`);
      }
    }
  }
});

test("empty states: pages outside the app shell match the in-app empty state", () => {
  assert.match(styles, /:where\(body:not\(\.app-body\)\) \.empty-state:where\(:has\(> \.empty-body\)\) \{ gap: \.9rem; padding: 1\.15rem 1\.25rem;/);
  assert.match(styles, /:where\(body:not\(\.app-body\)\) \.empty-icon \{ width: 2\.4rem; height: 2\.4rem;/);
});
