import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_PENDING_PER_USER, messageReminderText, reminderListLine, reminderRequestProblem, safeJumpUrl } from "../src/services/personalReminders";
import { decodePersonalReminder, encodePersonalReminder } from "../src/services/timedActions";

test("remindme: new reminders keep the old limits", () => {
  assert.equal(reminderRequestProblem({ text: "x", durationSec: 3600, pending: 0 }), null);
  assert.match(reminderRequestProblem({ text: "  ", durationSec: 3600, pending: 0 })!, /empty/);
  assert.match(reminderRequestProblem({ text: "x", durationSec: 5, pending: 0 })!, /Minimum is 10 seconds/);
  assert.match(reminderRequestProblem({ text: "x", durationSec: null, pending: 0 })!, /Invalid duration/);
  assert.match(reminderRequestProblem({ text: "x", durationSec: 366 * 86_400, pending: 0 })!, /365 days/);
  assert.match(reminderRequestProblem({ text: "x", durationSec: 60, pending: MAX_PENDING_PER_USER })!, /already have 25/);
  assert.match(reminderRequestProblem({ text: "y".repeat(513), durationSec: 60, pending: 0 })!, /512/);
});

test("remindme: only Discord message links are kept as jump links", () => {
  assert.equal(safeJumpUrl("https://discord.com/channels/123456789012345678/123456789012345679/123456789012345680"), "https://discord.com/channels/123456789012345678/123456789012345679/123456789012345680");
  assert.ok(safeJumpUrl("https://ptb.discord.com/channels/@me/123456789012345679/123456789012345680"));
  assert.equal(safeJumpUrl("https://evil.example/channels/1/2/3"), undefined);
  assert.equal(safeJumpUrl("https://discord.com/channels/1/2/3?x=javascript:"), undefined);
  assert.equal(safeJumpUrl(null), undefined);
});

test("Remind Me About This: the note wins, otherwise the message's first line or attachments", () => {
  assert.equal(messageReminderText("  reply to Sam ", { content: "hi", authorTag: "a", attachments: 0 }), "reply to Sam");
  assert.equal(messageReminderText("", { content: "\n  first line\nsecond", authorTag: "amy", attachments: 0 }), "Message from amy: “first line”");
  assert.equal(messageReminderText(null, { content: "", authorTag: "amy", attachments: 2 }), "Message from amy: 2 attachments");
  assert.equal(messageReminderText(null, { content: "", authorTag: "amy", attachments: 0 }), "Message from amy: a message");
  assert.ok(messageReminderText(null, { content: "z".repeat(600), authorTag: "amy", attachments: 0 }).length < 240);
});

test("remindme: the jump link survives encode/decode and shows in the list", () => {
  const payload = { text: "check this", inChannel: false, sourceName: "S", setAt: 1, jumpUrl: "https://discord.com/channels/1/2/3" };
  const round = decodePersonalReminder(encodePersonalReminder(payload));
  assert.equal(round?.jumpUrl, payload.jumpUrl);
  assert.equal(decodePersonalReminder(JSON.stringify({ ...payload, jumpUrl: "javascript:alert(1)" }))?.jumpUrl, undefined);
  const line = reminderListLine({ id: "abc", executeAt: new Date(10_000), payload: encodePersonalReminder({ ...payload, repeat: "daily" }) });
  assert.equal(line, "⏰ `abc` · <t:10:R> · 🔁 daily · [message](https://discord.com/channels/1/2/3)\n-# check this");
});
