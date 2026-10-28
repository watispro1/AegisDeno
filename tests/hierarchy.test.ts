import { test } from "node:test";
import assert from "node:assert/strict";
import { outranks } from "../src/permissions/hierarchy";

const base = { ownerId: "owner", actorId: "mod", targetId: "member", actorTopPosition: 5, targetTopPosition: 2 };

test("higher top role outranks lower", () => {
  assert.equal(outranks(base), true);
});

test("equal or lower top role does not outrank", () => {
  assert.equal(outranks({ ...base, actorTopPosition: 2 }), false);
  assert.equal(outranks({ ...base, actorTopPosition: 1 }), false);
});

test("nobody can act on themselves, not even the owner", () => {
  assert.equal(outranks({ ...base, actorId: "member" }), false);
  assert.equal(outranks({ ...base, actorId: "owner", targetId: "owner" }), false);
});

test("the owner outranks everyone regardless of roles", () => {
  assert.equal(outranks({ ...base, actorId: "owner", actorTopPosition: 0, targetTopPosition: 99 }), true);
});

test("nobody outranks the owner", () => {
  assert.equal(outranks({ ...base, targetId: "owner", actorTopPosition: 99, targetTopPosition: 0 }), false);
});
