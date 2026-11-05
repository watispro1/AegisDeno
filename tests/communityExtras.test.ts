import { test } from "node:test";
import assert from "node:assert/strict";
import { PermissionFlagsBits } from "discord.js";
import { avatarLinkLine, colorHex, notablePermissions, roleMemberCount, slowmodeLabel } from "../src/services/lookupFormat";
import { describeStay, ordinal, renderTemplate } from "../src/services/templateText";
import { greetingSettings, greetingTestBlock, testValues } from "../src/services/welcomeTest";
import { bonusExtra, pickWeightedWinners, totalTickets } from "../src/services/communityLogic";
import { notifyWinners, type NotifyClient } from "../src/services/giveawayNotify";

test("lookup helpers: avatar links, colours, slowmode, permissions, member counts", () => {
  assert.equal(avatarLinkLine(ext => `u.${ext}`, false), "[PNG](u.png) · [WEBP](u.webp) · [JPG](u.jpg)");
  assert.match(avatarLinkLine(ext => `u.${ext}`, true), /^\[GIF\]/);
  assert.equal(colorHex(0), "Default");
  assert.equal(colorHex(0xff00aa), "#FF00AA");
  assert.equal(slowmodeLabel(0), "Off");
  assert.equal(slowmodeLabel(5400), "1 hour 30 minutes");
  assert.deepEqual(notablePermissions(PermissionFlagsBits.Administrator | PermissionFlagsBits.BanMembers), ["Administrator (every permission)"]);
  assert.deepEqual(notablePermissions(PermissionFlagsBits.BanMembers | PermissionFlagsBits.KickMembers), ["Ban Members", "Kick Members"]);
  assert.equal(roleMemberCount(3, true, 1200), "1,200");
  assert.match(roleMemberCount(3, false, 1200), /^3 \(/);
});

test("template: ordinals, time in server, one-pass replacement", () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 112, 1204].map(n => ordinal(n)), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "112th", "1,204th"]);
  assert.equal(ordinal("abc"), "abc");
  const now = Date.UTC(2026, 10, 4);
  assert.equal(describeStay(now - 3 * 43_200 * 60_000, now), "3 months");
  assert.equal(describeStay(now - 30_000, now), "under a minute");
  assert.equal(describeStay(null, now), null);
  assert.equal(describeStay(now + 1000, now), null);
  const v = { user: "<@1>", username: "{server}", server: "Aegis", memberCount: 22 };
  assert.equal(renderTemplate("Hi {username}, you're our {memberOrdinal} ({member_ordinal}) member of {server}", v), "Hi {server}, you're our 22nd (22nd) member of Aegis");
  assert.equal(renderTemplate("Stayed {timeInServer}", v), "Stayed a while");
  assert.equal(renderTemplate("Stayed {timeInServer}", { ...v, timeInServer: "2 days" }), "Stayed 2 days");
});

test("welcome test: blocks a missing channel or empty message, goodbyes never ping", () => {
  const s = greetingSettings({ goodbyeEnabled: true, goodbyeChannelId: "123", goodbyeMessage: "  " }, "goodbye");
  assert.match(greetingTestBlock(s, "goodbye")!, /empty/);
  assert.match(greetingTestBlock(greetingSettings({}, "welcome"), "welcome")!, /No welcome channel/);
  assert.equal(greetingTestBlock(greetingSettings({ welcomeChannelId: "1", welcomeMessage: "hi" }, "welcome"), "welcome"), null);
  const member = { id: "9", joinedTimestamp: Date.UTC(2026, 9, 1), user: { username: "mod" }, guild: { name: "G", memberCount: 5 } };
  assert.equal(testValues(member, "welcome").user, "<@9>");
  assert.equal(testValues(member, "goodbye").user, "mod");
});

test("giveaway bonus entries stack with the booster bonus and stay within bounds", () => {
  assert.equal(bonusExtra("a", new Set(["a"]), 2), 1);
  assert.equal(bonusExtra("b", new Set(["a"]), 5), 0);
  assert.equal(totalTickets("a", { boosterIds: ["a"], multiplier: 3, bonusIds: ["a"], bonusEntries: 2 }), 4);
  assert.equal(totalTickets("c", { bonusIds: ["a"], bonusEntries: 10 }), 1);
  // With "a" holding 4 tickets and "b" 1, a draw landing on ticket index 3 still picks "a".
  const winners = pickWeightedWinners(["a", "b"], 1, { boosterIds: ["a"], multiplier: 3, bonusIds: ["a"], bonusEntries: 2, rand: () => 3 });
  assert.deepEqual(winners, ["a"]);
  assert.equal(pickWeightedWinners(["a", "b"], 2, { bonusIds: ["a"], bonusEntries: 3 }).length, 2);
});

test("winner DMs go out whatever happened to the channel, and closed DMs are counted as undelivered", async () => {
  const sent: string[] = [];
  const user = (id: string, open: boolean) => ({ send: async () => { if (!open) throw new Error("closed"); sent.push(id); } });
  const client: NotifyClient = {
    users: {
      cache: { get: (id) => (id === "1" ? user("1", true) : undefined) },
      fetch: async (id) => { if (id === "gone") throw new Error("unknown"); return user(id, id !== "closed"); },
    },
    guilds: { cache: { get: () => undefined } },
  };
  const g = { guildId: "g", channelId: "deleted-channel", messageId: "m", prize: "Nitro", hostId: "h" };
  const delivered = await notifyWinners(client, g, ["1", "2", "closed", "gone"], "won");
  assert.equal(delivered, 2);
  assert.deepEqual(sent, ["1", "2"]);
});

test("welcome test asks for Embed Links only when the message has an embed", async () => {
  const { greetingTestPermissions } = await import("../src/services/welcomeTest");
  assert.deepEqual(greetingTestPermissions(false).map(([, name]) => name), ["View Channel", "Send Messages"]);
  assert.deepEqual(greetingTestPermissions(true).map(([, name]) => name), ["View Channel", "Send Messages", "Embed Links"]);
});

test("/giveaway list stays under Discord's 2000-character message limit", async () => {
  const { activeGiveawayListContent } = await import("../src/services/giveawayEntry");
  const line = (i: number) => `**${i}.** 🏆 **${"P".repeat(80)}** — 1 winner(s) — 12345 entries — <@&123456789012345678> 10× — ends <t:1800000000:R> — [Jump](https://discord.com/channels/123456789012345678/123456789012345678/123456789012345678)`;
  const lines = Array.from({ length: 10 }, (_, i) => line(i + 1));
  const text = activeGiveawayListContent(lines);
  assert.ok(text.length <= 2000, `length ${text.length}`);
  assert.match(text, /^🎉 \*\*Active Giveaways \(10\):\*\*/);
  assert.match(text, /…and \d+ more/);
  assert.equal(activeGiveawayListContent(["a", "b"]), "🎉 **Active Giveaways (2):**\n\na\nb");
});

test("giveaway autocomplete offers running giveaways for end and cancel, and only rerollable ones for reroll", async () => {
  const { giveawayPickerFilter } = await import("../src/services/giveawayEntry");
  assert.deepEqual(giveawayPickerFilter("g1", "end"), { guildId: "g1", ended: false });
  assert.deepEqual(giveawayPickerFilter("g1", "cancel"), { guildId: "g1", ended: false });
  assert.deepEqual(giveawayPickerFilter("g1", "reroll"), { guildId: "g1", ended: true, cancelled: { $ne: true } });
});
