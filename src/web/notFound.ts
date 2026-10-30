/**
 * Pure helpers for the 404 page: guess which page a mistyped address meant.
 * Kept free of Express and Discord imports so they can be unit-tested directly.
 */

export interface Suggestion {
  href: string;
  label: string;
}

/** Levenshtein distance, capped early once it exceeds `max`. */
export function editDistance(a: string, b: string, max = 99): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Lower-cased path without query, hash, trailing slash or a `.html` suffix. */
export function normalisePath(raw: string): string {
  let path = String(raw ?? "").split(/[?#]/)[0].toLowerCase();
  try {
    path = decodeURIComponent(path);
  } catch {
    /* keep the raw form */
  }
  path = path.replace(/\/+$/, "").replace(/\.html?$/, "");
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * Up to three likely destinations for a path that did not match a route:
 * a page whose path is a small edit away, or a command whose name is the
 * last path segment (`/ban`, `/docs/timeout`).
 */
export function suggestPages(
  rawPath: string,
  pages: Suggestion[],
  commandNames: string[],
): Suggestion[] {
  const path = normalisePath(rawPath);
  if (path.length > 120) return [];
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  const add = (s: Suggestion) => {
    if (!seen.has(s.href) && out.length < 3) {
      seen.add(s.href);
      out.push(s);
    }
  };

  const scored = pages
    .filter(p => p.href !== "/")
    .map(p => ({ p, d: editDistance(path, p.href, 3) }))
    .filter(x => x.d <= Math.min(3, Math.max(1, Math.floor(x.p.href.length / 3))))
    .sort((a, b) => a.d - b.d);
  for (const { p } of scored) add(p);

  // A path that starts with a known page, e.g. /docs/automod -> /docs.
  for (const p of pages) {
    if (p.href !== "/" && path.startsWith(p.href + "/")) add(p);
  }

  const last = path.split("/").filter(Boolean).pop() ?? "";
  const name = last.replace(/^\//, "");
  if (name && commandNames.includes(name)) {
    add({ href: `/commands#cmd-${name}`, label: `/${name} in the command reference` });
  }
  return out;
}
