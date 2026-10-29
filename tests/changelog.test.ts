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

test("DASHBOARD_CHANGELOG.md parses into a released 1.2.0 that matches DASHBOARD_VERSION", () => {
  const path = join(__dirname, "..", "DASHBOARD_CHANGELOG.md");
  const log = readChangelogFile(path);
  assert.ok(log.intro.length > 0, "intro paragraphs");
  assert.ok(log.releases.length >= 1);
  const [first] = log.releases;
  assert.equal(first.version, DASHBOARD_VERSION);
  assert.equal(first.version, "1.2.0");
  assert.equal(first.date, "2026-10-29");
  assert.equal(first.id, "v1.2.0");
  assert.ok(first.notes.some((n) => n.includes("Dashboard 1.2.0")), "version label note");
  assert.ok(!log.releases.some((r) => r.date === null), "no Unreleased section left");
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

test("CHANGELOG.md records the /plugins removal and points at the dashboard changelog", () => {
  const md = readFileSync(join(__dirname, "..", "CHANGELOG.md"), "utf8");
  const unreleased = parseChangelog(md).releases[0];
  assert.equal(unreleased.version, "Unreleased");
  assert.ok(unreleased.sections.some((s) => s.items.some((i) => i.includes("DASHBOARD_CHANGELOG.md"))));
  const removed = unreleased.sections.find((s) => s.title === "Removed");
  assert.ok(removed, "Unreleased has a Removed section");
  assert.ok(removed.items.some((i) => i.includes("/plugins") && i.includes("/api/plugins")));
  // No release before Unreleased ever shipped a plugin framework entry.
  for (const release of parseChangelog(md).releases.slice(1)) {
    for (const section of release.sections) {
      for (const item of section.items) assert.ok(!/\/plugins list|\/api\/plugins|plugin router/.test(item), item);
    }
  }
});
