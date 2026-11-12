import { test } from "node:test";
import assert from "node:assert/strict";
import { explainHierarchyRefusal } from "../src/permissions/hierarchyExplain";
import { command as kick } from "../src/commands/moderation/kick";

const base = { action: "ban", ownerId: "1", actorId: "2", targetId: "3", targetName: "spammer" };

test("hierarchy refusal names both roles and how to fix it", () => {
  const you = explainHierarchyRefusal({ ...base, who: "you", actorTop: { name: "Helpers", position: 3 }, targetTop: { name: "Mods", position: 7 } });
  assert.equal(you, "❌ You can't ban **spammer**: their highest role **@Mods** is above yours, **@Helpers**. A moderator with a higher role can do it, or an admin can move your role up in Server Settings → Roles.");
  const bot = explainHierarchyRefusal({ ...base, who: "bot", actorTop: { name: "Aegis", position: 3 }, targetTop: { name: "Admin", position: 9 } });
  assert.match(bot, /^❌ I can't ban \*\*spammer\*\*: their highest role \*\*@Admin\*\* is above mine, \*\*@Aegis\*\*\. To let me, drag my role \*\*@Aegis\*\* above \*\*@Admin\*\*/);
});

test("hierarchy refusal: equal roles, owner, self and unknown roles each say why", () => {
  assert.match(explainHierarchyRefusal({ ...base, who: "you", actorTop: { name: "Mods", position: 5 }, targetTop: { name: "Mods", position: 5 } }), /same as yours, \*\*@Mods\*\*/);
  assert.match(explainHierarchyRefusal({ ...base, who: "you", targetId: "1", actorTop: null, targetTop: null }), /own this server/);
  assert.equal(explainHierarchyRefusal({ ...base, who: "you", targetId: "2", actorTop: null, targetTop: null }), "❌ You can't ban yourself.");
  assert.match(explainHierarchyRefusal({ ...base, who: "bot", actorTop: { name: "Aegis", position: 1 }, targetTop: null }), /couldn't load their roles/);
  assert.match(explainHierarchyRefusal({ ...base, who: "you", actorTop: { name: "@everyone", position: 0 }, targetTop: { name: "Member", position: 1 } }), /yours, @everyone \(no roles\)/);
});

test("/kick takes an optional proof attachment like /warn, /timeout and /ban", () => {
  const json = kick.data.toJSON() as { options: Array<{ name: string; type: number; required?: boolean }> };
  const proof = json.options.find(o => o.name === "proof");
  assert.ok(proof);
  assert.equal(proof.type, 11, "attachment option");
  assert.equal(proof.required, false);
});
