import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDashboardChangelog, parseChangelog, readChangelogFile, renderInline } from "../src/web/changelog";
import { VERSION } from "../src/version";

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

test("DASHBOARD_CHANGELOG.md parses into an Unreleased dashboard release", () => {
  const path = join(__dirname, "..", "DASHBOARD_CHANGELOG.md");
  const log = readChangelogFile(path);
  assert.ok(log.intro.length > 0, "intro paragraphs");
  assert.ok(log.releases.length >= 1);
  const [first] = log.releases;
  assert.equal(first.version, "Unreleased");
  assert.equal(first.date, null);
  assert.equal(first.id, "unreleased");
  assert.ok(first.notes.some((n) => n.includes("Dashboard 0.1.0")), "version label note");
  assert.deepEqual(first.sections.map((s) => s.title), ["Added", "Security", "Known limitations"]);
  for (const r of log.releases) {
    assert.ok(r.sections.length > 0, `${r.version} has no sections`);
    for (const s of r.sections) {
      assert.ok(["Added", "Changed", "Fixed", "Removed", "Deprecated", "Security", "Known limitations"].includes(s.title), `${r.version}: unexpected section "${s.title}"`);
      assert.ok(s.items.length > 0, `${r.version} ${s.title} is empty`);
      for (const i of s.items) assert.ok(!/\]\(|\*\*/.test(i), `${r.version}: unrendered markdown in "${i}"`);
    }
  }
  // The same file through the cached root-level loader.
  assert.deepEqual(getDashboardChangelog(), log);
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
