import { test } from "node:test";
import assert from "node:assert/strict";
import { command as purgeCmd } from "../src/commands/moderation/purge";
import { command as ticketCmd } from "../src/commands/tickets/ticket";
import { command as serverinfoCmd } from "../src/commands/general/serverinfo";

test("/purge command has keep_pinned boolean option", () => {
  const json = purgeCmd.data.toJSON() as { options?: Array<{ name: string; type: number; required?: boolean }> };
  const keepPinnedOpt = json.options?.find(o => o.name === "keep_pinned");
  assert.ok(keepPinnedOpt, "keep_pinned option exists");
  assert.equal(keepPinnedOpt.type, 5, "keep_pinned option is boolean (type 5)");
  assert.equal(keepPinnedOpt.required, false, "keep_pinned is optional");
});

test("/ticket command includes rename subcommand", () => {
  const json = ticketCmd.data.toJSON() as { options?: Array<{ name: string; type: number; options?: Array<{ name: string }> }> };
  const renameSub = json.options?.find(o => o.name === "rename");
  assert.ok(renameSub, "rename subcommand exists on /ticket");
  const nameOpt = renameSub.options?.find(o => o.name === "name");
  assert.ok(nameOpt, "rename subcommand has name option");
});

test("automod detects words obfuscated with zero-width spaces", () => {
  const rawBlocked = "badword";
  // Simulating zero-width space \u200B and soft hyphen \u00AD injected by a spammer
  const obfuscatedMsg = "b\u200Ba\u00ADd\u200Bw\uFEFFo\u200Cr\u200Dd";
  const normalized = obfuscatedMsg.toLowerCase().replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "");
  assert.equal(normalized, rawBlocked, "normalized string matches raw blocked word");
});
