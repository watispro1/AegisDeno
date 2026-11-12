import { test } from "node:test";
import assert from "node:assert/strict";
import { PermissionFlagsBits } from "discord.js";
import { groupedPermissions, memberLine, permissionsText, roleKind, sortMembersForList } from "../src/services/roleDetails";
import { paginateLines, pickPage } from "../src/utils/listPager";

test("list pager: pages respect both the line count and the character budget", () => {
  const lines = Array.from({ length: 45 }, (_, i) => `line ${i}`);
  const pages = paginateLines(lines, 20);
  assert.deepEqual(pages.map(p => p.length), [20, 20, 5]);
  const long = Array.from({ length: 10 }, () => "x".repeat(900));
  const byChars = paginateLines(long, 20, 3_800);
  assert.ok(byChars.every(p => p.join("\n").length <= 3_800), "no page goes over the budget");
  assert.equal(byChars.flat().length, 10, "no line is lost");
  assert.equal(paginateLines(["y".repeat(5000)], 20, 100)[0][0].length, 100, "an oversized line is cut");
  assert.deepEqual(paginateLines([]), [[]], "an empty list is one empty page");
});

test("list pager: the requested page is clamped", () => {
  const pages = paginateLines(Array.from({ length: 30 }, (_, i) => String(i)), 10);
  assert.equal(pickPage(pages, -3).page, 0);
  assert.equal(pickPage(pages, 99).page, 2);
  assert.equal(pickPage(pages, 1).lines[0], "10");
  assert.equal(pickPage(pages, 1).totalPages, 3);
});

test("roleinfo: permissions are grouped, Administrator stands alone, unknown flags are kept", () => {
  const admin = groupedPermissions(PermissionFlagsBits.Administrator | PermissionFlagsBits.SendMessages);
  assert.equal(admin.length, 1);
  assert.match(admin[0].granted[0], /Administrator/);

  const mod = groupedPermissions(PermissionFlagsBits.BanMembers | PermissionFlagsBits.SendMessages | PermissionFlagsBits.Connect);
  const byName = Object.fromEntries(mod.map(g => [g.name, g.granted]));
  assert.deepEqual(byName["⚠️ Dangerous"], ["Ban Members"]);
  assert.deepEqual(byName.Text, ["Send Messages"]);
  assert.deepEqual(byName.Voice, ["Connect"]);

  assert.match(permissionsText(0n), /no permissions of its own/);
  assert.match(permissionsText(PermissionFlagsBits.KickMembers | PermissionFlagsBits.AddReactions), /\*\*2\*\* permissions granted/);
});

test("roleinfo: role kind reads Discord's role tags", () => {
  assert.match(roleKind(null, true), /@everyone/);
  assert.equal(roleKind(null, false), "Regular role");
  assert.equal(roleKind({ botId: "42" }, false), "Bot role for <@42>");
  assert.equal(roleKind({ premiumSubscriberRole: true }, false), "Server Booster role");
  assert.match(roleKind({ subscriptionListingId: "1", availableForPurchase: true }, false), /for sale/);
  assert.match(roleKind({ guildConnections: true }, false), /Linked/);
  assert.equal(roleKind({ integrationId: "9" }, false), "Integration role");
});

test("roleinfo: member list puts humans first, alphabetically, and marks bots", () => {
  const sorted = sortMembersForList([
    { id: "1", tag: "zed", bot: false },
    { id: "2", tag: "Bot", bot: true },
    { id: "3", tag: "amy", bot: false },
  ]);
  assert.deepEqual(sorted.map(m => m.id), ["3", "1", "2"]);
  assert.match(memberLine(sorted[2], 2), /<@2> · Bot 🤖$/);
  assert.match(memberLine(sorted[0], 0), /^`  1` <@3>/);
});
