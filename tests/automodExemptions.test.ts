/** Per-rule automod exemptions (3.7.1) and partial config saves that no longer wipe settings. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeAutomodConfig, normalizeAutomodConfig, cleanIdList } from "../src/services/automod";
import { ruleExempt } from "../src/services/automodExecution";
import { editExemption, parseScope, perRuleExemptionLines } from "../src/services/automodExempt";
import { command as automod } from "../src/commands/automod/automod";

const G = "800000000000000001";
const ROLE = "600000000000000001";
const ROLE2 = "600000000000000002";
const CH = "700000000000000001";
const PARENT = "700000000000000002";

const base = () => normalizeAutomodConfig(G, {
  caps: { enabled: true, action: "delete", threshold: 70 },
  links: { enabled: true, action: "warn", exemptRoleIds: [ROLE], exemptChannelIds: [CH] },
  exemptRoleIds: [ROLE2],
});
const member = (roles: string[]) => ({ roles: { cache: { some: (fn: (r: { id: string }) => boolean) => roles.some(id => fn({ id })) } } }) as never;

test("normalize: per-rule lists keep distinct snowflakes only, capped at 25", () => {
  const c = normalizeAutomodConfig(G, { words: { enabled: true, action: "delete", list: [], exemptRoleIds: [ROLE, ROLE, "x", "$ne", ...Array.from({ length: 40 }, (_, i) => String(600000000000000100n + BigInt(i)))] } });
  assert.equal(c.words.exemptRoleIds!.length, 25);
  assert.equal(c.words.exemptRoleIds![0], ROLE);
  assert.ok(!c.words.exemptRoleIds!.includes("x"));
  assert.deepEqual(c.spam.exemptChannelIds, []);
  assert.deepEqual(cleanIdList("nope"), []);
});

test("merge: a partial save (preset, dashboard form) keeps caps, global and per-rule exemptions", () => {
  const current = base();
  // What a preset sends: four rules, no caps, no exemption lists.
  const preset = mergeAutomodConfig(current, { words: { enabled: true, action: "warn", list: ["bad"] }, links: { enabled: true, action: "delete" }, mentions: { enabled: true, action: "timeout", threshold: 4 }, spam: { enabled: true, action: "timeout", maxMessages: 5, windowSeconds: 5 } });
  assert.equal(preset.caps.enabled, true, "caps untouched (was reset to off before 3.7.1)");
  assert.equal(preset.caps.threshold, 70);
  assert.deepEqual(preset.exemptRoleIds, [ROLE2], "global exemptions kept (were wiped before 3.7.1)");
  assert.deepEqual(preset.links.exemptRoleIds, [ROLE], "per-rule exemptions kept");
  assert.equal(preset.links.action, "delete");
  // The dashboard form sends the global lists explicitly; an empty list clears them.
  const cleared = mergeAutomodConfig(preset, { exemptRoleIds: [] });
  assert.deepEqual(cleared.exemptRoleIds, []);
  assert.deepEqual(cleared.links.exemptChannelIds, [CH]);
});

test("ruleExempt: by role, by channel, and by a thread's parent channel", () => {
  const rule = base().links;
  assert.equal(ruleExempt(rule, member([ROLE]), ["700000000000000009"]), true);
  assert.equal(ruleExempt(rule, member([ROLE2]), [CH]), true);
  assert.equal(ruleExempt(rule, member([ROLE2]), ["700000000000000009"]), false);
  assert.equal(ruleExempt({ exemptChannelIds: [PARENT] }, null, ["thread-id", PARENT]), true, "a thread in an exempt channel");
  assert.equal(ruleExempt(base().words, member([ROLE]), [CH]), false, "other rules are unaffected");
});

test("editExemption: global vs one rule, duplicates and missing entries refused, only the changed part is patched", () => {
  const c = base();
  const add = editExemption(c, "caps", "role", ROLE2, true);
  assert.ok(add.ok);
  if (add.ok) {
    assert.deepEqual(Object.keys(add.patch), ["caps"]);
    assert.deepEqual(add.patch.caps!.exemptRoleIds, [ROLE2]);
    assert.equal(add.patch.caps!.threshold, 70);
    assert.match(add.message, /caps and floods rule/);
  }
  assert.equal(editExemption(c, "links", "channel", CH, true).ok, false);
  assert.equal(editExemption(c, "words", "channel", CH, false).ok, false);
  const global = editExemption(c, "all", "role", ROLE, true);
  assert.ok(global.ok && JSON.stringify(global.patch) === JSON.stringify({ exemptRoleIds: [ROLE2, ROLE] }));
  assert.equal(parseScope("spam"), "spam");
  assert.equal(parseScope("$where"), "all");
  assert.equal(parseScope(null), "all");
  assert.deepEqual(perRuleExemptionLines(c), [`**Links:** <@&${ROLE}>, <#${CH}>`]);
});

test("/automod exempt subcommands take an optional rule", () => {
  const json = automod.data.toJSON() as { options: Array<{ name: string; options?: Array<{ name: string; options?: Array<{ name: string; required?: boolean; choices?: unknown[] }> }> }> };
  const exempt = json.options.find(o => o.name === "exempt")!;
  assert.deepEqual(exempt.options!.map(o => o.name), ["addrole", "removerole", "addchannel", "removechannel"]);
  for (const sub of exempt.options!) {
    const rule = sub.options!.find(o => o.name === "rule")!;
    assert.ok(rule && !rule.required && rule.choices!.length === 6, sub.name);
  }
});
