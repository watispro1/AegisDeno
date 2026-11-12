/** Community pages pass: polls, Ghost Watch, starboard top posts and digest markup, the card-list kit and its script. */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { SiteConfig } from "../src/web/pages";
import { renderPolls } from "../src/web/dashboard/views/polls";
import { renderWatchlist } from "../src/web/dashboard/views/community";
import { renderDigest } from "../src/web/dashboard/views/digest";
import { starboardTopPanel } from "../src/web/dashboard/views/starboardTop";
import { cardTools, epoch, scheduleLine } from "../src/web/dashboard/views/communityKit";
import { dashboardScript } from "../src/web/dashboard/client";
import { styles } from "../src/web/theme";
import { DAY_NAMES } from "../src/services/digestLogic";

const GUILD = "800000000000000001";
const CHANNEL = "700000000000000001";
const site: SiteConfig = { inviteUrl: "#", supportUrl: "", version: "test", contactEmail: "", assetVersion: "t" };
const ctx = { guild: { id: GUILD, name: "Hub", memberCount: 3 }, viewer: { userId: "900000000000000001", username: "aj", globalName: null, csrf: "tok" }, nameOf: () => null } as never;
const noScript = (html: string) => assert.doesNotMatch(html, /<script>|onclick=|style="/);

const poll = (id: string, ended: boolean, votes: number[], label = "Best day?") => ({
  messageId: id, channelId: CHANNEL, creatorId: "900000000000000002", question: label, createdAt: new Date(Date.now() - 3600e3),
  endsAt: ended ? null : new Date(Date.now() + 7200e3), ended, multiselect: false, anonymous: false,
  options: votes.map((v, i) => ({ label: `Opt ${i}`, votes: v, percent: Math.round((v / Math.max(1, votes.reduce((a, b) => a + b, 0))) * 100) })),
  totalVotes: votes.reduce((a, b) => a + b, 0), voters: votes.reduce((a, b) => a + b, 0),
});

test("card kit: toolbar markup, epochs and the schedule line", () => {
  const t = cardTools("x<", { search: "Search", chips: [{ value: "open", label: "Open", count: 2 }], sorts: [{ value: "votes:desc", label: "Most votes" }] });
  assert.match(t, /data-cl-search="x&lt;"/);
  assert.match(t, /data-cl-chip="" aria-pressed="true">All <span class="chip-count">2/);
  assert.match(t, /<option value="votes:desc">Most votes/);
  assert.equal(epoch(new Date(5000)), 5);
  assert.equal(epoch(null), null);
  assert.equal(scheduleLine(1, 9, "UTC", DAY_NAMES), "Mondays at 09:00 UTC");
  assert.equal(scheduleLine(7, 9, "UTC", DAY_NAMES), null);
  assert.equal(scheduleLine(1, 24, "UTC", DAY_NAMES), null);
});

test("polls page: summary strip, pills, card tools with sort keys and the old counts line", () => {
  const html = renderPolls(site, ctx, { rows: [poll("100000000000000010", false, [2, 1]), poll("100000000000000011", true, [1, 1], "Staff vote")] as never, channels: [{ id: CHANNEL, name: "general" }] as never, hidden: new Set() });
  assert.match(html, /aria-label="Poll summary"/);
  assert.match(html, /1 open, 1 closed/);
  assert.match(html, /pill pill-ok">Open/);
  assert.match(html, /Leading: Opt 0/);
  assert.match(html, /pill pill-warn">Tied/);
  assert.match(html, /id="poll-list" data-card-list data-page-size="10"/);
  assert.match(html, /data-chip-value="open" data-sort-created="\d+" data-sort-votes="3" data-sort-closes="\d+"/);
  assert.match(html, /data-cl-more="poll-list"/);
  noScript(html);
  const empty = renderPolls(site, ctx, { rows: [], channels: [], hidden: new Set() });
  assert.match(empty, /No polls yet/);
  assert.doesNotMatch(empty, /data-card-list/);
});

test("Ghost Watch: summary, chips, sort keys, paging and a confirmed remove", () => {
  const rows = [
    { targetId: "900000000000000003", reason: null, events: ["all"], alertCount: 4, createdAt: new Date(Date.now() - 86400e3), expiresAt: new Date(Date.now() + 86400e3) },
    { targetId: "900000000000000004", reason: "spam", events: [], alertCount: 1, createdAt: new Date(), expiresAt: null },
  ];
  const html = renderWatchlist(site, ctx, { rows: rows as never, noticeCode: null });
  assert.match(html, /aria-label="Ghost Watch summary"/);
  assert.match(html, /<dt>Alerts sent<\/dt><dd>5<\/dd>/);
  assert.match(html, /data-chip-for="watch-table" data-chip="timed"/);
  assert.match(html, /id="watch-table" data-filterable data-page-size="20"/);
  assert.match(html, /data-chip-value="open" data-sort-alerts="1"/);
  assert.match(html, /data-confirm="Remove this member/);
  assert.match(html, /name="_csrf" value="tok"/);
  noScript(html);
});

test("starboard top: rank badges, sort keys and summary", () => {
  const e = (n: string, stars: number) => ({ sourceMessageId: n, sourceChannelId: CHANNEL, starboardMessageId: null, authorId: "900000000000000005", starCount: stars, excerpt: "hi", createdAt: new Date() });
  const html = starboardTopPanel(ctx, { entries: [e("100000000000000001", 9), e("100000000000000002", 5), e("100000000000000003", 4), e("100000000000000004", 2)] as never, starboardChannelId: null, emoji: "⭐" }, []);
  assert.match(html, /rank-badge rank-1">1/);
  assert.match(html, /data-sort-rank="1" data-sort-stars="9"/);
  assert.match(html, /<dt>Stars in top list<\/dt><dd>20<\/dd>/);
  assert.match(html, /One member has 4 of these/);
  noScript(html);
});

test("digest: summary pill, help and a live schedule line tied to the form", () => {
  const html = renderDigest(site, ctx, { config: { enabled: true, channelId: null, day: 1, hour: 9, timezone: "UTC" } as never, preview: null, channels: [], noticeCode: null });
  assert.match(html, /pill pill-ok">On/);
  assert.match(html, /data-schedule-preview="dg-" data-days="Sunday,Monday/);
  assert.match(html, /Will post Mondays at 09:00 UTC\./);
  assert.match(html, /What the digest covers/);
  noScript(html);
});

test("script and styles are registered", () => {
  assert.match(dashboardScript, /data-cl-search/);
  assert.match(dashboardScript, /data-schedule-preview/);
  assert.match(styles, /li\[data-cl-paged-out\]/);
  assert.ok(styles.indexOf("data-cl-paged-out") < styles.lastIndexOf("@media"), "loaded before responsive rules");
});
