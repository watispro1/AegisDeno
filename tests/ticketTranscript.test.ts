import { test } from "node:test";
import assert from "node:assert/strict";
import {
  renderTranscriptHtml,
  escapeHtml,
  autoCloseDecision,
  normalizeAutoCloseHours,
  encodeTicketTask,
  decodeTicketTask,
  DEFAULT_TICKET_AUTOCLOSE_HOURS,
  MAX_TICKET_AUTOCLOSE_HOURS,
} from "../src/services/ticketTranscript";

const HOUR = 3_600_000;
const meta = { guildName: "G", channelName: "ticket-bob", ticketId: "ticket-1", openerId: "1", generatedAt: 0 };

test("escapeHtml escapes markup characters", () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
});

test("transcript is self-contained, ordered and escaped", () => {
  const html = renderTranscriptHtml(meta, [
    { authorTag: "bob", authorId: "2", bot: false, timestamp: 2000, content: "second <script>alert(1)</script>", attachments: [], embedCount: 0 },
    { authorTag: "alice", authorId: "1", bot: false, timestamp: 1000, content: "first", attachments: [{ name: "a.png", url: "https://cdn.example/a.png" }], embedCount: 1 },
  ]);
  assert.ok(html.startsWith("<!DOCTYPE html>"));
  assert.ok(!/<script/i.test(html), "no script tags");
  assert.ok(!/<link|src=/i.test(html), "no external assets");
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.indexOf("first") < html.indexOf("second"));
  assert.ok(html.includes('href="https://cdn.example/a.png"'));
  assert.ok(html.includes("[1 embed]"));
  assert.ok(html.includes("<dd>2</dd>"), "message count");
});

test("transcript drops non-https attachment links", () => {
  const html = renderTranscriptHtml(meta, [
    { authorTag: "x", authorId: "3", bot: true, timestamp: 1, content: "", attachments: [{ name: "evil", url: "javascript:alert(1)" }], embedCount: 0 },
  ]);
  assert.ok(!html.includes("javascript:"));
  assert.ok(html.includes("<span>evil</span>"));
});

test("empty transcript says so", () => {
  assert.ok(renderTranscriptHtml(meta, []).includes("No messages."));
});

test("autoCloseDecision closes quiet tickets and rechecks active ones", () => {
  assert.deepEqual(autoCloseDecision(0, 48, 48 * HOUR), { action: "close" });
  assert.deepEqual(autoCloseDecision(10 * HOUR, 48, 48 * HOUR), { action: "recheck", at: 58 * HOUR });
  assert.deepEqual(autoCloseDecision(0, 0, 999 * HOUR), { action: "disabled" });
});

test("normalizeAutoCloseHours clamps and defaults", () => {
  assert.equal(normalizeAutoCloseHours(undefined), DEFAULT_TICKET_AUTOCLOSE_HOURS);
  assert.equal(normalizeAutoCloseHours(-5), 0);
  assert.equal(normalizeAutoCloseHours(12.7), 12);
  assert.equal(normalizeAutoCloseHours(1e9), MAX_TICKET_AUTOCLOSE_HOURS);
});

test("ticket task payload round-trips and rejects garbage", () => {
  assert.deepEqual(decodeTicketTask(encodeTicketTask({ ticketId: "ticket-1" })), { ticketId: "ticket-1" });
  assert.equal(decodeTicketTask("nope"), null);
  assert.equal(decodeTicketTask("{}"), null);
});
