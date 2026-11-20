/**
 * Dead CSS guard: every class the stylesheet defines must be referenced by
 * some non-theme source file (markup templates, client scripts, or a
 * template-built name like `kc-${kind}`). A new rule for a class nothing
 * renders fails here; a deliberate exception goes in deadCss.allowlist.json.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { styles } from "../src/web/theme";

const root = join(__dirname, "..");
const themeDir = join(root, "src", "web", "theme");

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return p === themeDir ? [] : tsFiles(p);
    return p.endsWith(".ts") ? [p] : [];
  });
}

/** Class names defined in the stylesheet, comments stripped. */
export function cssClassNames(css: string): Set<string> {
  const out = new Set<string>();
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const rule of clean.split("{")) {
    const selector = rule.split("}").pop() ?? rule;
    for (const m of selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) out.add(m[1]);
  }
  return out;
}

function deadClasses(): string[] {
  const sources = tsFiles(join(root, "src")).map(f => readFileSync(f, "utf8"));
  const corpus = sources.join("\n");
  /* Prefixes of class names built at runtime: `kc-${kind}`, 'is-' + state. */
  const prefixes = new Set<string>();
  for (const src of sources) {
    for (const m of src.matchAll(/([a-z][\w-]*-)\$\{/g)) prefixes.add(m[1]);
    for (const m of src.matchAll(/["']([a-z][\w-]*-)["']\s*\+/g)) prefixes.add(m[1]);
  }
  const used = (cls: string) => {
    const escaped = cls.replace(/[-]/g, "\\-");
    if (new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`).test(corpus)) return true;
    return [...prefixes].some(p => cls.startsWith(p) && cls.length > p.length);
  };
  return [...cssClassNames(styles)].filter(c => !used(c)).sort();
}

test("dead css: no class in the stylesheet is unreferenced by the source (beyond the allowlist)", () => {
  const allow = JSON.parse(readFileSync(join(__dirname, "deadCss.allowlist.json"), "utf8")).classes as Record<string, string>;
  const dead = deadClasses();
  const fresh = dead.filter(c => !(c in allow));
  assert.deepEqual(fresh, [], `CSS classes nothing renders (delete the rules, or allowlist with a reason in tests/deadCss.allowlist.json): ${fresh.join(", ")}`);
  const stale = Object.keys(allow).filter(c => !dead.includes(c));
  assert.deepEqual(stale, [], `allowlisted classes that are now used or gone; remove them from the allowlist: ${stale.join(", ")}`);
});

test("dead css: the guard catches a class nothing renders", () => {
  assert.ok(cssClassNames(".zz-never-rendered-xyz { color: red } /* .ignored-in-comment */").has("zz-never-rendered-xyz"));
  assert.ok(!cssClassNames("/* .ignored-in-comment */").has("ignored-in-comment"));
});
