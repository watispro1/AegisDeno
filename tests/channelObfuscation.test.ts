/**
 * Discord channel obfuscation (mandatory from Nov 16, 2026): channels Aegis
 * lacks View Channel on arrive named "___hidden___" with flag 1 << 17.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ChannelFlags, ChannelFlagsBitField, ChannelType } from "discord.js";
import {
  CHANNEL_OBFUSCATED_FLAG,
  OBFUSCATED_CHANNEL_NAME,
  channelDisplayName,
  hiddenChannelMessage,
  isObfuscatedChannel,
  isSendableChannel,
  visibleChannels,
} from "../src/utils/channels";
import { discordBotView } from "../src/web/dashboard/botView";
import { parseLogging, parseStarboard, parseTicketPanel, type ValidationContext } from "../src/web/dashboard/validation";

const VISIBLE = "700000000000000001";
const HIDDEN = "700000000000000050";

test("the raw flag matches Discord's CHANNEL_OBFUSCATED bit", () => {
  assert.equal(CHANNEL_OBFUSCATED_FLAG, 1 << 17);
  assert.equal(CHANNEL_OBFUSCATED_FLAG, 131072);
  const fromTypes = (ChannelFlags as unknown as Record<string, number>).ChannelObfuscated;
  if (fromTypes !== undefined) assert.equal(fromTypes, CHANNEL_OBFUSCATED_FLAG);
});

test("isObfuscatedChannel: flag (number, bigint, bitfield) or placeholder name", () => {
  assert.ok(isObfuscatedChannel({ id: HIDDEN, name: OBFUSCATED_CHANNEL_NAME, flags: 0 }));
  assert.ok(isObfuscatedChannel({ id: HIDDEN, name: "renamed", flags: CHANNEL_OBFUSCATED_FLAG }));
  assert.ok(isObfuscatedChannel({ id: HIDDEN, flags: CHANNEL_OBFUSCATED_FLAG | 2 }));
  assert.ok(isObfuscatedChannel({ id: HIDDEN, flags: BigInt(CHANNEL_OBFUSCATED_FLAG) }));
  assert.ok(isObfuscatedChannel({ id: HIDDEN, flags: new ChannelFlagsBitField(CHANNEL_OBFUSCATED_FLAG) }));
  assert.ok(isObfuscatedChannel({ id: HIDDEN, flags: { bitfield: CHANNEL_OBFUSCATED_FLAG } }));

  assert.ok(!isObfuscatedChannel({ id: VISIBLE, name: "general", flags: 0 }));
  assert.ok(!isObfuscatedChannel({ id: VISIBLE, name: "general", flags: new ChannelFlagsBitField(2) }));
  assert.ok(!isObfuscatedChannel({ id: VISIBLE, name: "hidden", flags: null }));
  assert.ok(!isObfuscatedChannel(null));
  assert.ok(!isObfuscatedChannel(undefined));
  assert.ok(!isObfuscatedChannel("___hidden___"));
});

test("helpers: filtering, display names, the hint, and sendability", () => {
  const list = [
    { id: VISIBLE, name: "general", flags: 0 },
    { id: HIDDEN, name: OBFUSCATED_CHANNEL_NAME, flags: CHANNEL_OBFUSCATED_FLAG },
  ];
  assert.deepEqual(visibleChannels(list).map(c => c.id), [VISIBLE]);
  assert.equal(channelDisplayName(list[0]), "general");
  assert.equal(channelDisplayName(list[1]), "hidden channel");
  assert.equal(channelDisplayName({}), "unknown");
  assert.match(hiddenChannelMessage(HIDDEN), new RegExp(`<#${HIDDEN}>.*View Channel`));
  assert.match(hiddenChannelMessage(), /can't see this channel.*View Channel/);

  const send = async () => undefined;
  assert.ok(isSendableChannel({ name: "general", flags: 0, send }));
  assert.ok(!isSendableChannel({ name: OBFUSCATED_CHANNEL_NAME, flags: CHANNEL_OBFUSCATED_FLAG, send }), "never send to a hidden channel");
});

/** Minimal discord.js-shaped guild cache for the dashboard's bot view. */
function fakeClient() {
  const category = { id: "700000000000000010", type: ChannelType.GuildCategory, name: "Staff", position: 0, flags: new ChannelFlagsBitField(0) };
  const channels = new Map<string, Record<string, unknown>>([
    [VISIBLE, { id: VISIBLE, type: ChannelType.GuildText, name: "mod-log", parent: category, rawPosition: 1, flags: new ChannelFlagsBitField(0) }],
    [HIDDEN, { id: HIDDEN, type: ChannelType.GuildText, name: OBFUSCATED_CHANNEL_NAME, parent: null, rawPosition: 2, flags: new ChannelFlagsBitField(CHANNEL_OBFUSCATED_FLAG), topic: null }],
    [category.id, category],
  ]);
  const guild = { id: "800000000000000001", name: "Test", memberCount: 3, channels: { cache: channels } };
  return { guilds: { cache: new Map([[guild.id, guild]]) } } as never;
}

test("dashboard bot view: pickers leave hidden channels out and report them separately", () => {
  const view = discordBotView(fakeClient());
  const picks = view.textChannels("800000000000000001");
  assert.deepEqual(picks.map(c => c.id), [VISIBLE]);
  assert.ok(picks.every(c => c.name !== OBFUSCATED_CHANNEL_NAME));
  assert.deepEqual([...view.hiddenChannelIds("800000000000000001")], [HIDDEN]);
  assert.equal(view.hiddenChannelIds("800000000000000999").size, 0);
});

test("settings validation refuses a hidden channel with the View Channel fix", () => {
  const ctx: ValidationContext = {
    textChannelIds: new Set([VISIBLE]),
    hiddenChannelIds: new Set([HIDDEN]),
    roles: new Map(),
  };
  const logging = parseLogging({ loggingEnabled: "on", loggingChannelId: HIDDEN }, ctx);
  assert.ok(!logging.ok);
  assert.match(Object.values(logging.errors).join(" "), /can't see that log channel.*View Channel/);
  assert.ok(parseLogging({ loggingEnabled: "on", loggingChannelId: VISIBLE }, ctx).ok);
  assert.ok(!parseTicketPanel({ channelId: HIDDEN }, ctx).ok);
  const star = parseStarboard({ enabled: "on", channelId: HIDDEN, threshold: "3", emoji: "⭐" }, ctx);
  assert.ok(!star.ok);
});

test("lock never treats a hidden channel as lockable (its overwrites are placeholders)", async () => {
  const { isLockable } = await import("../src/commands/moderation/lock");
  const base = { type: ChannelType.GuildText, isThread: () => false, permissionOverwrites: { cache: new Map() } };
  assert.ok(isLockable({ ...base, id: VISIBLE, name: "general", flags: new ChannelFlagsBitField(0) } as never));
  assert.ok(!isLockable({ ...base, id: HIDDEN, name: OBFUSCATED_CHANNEL_NAME, flags: new ChannelFlagsBitField(CHANNEL_OBFUSCATED_FLAG) } as never));
});
