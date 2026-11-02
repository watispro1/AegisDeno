/** /trustscore is a thin deprecated alias of /trust user (3.7.0 QoL round). */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { command as trustscore, TRUSTSCORE_DEPRECATION_NOTE } from "../src/commands/moderation/trustscore";
import { replyWithTrust } from "../src/commands/moderation/trust";

test("alias: same options as before, described as deprecated, points at /trust user", () => {
  const json = trustscore.data.toJSON() as { name: string; description: string; options: Array<{ name: string }> };
  assert.equal(json.name, "trustscore");
  assert.match(json.description, /Deprecated: use \/trust user/);
  assert.deepEqual(json.options.map(o => o.name), ["user", "ephemeral"]);
  assert.match(TRUSTSCORE_DEPRECATION_NOTE, /\/trust user/);
  assert.equal(typeof replyWithTrust, "function");
});

test("alias: no second scoring engine or collector left in /trustscore", () => {
  const src = fs.readFileSync("src/commands/moderation/trustscore.ts", "utf8");
  assert.doesNotMatch(src, /calculateTrustProfile|createMessageComponentCollector/);
  assert.match(src, /replyWithTrust/);
});
