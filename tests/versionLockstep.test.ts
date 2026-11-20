import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import {
  collect,
  mismatches,
  newestChangelogVersion,
  readmeVersions,
  tsConst,
} from "../scripts/check-versions";

test("newestChangelogVersion skips Unreleased and reads the first numbered release", () => {
  assert.equal(
    newestChangelogVersion(
      "# Changelog\n\n## [Unreleased]\n\n## [3.15.0] - 2026-11-20\n\n## [3.14.1] - 2026-11-18\n",
    ),
    "3.15.0",
  );
  assert.equal(newestChangelogVersion("# Changelog\n\nNothing yet.\n"), null);
});

test("readmeVersions reads the Current version table row", () => {
  assert.deepEqual(
    readmeVersions("| a | b |\n| Current version | bot 3.15.0, dashboard 2.1.0 |\n"),
    { bot: "3.15.0", dashboard: "2.1.0" },
  );
  assert.deepEqual(readmeVersions("no table"), { bot: null, dashboard: null });
});

test("tsConst reads exported string constants", () => {
  const src = 'export const VERSION = "3.15.0";\nexport const DASHBOARD_VERSION = "2.1.0";\n';
  assert.equal(tsConst(src, "VERSION"), "3.15.0");
  assert.equal(tsConst(src, "DASHBOARD_VERSION"), "2.1.0");
  assert.equal(tsConst(src, "OTHER"), null);
});

test("mismatches reports disagreement and unreadable sources", () => {
  assert.deepEqual(
    mismatches({
      bot: [
        { source: "a", value: "1.0.0" },
        { source: "b", value: "1.0.0" },
      ],
    }),
    [],
  );
  const bad = mismatches({
    bot: [
      { source: "a", value: "1.0.0" },
      { source: "b", value: "1.1.0" },
      { source: "c", value: null },
    ],
  });
  assert.equal(bad.length, 2);
  assert.match(bad.join("\n"), /could not read a version from c/);
  assert.match(bad.join("\n"), /bot versions disagree/);
});

test("the repository's versions agree (package.json, src/version.ts, README, changelogs)", () => {
  const groups = collect(join(__dirname, ".."));
  assert.deepEqual(mismatches(groups), []);
  assert.ok(groups.bot.length >= 4 && groups.dashboard.length >= 3);
});
