import { test } from "node:test";
import assert from "node:assert/strict";
import { command as slowmode } from "../src/commands/moderation/slowmode";
import { decodeSlowmodeRevert, encodeSlowmodeRevert, slowmodeForProblem, slowmodeRevertDecision } from "../src/services/slowmodeRevert";

test("/slowmode set and custom take an optional autocompleted `for`", () => {
  const json = slowmode.data.toJSON() as { options: Array<{ name: string; options?: Array<{ name: string; autocomplete?: boolean; required?: boolean }> }> };
  for (const sub of ["set", "custom"]) {
    const opt = json.options.find(o => o.name === sub)?.options?.find(o => o.name === "for");
    assert.ok(opt, `/slowmode ${sub} has for`);
    assert.equal(opt.autocomplete, true);
    assert.equal(opt.required, false);
  }
  assert.equal(typeof slowmode.autocomplete, "function");
});

test("timed slowmode: limits on `for` and nothing-to-revert are explained", () => {
  assert.equal(slowmodeForProblem(3600, 30, 0), null);
  assert.match(slowmodeForProblem(null, 30, 0)!, /isn't a duration/);
  assert.match(slowmodeForProblem(30, 30, 0)!, /at least 1 minute/);
  assert.match(slowmodeForProblem(8 * 86_400, 30, 0)!, /at most 7 days/);
  assert.match(slowmodeForProblem(3600, 0, 0)!, /already off/);
  assert.match(slowmodeForProblem(3600, 30, 30)!, /already at that rate/);
});

test("timed slowmode: only reverts when the channel still has the rate Aegis set", () => {
  const p = { previousRate: 0, appliedRate: 30, moderatorTag: "mod" };
  assert.equal(slowmodeRevertDecision(30, p), "revert");
  assert.equal(slowmodeRevertDecision(60, p), "changed-since", "a later manual change is kept");
  assert.equal(slowmodeRevertDecision(0, p), "already");
});

test("timed slowmode payload round-trips and rejects bad values", () => {
  const p = { previousRate: 5, appliedRate: 600, moderatorTag: "mod#1" };
  assert.deepEqual(decodeSlowmodeRevert(encodeSlowmodeRevert(p)), p);
  assert.equal(decodeSlowmodeRevert("{bad"), null);
  assert.equal(decodeSlowmodeRevert(JSON.stringify({ previousRate: -1, appliedRate: 5 })), null);
  assert.equal(decodeSlowmodeRevert(JSON.stringify({ previousRate: 0, appliedRate: 99_999 })), null);
  assert.equal(decodeSlowmodeRevert(JSON.stringify({ previousRate: 0, appliedRate: 5 }))?.moderatorTag, "a moderator");
});
