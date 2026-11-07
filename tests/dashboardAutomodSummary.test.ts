import { test } from "node:test";
import assert from "node:assert/strict";
import { automodSummaryText, clipMessage, mentionList } from "../src/commands/general/dashboard/automodSummary";

const id = (n: number) => String(100000000000000000n + BigInt(n));

test("mentionList shows every mention when it fits and None when empty", () => {
  assert.equal(mentionList([], x => `<#${x}>`), "None");
  assert.equal(mentionList(["1", "2"], x => `<#${x}>`), "<#1>, <#2>");
});

test("mentionList stops inside its budget and counts the rest", () => {
  const ids = Array.from({ length: 100 }, (_, i) => id(i));
  const out = mentionList(ids, x => `<@&${x}>`, 200);
  assert.ok(out.length <= 200, `length ${out.length}`);
  const more = Number(/and (\d+) more$/.exec(out)?.[1]);
  assert.equal(out.split(", ").length + more, 100);
});

test("the AutoMod summary stays under 2000 characters with hundreds of exemptions", () => {
  const cfg = {
    words: { enabled: true, action: "delete" as const, list: ["a"] },
    links: { enabled: false, action: "delete" as const, allowedDomains: [] },
    mentions: { enabled: true, action: "timeout" as const, threshold: 5 },
    spam: { enabled: true, action: "timeout" as const, maxMessages: 5, windowSeconds: 5 },
    exemptRoleIds: Array.from({ length: 250 }, (_, i) => id(i)),
    exemptChannelIds: Array.from({ length: 500 }, (_, i) => id(1000 + i)),
  };
  const text = automodSummaryText("N".repeat(100), cfg);
  assert.ok(text.length <= 2000, `length ${text.length}`);
  assert.match(text, /\*\*Exempt Roles:\*\* <@&\d+>.* and \d+ more/);
  assert.match(text, /\*\*Exempt Channels:\*\* <#\d+>.* and \d+ more/);
  assert.doesNotMatch(text, /<@&\d*$|<#\d*$/);
});

test("clipMessage cuts long text with an ellipsis", () => {
  assert.equal(clipMessage("short"), "short");
  const clipped = clipMessage(`${"a".repeat(1500)}\n${"b".repeat(1500)}`);
  assert.ok(clipped.length <= 2000);
  assert.ok(clipped.endsWith("…"));
});
