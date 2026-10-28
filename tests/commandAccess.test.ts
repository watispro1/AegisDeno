import { test } from "node:test";
import assert from "node:assert/strict";
import { PermissionFlagsBits } from "discord.js";
import { canUseCommand, hasModerationPermissions, searchCommands } from "../src/services/commandAccess";

const P = PermissionFlagsBits;

test("moderation permission detection matches discord.js flags", () => {
  assert.equal(hasModerationPermissions(null), false);
  assert.equal(hasModerationPermissions(P.SendMessages | P.ViewChannel), false);
  assert.equal(hasModerationPermissions(P.ModerateMembers), true);
  assert.equal(hasModerationPermissions(P.KickMembers), true);
  assert.equal(hasModerationPermissions(P.BanMembers), true);
  assert.equal(hasModerationPermissions(P.ManageMessages), true);
  assert.equal(hasModerationPermissions(P.Administrator), true);
});

test("guild: declared user permissions are required", () => {
  const cmd = { userPermissions: P.ManageGuild };
  assert.equal(canUseCommand(cmd, { inGuild: true, memberPermissions: P.SendMessages }), false);
  assert.equal(canUseCommand(cmd, { inGuild: true, memberPermissions: P.ManageGuild | P.SendMessages }), true);
  assert.equal(canUseCommand(cmd, { inGuild: true, memberPermissions: P.Administrator }), true);
});

test("guild: default_member_permissions is honoured, '0' means admins only", () => {
  const cmd = { defaultMemberPermissions: String(P.BanMembers) };
  assert.equal(canUseCommand(cmd, { inGuild: true, memberPermissions: 0n }), false);
  assert.equal(canUseCommand(cmd, { inGuild: true, memberPermissions: P.BanMembers }), true);
  assert.equal(canUseCommand({ defaultMemberPermissions: "0" }, { inGuild: true, memberPermissions: P.BanMembers }), false);
  assert.equal(canUseCommand({ defaultMemberPermissions: "0" }, { inGuild: true, memberPermissions: P.Administrator }), true);
});

test("guild: open commands are visible to everyone", () => {
  assert.equal(canUseCommand({}, { inGuild: true, memberPermissions: 0n }), true);
});

test("DMs: guild-only, dm-disabled and permissioned commands are hidden", () => {
  const dm = { inGuild: false, memberPermissions: null };
  assert.equal(canUseCommand({}, dm), true);
  assert.equal(canUseCommand({ guildOnly: true }, dm), false);
  assert.equal(canUseCommand({ dmPermission: false }, dm), false);
  assert.equal(canUseCommand({ userPermissions: P.ManageGuild }, dm), false);
});

test("searchCommands ranks prefix, then contains, then description/subcommand", () => {
  const list = [
    { name: "ticket", description: "Support tickets", category: "tickets", subcommands: ["transcript", "claim"] },
    { name: "warn", description: "Warn a member", category: "moderation" },
    { name: "warnings", description: "List warnings", category: "moderation" },
    { name: "clearwarnings", description: "Clear warnings", category: "moderation" },
  ];
  assert.deepEqual(searchCommands(list, "warn").map(c => c.name), ["warn", "warnings", "clearwarnings"]);
  assert.deepEqual(searchCommands(list, "/transcript").map(c => c.name), ["ticket"]);
  assert.deepEqual(searchCommands(list, "zzz"), []);
  assert.equal(searchCommands(list, "", 2).length, 2);
});
