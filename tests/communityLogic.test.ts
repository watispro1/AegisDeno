import { test } from "node:test";
import assert from "node:assert/strict";
import {
  entryWeight,
  pickWeightedWinners,
  applyPollVote,
  tallyPoll,
  pollLeaders,
  buildResultBar,
  reviewTransition,
  isSuggestionOpen,
  effectiveStarCount,
  isImageAttachment,
  pickStarboardMedia,
  renderWelcomeTemplate,
} from "../src/services/communityLogic";

// ─── Giveaways ───────────────────────────────────────────────────────────────

test("entryWeight gives boosters the multiplier and clamps it to 1..10", () => {
  const boosters = new Set(["b"]);
  assert.equal(entryWeight("b", boosters, 3), 3);
  assert.equal(entryWeight("a", boosters, 3), 1);
  assert.equal(entryWeight("b", boosters, 0), 1);
  assert.equal(entryWeight("b", boosters, 99), 10);
});

test("pickWeightedWinners returns distinct winners and never more than entrants", () => {
  const w = pickWeightedWinners(["a", "b", "c", "a"], 5);
  assert.equal(w.length, 3);
  assert.equal(new Set(w).size, 3);
  assert.deepEqual(pickWeightedWinners([], 3), []);
  assert.deepEqual(pickWeightedWinners(["a"], 0), []);
});

test("pickWeightedWinners excludes previous winners on reroll", () => {
  for (let i = 0; i < 20; i++) {
    const w = pickWeightedWinners(["a", "b", "c"], 2, { exclude: ["a"] });
    assert.ok(!w.includes("a"));
    assert.equal(w.length, 2);
  }
});

test("pickWeightedWinners maps tickets to booster weight deterministically", () => {
  // Pool order: a(1), b(3 as booster), c(1) → tickets 0=a, 1..3=b, 4=c.
  const opts = { boosterIds: ["b"], multiplier: 3 };
  assert.deepEqual(pickWeightedWinners(["a", "b", "c"], 1, { ...opts, rand: () => 0 }), ["a"]);
  assert.deepEqual(pickWeightedWinners(["a", "b", "c"], 1, { ...opts, rand: () => 3 }), ["b"]);
  assert.deepEqual(pickWeightedWinners(["a", "b", "c"], 1, { ...opts, rand: () => 4 }), ["c"]);
});

test("booster bonus shifts odds roughly in proportion to the multiplier", () => {
  let boosterWins = 0;
  const runs = 4000;
  for (let i = 0; i < runs; i++) {
    const [w] = pickWeightedWinners(["a", "b"], 1, { boosterIds: ["b"], multiplier: 3 });
    if (w === "b") boosterWins++;
  }
  const share = boosterWins / runs; // expected 0.75
  assert.ok(share > 0.7 && share < 0.8, `booster share ${share}`);
});

// ─── Polls ───────────────────────────────────────────────────────────────────

test("applyPollVote replaces the pick on single-choice polls and toggles off", () => {
  assert.deepEqual(applyPollVote([], 1, false), { choices: [1], added: true });
  assert.deepEqual(applyPollVote([1], 2, false), { choices: [2], added: true });
  assert.deepEqual(applyPollVote([2], 2, false), { choices: [], added: false });
});

test("applyPollVote keeps several picks on multi-choice polls", () => {
  assert.deepEqual(applyPollVote([2], 0, true), { choices: [0, 2], added: true });
  assert.deepEqual(applyPollVote([0, 2], 2, true), { choices: [0], added: false });
});

test("tallyPoll counts picks per option and distinct voters, ignoring bad indices", () => {
  const t = tallyPoll({ u1: [0], u2: [0, 1], u3: [], u4: [7, 1, 1] }, 3);
  assert.deepEqual(t.counts, [2, 2, 0]);
  assert.equal(t.totalVotes, 4);
  assert.equal(t.voters, 3);
});

test("pollLeaders returns ties and nothing when no votes", () => {
  assert.deepEqual(pollLeaders([2, 2, 0]), [0, 1]);
  assert.deepEqual(pollLeaders([0, 3, 1]), [1]);
  assert.deepEqual(pollLeaders([0, 0]), []);
});

test("buildResultBar renders a ten-cell bar with a percentage", () => {
  assert.equal(buildResultBar(0, 0), "░░░░░░░░░░ 0%");
  assert.equal(buildResultBar(3, 5), "██████░░░░ 60%");
  assert.equal(buildResultBar(5, 5), "██████████ 100%");
});

// ─── Suggestions ─────────────────────────────────────────────────────────────

test("reviewTransition allows pending/considered → any and locks final states", () => {
  assert.deepEqual(reviewTransition("pending", "approve"), { ok: true, next: "approved" });
  assert.deepEqual(reviewTransition("considered", "deny"), { ok: true, next: "rejected" });
  assert.deepEqual(reviewTransition("pending", "consider"), { ok: true, next: "considered" });
  assert.deepEqual(reviewTransition("considered", "consider"), { ok: false, reason: "unchanged" });
  assert.deepEqual(reviewTransition("approved", "deny"), { ok: false, reason: "final" });
  assert.deepEqual(reviewTransition("rejected", "approve"), { ok: false, reason: "final" });
});

test("isSuggestionOpen", () => {
  assert.equal(isSuggestionOpen("pending"), true);
  assert.equal(isSuggestionOpen("considered"), true);
  assert.equal(isSuggestionOpen("approved"), false);
});

// ─── Starboard ───────────────────────────────────────────────────────────────

test("effectiveStarCount drops the author's own star unless self-star is allowed", () => {
  assert.equal(effectiveStarCount(3, true, false), 2);
  assert.equal(effectiveStarCount(3, true, true), 3);
  assert.equal(effectiveStarCount(3, false, false), 3);
  assert.equal(effectiveStarCount(0, true, false), 0);
});

test("isImageAttachment uses content type, then the file extension", () => {
  assert.equal(isImageAttachment({ url: "x", contentType: "image/png" }), true);
  assert.equal(isImageAttachment({ url: "x", contentType: "video/mp4", name: "a.png" }), false);
  assert.equal(isImageAttachment({ url: "https://cdn/x.JPG?ex=1" }), true);
  assert.equal(isImageAttachment({ url: "https://cdn/x.pdf" }), false);
});

test("pickStarboardMedia prefers the first image attachment and lists the rest", () => {
  const m = pickStarboardMedia("hi", [
    { url: "u/doc.pdf", name: "doc.pdf", contentType: "application/pdf" },
    { url: "u/a.png", name: "a.png", contentType: "image/png" },
    { url: "u/b.png", name: "b.png", contentType: "image/png" },
  ], [{ imageUrl: "embed.png" }]);
  assert.equal(m.imageUrl, "u/a.png");
  assert.deepEqual(m.extraFiles.map(f => f.name), ["doc.pdf", "b.png"]);
  assert.equal(m.fallbackText, null);
});

test("pickStarboardMedia never shows spoiler images inline", () => {
  const m = pickStarboardMedia("", [{ url: "u/s.png", name: "SPOILER_s.png", contentType: "image/png", spoiler: true }], []);
  assert.equal(m.imageUrl, null);
  assert.equal(m.extraFiles[0].name, "SPOILER: SPOILER_s.png");
});

test("pickStarboardMedia falls back to embed image/thumbnail and embed text", () => {
  const m = pickStarboardMedia("", [], [
    { title: "Title", url: "https://x", description: "Body", thumbnailUrl: "thumb.png" },
  ]);
  assert.equal(m.imageUrl, "thumb.png");
  assert.equal(m.fallbackText, "**[Title](https://x)**\nBody");
});

// ─── Welcome ─────────────────────────────────────────────────────────────────

test("renderWelcomeTemplate fills every variable including the {count} alias", () => {
  const out = renderWelcomeTemplate("Hi {user} ({username}) to {server}! #{count} / #{member_count}", {
    userId: "42", username: "aj", serverName: "Aegis", memberCount: 100,
  });
  assert.equal(out, "Hi <@42> (aj) to Aegis! #100 / #100");
});

test("renderWelcomeTemplate does not re-expand variables inside substituted values", () => {
  const out = renderWelcomeTemplate("{username} @ {server}", {
    userId: "1", username: "{server}", serverName: "S", memberCount: null,
  });
  assert.equal(out, "{server} @ S");
  assert.equal(renderWelcomeTemplate("{count}", { userId: "1", username: "u", serverName: "S", memberCount: null }), "?");
});
