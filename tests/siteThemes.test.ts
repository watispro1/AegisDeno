/**
 * Site themes: every theme's text and status tokens meet WCAG AA (4.5:1) on
 * every background they are drawn on, the picker is rendered without inline
 * script/style, and the pre-paint script knows every theme.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { styles } from "../src/web/theme";
import { layout } from "../src/web/layout";
import { THEME_COLORS, THEME_IDS, themeInitScript, markSvg, faviconSvg, ogImageSvg, ogImagePng } from "../src/web/assets";
import { clientScript } from "../src/web/client";

type Tokens = Record<string, string>;

function block(selector: string): Tokens {
  const start = styles.indexOf(`${selector} {`);
  assert.ok(start >= 0, `missing token block ${selector}`);
  const body = styles.slice(start, styles.indexOf("}", start));
  const out: Tokens = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

/** Light is :root; the other themes override it. */
function theme(id: string): Tokens {
  const root = block(":root");
  return id === "light" ? root : { ...root, ...block(`[data-theme="${id}"]`) };
}

function rgb(c: string): [number, number, number, number] {
  const hex = /^#([0-9a-f]{6})$/i.exec(c);
  if (hex) return [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16)).concat(1) as [number, number, number, number];
  const fn = /^rgba?\(([^)]+)\)$/.exec(c);
  assert.ok(fn, `unparsable colour ${c}`);
  const p = fn[1].split(",").map(s => parseFloat(s));
  return [p[0], p[1], p[2], p[3] ?? 1];
}

/** Flatten a (possibly translucent) colour over an opaque one. */
function over(top: string, under: string): [number, number, number] {
  const [r, g, b, a] = rgb(top);
  const [ur, ug, ub] = rgb(under);
  return [r * a + ur * (1 - a), g * a + ug * (1 - a), b * a + ub * (1 - a)];
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = ["--text", "--text-2", "--muted", "--faint", "--link", "--ok", "--warn", "--danger"];
const BACKGROUNDS = ["--bg", "--bg-sunk", "--surface", "--code-bg"];
const AA = 4.5;

function resolve(t: Tokens, v: string): string {
  const ref = /^var\((--[\w-]+)\)$/.exec(v);
  return ref ? resolve(t, t[ref[1]]) : v;
}

test("themes: every theme has a token block and a browser colour", () => {
  assert.deepEqual([...THEME_IDS], ["light", "dark", "steel", "glass"]);
  for (const id of THEME_IDS) {
    const t = theme(id);
    for (const k of [...TEXT, ...BACKGROUNDS, "--accent", "--accent-ink", "--border"]) assert.ok(t[k], `${id}: ${k} defined`);
    assert.equal(resolve(t, t["--bg"]), THEME_COLORS[id], `${id}: theme-color matches --bg`);
  }
});

for (const id of THEME_IDS) {
  test(`contrast (${id}): text and status colours meet WCAG AA on every background`, () => {
    const t = theme(id);
    const failures: string[] = [];
    for (const bgKey of BACKGROUNDS) {
      const bg = over(resolve(t, t[bgKey]), resolve(t, t["--bg"]));
      for (const fg of TEXT) {
        const r = ratio(over(resolve(t, t[fg]), "#000000"), bg);
        if (r < AA) failures.push(`${fg} on ${bgKey}: ${r.toFixed(2)}`);
      }
    }
    const btn = ratio(rgb(resolve(t, t["--accent-ink"])).slice(0, 3) as [number, number, number], rgb(resolve(t, t["--accent"])).slice(0, 3) as [number, number, number]);
    if (btn < AA) failures.push(`--accent-ink on --accent: ${btn.toFixed(2)}`);
    /* Danger buttons, required-option pills and check icons put text on a status fill:
       white in light themes, the page ink in dark ones (see themes.ts). */
    const onFill = id === "dark" || id === "steel" || id === "glass" ? resolve(t, t["--bg"]) : "#ffffff";
    for (const fill of ["--danger", "--warn", "--accent"]) {
      const r = ratio(over(onFill, "#000000"), over(resolve(t, t[fill]), "#000000"));
      if (r < AA) failures.push(`on-fill text on ${fill}: ${r.toFixed(2)}`);
    }
    assert.deepEqual(failures, [], `${id} contrast failures`);
  });
}

test("contrast (glass): text stays AA on the frosted surfaces over every glow colour", () => {
  const t = theme("glass");
  for (const stop of ["--glass-a", "--glass-b", "--glass-c", "--glass-d", "--bg"]) {
    const under = resolve(t, t[stop]);
    for (const layer of ["--glass-surface", "--glass-strong"]) {
      const surface = over(t[layer], under);
      for (const fg of TEXT) {
        const r = ratio(over(resolve(t, t[fg]), "#000000"), surface);
        assert.ok(r >= AA, `${fg} on ${layer} over ${stop}: ${r.toFixed(2)}`);
      }
      /* Ghost pills and sunk fields add a faint white wash on top. */
      for (const wash of ["rgba(255, 255, 255, .13)"]) {
        const washed = over(wash, `rgb(${surface.join(",")})`);
        for (const fg of TEXT) {
          const r = ratio(over(resolve(t, t[fg]), "#000000"), washed);
          assert.ok(r >= AA, `${fg} on ${layer} + ${wash} over ${stop}: ${r.toFixed(2)}`);
        }
      }
    }
    for (const fg of TEXT) {
      const bare = ratio(over(resolve(t, t[fg]), "#000000"), rgb(under).slice(0, 3) as [number, number, number]);
      assert.ok(bare >= AA, `${fg} directly on ${stop}: ${bare.toFixed(2)}`);
    }
  }
});

test("glass: dark base, drifting glows that stop under reduced motion", () => {
  const t = theme("glass");
  assert.ok(luminance(rgb(t["--bg"]).slice(0, 3) as [number, number, number]) < 0.02, "glass is a dark theme");
  assert.ok(luminance(rgb(t["--text"]).slice(0, 3) as [number, number, number]) > 0.8, "light text");
  assert.match(styles, /\[data-theme="glass"\] body::before \{[^}]*animation: glass-drift/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\) \{\s*\[data-theme="glass"\] body::before \{ animation: none;/);
  assert.match(styles, /@media \(prefers-reduced-transparency: reduce\) \{[^@]*\[data-theme="glass"\] body::before \{ display: none; \}/);
  const [, , , a] = rgb(t["--glass-surface"]);
  assert.ok(a >= 0.45 && a <= 0.6, "frosted surface is translucent, not white");
  assert.ok(rgb(t["--glass-surface"]).slice(0, 3).every(c => c <= 40), "frosted surface is dark");
});

test("glass: blur only where supported, solid under prefers-reduced-transparency", () => {
  assert.match(styles, /@supports \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\)/);
  assert.match(styles, /@media \(prefers-reduced-transparency: reduce\)/);
  const outside = styles.replace(/@supports \(\(backdrop-filter[\s\S]*?\n}\n/, "").replace(/@media \(prefers-reduced-transparency: reduce\)[\s\S]*?\n}\n/, "");
  assert.ok(!/backdrop-filter:\s*blur/.test(outside.slice(outside.indexOf("Glass (beta)"))), "no unconditional blur for glass");
});

test("steel: editorial palette, no purple or neon in its tokens", () => {
  const t = block('[data-theme="steel"]');
  assert.equal(t["--bg"], "#0c0d0f");
  assert.equal(t["--text"], "#f2f0ea");
  assert.equal(t["--accent"], "#c5cdc8");
  assert.equal(t["--faint"], "#8e908c");
  for (const [k, v] of Object.entries(t)) {
    if (!/^#[0-9a-f]{6}$/i.test(v)) continue;
    const [r, g, b] = rgb(v);
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    assert.ok(sat < 110, `${k} ${v} is too saturated for Steel & Ink`);
    assert.ok(!(b > g + 20 && r > g + 20), `${k} ${v} reads as purple`);
  }
});

const html = layout({
  title: "T", description: "D", path: "/", body: "<p>x</p>", inviteUrl: "#", supportUrl: "", version: "1.0.0",
  ogImage: "/assets/og.png", assetVersion: "abc",
});

test("picker: every theme offered, Glass labelled Beta, no inline script, style or handlers", () => {
  assert.match(html, /<details class="theme-picker">\s*<summary class="icon-btn theme-toggle"/);
  for (const id of ["system", ...THEME_IDS]) assert.ok(html.includes(`data-set-theme="${id}"`), `offers ${id}`);
  assert.match(html, /data-set-theme="steel"[^>]*>[\s\S]*?Steel &amp; Ink<\/button>/);
  assert.match(html, /data-set-theme="glass"[^>]*>[\s\S]*?Glass <span class="theme-beta">Beta<\/span><\/button>/);
  assert.ok(!/<script(?![^>]*type="application\/ld\+json")[^>]*>[^<]+<\/script>/.test(html), "no inline executable script");
  assert.ok(!/\sstyle="/.test(html), "no inline styles");
  assert.ok(!/\son[a-z]+="/.test(html), "no inline handlers");
  assert.ok(html.indexOf('src="/assets/theme-init.js?v=abc"') < html.indexOf("</head>"), "theme applied from <head>, before paint");
  assert.ok(html.indexOf('src="/assets/theme-init.js') < html.indexOf("<body>"));
});

test("theme-init: applies every saved theme before paint and falls back to the system preference", () => {
  for (const id of THEME_IDS) assert.ok(themeInitScript.includes(`"${id}"`), `init knows ${id}`);
  assert.ok(themeInitScript.includes('localStorage.getItem("aegis-theme")'));
  assert.ok(themeInitScript.includes("prefers-color-scheme: dark"));
  const run = (saved: string | null, dark = false) => {
    const attrs: Record<string, string> = {};
    const meta = { content: "", setAttribute(_k: string, v: string) { this.content = v; } };
    const doc = { documentElement: { classList: { add() {} }, setAttribute: (k: string, v: string) => { attrs[k] = v; } }, querySelector: () => meta };
    const win = { matchMedia: () => ({ matches: dark }) };
    const ls = { getItem: () => saved };
    new Function("document", "window", "localStorage", themeInitScript)(doc, win, ls);
    return { ...attrs, meta: meta.content };
  };
  assert.deepEqual(run("steel"), { "data-theme": "steel", "data-theme-setting": "steel", meta: "#0c0d0f" });
  assert.deepEqual(run("glass"), { "data-theme": "glass", "data-theme-setting": "glass", meta: "#0b0d12" });
  assert.deepEqual(run(null, true), { "data-theme": "dark", "data-theme-setting": "system", meta: "#161716" });
  assert.deepEqual(run("bogus"), { "data-theme": "light", "data-theme-setting": "system", meta: "#fbfaf8" });
});

test("site.js: picker saves to localStorage and accepts only known themes", () => {
  assert.ok(clientScript.includes("'aegis-theme'"));
  for (const id of ["system", ...THEME_IDS]) assert.ok(clientScript.includes(`${id}:`), `client knows ${id}`);
  assert.ok(clientScript.includes("closest('.theme-picker')"));
  assert.ok(!clientScript.includes("cycleTheme"), "the old cycling toggle is gone");
});

test("brand: shield mark, favicon and a 1200x630 PNG social preview", () => {
  assert.match(markSvg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 32 32"/);
  assert.ok(faviconSvg.includes("#0c0d0f") && faviconSvg.includes("#c5cdc8"));
  assert.match(styles, /mask: url\("\/assets\/mark\.svg"\)/);
  assert.match(ogImageSvg, /width="1200" height="630"/);
  assert.ok(ogImageSvg.includes('fill="#0c0d0f"'), "og image uses the ink background");
  assert.equal(ogImagePng.subarray(1, 4).toString("latin1"), "PNG");
  assert.equal(ogImagePng.readUInt32BE(16), 1200);
  assert.equal(ogImagePng.readUInt32BE(20), 630);
  assert.ok(html.includes('content="/assets/og.png"'));
});
