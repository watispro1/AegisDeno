/**
 * The upgraded server-setup commands: /automod, /logging, /ticket, /verify,
 * /welcome, /config, /preset, /autoresponder, /automation, /rolepanel,
 * /developer, /sync and Report Message. Pure helpers, command definitions
 * (nothing renamed or removed), and a few flows with faked Discord objects.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ChannelFlagsBitField, ChannelType, PermissionFlagsBits, PermissionsBitField } from "discord.js";
import { CHANNEL_OBFUSCATED_FLAG } from "../src/utils/channels";
import { normalizeAutomodConfig } from "../src/services/automod";
import {
  botChannelProblem, botRoleProblem, channelPermissionMessage, dashboardPageUrl, missingFrom, POST_EMBED_PERMISSIONS, POST_FILE_PERMISSIONS,
} from "../src/commands/config/kit/setupKit";
import { actionPermissionWarning, afterChangeLine, automodChoices, findStoredWord, ruleSummary, wordListLines } from "../src/commands/automod/automod/views";
import { automodData } from "../src/commands/automod/automod/builder";
import { fullCategoryMap, isLogCategoryKey, testFailureReason, buildLoggingButtons, buildLoggingEmbed } from "../src/commands/logging/logging/panel";
import { cleanTicketName, ticketData, PANEL_TITLE_MAX } from "../src/commands/tickets/ticket/builder";
import { ticketCreationGaps } from "../src/commands/tickets/ticket";
import { verificationWarnings, buildVerificationEmbed } from "../src/commands/verification/verify/info";
import { unknownVariables, welcomeMessageProblem, WELCOME_MESSAGE_MAX, buildWelcomeButtons } from "../src/commands/welcome/welcome/view";
import { moduleLine } from "../src/commands/config/config";
import { presetEmbed } from "../src/commands/config/preset";
import { PRESETS } from "../src/services/presetService";
import { resolveResponder, unknownPlaceholders, responderLines } from "../src/commands/autoresponder/autoresponder";
import { parseDelay, taskLine, MIN_REPEAT_MS } from "../src/commands/automation/automation";
import { panelChoice, panelLines } from "../src/commands/roles/rolepanel/manage";
import { commandFields } from "../src/commands/developer/developer";
import { syncPlan } from "../src/commands/developer/sync";
import { reportBlock, reportLinks, reportReply } from "../src/commands/contextMenus";

const G = "900000000000000001";
const CH = "700000000000000001";
const ROLE = "600000000000000001";
const perms = (...bits: bigint[]) => new PermissionsBitField(bits);
type Opt = { name: string; type: number; options?: Opt[]; autocomplete?: boolean; max_length?: number; channel_types?: number[] };
const json = (data: { toJSON(): unknown }) => data.toJSON() as { name: string; options: Opt[] };
const find = (opts: Opt[] | undefined, ...path: string[]): Opt | undefined => {
  let cur: Opt | undefined;
  let list = opts;
  for (const p of path) { cur = list?.find(o => o.name === p); list = cur?.options; }
  return cur;
};

/* Shared setup kit */

test("setup kit: dashboard links, missing permissions and the message that names them", () => {
  assert.match(dashboardPageUrl(G, "settings/automod"), new RegExp(`/dashboard/${G}/settings/automod$`));
  assert.match(dashboardPageUrl(G), new RegExp(`/dashboard/${G}$`));
  assert.deepEqual(missingFrom(perms(PermissionFlagsBits.ViewChannel), POST_EMBED_PERMISSIONS), ["Send Messages", "Embed Links"]);
  assert.deepEqual(missingFrom(null, POST_EMBED_PERMISSIONS), [], "unknown permissions are not a refusal");
  assert.ok(POST_FILE_PERMISSIONS.some(([, n]) => n === "Attach Files"));
  assert.match(channelPermissionMessage(CH, ["Send Messages", "Embed Links"]), /\*\*Send Messages\*\*, \*\*Embed Links\*\* in <#700000000000000001>/);
});

test("setup kit: botRoleProblem refuses @everyone, integration roles, roles above Aegis and a missing Manage Roles", () => {
  const me = { permissions: perms(PermissionFlagsBits.ManageRoles), roles: { highest: { position: 5 } } };
  const guild = { id: G, members: { me } };
  assert.match(botRoleProblem(guild, { id: G })!, /@everyone/);
  assert.match(botRoleProblem(guild, { id: ROLE, managed: true })!, /managed by an integration/);
  assert.match(botRoleProblem(guild, { id: ROLE, position: 5 })!, /at or above Aegis's highest role/);
  assert.match(botRoleProblem(guild, { id: ROLE, editable: false })!, /at or above/);
  assert.equal(botRoleProblem(guild, { id: ROLE, position: 2, editable: true }), null);
  assert.match(botRoleProblem({ id: G, members: { me: { permissions: perms() } } }, { id: ROLE })!, /Manage Roles/);
  assert.equal(botRoleProblem({ id: G, members: {} }, { id: ROLE, position: 99 }), null, "can't tell, so no refusal");
});

test("setup kit: botChannelProblem catches hidden channels and missing permissions, and stays quiet when it can't tell", async () => {
  const hidden = { id: CH, flags: new ChannelFlagsBitField(CHANNEL_OBFUSCATED_FLAG) };
  assert.match((await botChannelProblem({ id: G, members: {} }, hidden))!, /can't see <#700000000000000001>/);
  const me = { permissions: perms() };
  const channel = { id: CH, permissionsFor: () => perms(PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages) };
  assert.match((await botChannelProblem({ id: G, members: { me } }, channel))!, /Embed Links/);
  const ok = { id: CH, permissionsFor: () => perms(PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks) };
  assert.equal(await botChannelProblem({ id: G, members: { me } }, ok), null);
  assert.equal(await botChannelProblem({ id: G, members: { me: null, fetchMe: async () => { throw new Error("x"); } } }, channel), null);
});

/* /automod */

test("/automod: current-settings line, case-insensitive word lookup, autocomplete and the words list", () => {
  const cfg = normalizeAutomodConfig(G, {
    words: { enabled: true, action: "timeout", list: ["BadWord", "zeta", "alpha`x"] },
    links: { enabled: false, action: "delete", allowedDomains: ["youtube.com", "twitch.tv"] },
    invites: { enabled: true, action: "warn", allowedCodes: ["Partner"] },
  } as never);
  assert.match(ruleSummary(cfg, "words"), /Blocked words filter:\*\* ✅ on · 3 word\(s\) · delete \+ timeout \(5 min\)/);
  assert.match(ruleSummary(cfg, "links"), /❌ off · 2 allowed domain/);
  assert.match(afterChangeLine(cfg, "spam"), /^\n> Now: \*\*Spam filter/);
  assert.match(afterChangeLine(cfg, null), /timeouts last \*\*5 minute/);
  assert.equal(findStoredWord(["BadWord"], "  badword "), "BadWord");
  assert.equal(findStoredWord(cfg.words.list, "nope"), null);
  assert.deepEqual(automodChoices(cfg, "domain", "yo").map(c => c.value), ["youtube.com"]);
  assert.deepEqual(automodChoices(cfg, "code", "").map(c => c.value), ["Partner"]);
  assert.deepEqual(automodChoices(cfg, "word", "").length, 3);
  assert.deepEqual(automodChoices(cfg, "other", ""), []);
  const lines = wordListLines(cfg.words.list);
  assert.equal(lines[0], "1. `alphaˋx`", "sorted, and a backtick cannot break the code span");
});

test("/automod: warns when Aegis can't carry out an enabled rule's action", () => {
  assert.match(actionPermissionWarning(perms(), true, "timeout", "Spam filter"), /Manage Messages\*\*, \*\*Timeout Members/);
  assert.equal(actionPermissionWarning(perms(PermissionFlagsBits.ManageMessages), true, "delete", "Spam filter"), "");
  assert.equal(actionPermissionWarning(perms(), false, "timeout", "Spam filter"), "", "a rule that is off needs nothing");
  assert.equal(actionPermissionWarning(null, true, "timeout", "Spam filter"), "");
});

test("/automod: remove/unallow options autocomplete, and words gains list and clear", () => {
  const data = json(automodData);
  assert.equal(find(data.options, "words", "remove", "word")?.autocomplete, true);
  assert.equal(find(data.options, "links", "unallow", "domain")?.autocomplete, true);
  assert.equal(find(data.options, "invites", "unallow", "code")?.autocomplete, true);
  assert.ok(find(data.options, "words", "list"));
  assert.ok(find(data.options, "words", "clear"));
  assert.notEqual(find(data.options, "words", "add", "word")?.autocomplete, true, "adding a word is free text");
});

test("/automod autocomplete offers nothing to members without Manage Server", async () => {
  const { command } = await import("../src/commands/automod/automod");
  const calls: unknown[] = [];
  await command.autocomplete!({
    guildId: G, memberPermissions: perms(),
    options: { getFocused: () => ({ name: "word", value: "" }) },
    respond: async (c: unknown) => { calls.push(c); },
  } as never);
  assert.deepEqual(calls, [[]]);
});

/* /logging */

test("/logging: categories, the status card and why a test entry wasn't posted", () => {
  const cats = fullCategoryMap({ voiceEvents: true, modActions: false });
  assert.equal(Object.keys(cats).length, 8);
  assert.equal(cats.voiceEvents, true);
  assert.equal(cats.modActions, false);
  assert.equal(cats.memberJoins, true, "defaults filled in");
  assert.equal(isLogCategoryKey("roleChanges"), true);
  assert.equal(isLogCategoryKey("$where"), false);

  const off = { loggingEnabled: false, loggingChannelId: null, logCategories: null, logChannels: null };
  assert.match(testFailureReason(off), /No logging channel/);
  assert.match(testFailureReason({ ...off, loggingChannelId: CH }), /switched off/);
  assert.match(testFailureReason({ ...off, loggingEnabled: true, loggingChannelId: CH, logCategories: { voiceEvents: false } }, "voiceEvents"), /Voice Activity\*\* logging is off/);
  assert.match(testFailureReason({ ...off, loggingEnabled: true, loggingChannelId: CH, logChannels: { modActions: "700000000000000002" } }, "modActions"), /<#700000000000000002>/);

  const rows = buildLoggingButtons(off, G);
  assert.ok(rows.length <= 5 && rows.every(r => r.components.length <= 5));
  const master = rows.at(-1)!.components[0].toJSON() as { disabled?: boolean };
  assert.equal(master.disabled, true, "can't switch logging on without a channel");
  const embed = buildLoggingEmbed({ ...off, loggingEnabled: true });
  assert.match(embed.data.description!, /no channel is set/);
  assert.ok((embed.data.fields ?? []).every(f => f.value.length <= 1024));
});

test("/logging: the channel picker only offers text channels, and new category/test options exist", async () => {
  const { command } = await import("../src/commands/logging/logging");
  const data = json(command.data);
  assert.deepEqual(find(data.options, "channel", "channel")?.channel_types, [ChannelType.GuildText]);
  assert.ok(find(data.options, "category", "category"));
  assert.ok(find(data.options, "test", "category"));
  const src = readFileSync(join(__dirname, "..", "src/commands/logging/logging.ts"), "utf8");
  assert.doesNotMatch(src, /updateGuildConfig\(guildId, config\)/, "never saves the whole config over dashboard changes");
});

/* /ticket */

test("/ticket: rename cleans names, panel text has Discord's limits, and creation gaps are named", () => {
  assert.equal(cleanTicketName("  Billing   Help!! "), "billing-help");
  assert.equal(cleanTicketName("--a--b--"), "a-b");
  assert.equal(cleanTicketName("🎫🎫"), "");
  assert.equal(cleanTicketName("x".repeat(150)).length, 100);
  const data = json(ticketData);
  assert.equal(find(data.options, "setup", "title")?.max_length, PANEL_TITLE_MAX);
  assert.ok(find(data.options, "close", "reason")?.max_length);
  assert.deepEqual(ticketCreationGaps(() => true), []);
  assert.deepEqual(ticketCreationGaps((bit) => bit !== PermissionFlagsBits.ManageRoles), ["Manage Roles"]);
});

test("/ticket setup refuses @everyone as the staff role before posting anything", async () => {
  const { command } = await import("../src/commands/tickets/ticket");
  const calls: { method: string; payload: unknown }[] = [];
  await command.execute({
    guild: { id: G, members: {}, channels: { cache: new Map() } },
    guildId: G,
    deferred: false, replied: false,
    memberPermissions: perms(PermissionFlagsBits.ManageChannels),
    options: {
      getSubcommand: () => "setup",
      getChannel: () => ({ id: CH }),
      getRole: () => ({ id: G, name: "@everyone" }),
      getString: () => null,
    },
    reply: async (p: unknown) => { calls.push({ method: "reply", payload: p }); },
    deferReply: async (p: unknown) => { calls.push({ method: "deferReply", payload: p }); },
  } as never);
  assert.equal(calls.length, 1);
  assert.match(String((calls[0].payload as { content: string }).content), /@everyone can't be the staff role/);
});

/* /verify */

test("/verify: warnings on the info card and the disabled view", () => {
  const roles = { cache: new Map([[ROLE, { id: ROLE, managed: false, editable: false }]]) };
  const cfg = { guildId: G, enabled: true, verifiedRoleId: ROLE, type: "button" as const, channelId: null, messageId: null, kickUnverifiedMinutes: 10 };
  const w = verificationWarnings({ roles } as never, cfg, false);
  assert.equal(w.length, 3);
  assert.match(w[0], /^⚠️ .*above my highest role/);
  assert.match(w[1], /No panel is posted/);
  assert.match(w[2], /Kick Members/);
  assert.match(buildVerificationEmbed(null).data.description!, /disabled/);
  assert.equal(buildVerificationEmbed(cfg, w).data.color, 0xFEE75C);
});

/* /welcome and /config */

test("/welcome: message limits, unknown variables, role subcommand and announcement channels", async () => {
  assert.equal(welcomeMessageProblem("   "), "❌ The welcome message can't be empty.");
  assert.match(welcomeMessageProblem("x".repeat(WELCOME_MESSAGE_MAX + 1))!, /1000 characters/);
  assert.equal(welcomeMessageProblem("Hi {user}"), null);
  assert.deepEqual(unknownVariables("Hi {user} {users} {member_count} {users}"), ["{users}"]);
  const { command } = await import("../src/commands/welcome/welcome");
  const data = json(command.data);
  assert.ok(find(data.options, "role", "role"));
  assert.deepEqual(find(data.options, "channel", "channel")?.channel_types, [ChannelType.GuildText, ChannelType.GuildAnnouncement]);
  const enable = buildWelcomeButtons({ welcomeEnabled: false, welcomeChannelId: null, welcomeMessage: "", welcomeRoleId: null }, G).components[0].toJSON() as { disabled?: boolean };
  assert.equal(enable.disabled, true, "can't enable without a channel");
});

test("/config: a module that is on without a channel is flagged", () => {
  assert.equal(moduleLine(false, CH), "❌ Disabled");
  assert.equal(moduleLine(true, CH), `✅ Enabled → <#${CH}>`);
  assert.match(moduleLine(true, null), /no channel is set/);
});

test("/preset: the card lists every setting the preset changes", () => {
  const embed = presetEmbed(PRESETS.gaming);
  const names = (embed.data.fields ?? []).map(f => f.name);
  for (const n of ["Blocked words", "Links", "Mention spam", "Message spam", "Warning escalation"]) assert.ok(names.some(x => x.includes(n)), n);
  assert.match(embed.data.footer!.text, /own blocked words are kept/);
});

/* /autoresponder and /automation */

test("/autoresponder: an ID or an exact trigger picks a responder; unknown placeholders are flagged", () => {
  const list = [
    { id: "ar-1", trigger: "hello", matchType: "contains" as const, response: "hi {user}" },
    { id: "ar-2", trigger: "hello", matchType: "exact" as const, response: "yo" },
    { id: "ar-3", trigger: "rules", matchType: "contains" as const, response: "see #rules", enabled: false },
  ];
  assert.equal(resolveResponder(list, "ar-2")?.id, "ar-2");
  assert.equal(resolveResponder(list, " RULES ")?.id, "ar-3");
  assert.equal(resolveResponder(list, "hello"), null, "ambiguous trigger");
  assert.deepEqual(unknownPlaceholders("{user} {usr} {channel} {member_count}"), ["{usr}"]);
  const lines = responderLines(list);
  assert.equal(lines.length, 3);
  assert.match(lines[2], /\*\*off\*\*/);
});

test("/automation: compound durations, the 28-day cap, the repeat floor and list lines", () => {
  assert.equal(parseDelay("10m"), 600_000);
  assert.equal(parseDelay("1h30m"), 5_400_000);
  assert.equal(parseDelay("2 days"), 172_800_000);
  assert.equal(parseDelay("29d"), null);
  assert.equal(parseDelay("soon"), null);
  assert.equal(MIN_REPEAT_MS, 60_000);
  const line = taskLine({ id: "t1", type: "scheduled", executeAt: new Date(0), intervalMs: 3_600_000, channelId: CH, creatorId: "1", payload: "hello   world" }, true, true);
  assert.match(line, /^🔁 \*\*`t1`\*\* — <t:0:R> · every 1 hour · <#700000000000000001> · by <@1>\n\*hello world\*$/);
  assert.match(taskLine({ id: "t2", type: "reminder", executeAt: new Date(0), payload: "x" }, false, false), /pending timer restore/);
});

test("/automation: channel pickers only offer text channels (the scheduler posts to text channels only)", async () => {
  const { command } = await import("../src/commands/automation/automation");
  const data = json(command.data);
  for (const sub of ["message", "repeat"]) assert.deepEqual(find(data.options, sub, "channel")?.channel_types, [ChannelType.GuildText], sub);
});

/* /rolepanel, /developer, /sync, Report Message */

test("/rolepanel: delete autocompletes panels; choices and list lines stay readable", async () => {
  const p = { id: "rp-1", title: "Colours", channelId: CH, roles: [{ roleId: ROLE, label: "Red" }], panelStyle: "dropdown" as const, mode: "exclusive" as const, requiredRoleId: "600000000000000002", createdAt: new Date(Date.now() - 3 * 86_400_000) };
  assert.equal(panelChoice(p).value, "rp-1");
  assert.match(panelChoice(p).name, /^Colours · 1 role\(s\) · 3d ago · rp-1$/);
  assert.match(panelLines([p])[0], /Dropdown · pick one · requires <@&600000000000000002>/);
  const { command } = await import("../src/commands/roles/rolepanel");
  assert.equal(find(json(command.data).options, "delete", "id")?.autocomplete, true);
  assert.equal(typeof command.autocomplete, "function");
});

test("/developer commands fits each category in a field; /sync explains what it clears", () => {
  const many = new Map([["general", Array.from({ length: 200 }, (_, i) => `\`/command${i}\``)]]);
  const [field] = commandFields(many);
  assert.ok(field.value.length <= 1024);
  assert.match(field.value, /\+\d+ more$/);
  assert.match(field.name, /General \(200\)/);
  assert.match(syncPlan(true, G).clear, /global/);
  assert.match(syncPlan(false, G).clear, new RegExp(G));
  assert.equal(syncPlan(false, null).clear, "nothing");
});

test("Report Message: own, Aegis and system messages are refused; reports carry links", () => {
  const bot = "800000000000000009";
  assert.equal(reportBlock({ author: { id: "1" } }, "1", bot), "own");
  assert.equal(reportBlock({ author: { id: bot } }, "1", bot), "bot-self");
  assert.equal(reportBlock({ author: { id: "2" }, system: true }, "1", bot), "system");
  assert.equal(reportBlock({ author: { id: "2" } }, "1", bot), null);
  assert.match(reportReply("bot-self"), /Aegis message/);
  const row = reportLinks(G, { url: "https://discord.com/channels/1/2/3", author: { id: "2" } }).toJSON() as { components: Array<{ url: string }> };
  assert.equal(row.components.length, 2);
  assert.match(row.components[1].url, /\/members\/2$/);
});

/* Backward compatibility and size */

test("every subcommand the setup commands had before is still registered", async () => {
  const expected: Record<string, string[]> = {
    "automod/automod": ["words", "links", "invites", "mentions", "spam", "duplicates", "caps", "emoji", "exempt", "timeout", "status"],
    "automation/automation": ["remind", "message", "list", "cancel", "repeat"],
    "autoresponder/autoresponder": ["add", "create", "remove", "delete", "toggle", "list"],
    "logging/logging": ["channel", "toggle", "status", "test"],
    "config/config": ["view", "overview", "logging", "welcome", "suggestions", "language", "media-safety"],
    "config/preset": ["apply", "view"],
    "roles/rolepanel": ["create", "list", "delete"],
    "tickets/ticket": ["setup", "close", "add", "remove", "claim", "transcript", "rename", "settings"],
    "verification/verify": ["setup", "autokick", "user", "batch", "info", "disable"],
    "welcome/welcome": ["status", "channel", "message", "preview", "test", "toggle"],
    "developer/developer": ["stats", "guilds", "commands"],
  };
  for (const [file, subs] of Object.entries(expected)) {
    const mod = await import(`../src/commands/${file}`);
    const names = (json(mod.command.data).options ?? []).map(o => o.name);
    for (const s of subs) assert.ok(names.includes(s), `${file}: ${s}`);
  }
  const sync = await import("../src/commands/developer/sync");
  assert.ok(find(json(sync.command.data).options, "guild_only"));
});

test("every description in the setup commands fits Discord's 100-character limit", async () => {
  const files = ["automod/automod", "automation/automation", "autoresponder/autoresponder", "logging/logging", "config/config", "config/preset", "config/diagnostics", "roles/rolepanel", "tickets/ticket", "verification/verify", "welcome/welcome", "developer/developer", "developer/sync"];
  const walk = (opts: Array<Opt & { description?: string }> | undefined, path: string) => {
    for (const o of opts ?? []) {
      assert.ok((o.description ?? "").length > 0 && (o.description ?? "").length <= 100, `${path} ${o.name}`);
      walk(o.options as never, `${path} ${o.name}`);
    }
  };
  for (const f of files) {
    const data = (await import(`../src/commands/${f}`)).command.data.toJSON() as { name: string; description: string; options?: Opt[] };
    assert.ok(data.description.length <= 100, f);
    walk(data.options as never, data.name);
  }
});

test("setup command files stay under 400 lines", () => {
  for (const f of [
    "automod/automod.ts", "automod/automod/views.ts", "automation/automation.ts", "autoresponder/autoresponder.ts", "logging/logging.ts", "logging/logging/panel.ts",
    "config/config.ts", "config/preset.ts", "config/diagnostics.ts", "config/kit/setupKit.ts", "roles/rolepanel.ts", "roles/rolepanel/manage.ts",
    "tickets/ticket.ts", "tickets/ticket/builder.ts", "tickets/ticket/manage.ts", "verification/verify.ts", "verification/verify/info.ts",
    "welcome/welcome.ts", "welcome/welcome/view.ts", "developer/developer.ts", "developer/sync.ts", "contextMenus.ts",
  ]) {
    const lines = readFileSync(join(__dirname, "..", "src/commands", f), "utf8").split("\n").length;
    assert.ok(lines < 400, `${f} has ${lines} lines`);
  }
});
