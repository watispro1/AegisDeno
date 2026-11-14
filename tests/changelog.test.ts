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

test("3.7.0 and dashboard 1.2.3: dated 2026-11-02, grouped Added/Changed/Fixed/Security, cover the PR #21 work", () => {
  const bot = parseChangelog(readFileSync(join(__dirname, "..", "CHANGELOG.md"), "utf8")).releases.find((r) => r.version === "3.7.0")!;
  const dash = readChangelogFile(join(__dirname, "..", "DASHBOARD_CHANGELOG.md")).releases.find((r) => r.version === "1.2.3")!;
  assert.equal(bot.date, "2026-11-02");
  assert.equal(dash.date, "2026-11-02");
  for (const r of [bot, dash]) assert.deepEqual(r.sections.map((s) => s.title), ["Added", "Changed", "Fixed", "Security"]);
  const botText = bot.sections.flatMap((s) => s.items).join(" ");
  for (const needle of ["ModMail", "/digest", "/trust user", "/trustscore", "Giveaways", "Scheduled messages", "Incident Mode", "Trust Score"]) {
    assert.ok(botText.includes(needle), `3.7.0 mentions ${needle}`);
  }
  const dashText = dash.sections.flatMap((s) => s.items).join(" ");
  for (const needle of ["ModMail", "Staff digest", "ago", "copy buttons"]) assert.ok(dashText.includes(needle), `1.2.3 mentions ${needle}`);
  // Each top-level entry appears once (no duplicated bullets after the merge).
  for (const r of [bot, dash]) {
    const items = r.sections.flatMap((s) => s.items);
    assert.equal(new Set(items).size, items.length, `${r.version} has duplicate entries`);
  }
});

test("3.7.1 and dashboard 1.2.4: dated 2026-11-02, carry the economy and the entry-point notes moved from 3.7.0", () => {
  const releases = parseChangelog(readFileSync(join(__dirname, "..", "CHANGELOG.md"), "utf8")).releases;
  const bot = releases.find((r) => r.version === "3.7.1")!;
  const older = releases.find((r) => r.version === "3.7.0")!;
  const dash = readChangelogFile(join(__dirname, "..", "DASHBOARD_CHANGELOG.md")).releases.find((r) => r.version === "1.2.4")!;
  assert.equal(bot.date, "2026-11-02");
  assert.equal(dash.date, "2026-11-02");
  const botText = bot.sections.flatMap((s) => s.items).join(" ");
  for (const needle of ["/economy toggle", "/daily", "/pay", "/shop", "/leaderboard", "a!help", "JOIN_WELCOME"]) assert.ok(botText.includes(needle), `3.7.1 mentions ${needle}`);
  const olderText = older.sections.flatMap((s) => s.items).join(" ");
  assert.ok(!olderText.includes("a!help") && !olderText.includes("JOIN_WELCOME"), "entry-point notes moved out of 3.7.0");
  assert.ok(dash.sections.flatMap((s) => s.items).join(" ").includes("Economy page"));
  for (const r of [bot, dash]) {
    const items = r.sections.flatMap((s) => s.items);
    assert.equal(new Set(items).size, items.length, `${r.version} has duplicate entries`);
  }
});

test("3.7.2: dated 2026-11-04, dashboard stayed 1.2.4", () => {
  const releases = parseChangelog(readFileSync(join(__dirname, "..", "CHANGELOG.md"), "utf8")).releases;
  const r = releases.find((x) => x.version === "3.7.2")!;
  assert.equal(r.date, "2026-11-04");
  const text = r.sections.flatMap((s) => s.items).join(" ");
  for (const needle of ["/case search", "/purge", "/health"]) assert.ok(text.includes(needle), `3.7.2 mentions ${needle}`);
  const older = releases[releases.indexOf(r) + 1].sections.flatMap((s) => s.items).join(" ");
  assert.ok(!older.includes("/case search"), "3.7.2 notes are not left in 3.7.1");
});

test("3.7.3 and dashboard 1.2.5: dated 2026-11-04", () => {
  const bot = parseChangelog(readFileSync(join(__dirname, "..", "CHANGELOG.md"), "utf8")).releases;
  const dash = readChangelogFile(join(__dirname, "..", "DASHBOARD_CHANGELOG.md")).releases;
  const r = bot.find((x) => x.version === "3.7.3")!;
  assert.equal(r.date, "2026-11-04");
  assert.equal(dash.find((x) => x.version === "1.2.5")!.date, "2026-11-04");
  const text = r.sections.flatMap((s) => s.items).join(" ");
  for (const needle of ["/temprole", "/softban", "/starboard top"]) assert.ok(text.includes(needle), `3.7.3 mentions ${needle}`);
});

test("3.8.0 and dashboard 1.3.0: released 2026-11-05", () => {
  const bot = parseChangelog(readFileSync(join(__dirname, "..", "CHANGELOG.md"), "utf8")).releases;
  const dash = readChangelogFile(join(__dirname, "..", "DASHBOARD_CHANGELOG.md")).releases;
  const r = bot.find((x) => x.version === "3.8.0")!;
  assert.ok(r, "3.8.0 is still listed");
  assert.equal(r.date, "2026-11-05");
  const d130 = dash.find((x) => x.version === "1.3.0")!;
  assert.ok(d130, "dashboard 1.3.0 is still listed");
  assert.equal(d130.date, "2026-11-05");
  const text = r.sections.flatMap((s) => s.items).join(" ");
  for (const needle of ["/deposit", "/weekly", "/crime", "/gamble", "/softban"]) assert.ok(text.includes(needle), `3.8.0 mentions ${needle}`);
});

test("3.9.0: records /massban, the automod burst fix and the deploy note", () => {
  const bot = parseChangelog(readFileSync(join(__dirname, "..", "CHANGELOG.md"), "utf8")).releases;
  const r = bot.find((x) => x.version === "3.9.0")!;
  assert.ok(r, "3.9.0 is still listed");
  assert.equal(r.date, "2026-11-11");
  const text = r.sections.flatMap((s) => s.items).join(" ");
  for (const needle of ["/massban", "/case user", "/infractions", "60 seconds"]) assert.ok(text.includes(needle), `3.9.0 mentions ${needle}`);
});

test("3.10.0: records the economy expansion and the deploy note", () => {
  const bot = parseChangelog(readFileSync(join(__dirname, "..", "CHANGELOG.md"), "utf8")).releases;
  const r = bot.find((x) => x.version === "3.10.0")!;
  assert.ok(r, "3.10.0 is still listed");
  assert.equal(r.date, "2026-11-11");
  assert.ok(r.notes.join(" ").includes("npm run deploy"), "deploy note");
  const text = r.sections.flatMap((s) => s.items).join(" ");
  for (const needle of ["/rob", "/interest", "/transactions", "/gamble dice", "/economy stats"]) assert.ok(text.includes(needle), `3.10.0 mentions ${needle}`);
});

test("dashboard 1.4.0 redesign: released 2026-11-12", () => {
  const dash = readChangelogFile(join(__dirname, "..", "DASHBOARD_CHANGELOG.md")).releases;
  const r = dash.find((x) => x.version === "1.4.0");
  assert.ok(r, "1.4.0 is listed");
  assert.equal(r.date, "2026-11-12");
});

test("dashboard 1.5.0 modules: released 2026-11-12", () => {
  const dash = readChangelogFile(join(__dirname, "..", "DASHBOARD_CHANGELOG.md")).releases;
  const r = dash.find((x) => x.version === "1.5.0");
  assert.ok(r, "1.5.0 is listed");
  assert.equal(r.date, "2026-11-12");
});

test("dashboard 1.6.0 trust, members, automod and community pages: released 2026-11-12", () => {
  const dash = readChangelogFile(join(__dirname, "..", "DASHBOARD_CHANGELOG.md")).releases;
  const r = dash.find((x) => x.version === "1.6.0");
  assert.ok(r, "1.6.0 is listed");
  assert.equal(r.date, "2026-11-12");
  assert.ok(r.notes.join(" ").includes("3.12.0"), "names the bot release it shipped with");
  assert.deepEqual(r.sections.map((s) => s.title), ["Added", "Changed"]);
});

test("dashboard 1.7.0 themes and site content: released 2026-11-14", () => {
  const dash = readChangelogFile(join(__dirname, "..", "DASHBOARD_CHANGELOG.md")).releases;
  const r = dash.find((x) => x.version === "1.7.0")!;
  assert.ok(r, "1.7.0 is still listed");
  assert.equal(r.date, "2026-11-14");
  assert.ok(r.notes.join(" ").includes("3.12.1"), "names the bot release it shipped with");
  assert.deepEqual(r.sections.map((s) => s.title), ["Added", "Changed", "Fixed"]);
  const text = r.sections.flatMap((s) => s.items).join(" ");
  for (const needle of ["Theme picker", "Steel &amp; Ink", "Glass theme (beta)", "Shield logo", "social preview", "Dark theme contrast", "/why", "/security", "/roadmap", "FAQ", "/badge/status.svg", "HwTbCYC4PM"]) assert.ok(text.includes(needle), `1.7.0 mentions ${needle}`);
  const items = r.sections.flatMap((s) => s.items);
  assert.equal(new Set(items).size, items.length, "no duplicate entries");
});

test("dashboard 1.8.0 checklist, activity and site round 3: newest dashboard release", () => {
  const dash = readChangelogFile(join(__dirname, "..", "DASHBOARD_CHANGELOG.md")).releases;
  assert.equal(dash[0].version, "1.8.0");
  assert.equal(dash[0].date, "2026-11-14");
  assert.equal(DASHBOARD_VERSION, "1.8.0");
  assert.ok(dash[0].notes.join(" ").includes("3.13.0"), "names the bot release it shipped with");
  assert.deepEqual(dash[0].sections.map((s) => s.title), ["Added", "Changed", "Fixed"]);
  const text = dash[0].sections.flatMap((s) => s.items).join(" ");
  for (const needle of ["Get started checklist", "Recent activity", "Showcase", "What&#39;s new", "Need help?", "Breadcrumbs", "featureList", "Activity moves", "phones", "Steel &amp; Ink", "proprietary"]) assert.ok(text.includes(needle), `1.8.0 mentions ${needle}`);
  const items = dash[0].sections.flatMap((s) => s.items);
  assert.equal(new Set(items).size, items.length, "no duplicate entries");
});

test("3.11.0: records the command improvements and the deploy note", () => {
  const bot = parseChangelog(readFileSync(join(__dirname, "..", "CHANGELOG.md"), "utf8")).releases;
  const r = bot.find((x) => x.version === "3.11.0")!;
  assert.ok(r, "3.11.0 is still listed");
  assert.equal(r.date, "2026-11-12");
  assert.ok(r.notes.join(" ").includes("npm run deploy"), "deploy note");
  assert.deepEqual(r.sections.map((s) => s.title), ["Added", "Changed", "Fixed"]);
  const text = r.sections.flatMap((s) => s.items).join(" ");
  for (const needle of ["Error IDs", "Report Message", "User Info", "/userinfo", "/avatar", "/help", "Friendlier Discord errors"]) assert.ok(text.includes(needle), `3.11.0 mentions ${needle}`);
});

test("3.12.0: records the moderation and economy overhaul and the deploy note", () => {
  const bot = parseChangelog(readFileSync(join(__dirname, "..", "CHANGELOG.md"), "utf8")).releases;
  const r = bot.find((x) => x.version === "3.12.0")!;
  assert.ok(r, "3.12.0 is still listed");
  assert.equal(r.date, "2026-11-12");
  assert.ok(r.notes.join(" ").includes("npm run deploy"), "deploy note");
  assert.deepEqual(r.sections.map((s) => s.title), ["Added", "Changed", "Removed"]);
  const text = r.sections.flatMap((s) => s.items).join(" ");
  for (const needle of ["Remind Me About This", "Timed slowmode", "Quick purges", "/roleinfo", "/serverinfo", "/leaderboard", "/shop view", "/inventory", "/transactions"]) assert.ok(text.includes(needle), `3.12.0 mentions ${needle}`);
  const removed = r.sections.find((s) => s.title === "Removed")!;
  assert.ok(removed.items.some((i) => i.includes("/transactions") && i.includes("count")), "count option removal listed");
  const items = r.sections.flatMap((s) => s.items);
  assert.equal(new Set(items).size, items.length, "no duplicate entries");
});

test("3.12.1: records the new support server invite", () => {
  const bot = parseChangelog(readFileSync(join(__dirname, "..", "CHANGELOG.md"), "utf8")).releases;
  const r = bot.find((x) => x.version === "3.12.1")!;
  assert.ok(r, "3.12.1 is still listed");
  assert.equal(r.date, "2026-11-14");
  assert.deepEqual(r.sections.map((s) => s.title), ["Changed"]);
  const text = r.sections.flatMap((s) => s.items).join(" ");
  assert.ok(text.includes("https://discord.gg/HwTbCYC4PM"), "names the new invite");
  assert.ok(text.includes("SUPPORT_SERVER_URL"), "notes the override still wins");
});

test("3.13.0: newest bot release, records the trust bar, the licence change and the legal updates", () => {
  const bot = parseChangelog(readFileSync(join(__dirname, "..", "CHANGELOG.md"), "utf8")).releases;
  assert.equal(bot[0].version, "3.13.0");
  assert.equal(bot[0].date, "2026-11-14");
  assert.equal(VERSION, "3.13.0");
  const notes = bot[0].notes.join(" ");
  assert.ok(/MIT/.test(notes) && /proprietary/.test(notes), "notes the licence change from MIT to proprietary");
  assert.ok(notes.includes("1.8.0"), "names the dashboard release");
  assert.deepEqual(bot[0].sections.map((s) => s.title), ["Changed", "Fixed"]);
  const text = bot[0].sections.flatMap((s) => s.items).join(" ");
  for (const needle of ["Trust Score bar", "scoreBar()", "LICENSE", "UNLICENSED", "Terms of Service", "Privacy Policy", "2026-11-14", "HwTbCYC4PM", "/security", "/remindme", "Remind Me About This", "Timed slowmode".toLowerCase(), "ModMail", "90 days", "Node.js 22"]) assert.ok(text.includes(needle), `3.13.0 mentions ${needle}`);
  const items = bot[0].sections.flatMap((s) => s.items);
  assert.equal(new Set(items).size, items.length, "no duplicate entries");
});

test("3.13.0 licence: LICENSE is proprietary and package.json says UNLICENSED and private", () => {
  const licence = readFileSync(join(__dirname, "..", "LICENSE"), "utf8");
  assert.match(licence, /All rights reserved/);
  assert.match(licence, /written permission/);
  assert.doesNotMatch(licence, /^MIT License/m);
  assert.doesNotMatch(licence, /Permission is hereby granted, free of charge/);
  const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));
  assert.equal(pkg.license, "UNLICENSED");
  assert.equal(pkg.private, true);
  const lock = JSON.parse(readFileSync(join(__dirname, "..", "package-lock.json"), "utf8"));
  assert.equal(lock.packages[""].license, "UNLICENSED");
  assert.match(readFileSync(join(__dirname, "..", "README.md"), "utf8"), /"license": "UNLICENSED"/);
});

test("3.13.0 legal pages: updated 2026-11-14, licence and contact wording, new privacy rows", async () => {
  const { renderTerms, renderPrivacy } = await import("../src/web/pages");
  const cfg = { inviteUrl: "https://discord.com/oauth2/authorize?client_id=1", supportUrl: "", version: VERSION, contactEmail: "", assetVersion: "t" };
  const terms = renderTerms(cfg);
  const privacy = renderPrivacy(cfg);
  for (const html of [terms, privacy]) {
    assert.match(html, /datetime="2026-11-14">November 14, 2026/);
    assert.ok(html.includes('href="https://discord.gg/HwTbCYC4PM"'), "support server contact, even without SUPPORT_SERVER_URL");
    assert.ok(html.includes('href="/security"'));
  }
  assert.match(terms, /all rights are reserved/);
  assert.match(terms, /LICENSE/);
  for (const needle of ["Personal reminders", "Remind Me About This", "timed slowmode", "Proof attachments", "ModMail", "Incident Mode reports", "/transactions", "deleted automatically after 90 days", "180 days after the member", "Get started checklist", "aegis-theme", "not in a cookie", "/badge/status.svg", "no tracking", "direct message"]) assert.ok(privacy.includes(needle), `privacy mentions ${needle}`);
  assert.doesNotMatch(privacy, /does not read DMs/);
});
