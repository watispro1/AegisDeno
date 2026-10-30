/**
 * 3.6.1 command improvements: confirmations, autocomplete, paging and the
 * hidden-ticket auto-close fix. Discord and Mongo are faked; no network.
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { ChannelFlagsBitField, PermissionFlagsBits, PermissionsBitField } from "discord.js";
import { rankChoices, clipChoice, shortAge, MAX_AUTOCOMPLETE_CHOICES } from "../src/utils/autocomplete";
import { confirmationIds, confirmationRow, isConfirmationClick, requestConfirmation } from "../src/utils/confirmation";
import { CHANNEL_OBFUSCATED_FLAG } from "../src/utils/channels";
import { autoCloseDecision } from "../src/services/ticketTranscript";

const HOUR = 3_600_000;
const GUILD = "900000000000000001";
const MOD = "900000000000000010";
const TARGET = "900000000000000020";

/* ── Fake interactions ─────────────────────────────────────────────── */

type Click = "yes" | "no" | "timeout";

function fakeInteraction(opts: {
  click?: Click;
  deferred?: boolean;
  perms?: bigint;
  strings?: Record<string, string>;
  users?: Record<string, { id: string; tag: string }>;
  subcommand?: string;
  focused?: { name: string; value: string };
  memberInGuild?: boolean;
} = {}) {
  const calls: { method: string; payload: unknown }[] = [];
  const ids = confirmationIds("int-1");
  const message = {
    awaitMessageComponent: async ({ filter }: { filter: (i: unknown) => boolean }) => {
      if (opts.click === "timeout" || !opts.click) throw new Error("time");
      const click = {
        customId: opts.click === "yes" ? ids.yes : ids.no,
        user: { id: MOD },
        deferUpdate: async () => undefined,
      };
      assert.ok(filter(click), "the invoker's click passes the filter");
      assert.ok(!filter({ ...click, user: { id: "someone-else" } }), "other people's clicks are ignored");
      return click;
    },
    createMessageComponentCollector: () => ({ on: () => undefined }),
  };
  const interaction = {
    id: "int-1",
    guildId: GUILD,
    guild: {
      id: GUILD,
      members: { fetch: async () => (opts.memberInGuild ? { id: TARGET } : null) },
    },
    client: { guilds: { fetch: async () => null } },
    user: { id: MOD, tag: "mod#0001" },
    deferred: Boolean(opts.deferred),
    replied: false,
    memberPermissions: new PermissionsBitField(opts.perms ?? 0n),
    options: {
      getString: (name: string) => opts.strings?.[name] ?? null,
      getUser: (name: string) => opts.users?.[name] ?? null,
      getBoolean: () => null,
      getInteger: () => null,
      getSubcommand: () => opts.subcommand ?? "",
      getFocused: () => opts.focused ?? { name: "", value: "" },
    },
    async reply(payload: unknown) {
      calls.push({ method: "reply", payload });
      this.replied = true;
      return { resource: { message } };
    },
    async deferReply(payload: unknown) {
      calls.push({ method: "deferReply", payload });
      this.deferred = true;
    },
    async editReply(payload: unknown) {
      calls.push({ method: "editReply", payload });
      return message;
    },
    async followUp(payload: unknown) {
      calls.push({ method: "followUp", payload });
    },
    async respond(choices: unknown) {
      calls.push({ method: "respond", payload: choices });
    },
  };
  return { interaction, calls };
}

function text(payload: unknown): string {
  if (typeof payload === "string") return payload;
  const p = payload as { content?: string; embeds?: { toJSON?: () => unknown }[] };
  return [p.content ?? "", ...(p.embeds ?? []).map(e => JSON.stringify(e.toJSON ? e.toJSON() : e))].join(" ");
}

/** A Mongo query chain that resolves to `value` however it is chained. */
function query<T>(value: T) {
  const q: Record<string, unknown> = {};
  for (const m of ["sort", "limit", "select", "lean"]) q[m] = () => q;
  q.then = (resolve: (v: T) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(value).then(resolve, reject);
  q.catch = (reject: (e: unknown) => unknown) => Promise.resolve(value).catch(reject);
  return q;
}

/* ── Autocomplete helper ───────────────────────────────────────────── */

test("rankChoices: prefix matches first, keyword matches, cap of 25, 100-char names", () => {
  const items = [
    { name: "kick spam", value: "b" },
    { name: "ban raid", value: "a", keywords: "user 42" },
    { name: "spam ban", value: "c" },
  ];
  assert.deepEqual(rankChoices(items, "ban").map(c => c.value), ["a", "c"]);
  assert.deepEqual(rankChoices(items, "42").map(c => c.value), ["a"]);
  assert.deepEqual(rankChoices(items, "").map(c => c.value), ["b", "a", "c"], "empty query keeps order");
  const many = Array.from({ length: 60 }, (_, i) => ({ name: "x".repeat(150), value: `v${i}` }));
  const out = rankChoices(many, "");
  assert.equal(out.length, MAX_AUTOCOMPLETE_CHOICES);
  assert.ok(out.every(c => c.name.length <= 100));
  assert.deepEqual(rankChoices([{ name: "n", value: "v".repeat(101) }], ""), [], "values are never cut");
  assert.equal(clipChoice("a  b\n c"), "a b c");
  assert.equal(shortAge(0, 3 * 24 * HOUR), "3d ago");
  assert.equal(shortAge(0, 30_000), "just now");
});

/* ── Confirmation helper ───────────────────────────────────────────── */

test("confirmation: ids are per interaction and only the invoker's clicks count", () => {
  const ids = confirmationIds("abc");
  assert.notDeepEqual(ids, confirmationIds("abd"));
  const row = confirmationRow(ids, "Delete case").toJSON();
  assert.equal(row.components.length, 2);
  assert.ok(isConfirmationClick(ids, "u1", { customId: ids.yes, user: { id: "u1" } }));
  assert.ok(!isConfirmationClick(ids, "u1", { customId: ids.yes, user: { id: "u2" } }));
  assert.ok(!isConfirmationClick(ids, "u1", { customId: "other", user: { id: "u1" } }));
});

test("requestConfirmation: confirm, cancel and timeout; fresh replies are ephemeral; deferred ones are edited", async () => {
  for (const [click, expected] of [["yes", "confirmed"], ["no", "cancelled"], ["timeout", "timeout"]] as const) {
    const { interaction, calls } = fakeInteraction({ click });
    const result = await requestConfirmation(interaction as never, "Sure?");
    assert.equal(result, expected);
    assert.equal(calls[0].method, "reply");
    assert.ok((calls[0].payload as { flags?: number }).flags, "prompt is ephemeral");
    if (expected !== "confirmed") assert.match(text(calls.at(-1)!.payload), /nothing was changed/i);
  }
  const { interaction, calls } = fakeInteraction({ click: "yes", deferred: true });
  assert.equal(await requestConfirmation(interaction as never, { content: "Sure?", confirmLabel: "Go" }), "confirmed");
  assert.equal(calls[0].method, "editReply", "a deferred interaction is edited, not replied to");
});

/* ── /case ─────────────────────────────────────────────────────────── */

test("/case: case_id autocompletes on view, edit and delete; IDs errors say where IDs come from", async () => {
  const { command, caseChoice, caseIdHelp } = await import("../src/commands/moderation/case");
  const json = command.data.toJSON() as { options: { name: string; options: { name: string; autocomplete?: boolean }[] }[] };
  for (const sub of ["view", "edit", "delete"]) {
    const opt = json.options.find(o => o.name === sub)!.options.find(o => o.name === "case_id")!;
    assert.equal(opt.autocomplete, true, `/case ${sub} case_id autocompletes`);
  }
  const choice = caseChoice({ _id: "65f0c0ffee0000000000abcd", action: "ban", reason: "Raid  account", userId: TARGET, createdAt: new Date(0) }, 2 * 24 * HOUR);
  assert.equal(choice.value, "65f0c0ffee0000000000abcd");
  assert.match(choice.name, /^BAN · 2d ago · Raid account · …00abcd$/);
  assert.match(caseIdHelp("nope", "invalid"), /\/case user/);
  assert.match(caseIdHelp("x".repeat(80), "missing"), /…/);
});

test("/case autocomplete returns nothing to members without Moderate Members", async () => {
  const { command } = await import("../src/commands/moderation/case");
  const { interaction, calls } = fakeInteraction({ perms: 0n, focused: { name: "case_id", value: "" } });
  await command.autocomplete!(interaction as never);
  assert.deepEqual(calls[0], { method: "respond", payload: [] });
});

test("/case autocomplete lists recent cases for moderators", async () => {
  const { command } = await import("../src/commands/moderation/case");
  const { ModerationCaseModel } = await import("../src/database/mongo");
  const find = mock.method(ModerationCaseModel, "find", () =>
    query([{ _id: "65f0c0ffee0000000000abcd", action: "warn", reason: "Spam", userId: TARGET, createdAt: new Date() }]) as never);
  try {
    const { interaction, calls } = fakeInteraction({ perms: PermissionFlagsBits.ModerateMembers, focused: { name: "case_id", value: "spam" } });
    await command.autocomplete!(interaction as never);
    const choices = calls[0].payload as { value: string }[];
    assert.deepEqual(choices.map(c => c.value), ["65f0c0ffee0000000000abcd"]);
    assert.deepEqual((find.mock.calls[0].arguments[0] as { guildId: string }).guildId, GUILD, "scoped to the server");
  } finally {
    find.mock.restore();
  }
});

test("/case delete asks first and deletes nothing when cancelled", async () => {
  const { command } = await import("../src/commands/moderation/case");
  const { ModerationCaseModel } = await import("../src/database/mongo");
  const record = { _id: "65f0c0ffee0000000000abcd", action: "warn", reason: "Spam", userId: TARGET, moderatorId: MOD, createdAt: new Date() };
  const findOne = mock.method(ModerationCaseModel, "findOne", () => query(record) as never);
  const deleteOne = mock.method(ModerationCaseModel, "deleteOne", () => query({ deletedCount: 1 }) as never);
  try {
    const { interaction, calls } = fakeInteraction({
      click: "no",
      subcommand: "delete",
      perms: PermissionFlagsBits.Administrator,
      strings: { case_id: record._id },
    });
    (interaction as { guild: Record<string, unknown> }).guild.name = "G";
    await command.execute(interaction as never);
    assert.equal(deleteOne.mock.callCount(), 0, "cancel keeps the case");
    assert.match(text(calls[0].payload), /Delete this case\?/);
  } finally {
    findOne.mock.restore();
    deleteOne.mock.restore();
  }
});

/* ── /warnings ─────────────────────────────────────────────────────── */

test("/warnings pages five at a time, newest numbered highest, with IDs", async () => {
  const { renderWarningsPage, command } = await import("../src/commands/moderation/warnings");
  const list = Array.from({ length: 12 }, (_, i) => ({
    _id: `w${i}`, reason: `r${i}`, moderatorId: MOD, createdAt: new Date(Date.UTC(2026, 0, 12 - i)),
  }));
  const who = { tag: "t#1", id: TARGET };
  const first = renderWarningsPage(who, list, 0);
  assert.equal(first.totalPages, 3);
  assert.ok(first.hasNext && !first.hasPrev);
  const fields = first.embed.toJSON().fields!;
  assert.equal(fields.length, 5);
  assert.match(fields[0].name, /^Warning 12 /);
  assert.match(fields[0].value, /`w0`/);
  const last = renderWarningsPage(who, list, 99);
  assert.equal(last.page, 2, "out-of-range pages clamp");
  assert.equal(last.embed.toJSON().fields!.length, 2);
  assert.match(renderWarningsPage(who, [], 0).embed.toJSON().description!, /no active warnings/);
  const opts = (command.data.toJSON() as { options: { name: string }[] }).options.map(o => o.name);
  assert.deepEqual(opts, ["user", "ephemeral"]);
});

/* ── /clearwarnings ────────────────────────────────────────────────── */

test("/clearwarnings: self, outranked and departed members", async () => {
  const { clearWarningsBlock } = await import("../src/commands/moderation/clearwarnings");
  assert.match(clearWarningsBlock({ actorId: "a", targetId: "a", targetInServer: true, outranksTarget: true })!, /your own/);
  assert.match(clearWarningsBlock({ actorId: "a", targetId: "b", targetInServer: true, outranksTarget: false })!, /equal to or above/);
  assert.equal(clearWarningsBlock({ actorId: "a", targetId: "b", targetInServer: true, outranksTarget: true }), null);
  assert.equal(clearWarningsBlock({ actorId: "a", targetId: "b", targetInServer: false, outranksTarget: false }), null, "members who left can be cleared");
});

test("/clearwarnings defers before the lookups, asks first and deletes nothing when cancelled", async () => {
  const { command } = await import("../src/commands/moderation/clearwarnings");
  const { WarningModel } = await import("../src/database/mongo");
  const find = mock.method(WarningModel, "find", () => query([{ _id: "w1", reason: "r", moderatorId: MOD, createdAt: new Date() }]) as never);
  const deleteMany = mock.method(WarningModel, "deleteMany", () => Promise.resolve({ deletedCount: 1 }) as never);
  try {
    const { interaction, calls } = fakeInteraction({ click: "no", users: { user: { id: TARGET, tag: "t#1" } }, memberInGuild: false });
    await command.execute(interaction as never);
    assert.equal(deleteMany.mock.callCount(), 0);
    assert.equal(calls[0].method, "deferReply", "acknowledged before the slow lookups");
    assert.ok((calls[0].payload as { flags?: number }).flags, "deferred ephemerally so the prompt stays private");
    assert.equal(calls[1].method, "editReply", "the prompt edits the deferred reply");
    assert.match(text(calls[1].payload), /Clear \*\*1\*\* warning/);
    assert.ok(!calls.some(c => c.method === "reply"), "never replies to an already-deferred interaction");
  } finally {
    find.mock.restore();
    deleteMany.mock.restore();
  }
});

test("/clearwarnings: blocked moderators get the reason on the deferred reply", async () => {
  const { command } = await import("../src/commands/moderation/clearwarnings");
  const { interaction, calls } = fakeInteraction({ users: { user: { id: MOD, tag: "mod#0001" } } });
  await command.execute(interaction as never);
  assert.deepEqual(calls.map(c => c.method), ["deferReply", "editReply"]);
  assert.match(text(calls[1].payload), /your own/);
});

test("/clearwarnings: prompt, case and deletion cover the same records, revoked ones included", async () => {
  const { command } = await import("../src/commands/moderation/clearwarnings");
  const { WarningModel, ModerationCaseModel } = await import("../src/database/mongo");
  const records = [
    { _id: "w1", reason: "a", moderatorId: MOD, createdAt: new Date() },
    { _id: "w2", reason: "b", moderatorId: MOD, createdAt: new Date() },
    { _id: "w3", reason: "c", moderatorId: MOD, createdAt: new Date(), revoked: true },
  ];
  const find = mock.method(WarningModel, "find", () => query(records) as never);
  const deleteMany = mock.method(WarningModel, "deleteMany", () => Promise.resolve({ deletedCount: 3 }) as never);
  const createCase = mock.method(ModerationCaseModel, "create", async (doc: unknown) => ({ ...(doc as object), _id: "c1" }) as never);
  const { mongoGuildConfigStore, invalidateGuildConfig } = await import("../src/services/configuration");
  const load = mock.method(mongoGuildConfigStore, "load", async () => ({ guildId: GUILD, loggingEnabled: false }) as never);
  const legacy = mock.method(mongoGuildConfigStore, "loadLegacy", async () => []);
  const save = mock.method(mongoGuildConfigStore, "save", async (_id: string, set: Record<string, unknown>) => ({ guildId: GUILD, ...set }) as never);
  invalidateGuildConfig(GUILD);
  try {
    const { interaction, calls } = fakeInteraction({ click: "yes", users: { user: { id: TARGET, tag: "t#1" } }, memberInGuild: false });
    await command.execute(interaction as never);
    const findFilter = find.mock.calls[0].arguments[0] as Record<string, unknown>;
    assert.ok(!("revoked" in findFilter), "the prompt counts revoked records too");
    assert.match(text(calls[1].payload), /\*\*3\*\* warning record\(s\) \(\*\*2\*\* active, \*\*1\*\* revoked\)/);
    const delFilter = deleteMany.mock.calls[0].arguments[0] as { _id: { $in: string[] } };
    assert.deepEqual(delFilter._id.$in, ["w1", "w2", "w3"], "deletes exactly the records shown");
    const caseDoc = createCase.mock.calls[0].arguments[0] as { details?: string };
    assert.equal(caseDoc.details, "Cleared 3 warning record(s) (2 active, 1 revoked).", "the case logs the same set");
    assert.match(text(calls.at(-1)!.payload), /3 warning record\(s\) \(2 active, 1 revoked\)/);
  } finally {
    find.mock.restore();
    deleteMany.mock.restore();
    createCase.mock.restore();
    load.mock.restore();
    legacy.mock.restore();
    save.mock.restore();
    invalidateGuildConfig(GUILD);
  }
});

test("/clearwarnings summary wording", async () => {
  const { clearedSummary } = await import("../src/commands/moderation/clearwarnings");
  const { countWarningRecords, describeWarningRecords } = await import("../src/services/warnings");
  assert.deepEqual(countWarningRecords([{}, { revoked: false }, { revoked: true }]), { active: 2, revoked: 1, total: 3 });
  assert.equal(describeWarningRecords({ active: 2, revoked: 0, total: 2 }), "**2** warning(s)");
  assert.equal(describeWarningRecords({ active: 0, revoked: 2, total: 2 }, false), "2 revoked warning record(s)");
  assert.equal(clearedSummary({ active: 2, revoked: 1, total: 3 }, 3), "3 warning record(s) (2 active, 1 revoked)");
  assert.equal(clearedSummary({ active: 2, revoked: 0, total: 2 }, 1), "2 warning(s); 1 of 2 were still there to delete");
});

/* ── /escalation clear ─────────────────────────────────────────────── */

test("/escalation clear asks first; cancel keeps thresholds, confirm removes them", async () => {
  const { command } = await import("../src/commands/moderation/escalation");
  const { mongoGuildConfigStore, invalidateGuildConfig } = await import("../src/services/configuration");
  const stored = { guildId: GUILD, escalation: { enabled: true, thresholds: [{ atWarnings: 3, action: "timeout", durationMinutes: 60 }] } };
  const load = mock.method(mongoGuildConfigStore, "load", async () => structuredClone(stored) as never);
  const legacy = mock.method(mongoGuildConfigStore, "loadLegacy", async () => []);
  const save = mock.method(mongoGuildConfigStore, "save", async (_id: string, set: Record<string, unknown>) => ({ ...stored, ...set }) as never);
  try {
    for (const click of ["no", "yes"] as const) {
      invalidateGuildConfig(GUILD);
      save.mock.resetCalls();
      const { interaction, calls } = fakeInteraction({ click, subcommand: "clear", perms: PermissionFlagsBits.ManageGuild });
      await command.execute(interaction as never);
      const thresholdWrites = save.mock.calls.filter(c => JSON.stringify(c.arguments[1]).includes("thresholds"));
      if (click === "no") {
        assert.equal(thresholdWrites.length, 0, "cancel keeps the thresholds");
      } else {
        assert.equal(thresholdWrites.length, 1);
        assert.match(text(calls.at(-1)!.payload), /cleared/);
      }
      assert.ok(calls.some(c => /Remove all \*\*1\*\* escalation threshold/.test(text(c.payload))));
    }
  } finally {
    load.mock.restore();
    legacy.mock.restore();
    save.mock.restore();
    invalidateGuildConfig(GUILD);
  }
});

/* ── /autoresponder ────────────────────────────────────────────────── */

test("/autoresponder: duplicate and empty triggers, capped list, ID autocomplete", async () => {
  const mod = await import("../src/commands/autoresponder/autoresponder");
  const existing = [{ trigger: "hello", matchType: "contains" as const }];
  assert.match(mod.validateTrigger("  HELLO ", "contains", existing)!, /already/);
  assert.equal(mod.validateTrigger("hello", "exact", existing), null, "same text, different match type is fine");
  assert.match(mod.validateTrigger("   ", "contains", [])!, /empty/);

  const many = Array.from({ length: 30 }, (_, i) => ({ id: `ar-${i}`, trigger: `t${i}`, matchType: "contains" as const, response: "r".repeat(500) }));
  const body = mod.formatResponderList(many);
  assert.ok(body.length <= 4096);
  assert.match(body, /and 10 more/);

  const json = mod.command.data.toJSON() as { options: { name: string; options: { name: string; autocomplete?: boolean; max_length?: number }[] }[] };
  for (const sub of ["remove", "delete"]) {
    assert.equal(json.options.find(o => o.name === sub)!.options[0].autocomplete, true);
  }
  const add = json.options.find(o => o.name === "add")!.options;
  assert.equal(add.find(o => o.name === "trigger")!.max_length, mod.MAX_TRIGGER_LENGTH);
  assert.equal(add.find(o => o.name === "response")!.max_length, 2000);
  assert.match(mod.responderChoice(many[0]).name, /^"t0" \(contains\)/);

  const { interaction, calls } = fakeInteraction({ perms: 0n, focused: { name: "id", value: "" } });
  await mod.command.autocomplete!(interaction as never);
  assert.deepEqual(calls[0].payload, [], "no IDs for members without Manage Server");
});

/* ── Codex #13: hidden tickets stay open ───────────────────────────── */

test("Codex #13: auto-close defers instead of closing a ticket hidden from Aegis", () => {
  assert.deepEqual(autoCloseDecision(0, 48, 100 * HOUR, { channelHidden: true }), { action: "defer", at: 148 * HOUR });
  assert.deepEqual(autoCloseDecision(0, 48, 100 * HOUR), { action: "close" }, "visible quiet tickets still close");
  assert.deepEqual(autoCloseDecision(0, 0, 100 * HOUR, { channelHidden: true }), { action: "disabled" });
});

test("Codex #13: closeTicket leaves a hidden ticket open and untouched", async () => {
  const { closeTicket } = await import("../src/services/ticketService");
  const { TicketModel } = await import("../src/database/mongo");
  const save = mock.fn(async () => undefined);
  const doc = { id: "ticket-1", userId: TARGET, status: "open", save };
  const findOne = mock.method(TicketModel, "findOne", () => Promise.resolve(doc) as never);
  const send = mock.fn(async () => undefined);
  const hidden = { id: "c1", name: "ticket-1", flags: new ChannelFlagsBitField(CHANNEL_OBFUSCATED_FLAG), send, delete: mock.fn(async () => undefined) };
  const guild = { id: GUILD, client: {}, channels: { cache: new Map([["c1", hidden]]), fetch: async () => hidden } };
  try {
    const closed = await closeTicket(guild as never, "c1", MOD, "Done");
    assert.equal(closed, false);
    assert.equal(save.mock.callCount(), 0, "status not changed");
    assert.equal(doc.status, "open");
    assert.equal(send.mock.callCount(), 0);
  } finally {
    findOne.mock.restore();
  }
});
