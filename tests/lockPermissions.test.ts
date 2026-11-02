/**
 * top.gg review (Nov 2, 2026): "/lock states it needs MANAGE_CHANNELS. A lock
 * command only needs MANAGE_ROLES." A lock only edits the @everyone overwrite.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PermissionFlagsBits, PermissionsBitField } from "discord.js";
import { loadCommands, commands } from "../src/commands/loader";
import { lockMissing, lockPermissionMessage, lockFailureMessage, LOCK_BOT_PERMISSION } from "../src/permissions/lockPermissions";
import { lockServerChannels, serverLockWarning } from "../src/services/serverLock";
import { planIncidentChanges, type ChannelSnapshot } from "../src/services/incidentLogic";

before(async () => { await loadCommands(); });

const bits = (...flags: bigint[]) => new PermissionsBitField(flags.reduce((a, b) => a | b, 0n));
const flagsOf = (list: readonly unknown[] | undefined) =>
  new PermissionsBitField((list ?? []).reduce<bigint>((a, p) => a | new PermissionsBitField(p as bigint).bitfield, 0n));

test("/lock asks the bot for Manage Roles, never Manage Channels", () => {
  const lock = commands.get("lock")!;
  const bot = flagsOf(lock.botPermissions);
  assert.equal(LOCK_BOT_PERMISSION, PermissionFlagsBits.ManageRoles);
  assert.ok(bot.has(PermissionFlagsBits.ManageRoles));
  assert.ok(!bot.has(PermissionFlagsBits.ManageChannels, false), "bot side must not need Manage Channels");
  // The moderator side keeps Manage Channels (documented choice).
  assert.ok(flagsOf(lock.userPermissions).has(PermissionFlagsBits.ManageChannels));
});

test("lock code paths only edit permission overwrites (nothing that needs Manage Channels)", () => {
  const files = ["src/commands/moderation/lock.ts", "src/services/channelLock.ts", "src/services/serverLock.ts", "src/services/lockUndo.ts"];
  for (const f of files) {
    const src = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
    assert.doesNotMatch(src, /\.(setTopic|setParent|setPosition|setRateLimitPerUser|setNSFW|setBitrate)\(|\b(channel|ch|targetChannel)\.setName\(/, `${f} edits the channel itself`);
    assert.doesNotMatch(src, /\bchannel\.edit\(|\bch\.edit\(|targetChannel\.edit\(/, `${f} calls channel.edit`);
    assert.doesNotMatch(src, /botPermissions:\s*\[[^\]]*ManageChannels/, `${f} declares Manage Channels for the bot`);
  }
});

test("lockMissing: Manage Roles + View Channel in the channel, Send Messages there or server-wide", () => {
  const ok = bits(PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.SendMessages);
  assert.deepEqual(lockMissing(ok), []);
  assert.deepEqual(lockMissing(bits(PermissionFlagsBits.Administrator)), []);
  // Manage Channels alone is not enough.
  assert.deepEqual(lockMissing(bits(PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.SendMessages)), ["Manage Roles"]);
  // Send Messages held server-wide counts (Discord checks the guild or parent).
  assert.deepEqual(lockMissing(bits(PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageRoles), bits(PermissionFlagsBits.SendMessages)), []);
  assert.deepEqual(lockMissing(bits(PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageRoles)), ["Send Messages"]);
  assert.equal(lockMissing(null).length, 3);
});

test("lock messages explain the Discord rule and never mention Manage Channels", () => {
  const msg = lockPermissionMessage("123", ["Manage Roles"]);
  assert.match(msg, /Manage Roles/);
  assert.match(msg, /Manage Permissions/);
  assert.doesNotMatch(msg, /Manage Channels/);
  assert.match(lockFailureMessage("123", { code: 50013 }), /Missing Permissions/);
  assert.match(lockFailureMessage("123", { code: 50001 }), /View Channel/);
  assert.doesNotMatch(lockFailureMessage("123", new Error("x")), /Manage Channels/);
  assert.doesNotMatch(serverLockWarning({ locked: 1, skipped: 2, failed: 1 }), /Manage Channels/);
  assert.equal(serverLockWarning({ locked: 3, skipped: 0, failed: 0 }), "");
});

test("/lock server skips channels where Aegis lacks Manage Roles instead of failing", async () => {
  const everyone = { id: "1" };
  const edits: string[] = [];
  const mk = (id: string, perms: PermissionsBitField) => ({
    id, flags: 0, isTextBased: () => true, isThread: () => false,
    permissionsFor: (who: unknown) => who === everyone ? bits(PermissionFlagsBits.ViewChannel) : perms,
    permissionOverwrites: { cache: new Map(), edit: async () => { edits.push(id); } },
  });
  const guild = {
    roles: { everyone },
    members: { me: { permissions: bits(PermissionFlagsBits.SendMessages) } },
  };
  const good = mk("a", bits(PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageRoles));
  const noRoles = mk("b", bits(PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels));
  const r = await lockServerChannels(guild as never, [good, noRoles] as never);
  assert.deepEqual(r, { locked: 1, skipped: 1, failed: 0 });
  assert.deepEqual(edits, ["a"]);
});

test("Incident Mode locks with Manage Roles alone and explains a skip without Manage Channels", () => {
  const base: ChannelSnapshot = {
    id: "700000000000000001", name: "general", kind: "text", hidden: false, isPublic: true,
    canEditChannel: false, canEditOverwrites: true, rateLimitPerUser: 0, everyoneSend: "neutral",
    hasEveryoneOverwrite: false, everyoneOverwriteOnlySendDeny: false,
  };
  const opts = { slowmodeSeconds: 0, slowmodeChannelIds: [], lockMode: "public", lockChannelIds: [] } as never;
  const plan = planIncidentChanges([base], opts);
  assert.equal(plan.changes.length, 1);
  const skipped = planIncidentChanges([{ ...base, canEditOverwrites: false }], opts);
  assert.match(skipped.skipped[0].reason, /Manage Roles/);
  assert.doesNotMatch(skipped.skipped[0].reason, /Manage Channels/);
});
