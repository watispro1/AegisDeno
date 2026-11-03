/** Entry points (top.gg review fix): @mention / typed help, DM help routing, cooldown, join welcome, /help in DMs. No network, no Mongo. */
import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ChannelType, PermissionFlagsBits, type Client, type Guild, type Message } from "discord.js";
import {
  ENTRY_MENTIONS, KeyedCooldown, canPostHelp, canReplyTo, dmEntryKind, isGuildHelpTrigger, isMentionHelp, isTextHelpTrigger,
  joinWelcomeEnabled, normalizeTrigger, pickWelcomeChannel, shouldDmHelp,
} from "../src/services/entryPointLogic";
import {
  DM_STAFF_NOTE, ENTRY_HELP_CATEGORIES, _resetEntryPointForTests, buildEntryHelp, buildJoinWelcome, firstDmFrom,
  handleGuildEntryHelp, memoryWelcomeStore, sendJoinWelcome,
} from "../src/services/entryPoint";
import { commands, loadCommands } from "../src/commands/loader";
import { executeCommand } from "../src/commands/executor";
import { newHereLine } from "../src/commands/general/help";
import { ModmailThreadModel } from "../src/database/modmailModels";
import { handleModmailDM } from "../src/services/modmailService";

const BOT = "200000000000000001";
const ROLE = "300000000000000001";
const ALL = PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages | PermissionFlagsBits.EmbedLinks | PermissionFlagsBits.ReadMessageHistory;

before(async () => { await loadCommands(); });
beforeEach(() => _resetEntryPointForTests());

/* Detection */

test("mention detection: bare mention, nickname mention, managed role, optional 'help'", () => {
  for (const ok of [`<@${BOT}>`, `<@!${BOT}>`, `  <@${BOT}>  `, `<@${BOT}> help`, `<@!${BOT}> HELP`, `<@${BOT}>   Help!`, `<@&${ROLE}>`, `<@&${ROLE}> help`]) {
    assert.ok(isMentionHelp(ok, BOT, ROLE), ok);
  }
  for (const no of [`<@${BOT}> ban everyone`, `hey <@${BOT}>`, `<@${BOT}><@${BOT}>`, `<@200000000000000002>`, `<@&${ROLE}>`, "help", "", `<@${BOT}> helpme`]) {
    // The role form only counts when the bot's role id is known.
    const role = no === `<@&${ROLE}>` ? null : ROLE;
    assert.ok(!isMentionHelp(no, BOT, role), no);
  }
  assert.ok(!isMentionHelp(`<@${BOT}>`, "not-an-id"), "bad bot id never matches");
});

test("text triggers: whole message, any case; no general prefix", () => {
  for (const ok of ["a!help", "!help", "aegis help", "A!HELP", "  Aegis   Help  ", "!Help"]) assert.ok(isTextHelpTrigger(ok), ok);
  for (const no of ["a!ban", "!helpme", "aegis help me", "help", "!help please", "a! help", "/help", "?help"]) assert.ok(!isTextHelpTrigger(no), no);
  assert.ok(isGuildHelpTrigger("!help", BOT, null));
  assert.ok(isGuildHelpTrigger(`<@${BOT}>`, BOT, null));
  assert.equal(normalizeTrigger("  A  B "), "a b");
});

test("DM routing: help words always, greetings only without an open ticket, attachments never", () => {
  assert.equal(dmEntryKind("help"), "help");
  assert.equal(dmEntryKind("/help"), "help");
  assert.equal(dmEntryKind("!HELP"), "help");
  assert.equal(dmEntryKind("Hello!"), "greeting");
  assert.equal(dmEntryKind("hi"), "greeting");
  assert.equal(dmEntryKind("hi, I was banned unfairly"), null);
  assert.equal(dmEntryKind("I need help with a ban"), null);

  assert.ok(shouldDmHelp({ content: "help", hasAttachments: false, hasOpenTicket: true }));
  assert.ok(shouldDmHelp({ content: "hi", hasAttachments: false, hasOpenTicket: false }));
  assert.ok(!shouldDmHelp({ content: "hi", hasAttachments: false, hasOpenTicket: true }), "mid-conversation hi goes to staff");
  assert.ok(!shouldDmHelp({ content: "help", hasAttachments: true, hasOpenTicket: false }), "attachments go to ModMail");
  assert.ok(!shouldDmHelp({ content: "someone is spamming", hasAttachments: false, hasOpenTicket: false }));
});

test("permissions: needs View, Embed Links and Send (Send in Threads for threads); reply also needs history", () => {
  assert.ok(canPostHelp(ALL, false));
  assert.ok(!canPostHelp(ALL & ~PermissionFlagsBits.EmbedLinks, false));
  assert.ok(!canPostHelp(ALL & ~PermissionFlagsBits.ViewChannel, false));
  assert.ok(!canPostHelp(ALL, true), "threads need Send Messages in Threads");
  assert.ok(canPostHelp(ALL | PermissionFlagsBits.SendMessagesInThreads, true));
  assert.ok(!canPostHelp(null, false));
  assert.ok(canReplyTo(ALL));
  assert.ok(!canReplyTo(ALL & ~PermissionFlagsBits.ReadMessageHistory));
});

test("cooldown: one answer per key per window, other keys unaffected, bounded size", () => {
  const c = new KeyedCooldown(10_000, 3);
  assert.ok(c.take("a", 0));
  assert.ok(!c.take("a", 9_999));
  assert.ok(c.take("b", 5));
  assert.ok(c.take("a", 10_000));
  for (const k of ["c", "d", "e", "f"]) c.take(k, 20_000);
  assert.ok(c.take("a", 20_001), "oldest key was evicted at the size bound");
});

/* The help card */

test("help card: slash-command lead, real example commands, four link buttons, never pings", () => {
  const card = buildEntryHelp();
  const e = card.embeds[0].toJSON();
  assert.match(e.description ?? "", /I use slash commands\. Start with \*\*\/help\*\*/);
  for (const cat of ENTRY_HELP_CATEGORIES) for (const name of cat.commands) assert.ok(commands.has(name), `/${name} exists`);
  const buttons = card.components[0].toJSON().components as Array<{ label: string; url: string }>;
  assert.deepEqual(buttons.map(b => b.label), ["Commands", "Dashboard", "Support server", "Invite"]);
  assert.ok(buttons[0].url.endsWith("/commands"));
  assert.ok(buttons[1].url.endsWith("/dashboard"));
  for (const b of buttons) assert.match(b.url, /^https?:\/\//);
  assert.ok(!JSON.stringify(e).includes(DM_STAFF_NOTE), "server card has no DM note");
  const dm = JSON.stringify(buildEntryHelp({ dm: true, hasOpenTicket: true }).embeds[0].toJSON());
  assert.ok(dm.includes(DM_STAFF_NOTE));
  assert.ok(dm.includes("goes to that server's staff"));
  assert.deepEqual(ENTRY_MENTIONS, { parse: [], users: [], roles: [], repliedUser: false });
});

/* Server mention handler */

function fakeMessage(content: string, o: { perms?: bigint; channelId?: string; thread?: boolean; bot?: boolean } = {}) {
  const calls: { reply: any[]; send: any[] } = { reply: [], send: [] };
  const msg = {
    content,
    author: { id: "400000000000000001", bot: o.bot ?? false },
    channelId: o.channelId ?? "500000000000000001",
    inGuild: () => true,
    guild: { members: { me: { roles: { botRole: { id: ROLE } } } } },
    channel: {
      isThread: () => o.thread ?? false,
      permissionsFor: () => ({ bitfield: o.perms ?? ALL }),
      send: async (p: unknown) => { calls.send.push(p); return {}; },
    },
    reply: async (p: unknown) => { calls.reply.push(p); return {}; },
  };
  return { msg: msg as unknown as Message, calls };
}
const client = { user: { id: BOT } } as unknown as Client;

test("server: a bare mention gets the card as a non-pinging reply", async () => {
  const { msg, calls } = fakeMessage(`<@${BOT}>`);
  assert.equal(await handleGuildEntryHelp(client, msg), true);
  assert.equal(calls.reply.length, 1);
  assert.deepEqual(calls.reply[0].allowedMentions, ENTRY_MENTIONS);
  assert.equal(calls.reply[0].failIfNotExists, false);
  assert.equal(calls.reply[0].embeds.length, 1);
});

test("server: ordinary messages are untouched; bots are ignored", async () => {
  const { msg, calls } = fakeMessage("hello everyone");
  assert.equal(await handleGuildEntryHelp(client, msg), false);
  const bot = fakeMessage(`<@${BOT}>`, { bot: true });
  assert.equal(await handleGuildEntryHelp(client, bot.msg), false);
  assert.equal(calls.reply.length + bot.calls.reply.length, 0);
});

test("server: per-channel cooldown of ~10s, separate channels answered", async () => {
  const a1 = fakeMessage("!help", { channelId: "c1" });
  const a2 = fakeMessage("a!help", { channelId: "c1" });
  const b1 = fakeMessage("aegis help", { channelId: "c2" });
  await handleGuildEntryHelp(client, a1.msg);
  assert.equal(await handleGuildEntryHelp(client, a2.msg), true, "still consumed, so autoresponders don't fire");
  await handleGuildEntryHelp(client, b1.msg);
  assert.equal(a1.calls.reply.length, 1);
  assert.equal(a2.calls.reply.length, 0);
  assert.equal(b1.calls.reply.length, 1);
});

test("server: silent without Embed Links / Send; plain send without Read Message History", async () => {
  const noEmbed = fakeMessage(`<@${BOT}>`, { perms: ALL & ~PermissionFlagsBits.EmbedLinks });
  assert.equal(await handleGuildEntryHelp(client, noEmbed.msg), true);
  assert.equal(noEmbed.calls.reply.length + noEmbed.calls.send.length, 0);
  const noHistory = fakeMessage(`<@${BOT}>`, { perms: ALL & ~PermissionFlagsBits.ReadMessageHistory, channelId: "c9" });
  await handleGuildEntryHelp(client, noHistory.msg);
  assert.equal(noHistory.calls.reply.length, 0);
  assert.equal(noHistory.calls.send.length, 1);
  assert.deepEqual(noHistory.calls.send[0].allowedMentions, ENTRY_MENTIONS);
});

/* DMs through the ModMail entry point */

function fakeDm(content: string, userId: string) {
  const replies: any[] = [];
  const msg = {
    content, guildId: null, author: { id: userId, bot: false, tag: "u#0" }, attachments: new Map(),
    reply: async (p: unknown) => { replies.push(p); return {}; },
    react: async () => ({}),
  };
  return { msg: msg as unknown as Message, replies };
}

test("DM: help words and a first DM with no ModMail server get the card; later DMs get the short text", async () => {
  const realFind = ModmailThreadModel.find;
  (ModmailThreadModel as any).find = () => ({ select: () => ({ lean: async () => [] }) });
  try {
    const dmClient = { guilds: { cache: new Map() } } as unknown as Client;
    const help = fakeDm("help", "600000000000000001");
    await handleModmailDM(dmClient, help.msg);
    assert.equal(help.replies.length, 1);
    assert.ok(JSON.stringify(help.replies[0].embeds[0].toJSON()).includes(DM_STAFF_NOTE));
    assert.deepEqual(help.replies[0].allowedMentions, ENTRY_MENTIONS);

    const first = fakeDm("can someone unban me", "600000000000000002");
    await handleModmailDM(dmClient, first.msg);
    assert.equal(first.replies[0].embeds?.length, 1, "first DM → help card");
    const second = fakeDm("hello? anyone", "600000000000000002");
    await handleModmailDM(dmClient, second.msg);
    assert.match(second.replies[0].content, /couldn't find a server we share/);
  } finally {
    (ModmailThreadModel as any).find = realFind;
  }
});

test("firstDmFrom: true once per user", () => {
  assert.ok(firstDmFrom("u1"));
  assert.ok(!firstDmFrom("u1"));
  assert.ok(firstDmFrom("u2"));
});

/* Join welcome */

function fakeGuild(o: { systemCanSend?: boolean; otherCanSend?: boolean; sendFails?: boolean; noSystem?: boolean } = {}) {
  const sent: Array<{ channel: string; payload: any }> = [];
  const mk = (id: string, canSend: boolean, rawPosition: number) => ({
    id, type: ChannelType.GuildText, rawPosition,
    permissionsFor: () => ({ bitfield: canSend ? ALL : PermissionFlagsBits.ViewChannel }),
    isTextBased: () => true,
    send: async (payload: unknown) => { if (o.sendFails) throw new Error("Missing Access"); sent.push({ channel: id, payload }); return {}; },
  });
  const system = mk("sys", o.systemCanSend ?? true, 5);
  const lower = mk("low", o.otherCanSend ?? true, 9);
  const top = mk("top", o.otherCanSend ?? true, 1);
  const cache = new Map<string, unknown>([["sys", system], ["low", lower], ["top", top]]);
  const guild = { id: "700000000000000001", members: { me: {} }, systemChannel: o.noSystem ? null : system, channels: { cache } };
  return { guild: guild as unknown as Guild, sent };
}

test("welcome: once per guild into the system channel, no pings, Dashboard button", async () => {
  const store = memoryWelcomeStore();
  const { guild, sent } = fakeGuild();
  assert.equal(await sendJoinWelcome(guild, store), "sent");
  assert.equal(await sendJoinWelcome(guild, store), "already");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].channel, "sys");
  assert.deepEqual(sent[0].payload.allowedMentions, ENTRY_MENTIONS);
  assert.match(sent[0].payload.embeds[0].toJSON().description, /Run \*\*\/help\*\* to get started/);
  assert.ok(buildJoinWelcome().components[0].toJSON().components.some((b: any) => b.label === "Dashboard"));
});

test("welcome: falls back to the highest sendable channel; silent with no permission; failed send is not recorded", async () => {
  const fb = fakeGuild({ systemCanSend: false });
  assert.equal(await sendJoinWelcome(fb.guild, memoryWelcomeStore()), "sent");
  assert.equal(fb.sent[0].channel, "top");

  const none = fakeGuild({ systemCanSend: false, otherCanSend: false });
  const store = memoryWelcomeStore();
  assert.equal(await sendJoinWelcome(none.guild, store), "no-channel");
  assert.equal(store.claimed.size, 0);

  const failing = fakeGuild({ sendFails: true });
  const s2 = memoryWelcomeStore();
  assert.equal(await sendJoinWelcome(failing.guild, s2), "failed");
  assert.equal(s2.claimed.size, 0, "claim released so a later join can retry");
});

test("welcome: JOIN_WELCOME=off disables it; pickWelcomeChannel rules", async () => {
  assert.ok(joinWelcomeEnabled(undefined));
  assert.ok(joinWelcomeEnabled("on"));
  for (const v of ["off", "false", "0", "no", "OFF"]) assert.ok(!joinWelcomeEnabled(v), v);
  const prev = process.env.JOIN_WELCOME;
  process.env.JOIN_WELCOME = "off";
  try {
    assert.equal(await sendJoinWelcome(fakeGuild().guild, memoryWelcomeStore()), "disabled");
  } finally {
    if (prev === undefined) delete process.env.JOIN_WELCOME; else process.env.JOIN_WELCOME = prev;
  }
  assert.equal(pickWelcomeChannel(null, []), null);
  assert.equal(pickWelcomeChannel({ id: "s", canSend: true, position: 9 }, [{ id: "a", canSend: true, position: 0 }]), "s");
  assert.equal(pickWelcomeChannel({ id: "s", canSend: false, position: 0 }, [{ id: "b", canSend: true, position: 3 }, { id: "a", canSend: true, position: 1 }]), "a");
});

/* /help */

test("/help is registered for servers and DMs, for everyone", () => {
  const json = commands.get("help")!.data.toJSON() as { contexts?: number[]; default_member_permissions?: string | null; dm_permission?: boolean };
  assert.deepEqual(json.contexts, [0, 1]);
  assert.ok(json.default_member_permissions == null);
  assert.notEqual(json.dm_permission, false);
  assert.ok(!commands.get("help")!.guildOnly);
  assert.ok(!commands.get("help")!.userPermissions?.length);
});

let helpUser = 0;
function fakeHelpInteraction(o: { inGuild: boolean; perms: bigint | null }) {
  const replies: any[] = [];
  // A fresh user each time: the executor's per-user cooldown would otherwise answer "please wait".
  const userId = String(800000000000000000n + BigInt(++helpUser));
  const interaction = {
    commandName: "help",
    user: { id: userId, tag: "m#0" },
    guildId: o.inGuild ? "700000000000000001" : null,
    guild: o.inGuild ? { members: { me: { permissions: { has: () => true } } } } : null,
    inGuild: () => o.inGuild,
    memberPermissions: o.perms === null ? null : { bitfield: o.perms, has: (p: bigint) => ((o.perms as bigint) & p) === p },
    options: { getString: () => null },
    replied: false, deferred: false,
    reply: async (p: any) => {
      replies.push(p);
      return { createMessageComponentCollector: () => ({ on: () => undefined }) };
    },
    editReply: async () => ({}), followUp: async (p: any) => { replies.push(p); },
  };
  return { interaction: interaction as any, replies };
}

test("/help runs in DMs (no 'couldn't verify my permissions') and for a member with no permissions, fast", async () => {
  for (const ctx of [{ inGuild: false, perms: null }, { inGuild: true, perms: 0n }]) {
    const { interaction, replies } = fakeHelpInteraction(ctx);
    const t = Date.now();
    await executeCommand(commands.get("help")!, interaction);
    assert.ok(Date.now() - t < 1_000, "answers well inside Discord's 3 s window");
    assert.equal(replies.length, 1);
    assert.ok(replies[0].embeds?.length, JSON.stringify(replies[0]).slice(0, 200));
    const fields = replies[0].embeds[0].toJSON().fields as Array<{ name: string; value: string }>;
    assert.ok(fields.some(f => f.name.includes("New here?")));
  }
});

test("/help: newHereLine names only commands the user can run", () => {
  assert.match(newHereLine(true, new Set(["dashboard", "diagnostics"])), /Try `\/dashboard` or `\/diagnostics`/);
  assert.match(newHereLine(true, new Set()), /Ask a server admin/);
  assert.match(newHereLine(false, new Set(["dashboard"])), /Add Aegis/);
});

test("/help: every category page (admin view) renders and fits Discord's 4096-character limit", async () => {
  const handlers: Record<string, (...a: any[]) => unknown> = {};
  const { interaction } = fakeHelpInteraction({ inGuild: true, perms: PermissionFlagsBits.Administrator });
  interaction.reply = async () => ({ createMessageComponentCollector: () => ({ on: (ev: string, fn: any) => { handlers[ev] = fn; } }) });
  await executeCommand(commands.get("help")!, interaction);
  assert.ok(handlers.collect, "category picker is live");
  for (const value of ["all", "general", "moderation", "config", "developer", "nonexistent"]) {
    const updates: any[] = [];
    await handlers.collect({ values: [value], user: interaction.user, customId: "help_category_select", update: async (p: any) => { updates.push(p); }, replied: false, deferred: false });
    assert.equal(updates.length, 1, value);
    const e = updates[0].embeds[0].toJSON();
    assert.ok((e.description ?? "").length <= 4096, `${value}: ${(e.description ?? "").length}`);
    assert.ok((e.description ?? "").length > 0, value);
  }
});
