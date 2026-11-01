import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDashboardChangelog, parseChangelog, readChangelogFile, renderInline } from "../src/web/changelog";
import { DASHBOARD_VERSION, VERSION } from "../src/version";

const sample = `# Changelog

Intro with a [link](https://keepachangelog.com/).

## [Unreleased]

### Added
- Something \`new\` with **bold**
  that wraps onto a second line.

## [1.2.0] - 2026-10-01

A note about this release.

### Fixed
- A [ref link][1.2.0] and <script>alert(1)</script>.

[1.2.0]: https://github.com/o/r/compare/a...b
`;

test("parseChangelog reads releases, sections and wrapped items", () => {
  const log = parseChangelog(sample);
  assert.equal(log.releases.length, 2);
  const [unreleased, rel] = log.releases;
  assert.equal(unreleased.version, "Unreleased");
  assert.equal(unreleased.date, null);
  assert.equal(unreleased.id, "unreleased");
  assert.equal(unreleased.sections[0].title, "Added");
  assert.equal(
    unreleased.sections[0].items[0],
    'Something <code class="inline">new</code> with <strong>bold</strong> that wraps onto a second line.',
  );
  assert.equal(rel.version, "1.2.0");
  assert.equal(rel.date, "2026-10-01");
  assert.equal(rel.id, "v1.2.0");
  assert.equal(rel.compareUrl, "https://github.com/o/r/compare/a...b");
  assert.deepEqual(rel.notes, ["A note about this release."]);
  assert.equal(log.intro.length, 1);
});

test("parseChangelog escapes HTML and resolves reference links", () => {
  const item = parseChangelog(sample).releases[1].sections[0].items[0];
  assert.ok(item.includes('<a href="https://github.com/o/r/compare/a...b">ref link</a>'));
  assert.ok(item.includes("&lt;script&gt;"));
  assert.ok(!item.includes("<script>"));
});

test("renderInline keeps markdown inside code spans literal and drops unsafe links", () => {
  assert.equal(renderInline("`**not bold**`"), '<code class="inline">**not bold**</code>');
  assert.equal(renderInline("[x](javascript:alert(1))"), "x)");
});

test("CHANGELOG.md parses and its newest release matches src/version.ts", () => {
  const md = readFileSync(join(__dirname, "..", "CHANGELOG.md"), "utf8");
  const log = parseChangelog(md);
  const released = log.releases.filter((r) => r.date);
  assert.equal(released[0].version, VERSION);
  for (const r of log.releases) {
    assert.ok(r.sections.length > 0, `${r.version} has no sections`);
    for (const s of r.sections) {
      assert.ok(["Added", "Changed", "Fixed", "Removed", "Deprecated", "Security"].includes(s.title), `${r.version}: unexpected section "${s.title}"`);
      assert.ok(s.items.length > 0, `${r.version} ${s.title} is empty`);
      for (const i of s.items) assert.ok(!/\]\(|\*\*/.test(i), `${r.version}: unrendered markdown in "${i}"`);
    }
  }
});

test("DASHBOARD_CHANGELOG.md: newest release matches DASHBOARD_VERSION; 1.2.1 and 1.2.0 stay intact", () => {
  const path = join(__dirname, "..", "DASHBOARD_CHANGELOG.md");
  const log = readChangelogFile(path);
  assert.ok(log.intro.length > 0, "intro paragraphs");
  assert.ok(log.releases.length >= 1);
  assert.equal(log.releases[0].version, DASHBOARD_VERSION);
  assert.equal(log.releases[0].id, `v${DASHBOARD_VERSION}`);
  assert.ok(log.releases[0].notes.some((n) => n.includes(`Dashboard ${DASHBOARD_VERSION}`)), "newest version label note");
  const latest = log.releases.find((r) => r.version === "1.2.1")!;
  const first = log.releases.find((r) => r.version === "1.2.0")!;
  assert.ok(latest && first);
  assert.equal(latest.date, "2026-10-30");
  assert.equal(latest.id, "v1.2.1");
  assert.ok(latest.notes.some((n) => n.includes("Dashboard 1.2.1")), "version label note");
  assert.deepEqual(latest.sections.map((s) => s.title), ["Changed", "Fixed"]);
  assert.ok(latest.sections.some((s) => s.items.some((i) => i.includes("View Channel"))), "hidden-channel handling listed");
  assert.equal(first.version, "1.2.0");
  assert.equal(first.date, "2026-10-29");
  assert.equal(first.id, "v1.2.0");
  assert.ok(first.notes.some((n) => n.includes("Dashboard 1.2.0")), "version label note");
  assert.ok(!log.releases.some((r) => r.date === null), "no Unreleased section left");
  assert.ok(!log.intro.join(" ").toLowerCase().includes("unreleased"), "intro never says unreleased");
  assert.deepEqual(first.sections.map((s) => s.title), ["Added", "Changed", "Fixed", "Security", "Known limitations"]);
  for (const r of log.releases) {
    assert.ok(r.sections.length > 0, `${r.version} has no sections`);
    for (const s of r.sections) {
      assert.ok(["Added", "Changed", "Fixed", "Removed", "Deprecated", "Security", "Known limitations"].includes(s.title), `${r.version}: unexpected section "${s.title}"`);
      assert.ok(s.items.length > 0, `${r.version} ${s.title} is empty`);
      for (const i of s.items) {
        assert.ok(!/\]\(|\*\*/.test(i), `${r.version}: unrendered markdown in "${i}"`);
        assert.ok(!/\s-\s\*\*|\s- [A-Z][a-z]+:/.test(i), `${r.version}: nested bullet flattened into "${i.slice(0, 80)}"`);
      }
    }
  }
  // The settings sections are a nested list, not run together.
  const settings = first.sections[0].items.find((i) => i.startsWith("<strong>Settings</strong>"));
  assert.ok(settings, "Settings item");
  assert.match(settings, /<ul><li>Logging: [^<]*<\/li><li>Escalation:/);
  // The same file through the cached root-level loader.
  assert.deepEqual(getDashboardChangelog(), log);
});

test("parseChangelog renders nested bullets as a nested list, with wrapped lines", () => {
  const md = `## [2.0.0] - 2026-10-29

### Added
- **Parent** item
  that wraps.
  - First child with \`code\`
    continued here.
  - Second child
- Next top-level item
`;
  const [section] = parseChangelog(md).releases[0].sections;
  assert.equal(section.items.length, 2);
  assert.equal(
    section.items[0],
    '<strong>Parent</strong> item that wraps.<ul><li>First child with <code class="inline">code</code> continued here.</li><li>Second child</li></ul>',
  );
  assert.equal(section.items[1], "Next top-level item");
  assert.ok(!section.items[0].includes(" - "), "no literal dash separator");
});

test("parseChangelog escapes HTML inside nested items", () => {
  const md = `## [2.0.0] - 2026-10-29

### Fixed
- Parent
  - <img src=x onerror=alert(1)>
`;
  const item = parseChangelog(md).releases[0].sections[0].items[0];
  assert.ok(item.includes("&lt;img"));
  assert.ok(!item.includes("<img"));
});

test("readChangelogFile returns an empty changelog for a missing file", () => {
  assert.deepEqual(readChangelogFile(join(__dirname, "no-such-changelog.md")), { intro: [], releases: [] });
});

test("CHANGELOG.md: newest release matches VERSION; 3.6.0 records the /plugins removal, hidden channels, and points at the dashboard changelog", () => {
  const md = readFileSync(join(__dirname, "..", "CHANGELOG.md"), "utf8");
  const releases = parseChangelog(md).releases;
  assert.ok(!releases.some((r) => r.date === null || r.version === "Unreleased"), "no Unreleased section");
  assert.ok(!/unreleased/i.test(md), "the word unreleased is gone");
  assert.equal(releases[0].version, VERSION);
  const latest = releases.find((r) => r.version === "3.6.0")!;
  assert.ok(latest, "3.6.0 is still listed");
  assert.equal(latest.date, "2026-10-30");
  assert.ok(latest.sections.some((s) => s.items.some((i) => i.includes("DASHBOARD_CHANGELOG.md"))));
  assert.ok(latest.sections.some((s) => s.items.some((i) => i.includes("isObfuscatedChannel"))), "channel obfuscation listed");
  const removed = latest.sections.find((s) => s.title === "Removed");
  assert.ok(removed, "3.6.0 has a Removed section");
  assert.ok(removed.items.some((i) => i.includes("/plugins") && i.includes("/api/plugins")));
  // No release before 3.6.0 ever shipped a plugin framework entry.
  for (const release of parseChangelog(md).releases.slice(releases.indexOf(latest) + 1)) {
    for (const section of release.sections) {
      for (const item of section.items) assert.ok(!/\/plugins list|\/api\/plugins|plugin router/.test(item), item);
    }
  }
});
