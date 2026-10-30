/**
 * Bug-hunt fixes (3.6.1): interaction-scoped modal IDs, role-panel and
 * verification role hierarchy, hidden-channel checks before posting, and the
 * atomic ticket close. Discord and Mongo are faked; no network.
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { ChannelFlagsBitField, PermissionFlagsBits, PermissionsBitField } from "discord.js";
import { scopedModalId } from "../src/utils/modal";
import { roleAboveActor } from "../src/permissions/hierarchy";
import { CHANNEL_OBFUSCATED_FLAG } from "../src/utils/channels";

const GUILD = "900000000000000001";
const OWNER = "900000000000000002";
const MOD = "900000000000000010";

/** A slash-command interaction with just enough surface for the setup flows. */
function fakeInteraction(opts: {
  id?: string;
  subcommand?: string;
  perms?: bigint;
  actorTop?: number | null;
  channel?: { id: string; flags?: ChannelFlagsBitField };
  roles?: Record<string, { id: string; name: string; position: number } | null>;
}) {
  const calls: { method: string; payload: unknown }[] = [];
  let modalFilter: ((m: { user: { id: string }; customId: string }) => boolean) | null = null;
  const channel = opts.channel ?? { id: "700000000000000001" };
  const interaction = {
    id: opts.id ?? "int-1",
    guildId: GUILD,
    guild: {
      id: GUILD,
      ownerId: OWNER,
      members: {
        cache: new Map(opts.actorTop === null ? [] : [[MOD, { roles: { highest: { position: opts.actorTop ?? 10 } } }]]),
        fetch: async () => null,
      },
      channels: { cache: new Map([[channel.id, channel]]) },
    },
    user: { id: MOD, tag: "mod#0001" },
    memberPermissions: new PermissionsBitField(opts.perms ?? PermissionFlagsBits.Administrator),
    options: {
      getSubcommand: () => opts.subcommand ?? "",
      getChannel: () => channel,
      getRole: (name: string) => opts.roles?.[name] ?? null,
      getString: () => null,
      getBoolean: () => null,
      getInteger: () => null,
    },
    async reply(payload: unknown) {
      calls.push({ method: "reply", payload });
    },
    async showModal(modal: { toJSON(): { custom_id: string } }) {
      calls.push({ method: "showModal", payload: modal.toJSON() });
    },
    async awaitModalSubmit(o: { filter: typeof modalFilter }) {
      modalFilter = o.filter;
      throw new Error("time");
    },
  };
  return { interaction, calls, filter: () => modalFilter };
}

function content(payload: unknown): string {
  return String((payload as { content?: string })?.content ?? payload);
}

/* ── Modal IDs ─────────────────────────────────────────────────────── */

test("scopedModalId: one ID per opening interaction, within Discord's 100-character limit", () => {
  assert.notEqual(scopedModalId("suggest_submit_modal", "1"), scopedModalId("suggest_submit_modal", "2"));
  assert.ok(scopedModalId("x".repeat(120), "123").length <= 100);
});

test("/suggest submit: a submit from an earlier, abandoned invocation does not resolve this one", async () => {
  const { command } = await import("../src/commands/community/suggest");
  const { mongoGuildConfigStore, invalidateGuildConfig } = await import("../src/services/configuration");
  const load = mock.method(mongoGuildConfigStore, "load", async () => ({ guildId: GUILD, suggestionsChannelId: "700000000000000001" }) as never);
  const legacy = mock.method(mongoGuildConfigStore, "loadLegacy", async () => []);
  const save = mock.method(mongoGuildConfigStore, "save", async (_id: string, set: Record<string, unknown>) => ({ guildId: GUILD, suggestionsChannelId: "700000000000000001", ...set }) as never);
  invalidateGuildConfig(GUILD);
  try {
    const { interaction, calls, filter } = fakeInteraction({ id: "int-2", subcommand: "submit" });
    await command.execute(interaction as never);
    const modal = calls.find(c => c.method === "showModal")!.payload as { custom_id: string };
    assert.equal(modal.custom_id, scopedModalId("suggest_submit_modal", "int-2"));
    const f = filter()!;
    assert.ok(f({ user: { id: MOD }, customId: modal.custom_id }), "its own modal is accepted");
    assert.ok(!f({ user: { id: MOD }, customId: scopedModalId("suggest_submit_modal", "int-1") }), "another invocation's modal is ignored");
    assert.ok(!f({ user: { id: MOD }, customId: "suggest_submit_modal" }), "the old fixed ID is ignored");
  } finally {
    load.mock.restore();
    legacy.mock.restore();
    save.mock.restore();
    invalidateGuildConfig(GUILD);
  }
});

/* ── Role hierarchy for self-service roles ────────────────────────── */

test("roleAboveActor: roles must be strictly below the actor's top role; the owner may use any", () => {
  const roles = [{ id: "low", position: 3 }, { id: "equal", position: 5 }, { id: "high", position: 9 }];
  assert.equal(roleAboveActor({ ownerId: OWNER, actorId: MOD, actorTopPosition: 5, roles: [roles[0]] }), null);
  assert.equal(roleAboveActor({ ownerId: OWNER, actorId: MOD, actorTopPosition: 5, roles })?.id, "equal");
  assert.equal(roleAboveActor({ ownerId: OWNER, actorId: OWNER, actorTopPosition: 0, roles }), null, "owner is exempt");
  assert.equal(roleAboveActor({ ownerId: OWNER, actorId: MOD, actorTopPosition: null, roles: [roles[0]] })?.id, "low", "unknown actor is refused");
});

test("/rolepanel create refuses a role at or above the creator's highest role before opening the form", async () => {
  const { command } = await import("../src/commands/roles/rolepanel");
  const { interaction, calls } = fakeInteraction({
    subcommand: "create",
    actorTop: 5,
    roles: { role1: { id: "600000000000000001", name: "Events", position: 2 }, role2: { id: "600000000000000002", name: "Admin", position: 5 } },
  });
  await command.execute(interaction as never);
  assert.ok(!calls.some(c => c.method === "showModal"), "no form, nothing posted");
  assert.match(content(calls[0].payload), /<@&600000000000000002>.*equal to or above your highest role/);
});

test("/rolepanel create allows roles below the creator and refuses a channel hidden from Aegis", async () => {
  const { command } = await import("../src/commands/roles/rolepanel");
  const ok = fakeInteraction({ subcommand: "create", actorTop: 5, roles: { role1: { id: "600000000000000001", name: "Events", position: 2 } } });
  await command.execute(ok.interaction as never);
  assert.equal(ok.calls[0].method, "showModal");

  const hidden = fakeInteraction({
    subcommand: "create",
    channel: { id: "700000000000000099", flags: new ChannelFlagsBitField(CHANNEL_OBFUSCATED_FLAG) },
    roles: { role1: { id: "600000000000000001", name: "Events", position: 2 } },
  });
  await command.execute(hidden.interaction as never);
  assert.ok(!hidden.calls.some(c => c.method === "showModal"));
  assert.match(content(hidden.calls[0].payload), /can't see <#700000000000000099>/);
});

test("/verify setup refuses a verified role at or above the invoker's highest role", async () => {
  const { command } = await import("../src/commands/verification/verify");
  const { interaction, calls } = fakeInteraction({
    subcommand: "setup",
    actorTop: 4,
    roles: { verified_role: { id: "600000000000000003", name: "Mods", position: 4 } },
  });
  await command.execute(interaction as never);
  assert.ok(!calls.some(c => c.method === "showModal"));
  assert.match(content(calls[0].payload), /can't use <@&600000000000000003> as the verified role/);

  const owner = fakeInteraction({ subcommand: "setup", actorTop: 0, roles: { verified_role: { id: "600000000000000003", name: "Mods", position: 4 } } });
  owner.interaction.user.id = OWNER;
  await command.execute(owner.interaction as never);
  assert.equal(owner.calls[0].method, "showModal", "the owner may use any role");
});

/* ── Tickets ───────────────────────────────────────────────────────── */

test("closeTicket: when another close wins the race, this one posts and deletes nothing", async () => {
  const { closeTicket } = await import("../src/services/ticketService");
  const { TicketModel } = await import("../src/database/mongo");
  const doc = { _id: "t1", id: "ticket-1", userId: "u1", status: "open" };
  const findOne = mock.method(TicketModel, "findOne", () => Promise.resolve(doc) as never);
  const updateOne = mock.method(TicketModel, "updateOne", () => Promise.resolve({ modifiedCount: 0 }) as never);
  const send = mock.fn(async () => undefined);
  const del = mock.fn(async () => undefined);
  const visible = { id: "c1", name: "ticket-1", flags: new ChannelFlagsBitField(0), send, delete: del, messages: { fetch: async () => null } };
  const guild = { id: GUILD, client: { users: { fetch: async () => null } }, channels: { cache: new Map([["c1", visible]]), fetch: async () => visible } };
  try {
    assert.equal(await closeTicket(guild as never, "c1", MOD, "Done"), false);
    const filter = updateOne.mock.calls[0].arguments[0] as Record<string, unknown>;
    assert.equal(filter.status, "open", "the close is conditional on the ticket still being open");
    assert.equal(send.mock.callCount(), 0);
    assert.equal(del.mock.callCount(), 0);
  } finally {
    findOne.mock.restore();
    updateOne.mock.restore();
  }
});
