/**
 * QoL pass: the low-trust role following score changes, /diagnostics channel
 * and ModMail permission checks, ticket transcript summaries and /remindme edit.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ChannelType, PermissionFlagsBits } from "discord.js";
import { applyLowTrustAction, lowTrustRoleAction, queueRecheck, type RoleMember } from "../src/services/lowTrustSync";
import { noteTrustChange, setTrustChangeSink } from "../src/services/trustHooks";
import { normalizeTrustConfig } from "../src/services/trustEngine";
import {
  MODMAIL_THREAD_PERMISSIONS, POSTING_PERMISSIONS, accessLine, checkConfiguredChannels, checkModmailChannel,
  configuredChannels, fitField, missingPermissions,
} from "../src/services/channelAccess";
import { renderTranscriptHtml, transcriptParticipants, transcriptSpan, type TranscriptMessage } from "../src/services/ticketTranscript";
import { planReminderEdit } from "../src/services/reminderEdit";
import { CHANNEL_OBFUSCATED_FLAG } from "../src/utils/channels";

const ROLE = "600000000000000001";
const CH = "700000000000000001";
const CH2 = "700000000000000002";
const on = normalizeTrustConfig({ enabled: true, lowThreshold: 30, lowTrustRoleId: ROLE });
const editable = { editable: true, managed: false };

test("lowTrustRoleAction: adds below the threshold, removes once recovered, never touches a role it can't manage", () => {
  assert.equal(lowTrustRoleAction(on, 10, false, editable).action, "add");
  assert.equal(lowTrustRoleAction(on, 10, true, editable).action, "none", "already has it");
  assert.equal(lowTrustRoleAction(on, 45, true, editable).action, "remove");
  assert.match(lowTrustRoleAction(on, 45, true, editable).why, /no longer below 30/);
  assert.equal(lowTrustRoleAction(on, 45, false, editable).action, "none");
  assert.equal(lowTrustRoleAction(on, 30, true, editable).action, "remove", "the threshold itself is not low trust");
  assert.equal(lowTrustRoleAction(on, 10, false, { editable: false, managed: false }).action, "none", "above Aegis");
  assert.equal(lowTrustRoleAction(on, 45, true, { editable: true, managed: true }).action, "none", "managed role");
  assert.equal(lowTrustRoleAction(on, 10, false, null).action, "none", "deleted role");
  assert.equal(lowTrustRoleAction({ ...on, enabled: false }, 10, false, editable).action, "none", "integration off");
  assert.equal(lowTrustRoleAction({ ...on, lowTrustRoleId: null }, 45, true, editable).action, "none", "no role configured");
});

function fakeMember(hasRole: boolean, opts: { bot?: boolean; fail?: boolean } = {}) {
  const calls: string[] = [];
  const roles = new Set(hasRole ? [ROLE] : []);
  const member: RoleMember = {
    id: "500000000000000001",
    user: { bot: opts.bot === true },
    roles: {
      cache: { has: id => roles.has(id) },
      add: async (id, reason) => { if (opts.fail) throw new Error("Missing Permissions"); calls.push(`add ${id} ${reason}`); roles.add(id); },
      remove: async (id, reason) => { if (opts.fail) throw new Error("Missing Permissions"); calls.push(`remove ${id} ${reason}`); roles.delete(id); },
    },
  };
  return { member, calls };
}

test("applyLowTrustAction: edits the role with a readable audit reason, skips bots, and survives a Discord error", async () => {
  const low = fakeMember(false);
  assert.equal(await applyLowTrustAction(low.member, on, 12, editable), "add");
  assert.deepEqual(low.calls, [`add ${ROLE} Trust Score 12 below 30`]);
  const recovered = fakeMember(true);
  assert.equal(await applyLowTrustAction(recovered.member, on, 55, editable), "remove");
  assert.match(recovered.calls[0], /^remove 600000000000000001 Trust Score 55, no longer below 30$/);
  const bot = fakeMember(false, { bot: true });
  assert.equal(await applyLowTrustAction(bot.member, on, 0, editable), "none");
  assert.deepEqual(bot.calls, []);
  const failing = fakeMember(false, { fail: true });
  assert.equal(await applyLowTrustAction(failing.member, on, 5, editable), "none");
});

test("trust hooks: case and warning services can signal a change; no sink is a no-op and a failing sink never throws", () => {
  const seen: string[] = [];
  noteTrustChange("g", "u");
  setTrustChangeSink((g, u) => seen.push(`${g}:${u}`));
  noteTrustChange("800000000000000001", "500000000000000001");
  noteTrustChange("800000000000000001", null);
  noteTrustChange("800000000000000001", "");
  assert.deepEqual(seen, ["800000000000000001:500000000000000001"]);
  setTrustChangeSink(() => { throw new Error("boom"); });
  assert.doesNotThrow(() => noteTrustChange("g", "u"));
  setTrustChangeSink(null);
  assert.equal(queueRecheck("g", "u"), false, "nothing is queued before the sync starts");
});

test("moderation services report trust changes through the hook", async () => {
  const fs = await import("node:fs");
  const cases = fs.readFileSync("src/services/moderationCases.ts", "utf8");
  const warnings = fs.readFileSync("src/services/warnings.ts", "utf8");
  assert.match(cases, /noteTrustChange\(input\.guildId, input\.userId\)/, "new case");
  assert.match(cases, /if \(result\) noteTrustChange/, "revoked case");
  assert.equal((warnings.match(/noteTrustChange\(/g) ?? []).length, 5, "add, clear, delete by IDs, remove and revoke");
});

const guildCfg = {
  loggingEnabled: true, loggingChannelId: CH, logChannels: { memberJoins: CH2, roleChanges: CH } as Record<string, string>,
  welcomeEnabled: true, welcomeChannelId: CH, goodbyeEnabled: false, goodbyeChannelId: "700000000000000009",
  suggestionsChannelId: "nope", digest: undefined,
};

test("configuredChannels: one entry per channel with every use, skipping modules that are off and junk IDs", () => {
  const list = configuredChannels({ guild: guildCfg, starboard: { enabled: true, channelId: CH2 }, ticketLogChannelId: null, verification: { enabled: false, channelId: "700000000000000008" } });
  assert.deepEqual(list, [
    { id: CH, labels: ["log channel", "role log", "welcome"] },
    { id: CH2, labels: ["join log", "starboard"] },
  ]);
});

test("permission checks name exactly what is missing, and long reports fit an embed field", () => {
  const has = (bits: bigint[]) => (bit: bigint) => bits.includes(bit);
  assert.deepEqual(missingPermissions(has([PermissionFlagsBits.ViewChannel]), POSTING_PERMISSIONS), ["Send Messages", "Embed Links"]);
  assert.deepEqual(missingPermissions(has([PermissionFlagsBits.SendMessagesInThreads]), MODMAIL_THREAD_PERMISSIONS), ["Create Private Threads", "Manage Threads"]);
  assert.equal(accessLine({ id: CH, labels: ["welcome"] }, null), null);
  assert.match(accessLine({ id: CH, labels: ["welcome", "log channel"] }, { kind: "missing", permissions: ["Embed Links"] })!, /<#700000000000000001> \(welcome, log channel\): missing \*\*Embed Links\*\*/);
  assert.match(accessLine({ id: CH, labels: ["x"] }, { kind: "hidden" })!, /View Channel/);
  const lines = Array.from({ length: 40 }, (_, i) => `⚠️ <#7000000000000000${String(i).padStart(2, "0")}> (welcome): missing **View Channel**, **Send Messages**`);
  const field = fitField(lines);
  assert.ok(field.length <= 1024, `fits (${field.length})`);
  assert.match(field, /…and \d+ more$/);
  assert.equal(fitField(["a", "b"]), "a\nb");
});

function fakeChannel(id: string, allowed: bigint[], o: { type?: ChannelType; hidden?: boolean } = {}) {
  return { id, type: o.type ?? ChannelType.GuildText, flags: o.hidden ? CHANNEL_OBFUSCATED_FLAG : 0, permissionsFor: () => ({ has: (bit: bigint) => allowed.includes(bit) }) };
}
function fakeGuild(channels: Array<ReturnType<typeof fakeChannel>>) {
  const map = new Map(channels.map(c => [c.id, c]));
  return { channels: { cache: { get: (id: string) => map.get(id) }, fetch: async (id: string) => map.get(id) ?? null } } as never;
}

test("checkConfiguredChannels: flags missing View Channel / Send Messages / Embed Links, hidden and deleted channels", async () => {
  const guild = fakeGuild([
    fakeChannel(CH, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]),
    fakeChannel(CH2, [PermissionFlagsBits.ViewChannel]),
    fakeChannel("700000000000000003", [], { hidden: true }),
  ]);
  const lines = await checkConfiguredChannels(guild, {} as never, [
    { id: CH, labels: ["welcome"] }, { id: CH2, labels: ["starboard"] },
    { id: "700000000000000003", labels: ["log channel"] }, { id: "700000000000000004", labels: ["suggestions"] },
  ]);
  assert.equal(lines.length, 3, "the healthy channel is not listed");
  assert.match(lines[0], /starboard\): missing \*\*Send Messages\*\*, \*\*Embed Links\*\*/);
  assert.match(lines[1], /can't see it/);
  assert.match(lines[2], /deleted/);
});

test("checkModmailChannel: thread permissions for a text channel, post permissions for a forum, silent when ModMail is off", async () => {
  const all = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.CreatePrivateThreads, PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.ManageThreads];
  assert.equal(await checkModmailChannel(fakeGuild([]), {} as never, { enabled: false, channelId: CH }), null);
  assert.equal(await checkModmailChannel(fakeGuild([]), {} as never, undefined), null);
  assert.match((await checkModmailChannel(fakeGuild([fakeChannel(CH, all)]), {} as never, { enabled: true, channelId: CH }))!, /^✅ .*private threads/);
  const missing = await checkModmailChannel(fakeGuild([fakeChannel(CH, [PermissionFlagsBits.ViewChannel])]), {} as never, { enabled: true, channelId: CH });
  assert.match(missing!, /Create Private Threads\*\*, \*\*Send Messages in Threads\*\*, \*\*Manage Threads/);
  const forum = await checkModmailChannel(fakeGuild([fakeChannel(CH, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessagesInThreads], { type: ChannelType.GuildForum })]), {} as never, { enabled: true, channelId: CH });
  assert.match(forum!, /\*\*Send Messages\*\*, \*\*Manage Threads\*\*.*post/);
  assert.match((await checkModmailChannel(fakeGuild([fakeChannel(CH, [], { hidden: true })]), {} as never, { enabled: true, channelId: CH }))!, /can't see/);
});

const msg = (authorId: string, tag: string, timestamp: number, bot = false): TranscriptMessage => ({ authorTag: tag, authorId, bot, timestamp, content: "hi", attachments: [], embedCount: 0 });

test("ticket transcripts: participants with counts, the time span, and a divider per UTC day", () => {
  const day = Date.UTC(2026, 10, 3, 23, 0);
  const messages = [msg("1", "member", day), msg("2", "Aegis", day + 60_000, true), msg("1", "member", day + 2 * 3_600_000), msg("3", "mod", day + 2 * 3_600_000 + 5 * 60_000)];
  assert.deepEqual(transcriptParticipants(messages).map(p => [p.tag, p.count]), [["member", 2], ["Aegis", 1], ["mod", 1]]);
  assert.equal(transcriptSpan(2 * 3_600_000 + 5 * 60_000), "2h 5m");
  assert.equal(transcriptSpan(30_000), "under a minute");
  assert.equal(transcriptSpan(3 * 86_400_000 + 4 * 3_600_000), "3d 4h");
  const html = renderTranscriptHtml({ guildName: "G", channelName: "ticket-1", ticketId: "t", openerId: "1", generatedAt: day }, messages);
  assert.match(html, /<dt>Participants<\/dt><dd>member: 2, Aegis \(bot\): 1, mod: 1<\/dd>/);
  assert.match(html, /<dt>First to last message<\/dt><dd>2h 5m<\/dd>/);
  assert.equal((html.match(/<h2 class="day">/g) ?? []).length, 2, "Nov 3 and Nov 4");
  assert.ok(html.indexOf("2026-11-03 (UTC)") < html.indexOf("2026-11-04 (UTC)"));
  assert.ok(!/<script/i.test(html));
});

test("planReminderEdit: text, time and repeat change independently; limits match /remindme set", () => {
  const current = { text: "old", inChannel: false, sourceName: "G", setAt: 1, repeat: "daily" as const };
  const now = 1_000_000;
  assert.equal(planReminderEdit(current, { text: null, durationSec: null, repeat: null }, now).ok, false, "nothing changed");
  const text = planReminderEdit(current, { text: "  new  ", durationSec: null, repeat: null }, now);
  assert.ok(text.ok && text.payload.text === "new" && text.executeAt === undefined && text.intervalMs === undefined);
  const time = planReminderEdit(current, { text: null, durationSec: 7200, repeat: null }, now);
  assert.ok(time.ok && time.executeAt?.getTime() === now + 7_200_000);
  const once = planReminderEdit(current, { text: null, durationSec: null, repeat: "none" }, now);
  assert.ok(once.ok && once.payload.repeat === undefined && once.intervalMs === null);
  const weekly = planReminderEdit(current, { text: null, durationSec: null, repeat: "weekly" }, now);
  assert.ok(weekly.ok && weekly.intervalMs === 7 * 86_400_000 && weekly.changes.join() === "repeat");
  assert.equal(planReminderEdit(current, { text: "", durationSec: null, repeat: null }, now).ok, false);
  assert.equal(planReminderEdit(current, { text: null, durationSec: 0, repeat: null }, now).ok, false, "unparseable or too short");
  assert.equal(planReminderEdit(current, { text: null, durationSec: 366 * 86_400, repeat: null }, now).ok, false);
  assert.equal(current.text, "old", "the stored payload is not mutated");
});
