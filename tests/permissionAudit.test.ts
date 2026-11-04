/**
 * Permission audit (top.gg review, Nov 2, 2026). Every command's declared bot
 * permissions are checked against what its code calls on Discord's API, and
 * this table is the reviewed result: changing a declaration without updating
 * the audit (and the docs) fails here.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { PermissionFlagsBits, PermissionsBitField, type PermissionResolvable } from "discord.js";
import { loadCommands, commands } from "../src/commands/loader";
import { botPermissionBitfield, botPermissionRows, buildCatalog, clearCatalogCache } from "../src/web/catalog";
import { BOT_PERMISSION_WHY, IMPLICIT_BOT_PERMISSIONS, OPTIONAL_BOT_PERMISSIONS } from "../src/permissions/botPermissionGuide";
import { formatPermissions } from "../src/commands/executor";
import { invitePermissionReport } from "../src/commands/config/diagnostics";
import { botPermissionChecks } from "../src/web/dashboard/botView";

before(async () => { await loadCommands(); clearCatalogCache(); });

type Audit = { bot: string[]; feature: string[] };
/** command → bot permissions checked before it runs / used only by some parts. */
const AUDIT: Record<string, Audit> = {
  about: { bot: ["EmbedLinks"], feature: [] },
  dashboard: { bot: ["EmbedLinks"], feature: [] },
  help: { bot: ["EmbedLinks"], feature: [] },
  ping: { bot: ["EmbedLinks"], feature: [] },
  serverinfo: { bot: ["EmbedLinks"], feature: [] },
  userinfo: { bot: ["EmbedLinks"], feature: [] },
  appeal: { bot: [], feature: ["BanMembers"] },
  ban: { bot: ["BanMembers"], feature: [] },
  escalation: { bot: [], feature: ["ModerateMembers", "KickMembers", "BanMembers"] },
  incident: { bot: [], feature: ["ManageChannels", "ManageRoles", "ModerateMembers", "KickMembers"] },
  kick: { bot: ["KickMembers"], feature: [] },
  lock: { bot: ["ManageRoles"], feature: [] },
  modmail: { bot: [], feature: ["CreatePrivateThreads", "SendMessagesInThreads", "ManageThreads"] },
  nickname: { bot: ["ManageNicknames"], feature: [] },
  purge: { bot: ["ManageMessages", "ReadMessageHistory"], feature: [] },
  removetimeout: { bot: ["ModerateMembers"], feature: [] },
  slowmode: { bot: ["ManageChannels"], feature: [] },
  softban: { bot: ["BanMembers"], feature: [] },
  temprole: { bot: ["ManageRoles"], feature: [] },
  timeout: { bot: ["ModerateMembers"], feature: [] },
  trust: { bot: [], feature: ["ManageRoles"] },
  unban: { bot: ["BanMembers"], feature: [] },
  warn: { bot: [], feature: ["ModerateMembers", "KickMembers", "BanMembers"] },
  automod: { bot: [], feature: ["ManageMessages", "ModerateMembers"] },
  welcome: { bot: [], feature: ["ManageRoles"] },
  announce: { bot: ["SendMessages", "EmbedLinks"], feature: [] },
  embed: { bot: ["SendMessages", "EmbedLinks"], feature: [] },
  giveaway: { bot: ["SendMessages", "EmbedLinks"], feature: [] },
  poll: { bot: ["SendMessages", "EmbedLinks"], feature: [] },
  starboard: { bot: ["SendMessages", "EmbedLinks"], feature: [] },
  suggest: { bot: ["SendMessages", "EmbedLinks"], feature: [] },
  automation: { bot: ["SendMessages", "EmbedLinks"], feature: [] },
  ticket: { bot: [], feature: ["ManageChannels", "ManageRoles", "AttachFiles"] },
  verify: { bot: [], feature: ["ManageRoles", "KickMembers"] },
  rolepanel: { bot: [], feature: ["ManageRoles"] },
  shop: { bot: [], feature: ["ManageRoles"] },
};

const names = (list: readonly PermissionResolvable[] | undefined) =>
  [...new Set((list ?? []).flatMap(p => new PermissionsBitField(p).toArray()))].sort();

/** The invite before the audit, for the record (and so the change is deliberate). */
const OLD_INVITE = 1099645938774n;
const NEW_INVITE = 1460691659798n;

test("every command's bot permissions match the reviewed audit", () => {
  for (const cmd of commands.values()) {
    const expected = AUDIT[cmd.data.name] ?? { bot: [], feature: [] };
    assert.deepEqual(names(cmd.botPermissions), [...expected.bot].sort(), `/${cmd.data.name} botPermissions`);
    assert.deepEqual(names(cmd.featurePermissions), [...expected.feature].sort(), `/${cmd.data.name} featurePermissions`);
  }
  for (const name of Object.keys(AUDIT)) assert.ok(commands.has(name), `audit lists /${name}, which no longer exists`);
});

test("API requirements: lock = Manage Roles, slowmode = Manage Channels, purge = Manage Messages + history", () => {
  const bot = (n: string) => names(commands.get(n)!.botPermissions);
  assert.deepEqual(bot("lock"), ["ManageRoles"]);
  assert.ok(!bot("lock").includes("ManageChannels"));
  assert.deepEqual(bot("slowmode"), ["ManageChannels"]);
  assert.deepEqual(bot("purge"), ["ManageMessages", "ReadMessageHistory"]);
  assert.deepEqual(bot("timeout"), ["ModerateMembers"]);
  assert.deepEqual(bot("nickname"), ["ManageNicknames"]);
  // Giveaways use a button, not reactions.
  assert.ok(!bot("giveaway").includes("AddReactions"));
});

test("invite bitfield is the union of declarations plus the channel basics, without Administrator", () => {
  let union = 0n;
  for (const cmd of commands.values()) {
    for (const p of [...(cmd.botPermissions ?? []), ...(cmd.featurePermissions ?? [])]) union |= new PermissionsBitField(p).bitfield;
  }
  for (const f of IMPLICIT_BOT_PERMISSIONS) union |= f;
  const bits = botPermissionBitfield();
  assert.equal(bits, union);
  assert.equal(bits, NEW_INVITE, `invite integer changed: ${bits} (update docs, README and CHANGELOG)`);
  assert.notEqual(bits, OLD_INVITE);
  assert.equal(bits & PermissionFlagsBits.Administrator, 0n);
  assert.equal(bits & PermissionFlagsBits.AddReactions, 0n, "nothing reacts in a server");
  assert.equal(bits & PermissionFlagsBits.ViewAuditLog, 0n, "nothing reads the audit log");
  for (const o of OPTIONAL_BOT_PERMISSIONS) assert.equal(bits & o.flag, 0n, `${o.name} is optional, not requested`);
  assert.ok(bits & PermissionFlagsBits.ManageRoles, "Manage Roles is requested (locks, roles, tickets)");
});

test("every invite permission is explained, shown in the docs table and checked by /diagnostics and the dashboard", () => {
  const flags = new PermissionsBitField(botPermissionBitfield()).toArray();
  for (const f of flags) assert.ok(BOT_PERMISSION_WHY[f], `${f} has no explanation`);
  assert.equal(botPermissionRows().length, flags.length);
  assert.ok(botPermissionRows().every(r => r.why.length > 0));
  assert.deepEqual(botPermissionChecks().map(([f]) => f), flags);
  // A fresh invite with exactly these permissions reports nothing missing.
  const fresh = new PermissionsBitField(botPermissionBitfield());
  assert.deepEqual(invitePermissionReport(fresh).missing, []);
  const noRoles = new PermissionsBitField(botPermissionBitfield() & ~PermissionFlagsBits.ManageRoles);
  const report = invitePermissionReport(noRoles);
  assert.deepEqual(report.missing, ["ManageRoles"]);
  assert.match(report.lines, /❌ Manage Roles — Locks/);
  assert.ok(report.lines.length <= 1024);
  assert.ok(invitePermissionReport(new PermissionsBitField(0n)).lines.length <= 1024);
});

test("the command catalog shows what each command declares", () => {
  const lock = buildCatalog().find(c => c.name === "lock")!;
  assert.deepEqual(lock.botPermissions, ["Manage Roles"]);
  const ticket = buildCatalog().find(c => c.name === "ticket")!;
  assert.deepEqual(ticket.featurePermissions, ["Attach Files", "Manage Channels", "Manage Roles"]);
});

test("permission names are never raw numbers", () => {
  assert.equal(formatPermissions([PermissionFlagsBits.ManageNicknames]), "Manage Nicknames");
  assert.equal(formatPermissions([PermissionFlagsBits.CreatePrivateThreads]), "Create Private Threads");
  assert.doesNotMatch(formatPermissions([PermissionFlagsBits.ManageThreads, PermissionFlagsBits.ManageRoles]), /\d/);
});
