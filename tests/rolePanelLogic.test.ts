import { test } from "node:test";
import assert from "node:assert/strict";
import {
  planRoleChanges,
  meetsPanelRequirement,
  rolePanelSelectCustomId,
  parseRolePanelSelectCustomId,
  normalizePanelMode,
  normalizePanelStyle,
} from "../src/services/rolePanelLogic";

const panel = ["a", "b", "c"];

test("multi mode toggles each picked role", () => {
  assert.deepEqual(planRoleChanges(["a"], panel, ["a", "b"], "multi"), { add: ["b"], remove: ["a"] });
});

test("roles outside the panel and duplicates are ignored", () => {
  assert.deepEqual(planRoleChanges([], panel, ["x", "b", "b"], "multi"), { add: ["b"], remove: [] });
  assert.deepEqual(planRoleChanges([], panel, ["x"], "multi"), { add: [], remove: [] });
});

test("exclusive mode swaps to the picked role", () => {
  assert.deepEqual(planRoleChanges(["a", "c", "other"], panel, ["b"], "exclusive"), { add: ["b"], remove: ["a", "c"] });
});

test("exclusive mode removes a role that is picked again", () => {
  assert.deepEqual(planRoleChanges(["b"], panel, ["b"], "exclusive"), { add: [], remove: ["b"] });
});

test("exclusive mode only honours the first valid pick", () => {
  assert.deepEqual(planRoleChanges([], panel, ["x", "c", "a"], "exclusive"), { add: ["c"], remove: [] });
});

test("required role gate", () => {
  assert.equal(meetsPanelRequirement(["a"], null), true);
  assert.equal(meetsPanelRequirement(["a"], "req"), false);
  assert.equal(meetsPanelRequirement(["a", "req"], "req"), true);
});

test("select custom id round-trips and does not collide with button ids", () => {
  const id = rolePanelSelectCustomId("panel-1234");
  assert.equal(parseRolePanelSelectCustomId(id), "panel-1234");
  assert.equal(/^rolepanel_/.test(id), false);
  assert.equal(parseRolePanelSelectCustomId("rolepanel_panel-1_123"), null);
  assert.equal(parseRolePanelSelectCustomId("rolepanelsel_"), null);
});

test("style and mode default safely", () => {
  assert.equal(normalizePanelStyle("dropdown"), "dropdown");
  assert.equal(normalizePanelStyle(undefined), "button");
  assert.equal(normalizePanelMode("exclusive"), "exclusive");
  assert.equal(normalizePanelMode("weird"), "multi");
});
