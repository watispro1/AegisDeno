/**
 * Reads a Keep a Changelog file and turns it into structured releases, so the
 * site can't drift from the files in the repository. CHANGELOG.md feeds
 * /changelog and /changelog.xml; DASHBOARD_CHANGELOG.md feeds
 * /dashboard/changelog.
 *
 * The parser only understands the subset of Markdown the changelog uses:
 * `## [version] - date` release headings, `### Section` headings, paragraphs,
 * `- ` list items (continuation lines indented), one level of nested `- `
 * items (indented two or more spaces under a parent item), inline code, bold,
 * inline links and reference links.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

export interface ChangelogSection {
  title: string;
  /** Rendered HTML for each list item; nested items become a `<ul>` inside it. */
  items: string[];
}

export interface ChangelogRelease {
  /** "Unreleased" or a version number such as "3.5.0". */
  version: string;
  /** ISO date (YYYY-MM-DD), or null for Unreleased. */
  date: string | null;
  /** Fragment id used on /changelog, e.g. "v3.5.0" or "unreleased". */
  id: string;
  /** Rendered HTML paragraphs that sit between the heading and the first section. */
  notes: string[];
  sections: ChangelogSection[];
  /** Compare link from the reference list at the bottom of the file, if any. */
  compareUrl: string | null;
}

export interface Changelog {
  /** Rendered HTML paragraphs from the top of the file. */
  intro: string[];
  releases: ChangelogRelease[];
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHref(url: string): string | null {
  const u = url.trim();
  if (/^https?:\/\//i.test(u) || u.startsWith("/") || u.startsWith("#")) return u;
  return null;
}

/** Inline Markdown to HTML: `code`, **bold**, [text](url) and [text] references. */
export function renderInline(md: string, refs: Map<string, string> = new Map()): string {
  // Pull code spans out first so nothing inside them is treated as Markdown.
  const codes: string[] = [];
  let s = md.replace(/`([^`]+)`/g, (_m, code: string) => {
    codes.push(`<code class="inline">${esc(code)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });

  s = esc(s);

  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, url: string) => {
    const href = safeHref(url.replace(/&amp;/g, "&"));
    return href ? `<a href="${esc(href)}">${text}</a>` : text;
  });

  s = s.replace(/\[([^\]]+)\]\[([^\]]+)\]/g, (m, text: string, label: string) => {
    const url = refs.get(label.toLowerCase());
    const href = url ? safeHref(url) : null;
    return href ? `<a href="${esc(href)}">${text}</a>` : m;
  });

  s = s.replace(/\[([^\]]+)\](?![(\[])/g, (m, text: string) => {
    const url = refs.get(text.toLowerCase());
    const href = url ? safeHref(url) : null;
    return href ? `<a href="${esc(href)}">${text}</a>` : m;
  });

  return s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => codes[Number(i)]);
}

function slug(version: string): string {
  return version.toLowerCase() === "unreleased" ? "unreleased" : `v${version.replace(/[^\w.-]/g, "")}`;
}

export function parseChangelog(md: string): Changelog {
  const lines = md.replace(/\r\n/g, "\n").split("\n");

  // Reference-style link definitions: [label]: url
  const refs = new Map<string, string>();
  for (const line of lines) {
    const m = line.match(/^\[([^\]]+)\]:\s*(\S+)\s*$/);
    if (m) refs.set(m[1].toLowerCase(), m[2]);
  }

  const intro: string[] = [];
  const releases: ChangelogRelease[] = [];
  let release: ChangelogRelease | null = null;
  let section: ChangelogSection | null = null;
  let para: string[] = [];
  let item: string[] | null = null;
  /** Nested items of the current item, each a list of wrapped lines. */
  let subs: string[][] = [];

  const flushItem = () => {
    if (item && section) {
      const nested = subs.length
        ? `<ul>${subs.map(sub => `<li>${renderInline(sub.join(" "), refs)}</li>`).join("")}</ul>`
        : "";
      section.items.push(renderInline(item.join(" "), refs) + nested);
    }
    item = null;
    subs = [];
  };
  const flushPara = () => {
    if (para.length) {
      const html = renderInline(para.join(" "), refs);
      if (release) release.notes.push(html);
      else intro.push(html);
    }
    para = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^\[[^\]]+\]:\s*\S+$/.test(line)) continue; // reference definitions
    if (/^#\s/.test(line)) continue; // the "# Changelog" title

    const rel = line.match(/^##\s+\[?([^\]\s]+)\]?(?:\s+[-–—]\s+(\d{4}-\d{2}-\d{2}))?\s*$/);
    if (rel) {
      flushItem();
      flushPara();
      const version = rel[1];
      release = {
        version,
        date: rel[2] ?? null,
        id: slug(version),
        notes: [],
        sections: [],
        compareUrl: refs.get(version.toLowerCase()) ?? null,
      };
      releases.push(release);
      section = null;
      continue;
    }

    const sec = line.match(/^###\s+(.+)$/);
    if (sec && release) {
      flushItem();
      flushPara();
      section = { title: sec[1].trim(), items: [] };
      release.sections.push(section);
      continue;
    }

    const li = line.match(/^-\s+(.*)$/);
    if (li && section) {
      flushItem();
      item = [li[1]];
      continue;
    }

    if (line.trim() === "") {
      flushItem();
      flushPara();
      continue;
    }

    const nested = line.match(/^\s{2,}[-*]\s+(.*)$/);
    if (item && nested) {
      subs.push([nested[1].trim()]);
      continue;
    }

    if (item && /^\s+\S/.test(line)) {
      // A continuation line belongs to the nested item it follows, if any.
      if (subs.length) subs[subs.length - 1].push(line.trim());
      else item.push(line.trim());
      continue;
    }

    flushItem();
    para.push(line.trim());
  }
  flushItem();
  flushPara();

  return { intro, releases };
}

const EMPTY: Changelog = { intro: [], releases: [] };

/** Bot changelog file name, at the repository root. */
export const CHANGELOG_FILE = "CHANGELOG.md";
/** Dashboard changelog file name, at the repository root. */
export const DASHBOARD_CHANGELOG_FILE = "DASHBOARD_CHANGELOG.md";

/** Parses one changelog file. A missing or unreadable file gives an empty changelog. */
export function readChangelogFile(path: string): Changelog {
  try {
    return parseChangelog(readFileSync(path, "utf8"));
  } catch {
    return EMPTY;
  }
}

/**
 * Changelog files sit at the repository root. From src/web (tsx) and dist/web
 * (compiled) that is two levels up; the working directory is a fallback.
 */
export function repoFilePath(fileName: string): string | null {
  const candidates = [join(__dirname, "..", "..", fileName), join(process.cwd(), fileName)];
  return candidates.find((p) => existsSync(p)) ?? null;
}

const cache = new Map<string, Changelog>();

/** Parsed changelog for a root-level file, read once per process. */
export function loadChangelog(fileName: string): Changelog {
  const hit = cache.get(fileName);
  if (hit) return hit;
  const file = repoFilePath(fileName);
  const log = file ? readChangelogFile(file) : EMPTY;
  cache.set(fileName, log);
  return log;
}

/** The bot changelog (CHANGELOG.md). */
export function getChangelog(): Changelog {
  return loadChangelog(CHANGELOG_FILE);
}

/** The dashboard changelog (DASHBOARD_CHANGELOG.md). */
export function getDashboardChangelog(): Changelog {
  return loadChangelog(DASHBOARD_CHANGELOG_FILE);
}

/** Released versions only (skips Unreleased), newest first. */
export function getReleases(): ChangelogRelease[] {
  return getChangelog().releases.filter((r) => r.date !== null);
}

/** Change type of a Keep a Changelog section, used for the coloured chips and the type filter. */
export type ChangeKind = "added" | "changed" | "fixed" | "security" | "removed" | "deprecated" | "known" | "other";

/** Display order of change types on the site. */
export const CHANGE_KINDS: readonly ChangeKind[] = ["added", "changed", "fixed", "security", "removed", "deprecated", "known", "other"];

/** Maps a section heading ("Added", "Known limitations", ...) to its change type. */
export function sectionKind(title: string): ChangeKind {
  const t = title.trim().toLowerCase();
  if (t === "added") return "added";
  if (t === "changed") return "changed";
  if (t === "fixed") return "fixed";
  if (t === "security") return "security";
  if (t === "removed") return "removed";
  if (t === "deprecated") return "deprecated";
  if (t.startsWith("known")) return "known";
  return "other";
}

/** Number of top-level changes in a release, per change type, plus the total. */
export function releaseCounts(r: ChangelogRelease): { total: number; byKind: Partial<Record<ChangeKind, number>> } {
  const byKind: Partial<Record<ChangeKind, number>> = {};
  let total = 0;
  for (const s of r.sections) {
    const k = sectionKind(s.title);
    byKind[k] = (byKind[k] ?? 0) + s.items.length;
    total += s.items.length;
  }
  return { total, byKind };
}

export type VersionBump = "major" | "minor" | "patch" | "initial";

function semverParts(v: string): [number, number, number] | null {
  const m = v.match(/^v?(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/**
 * What kind of release `version` is compared with the release before it
 * (`previous`, the next one down the newest-first list). The oldest release is
 * "initial"; anything that is not x.y.z counts as a patch.
 */
export function versionBump(version: string, previous: string | null | undefined): VersionBump {
  const cur = semverParts(version);
  if (!previous) return "initial";
  const prev = semverParts(previous);
  if (!cur || !prev) return "patch";
  if (cur[0] !== prev[0]) return "major";
  if (cur[1] !== prev[1]) return "minor";
  return "patch";
}

/** Strips tags and collapses whitespace: rendered changelog HTML to plain text. */
export function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Changelog as JSON for /changelog.json: plain text and HTML per change, released versions only. */
export function changelogJson(base: string): { version: 1; bot: unknown[]; dashboard: unknown[] } {
  const map = (log: Changelog, path: string) =>
    log.releases.filter((r) => r.date !== null).map((r) => ({
      version: r.version,
      date: r.date,
      url: `${base}${path}#${r.id}`,
      compareUrl: r.compareUrl,
      notes: r.notes.map(plainText),
      sections: r.sections.map((s) => ({
        title: s.title,
        kind: sectionKind(s.title),
        items: s.items.map((html) => ({ text: plainText(html), html })),
      })),
    }));
  return { version: 1, bot: map(getChangelog(), "/changelog"), dashboard: map(getDashboardChangelog(), "/dashboard/changelog") };
}

function xml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Atom feed of released versions. `base` is the site origin ("" for relative links). */
export function atomFeed(base: string): string {
  const releases = getReleases();
  const updated = releases[0]?.date ?? "2026-01-01";
  const entries = releases
    .map((r) => {
      const link = `${base}/changelog#${r.id}`;
      const html = [
        ...r.notes.map((n) => `<p>${n}</p>`),
        ...r.sections.map((s) => `<h3>${esc(s.title)}</h3><ul>${s.items.map((i) => `<li>${i}</li>`).join("")}</ul>`),
      ].join("");
      return `  <entry>
    <title>Aegis ${xml(r.version)}</title>
    <id>${xml(link)}</id>
    <link rel="alternate" type="text/html" href="${xml(link)}"/>
    <updated>${xml(r.date ?? updated)}T00:00:00Z</updated>
    <content type="html"><![CDATA[${html.replace(/]]>/g, "]]&gt;")}]]></content>
  </entry>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Aegis changelog</title>
  <subtitle>Release history for the Aegis Discord bot</subtitle>
  <id>${xml(base + "/changelog.xml")}</id>
  <link rel="self" type="application/atom+xml" href="${xml(base + "/changelog.xml")}"/>
  <link rel="alternate" type="text/html" href="${xml(base + "/changelog")}"/>
  <updated>${xml(updated)}T00:00:00Z</updated>
${entries}
</feed>
`;
}
