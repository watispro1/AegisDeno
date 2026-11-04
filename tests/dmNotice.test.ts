import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { dmOutcome, dmSentLabel, dmSentText } from "../src/services/dmNotice";

test("DM notice: a failed DM is not reported as sent", () => {
  assert.equal(dmOutcome(false, true), "sent");
  assert.equal(dmOutcome(false, false), "failed");
  assert.equal(dmOutcome(true, false), "silent");
  assert.equal(dmSentLabel("sent"), "✅ Yes");
  assert.match(dmSentLabel("failed"), /DMs closed or blocked/);
  assert.equal(dmSentText("silent"), "No (silent)");
});

test("kick, ban and timeout report the DM from the send result", () => {
  for (const f of ["kick", "ban", "timeout"]) {
    const src = fs.readFileSync(`src/commands/moderation/${f}.ts`, "utf8");
    assert.match(src, /dmOutcome\(silent, \w+\)/, f);
    assert.ok(!/!silent \? "✅ Yes"/.test(src), `${f} still assumes the DM arrived`);
  }
});
