import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compareTopEntries,
  escapeDiscordText,
  formatTopAuthors,
  formatTopDescription,
  formatTopLine,
  inPeriod,
  isStarboardTopPeriod,
  messageUrl,
  periodStart,
  rankTopAuthors,
  rankTopEntries,
  starboardPostUrl,
  storedExcerpt,
  topTitle,
  type StarboardTopEntry,
} from "../src/services/starboardTop";
import { topFilter } from "../src/services/starboardTopQuery";
import { starboardTopPanel } from "../src/web/dashboard/views/starboardTop";

const GUILD = "800000000000000001";
const NOW = new Date("2026-11-04T16:00:00Z");
const DAY = 86_400_000;

function entry(id: string, stars: number, daysAgo: number, authorId = "500000000000000001", extra: Partial<StarboardTopEntry> = {}): StarboardTopEntry {
  return {
    sourceChannelId: "700000000000000001",
    sourceMessageId: id,
    authorId,
    starboardMessageId: `9${id.slice(1)}`,
    starCount: stars,
    excerpt: `post ${id}`,
    createdAt: new Date(NOW.getTime() - daysAgo * DAY),
    ...extra,
  };
}

test("periods: week and month count back from now; all has no start", () => {
  assert.equal(periodStart("all", NOW), null);
  assert.equal(periodStart("week", NOW)?.toISOString(), "2026-10-28T16:00:00.000Z");
  assert.equal(periodStart("month", NOW)?.toISOString(), "2026-10-05T16:00:00.000Z");
  assert.equal(inPeriod(entry("1", 1, 7), "week", NOW), true, "exactly 7 days ago is included");
  assert.equal(inPeriod(entry("1", 1, 7.01), "week", NOW), false);
  assert.equal(inPeriod(entry("1", 1, 29), "month", NOW), true);
  assert.equal(inPeriod(entry("1", 1, 400), "all", NOW), true);
  assert.equal(isStarboardTopPeriod("week"), true);
  assert.equal(isStarboardTopPeriod("year"), false);
  assert.equal(isStarboardTopPeriod(undefined), false);
});

test("ranking: most stars first, ties to the earlier starboard post, then lower message ID", () => {
  const list = [
    entry("100000000000000003", 5, 1),
    entry("100000000000000001", 9, 2),
    entry("100000000000000002", 5, 3),
    entry("100000000000000004", 5, 3),
  ];
  assert.deepEqual(rankTopEntries(list, { now: NOW }).map(e => e.sourceMessageId), [
    "100000000000000001", "100000000000000002", "100000000000000004", "100000000000000003",
  ]);
  assert.equal(compareTopEntries(list[2], list[2]), 0);
});

test("ranking: period and author filters, limit capped at 10 by default", () => {
  const many = Array.from({ length: 15 }, (_, i) => entry(`1000000000000000${String(i).padStart(2, "0")}`, i, i, i % 2 ? "500000000000000002" : "500000000000000001"));
  assert.equal(rankTopEntries(many, { now: NOW }).length, 10);
  assert.equal(rankTopEntries(many, { now: NOW, limit: 100 }).length, 15, "hard cap is 25");
  const week = rankTopEntries(many, { period: "week", now: NOW });
  assert.deepEqual(week.map(e => e.starCount), [7, 6, 5, 4, 3, 2, 1, 0]);
  const byAuthor = rankTopEntries(many, { authorId: "500000000000000002", now: NOW });
  assert.ok(byAuthor.every(e => e.authorId === "500000000000000002"));
  assert.deepEqual(byAuthor.map(e => e.starCount), [13, 11, 9, 7, 5, 3, 1]);
});

test("top authors: summed stars, ties broken by post count then ID", () => {
  const authors = rankTopAuthors([
    entry("1", 10, 1, "500000000000000003"),
    entry("2", 4, 1, "500000000000000001"),
    entry("3", 6, 1, "500000000000000001"),
    entry("4", 10, 1, "500000000000000002"),
    entry("5", 1, 1, "500000000000000004"),
  ]);
  assert.deepEqual(authors, [
    { authorId: "500000000000000001", stars: 10, posts: 2 },
    { authorId: "500000000000000002", stars: 10, posts: 1 },
    { authorId: "500000000000000003", stars: 10, posts: 1 },
  ]);
  assert.equal(formatTopAuthors([], "⭐"), null);
  assert.equal(
    formatTopAuthors(authors.slice(0, 2), "⭐"),
    "**Top authors:** <@500000000000000001> (10 ⭐ · 2 posts), <@500000000000000002> (10 ⭐ · 1 post)",
  );
});

test("excerpts: whitespace collapsed, clipped by characters, markdown and mentions defused", () => {
  assert.equal(storedExcerpt("  hello\n\n  world  "), "hello world");
  assert.equal(storedExcerpt(null), "");
  assert.equal(storedExcerpt("abcdefghij", 5), "abcd…");
  assert.equal(storedExcerpt("😀😀😀😀😀😀", 4), "😀😀😀…", "emoji are not split");
  assert.equal(escapeDiscordText("[click](https://x) **bold** @everyone"), "\\[click\\](https://x) \\*\\*bold\\*\\* @\u200beveryone");
  assert.equal(escapeDiscordText("<@123> # big"), "\\<@\u200b123\\> \\# big");
});

test("links: original message, and the starboard post in its saved channel or the current one", () => {
  const e = entry("100000000000000001", 3, 1);
  assert.equal(messageUrl(GUILD, "7", "1"), `https://discord.com/channels/${GUILD}/7/1`);
  assert.equal(starboardPostUrl(GUILD, e, null), null);
  assert.equal(starboardPostUrl(GUILD, e, "700000000000000009"), `https://discord.com/channels/${GUILD}/700000000000000009/900000000000000001`);
  assert.equal(starboardPostUrl(GUILD, { ...e, starboardChannelId: "700000000000000005" }, "700000000000000009"), `https://discord.com/channels/${GUILD}/700000000000000005/900000000000000001`);
});

test("formatTopLine: rank, stars, author, links and an escaped excerpt", () => {
  const e = entry("100000000000000001", 12, 1, "500000000000000001", { excerpt: "nice *art*" });
  const line = formatTopLine(e, 1, { guildId: GUILD, emoji: "⭐", starboardChannelId: "700000000000000009" });
  assert.equal(line,
    `**1.** ⭐ **12** · <@500000000000000001> · <#700000000000000001> · [Original](https://discord.com/channels/${GUILD}/700000000000000001/100000000000000001) · [Starboard](https://discord.com/channels/${GUILD}/700000000000000009/900000000000000001)\n> nice \\*art\\*`);
  const bare = formatTopLine({ ...e, excerpt: null }, 2, { guildId: GUILD, emoji: "🌟", starboardChannelId: null });
  assert.ok(!bare.includes("[Starboard]"));
  assert.ok(bare.endsWith("> *no text*"));
});

test("formatTopDescription keeps under the limit and always keeps the authors line", () => {
  const lines = Array.from({ length: 10 }, (_, i) => `${i}`.padEnd(600, "x"));
  const out = formatTopDescription(lines, "**Top authors:** a", 4096);
  assert.ok(out.length <= 4096);
  assert.ok(out.endsWith("**Top authors:** a"));
  assert.equal(formatTopDescription(["a", "b"], null), "a\n\nb");
  assert.equal(topTitle("week", false), "Top starred posts (past 7 days)");
  assert.equal(topTitle("all", true), "Top starred posts by this member (all time)");
});

test("topFilter: guild always, author and period only when given", () => {
  assert.deepEqual(topFilter(GUILD, { period: "all" }), { guildId: GUILD });
  assert.deepEqual(topFilter(GUILD, { period: "week", authorId: "5", now: NOW }), {
    guildId: GUILD, authorId: "5", createdAt: { $gte: new Date("2026-10-28T16:00:00.000Z") },
  });
});

test("dashboard Top posts panel escapes text and links both messages", () => {
  const ctx = { guild: { id: GUILD, name: "Hub", memberCount: 3 }, viewer: { userId: "900000000000000001", username: "aj", globalName: null, csrf: "x" }, nameOf: () => null };
  const html = starboardTopPanel(ctx, {
    entries: [entry("100000000000000001", 7, 1, "500000000000000001", { excerpt: "<script>alert(1)</script>" })],
    starboardChannelId: "700000000000000009",
    emoji: "⭐",
  }, [{ id: "700000000000000001", name: "general" }] as never);
  assert.ok(!html.includes("<script>"));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /href="https:\/\/discord\.com\/channels\/800000000000000001\/700000000000000001\/100000000000000001"/);
  assert.match(html, /href="https:\/\/discord\.com\/channels\/800000000000000001\/700000000000000009\/900000000000000001"/);
  assert.match(html, /#general/);
  assert.match(html, /<strong>7<\/strong> ⭐/);
  assert.ok(!/style=|<script/.test(html), "no inline styles or scripts");
  const empty = starboardTopPanel(ctx, { entries: [], starboardChannelId: null, emoji: "⭐" }, []);
  assert.match(empty, /No starred posts yet/);
});
