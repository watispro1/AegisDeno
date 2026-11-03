import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

/** Every sendGuildLog(...) call in a file, as source text. */
function logCalls(file: string): string[] {
  const s = fs.readFileSync(file, "utf8");
  const calls: string[] = [];
  let from = 0;
  for (;;) {
    const start = s.indexOf("sendGuildLog(", from);
    if (start < 0) break;
    let i = start + "sendGuildLog(".length;
    let depth = 1;
    while (depth > 0 && i < s.length) {
      if (s[i] === "(") depth++;
      else if (s[i] === ")") depth--;
      i++;
    }
    calls.push(s.slice(start, i));
    from = i;
  }
  return calls.filter((c) => !c.startsWith("sendGuildLog(\n  client: Client"));
}

test("escalation, unban, timed unban, remove-timeout and clear-warnings logs use the modActions category", () => {
  const files = [
    "src/services/escalation.ts",
    "src/services/unban.ts",
    "src/commands/moderation/removetimeout.ts",
    "src/commands/moderation/clearwarnings.ts",
  ];
  for (const f of files) {
    const calls = logCalls(f);
    assert.ok(calls.length > 0, f);
    for (const c of calls) assert.match(c, /"modActions"\)$/, `${f}: ${c.slice(0, 60)}`);
  }
  const timedUnban = logCalls("src/services/scheduledActions.ts").find((c) => c.includes("Temporary Ban Expired"));
  assert.match(timedUnban ?? "", /"modActions"\)$/);
});
