/** ID autocomplete on /automation cancel and /appeal view|review; the 60-second quick Undo on /lock, /slowmode and /nickname. */
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PermissionFlagsBits, PermissionsBitField, type ButtonInteraction, type ChatInputCommandInteraction, type GuildBasedChannel, type Message, type Role } from "discord.js";
import { appealCodeSuggestions, shortUntil, taskIdSuggestions, type TaskSuggestionRow } from "../src/utils/idSuggestions";
import { QUICK_UNDO_MS, buildQuickUndoButton, everyoneSendState, offerQuickUndo, quickUndoId, quickUndoVerdict } from "../src/utils/quickUndo";

const NOW = Date.parse("2026-11-02T15:00:00Z");
const ME = "111111111111111111";
const OTHER = "222222222222222222";
const GUILD = "333333333333333333";

type Opt = { name: string; autocomplete?: boolean; options?: Opt[] };

function task(id: string, creatorId: string, inMs: number, extra: Partial<TaskSuggestionRow> = {}): TaskSuggestionRow {
  return { id, type: "scheduled", creatorId, channelId: "1", executeAt: new Date(NOW + inMs), preview: `message ${id}`, ...extra };
}

/* autocomplete */

test("taskIdSuggestions: own tasks only without Manage Server, all with it, soonest first", () => {
  const rows = [task("b", OTHER, 7_200_000), task("a", ME, 3_600_000, { type: "reminder" }), task("c", ME, 90_000_000, { intervalMs: 600_000 })];
  const mine = taskIdSuggestions(rows, "", { userId: ME, canManageServer: false }, NOW);
  assert.deepEqual(mine.map((c) => c.value), ["a", "c"]);
  assert.match(mine[0].name, /^⏰ Reminder · in 1h · message a$/);
  assert.match(mine[1].name, /^🔁 Repeating · in 25h · message c$/);
  const all = taskIdSuggestions(rows, "", { userId: ME, canManageServer: true }, NOW);
  assert.deepEqual(all.map((c) => c.value), ["a", "b", "c"]);
  assert.deepEqual(taskIdSuggestions(rows, "message b", { userId: ME, canManageServer: true }, NOW).map((c) => c.value), ["b"]);
  const many = Array.from({ length: 40 }, (_, n) => task(`t${n}`, ME, n * 60_000 + 120_000, { preview: "x".repeat(200) }));
  const capped = taskIdSuggestions(many, "", { userId: ME, canManageServer: false }, NOW);
  assert.equal(capped.length, 25);
  assert.ok(capped.every((c) => c.name.length <= 100 && c.value.startsWith("t")));
  assert.equal(shortUntil(NOW + 30_000, NOW), "due now");
});

test("appealCodeSuggestions: review offers pending appeals only; view offers all, newest first; matches user ID", () => {
  const rows = [
    { appealCode: "AGS-AAAA", userId: ME, status: "pending", banReason: "Raid", createdAt: new Date(NOW - 3_600_000) },
    { appealCode: "AGS-BBBB", userId: OTHER, status: "denied", banReason: null, createdAt: new Date(NOW - 60_000) },
  ];
  assert.deepEqual(appealCodeSuggestions(rows, "", "review", NOW).map((c) => c.value), ["AGS-AAAA"]);
  const view = appealCodeSuggestions(rows, "", "view", NOW);
  assert.deepEqual(view.map((c) => c.value), ["AGS-BBBB", "AGS-AAAA"]);
  assert.match(view[1].name, /^AGS-AAAA · ⏳ pending · user 1{18} · 1h ago · Raid$/);
  assert.deepEqual(appealCodeSuggestions(rows, "ags-b", "view", NOW).map((c) => c.value), ["AGS-BBBB"]);
  assert.deepEqual(appealCodeSuggestions(rows, OTHER.slice(0, 6), "view", NOW).map((c) => c.value), ["AGS-BBBB"]);
});

test("/automation cancel and /appeal view|review autocomplete their ID; /appeal submit does not", async () => {
  const automation = (await import("../src/commands/automation/automation")).command.data.toJSON() as { options: Opt[] };
  assert.equal(automation.options.find((o) => o.name === "cancel")!.options!.find((o) => o.name === "id")!.autocomplete, true);
  const appeal = (await import("../src/commands/moderation/appeal")).command.data.toJSON() as { options: Opt[] };
  for (const sub of ["view", "review"]) assert.equal(appeal.options.find((o) => o.name === sub)!.options!.find((o) => o.name === "code")!.autocomplete, true, sub);
  assert.notEqual(appeal.options.find((o) => o.name === "submit")!.options!.find((o) => o.name === "code")!.autocomplete, true);
});

function autocompleteInteraction(perms: bigint, sub: string, focused: { name: string; value: string }) {
  const calls: unknown[] = [];
  return {
    calls,
    interaction: {
      guildId: GUILD,
      user: { id: ME },
      memberPermissions: new PermissionsBitField(perms),
      options: { getFocused: () => focused, getSubcommand: () => sub },
      respond: async (choices: unknown) => { calls.push(choices); },
    },
  };
}

test("/appeal autocomplete: nothing without Ban Members; server-scoped pending lookup for review", async () => {
  const { command } = await import("../src/commands/moderation/appeal");
  const { BanAppealModel } = await import("../src/database/mongo");
  const none = autocompleteInteraction(0n, "review", { name: "code", value: "" });
  await command.autocomplete!(none.interaction as never);
  assert.deepEqual(none.calls, [[]]);

  const lean = { sort: () => lean, limit: () => lean, select: () => lean, lean: async () => [{ appealCode: "AGS-CCCC", userId: OTHER, status: "pending", banReason: "Spam", createdAt: new Date() }] };
  const find = mock.method(BanAppealModel, "find", () => lean as never);
  try {
    const staff = autocompleteInteraction(PermissionFlagsBits.BanMembers, "review", { name: "code", value: "" });
    await command.autocomplete!(staff.interaction as never);
    assert.deepEqual((staff.calls[0] as { value: string }[]).map((c) => c.value), ["AGS-CCCC"]);
    assert.deepEqual(find.mock.calls[0].arguments[0], { guildId: GUILD, status: "pending" });
    // /appeal submit never lists codes, whatever the member's permissions.
    const submit = autocompleteInteraction(PermissionFlagsBits.BanMembers, "submit", { name: "code", value: "" });
    await command.autocomplete!(submit.interaction as never);
    assert.deepEqual(submit.calls, [[]]);
  } finally {
    find.mock.restore();
  }
});

/* quick Undo */

test("quickUndoVerdict: author only, 60 seconds; buttons and IDs", () => {
  assert.equal(quickUndoVerdict(ME, ME, NOW, NOW + 1_000), "ok");
  assert.equal(quickUndoVerdict(ME, ME, NOW, NOW + QUICK_UNDO_MS), "ok");
  assert.equal(quickUndoVerdict(ME, ME, NOW, NOW + QUICK_UNDO_MS + 1), "expired");
  assert.equal(quickUndoVerdict(ME, OTHER, NOW, NOW + 1_000), "not-author");
  assert.equal(QUICK_UNDO_MS, 60_000);
  assert.equal(quickUndoId("999"), "qundo_999");
  const ready = buildQuickUndoButton("qundo_1").toJSON() as { label: string; disabled?: boolean };
  assert.equal(ready.label, "Undo (60s)");
  assert.ok(!ready.disabled);
  for (const state of ["done", "expired", "failed"] as const) assert.equal((buildQuickUndoButton("qundo_1", state).toJSON() as { disabled?: boolean }).disabled, true);
});

test("everyoneSendState reads allow, deny and inherit from the @everyone overwrite", () => {
  const everyone = { id: GUILD } as Role;
  const channel = (allow: bigint, deny: bigint, present = true) => ({
    permissionOverwrites: { cache: new Map(present ? [[GUILD, { allow: new PermissionsBitField(allow), deny: new PermissionsBitField(deny) }]] : []) },
  }) as unknown as GuildBasedChannel;
  assert.equal(everyoneSendState(channel(PermissionFlagsBits.SendMessages, 0n), everyone), true);
  assert.equal(everyoneSendState(channel(0n, PermissionFlagsBits.SendMessages), everyone), false);
  assert.equal(everyoneSendState(channel(0n, PermissionFlagsBits.ViewChannel), everyone), null);
  assert.equal(everyoneSendState(channel(0n, 0n, false), everyone), null);
});

function undoHarness() {
  const collector = Object.assign(new EventEmitter(), { stop(reason: string) { this.emit("end", new Map(), reason); } });
  const edits: unknown[] = [];
  const message = { createMessageComponentCollector: () => collector } as unknown as Message;
  const interaction = { user: { id: ME, tag: "mod#0001" }, editReply: async (o: unknown) => { edits.push(o); } } as unknown as ChatInputCommandInteraction;
  const press = (userId: string) => {
    const replies: { method: string; payload: { content?: string } }[] = [];
    const i = {
      customId: "qundo_1", user: { id: userId }, deferred: false, replied: false,
      reply: async (p: { content: string }) => { replies.push({ method: "reply", payload: p }); },
      deferUpdate: async () => { replies.push({ method: "deferUpdate", payload: {} }); },
      followUp: async (p: { content: string }) => { replies.push({ method: "followUp", payload: p }); },
    };
    collector.emit("collect", i as unknown as ButtonInteraction);
    return replies;
  };
  return { collector, edits, message, interaction, press };
}

test("offerQuickUndo: another moderator is turned away; the author's press runs the undo once and marks it Undone", async () => {
  const h = undoHarness();
  let undone = 0;
  offerQuickUndo(h.interaction, { message: h.message, customId: "qundo_1", actionAtMs: Date.now(), undo: async () => { undone++; return { ok: true, message: "↩️ Restored." }; } });

  const other = h.press(OTHER);
  await new Promise((r) => setImmediate(r));
  assert.equal(undone, 0);
  assert.match(other[0].payload.content!, /Only mod#0001 can undo this/);

  const mine = h.press(ME);
  await new Promise((r) => setImmediate(r));
  assert.equal(undone, 1);
  assert.deepEqual(mine.map((r) => r.method), ["deferUpdate", "followUp"]);
  const last = h.edits.at(-1) as { components: { toJSON(): { components: { label: string; disabled: boolean }[] } }[] };
  assert.equal(last.components[0].toJSON().components[0].label, "Undone");
  assert.equal(last.components[0].toJSON().components[0].disabled, true);
});

test("offerQuickUndo: a failed undo reports privately and the window closing removes the button", async () => {
  const h = undoHarness();
  offerQuickUndo(h.interaction, { message: h.message, customId: "qundo_1", actionAtMs: Date.now(), undo: async () => { throw new Error("Missing Permissions"); } });
  const replies = h.press(ME);
  await new Promise((r) => setImmediate(r));
  assert.match(replies.at(-1)!.payload.content!, /couldn't undo/);
  h.collector.emit("end", new Map(), "time");
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(h.edits.at(-1), { components: [] });
});

test("/lock, /slowmode and /nickname wire the quick Undo; /slowmode's quick-adjust collector ignores it", async () => {
  const fs = await import("node:fs");
  const read = (p: string) => fs.readFileSync(`${__dirname}/../src/${p}`, "utf8");
  assert.match(read("commands/moderation/lock.ts"), /offerLockUndo\(interaction, targetChannel, isLocking\)/);
  assert.match(read("services/lockUndo.ts"), /SendMessages: previous/);
  assert.match(read("services/lockUndo.ts"), /clearPendingUnlocks/);
  const slow = read("commands/moderation/slowmode.ts");
  assert.match(slow, /offerQuickUndo\(/);
  assert.match(slow, /i\.customId\.startsWith\("slowmode_"\)/);
  assert.match(slow, /setRateLimitPerUser\(previousRate/);
  const nick = read("commands/moderation/nickname.ts");
  assert.match(nick, /offerQuickUndo\(/);
  assert.match(nick, /setNickname\(previous/);
  for (const file of ["commands/moderation/lock.ts", "commands/moderation/slowmode.ts", "commands/moderation/nickname.ts", "utils/quickUndo.ts", "services/lockUndo.ts", "utils/idSuggestions.ts"]) {
    assert.ok(read(file).split("\n").length <= 410, `${file} stays small`);
  }
});
