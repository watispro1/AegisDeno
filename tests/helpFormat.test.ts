/** /help formatting: cooldown display matches the executor, Apps section lists the context menus. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { appsSectionText, formatCooldown } from "../src/services/helpFormat";
import { contextMenus } from "../src/commands/contextMenus";

test("formatCooldown: unset is the 1.5s default, 0 is none, others show the real time", () => {
  assert.equal(formatCooldown(undefined), "1.5s (default)");
  assert.equal(formatCooldown(0), "None");
  assert.equal(formatCooldown(1500), "1.5s");
  assert.equal(formatCooldown(5000), "5s");
  assert.equal(formatCooldown(30_000), "30s");
  assert.equal(formatCooldown(90_000), "1m 30s");
  assert.equal(formatCooldown(3_600_000), "1h");
});

test("appsSectionText: lists every context menu and notes they are server-only in DMs", () => {
  const text = appsSectionText(contextMenus.values(), true);
  for (const name of ["User Info", "Avatar", "Report Message"]) assert.match(text, new RegExp(`\\*\\*${name}\\*\\*`));
  assert.ok(text.length <= 1024, "fits an embed field");
  assert.doesNotMatch(text, /not in DMs/);
  assert.match(appsSectionText(contextMenus.values(), false), /not in DMs/);
  assert.equal(appsSectionText([], true), "No right-click commands.");
});
