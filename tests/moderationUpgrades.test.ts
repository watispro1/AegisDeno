import { test } from "node:test";
import assert from "node:assert/strict";
import { PermissionFlagsBits, PermissionsBitField } from "discord.js";

import { buildReasonSuggestions, combineReason, MOD_REASON_PRESETS } from "../src/utils/moderationPresets";
import { UNDO_WINDOW_MS, canPressUndo, isUndoWindowOpen, undoPermissionFor } from "../src/services/moderationUndo";
import { pageInfo, stepPage } from "../src/services/casePaging";
import { warningExpiryCutoff } from "../src/services/escalation";
import { normalizeWarnExpiryDays } from "../src/services/configuration";
import { buildLockNoticeText, shouldPostLockNotice } from "../src/services/lockNotice";
import { messageAlertKind, resolveWatchEvents, watchesVoice } from "../src/services/watchlistService";

// ─── Reason presets ──────────────────────────────────────────────────────────

test("reason presets are exactly the six requested", () => {
  assert.deepEqual(MOD_REASON_PRESETS.map((p) => p.value), ["Spam", "NSFW", "Harassment", "Advertising", "Raiding", "Other"]);
});

test("empty input lists every preset and no custom entry", () => {
  const s = buildReasonSuggestions("");
  assert.equal(s.length, 6);
  assert.ok(s.every((x) => !x.name.startsWith("Custom")));
});

test("typed text is offered first, keeps its casing, and matching presets follow", () => {
  const s = buildReasonSuggestions("  Spamming invite LINKS ");
  assert.equal(s[0].value, "Spamming invite LINKS");
  assert.match(s[0].name, /^Custom: /);
  const r = buildReasonSuggestions("raid");
  assert.equal(r[0].value, "raid");
  assert.ok(r.some((x) => x.value === "Raiding"));
});

test("typing a preset exactly does not duplicate it as custom", () => {
  const s = buildReasonSuggestions("nsfw");
  assert.deepEqual(s.map((x) => x.value), ["NSFW"]);
});

test("custom suggestions respect Discord's 100-char limits", () => {
  const s = buildReasonSuggestions("x".repeat(300));
  assert.ok(s[0].name.length <= 100);
  assert.ok(s[0].value.length <= 100);
});

test("combineReason merges legacy preset and free text", () => {
  assert.equal(combineReason(null, null), null);
  assert.equal(combineReason("Spam", null), "Spam");
  assert.equal(combineReason(null, " flooding "), "flooding");
  assert.equal(combineReason("Spam", "flooding #general"), "[Spam] flooding #general");
  assert.equal(combineReason("Spam", "Spam"), "Spam");
});

// ─── Undo window ─────────────────────────────────────────────────────────────

test("undo window is open for 5 minutes and closed after", () => {
  const t = 1_000_000;
  assert.equal(UNDO_WINDOW_MS, 300_000);
  assert.equal(isUndoWindowOpen(t, t), true);
  assert.equal(isUndoWindowOpen(t, t + UNDO_WINDOW_MS), true);
  assert.equal(isUndoWindowOpen(t, t + UNDO_WINDOW_MS + 1), false);
  assert.equal(isUndoWindowOpen(t, t - 1), false, "clock skew before the action is rejected");
});

test("undo requires Ban Members for bans and Moderate Members otherwise", () => {
  assert.equal(undoPermissionFor("ban"), PermissionFlagsBits.BanMembers);
  assert.equal(undoPermissionFor("timeout"), PermissionFlagsBits.ModerateMembers);
  const modOnly = new PermissionsBitField(PermissionFlagsBits.ModerateMembers);
  assert.equal(canPressUndo("warn", modOnly), true);
  assert.equal(canPressUndo("timeout", modOnly), true);
  assert.equal(canPressUndo("ban", modOnly), false);
  assert.equal(canPressUndo("warn", new PermissionsBitField(0n)), false);
  assert.equal(canPressUndo("warn", null), false);
});

// ─── Case paging ─────────────────────────────────────────────────────────────

test("pageInfo slices and clamps", () => {
  assert.deepEqual(pageInfo(12, 0), { page: 0, totalPages: 3, start: 0, end: 5, hasPrev: false, hasNext: true });
  assert.deepEqual(pageInfo(12, 2), { page: 2, totalPages: 3, start: 10, end: 12, hasPrev: true, hasNext: false });
  assert.equal(pageInfo(12, 99).page, 2);
  assert.equal(pageInfo(12, -4).page, 0);
  assert.deepEqual(pageInfo(0, 0), { page: 0, totalPages: 1, start: 0, end: 0, hasPrev: false, hasNext: false });
});

test("stepPage moves within bounds", () => {
  assert.equal(stepPage(0, "next", 12), 1);
  assert.equal(stepPage(2, "next", 12), 2);
  assert.equal(stepPage(0, "prev", 12), 0);
  assert.equal(stepPage(1, "prev", 12), 0);
});

// ─── Escalation expiry ───────────────────────────────────────────────────────

test("warningExpiryCutoff returns null when disabled and a past date otherwise", () => {
  const now = Date.UTC(2026, 9, 28);
  assert.equal(warningExpiryCutoff(null, now), null);
  assert.equal(warningExpiryCutoff(0, now), null);
  assert.equal(warningExpiryCutoff(undefined, now), null);
  assert.equal(warningExpiryCutoff(30, now)?.toISOString(), new Date(now - 30 * 86_400_000).toISOString());
});

test("normalizeWarnExpiryDays accepts 1–365 integers only", () => {
  assert.equal(normalizeWarnExpiryDays(30), 30);
  assert.equal(normalizeWarnExpiryDays("14"), 14);
  assert.equal(normalizeWarnExpiryDays(0), null);
  assert.equal(normalizeWarnExpiryDays(366), null);
  assert.equal(normalizeWarnExpiryDays(2.5), null);
  assert.equal(normalizeWarnExpiryDays(null), null);
  assert.equal(normalizeWarnExpiryDays(undefined), null);
});

// ─── Lock notice ─────────────────────────────────────────────────────────────

test("lock notice puts the custom message first and includes auto-unlock", () => {
  assert.equal(buildLockNoticeText({ reason: "Raid" }), "**Reason:** Raid");
  assert.equal(
    buildLockNoticeText({ reason: "Raid", customMessage: "  Back soon!  ", autoUnlockText: "<t:1:R>" }),
    "Back soon!\n\n**Reason:** Raid\n**Auto-unlock:** <t:1:R>",
  );
  assert.ok(buildLockNoticeText({ reason: "r", customMessage: "a".repeat(5000) }).length < 1100);
});

test("lock notice is posted elsewhere always, and in the current channel only with a custom message", () => {
  assert.equal(shouldPostLockNotice("a", "b", false), true);
  assert.equal(shouldPostLockNotice("a", "a", false), false);
  assert.equal(shouldPostLockNotice("a", "a", true), true);
});

// ─── Watchlist ───────────────────────────────────────────────────────────────

test("daily preset watches first message and voice only", () => {
  assert.deepEqual(resolveWatchEvents("daily"), ["firstMessage", "voice"]);
  assert.deepEqual(resolveWatchEvents("nope"), resolveWatchEvents("all"));
  assert.deepEqual(resolveWatchEvents(null), resolveWatchEvents("all"));
});

test("messageAlertKind distinguishes first-of-day from ordinary messages", () => {
  const daily = resolveWatchEvents("daily");
  assert.equal(messageAlertKind(daily, true), "firstMessage");
  assert.equal(messageAlertKind(daily, false), null);
  const msgs = resolveWatchEvents("messages");
  assert.equal(messageAlertKind(msgs, false), "message");
  assert.equal(messageAlertKind(msgs, true), "firstMessage");
  assert.equal(messageAlertKind(resolveWatchEvents("roles"), true), null);
});

test("watchesVoice covers new and legacy event names", () => {
  assert.equal(watchesVoice(["voice"]), true);
  assert.equal(watchesVoice(["presence"]), true);
  assert.equal(watchesVoice(["message"]), false);
});
