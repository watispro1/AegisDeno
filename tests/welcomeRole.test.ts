import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldAssignWelcomeRole, WELCOME_ROLE_WINDOW_MS } from "../src/bot/eventFilters";

const NOW = Date.UTC(2026, 10, 3, 12);
const HOUR = 3_600_000;
const fresh = { pending: false, joinedTimestamp: NOW - HOUR, hasRole: false };

test("welcome role: cached member leaving screening gets the role", () => {
  assert.equal(shouldAssignWelcomeRole({ pending: true }, fresh, NOW), true);
});

test("welcome role: partial old member with null pending still counts for a recent joiner", () => {
  assert.equal(shouldAssignWelcomeRole({ partial: true, pending: null }, fresh, NOW), true);
});

test("welcome role: partial old member who joined over 7 days ago is skipped", () => {
  const old = { ...fresh, joinedTimestamp: NOW - WELCOME_ROLE_WINDOW_MS - 1 };
  assert.equal(shouldAssignWelcomeRole({ partial: true, pending: null }, old, NOW), false);
  assert.equal(shouldAssignWelcomeRole({ partial: true, pending: null }, { ...fresh, joinedTimestamp: null }, NOW), false);
});

test("welcome role: never while still pending or when the role is already there", () => {
  assert.equal(shouldAssignWelcomeRole({ pending: true }, { ...fresh, pending: true }, NOW), false);
  assert.equal(shouldAssignWelcomeRole({ partial: true }, { ...fresh, hasRole: true }, NOW), false);
});

test("welcome role: an ordinary update of a cached, non-pending member does nothing", () => {
  assert.equal(shouldAssignWelcomeRole({ partial: false, pending: false }, fresh, NOW), false);
});
