/**
 * 3.6.2 bug fixes and command upgrades: Ghost Watch cache race and privacy
 * gate, atomic giveaway entry, /suggest setup channel types, automod and
 * edit handling, scheduler retry policy, temporary bans, friendly durations
 * and Discord-limit helpers. Discord and Mongo are faked; no network.
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { ChannelFlagsBitField, ChannelType, EmbedBuilder, PermissionFlagsBits, PermissionsBitField } from "discord.js";
import { CHANNEL_OBFUSCATED_FLAG } from "../src/utils/channels";

const GUILD = "900000000000000001";
const MOD = "900000000000000010";
const OTHER_MOD = "900000000000000011";
const TARGET = "900000000000000020";

/* ── Ghost Watch cache: changes during a sync are not lost or resurrected ── */

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

test("watchlist sync: a watch added while Mongo is being read survives the rebuild", async () => {
  const svc = await import("../src/services/watchlistService");
  await svc.syncActiveWatches(async () => []);
  const read = deferred<import("../src/services/watchlistService").WatchRow[]>();
  const sync = svc.syncActiveWatches(() => read.promise);
  // /watchlist add lands after the snapshot was taken.
  svc.updateWatchCache(GUILD, TARGET, MOD, ["message"], null);
  read.resolve([]);
  await sync;
  assert.deepEqual(svc.cachedWatches(GUILD, TARGET).map(w => w.moderatorId), [MOD]);
});

test("watchlist sync: a watch removed while Mongo is being read is not resurrected", async () => {
  const svc = await import("../src/services/watchlistService");
  await svc.syncActiveWatches(async () => [
    { guildId: GUILD, targetId: TARGET, moderatorId: MOD, events: ["message"] },
    { guildId: GUILD, targetId: TARGET, moderatorId: OTHER_MOD, events: ["join"] },
  ]);
  const read = deferred<import("../src/services/watchlistService").WatchRow[]>();
  const sync = svc.syncActiveWatches(() => read.promise);
  svc.removeWatchFromCache(GUILD, TARGET, MOD);
  // The snapshot still has both watches.
  read.resolve([
    { guildId: GUILD, targetId: TARGET, moderatorId: MOD, events: ["message"] },
    { guildId: GUILD, targetId: TARGET, moderatorId: OTHER_MOD, events: ["join"] },
  ]);
  await sync;
  assert.deepEqual(svc.cachedWatches(GUILD, TARGET).map(w => w.moderatorId), [OTHER_MOD]);
});

test("watchlist sync: concurrent syncs share one read, and a failed read keeps the cache", async () => {
  const svc = await import("../src/services/watchlistService");
  await svc.syncActiveWatches(async () => [{ guildId: GUILD, targetId: TARGET, moderatorId: MOD, events: ["message"] }]);
  let reads = 0;
  const read = deferred<import("../src/services/watchlistService").WatchRow[]>();
  const a = svc.syncActiveWatches(() => { reads++; return read.promise; });
  const b = svc.syncActiveWatches(() => { reads++; return read.promise; });
  read.resolve([{ guildId: GUILD, targetId: TARGET, moderatorId: MOD, events: ["message"] }]);
  await Promise.all([a, b]);
  assert.equal(reads, 1);
  await svc.syncActiveWatches(async () => { throw new Error("db down"); });
  assert.equal(svc.cachedWatches(GUILD, TARGET).length, 1, "kept after a failed read");
});

/* ── Ghost Watch privacy gate ─────────────────────────────────────────── */

function fakeGuild(opts: { modPerms?: bigint | null; canView?: boolean; everyoneCanView?: boolean; hidden?: boolean }) {
  const member = opts.modPerms === null ? null : { id: MOD, permissions: new PermissionsBitField(opts.modPerms ?? PermissionFlagsBits.ModerateMembers) };
  const everyone = { id: GUILD };
  const channel = {
    id: "700000000000000001",
    flags: new ChannelFlagsBitField(opts.hidden ? CHANNEL_OBFUSCATED_FLAG : 0),
    permissionsFor: (who: { id: string }) => new PermissionsBitField(
      (who.id === GUILD ? opts.everyoneCanView : opts.canView) ?? true ? PermissionFlagsBits.ViewChannel : 0n,
    ),
  };
  return {
    id: GUILD,
    roles: { everyone },
    members: { cache: new Map(member ? [[MOD, member]] : []), fetch: async () => member },
    channels: { cache: new Map([[channel.id, channel]]), fetch: async () => channel },
  };
}

test("Ghost Watch: alerts only reach a watcher who is still a moderator and can view the source channel", async () => {
  const { watcherMayReceive } = await import("../src/services/watchlistService");
  const ch = "700000000000000001";
  assert.equal(await watcherMayReceive({ guild: fakeGuild({}) as never, channelId: ch }, MOD), true);
  assert.equal(await watcherMayReceive({ guild: fakeGuild({ canView: false }) as never, channelId: ch }, MOD), false, "cannot view the channel");
  assert.equal(await watcherMayReceive({ guild: fakeGuild({ modPerms: PermissionFlagsBits.SendMessages }) as never, channelId: ch }, MOD), false, "lost Moderate Members");
  assert.equal(await watcherMayReceive({ guild: fakeGuild({ modPerms: null }) as never }, MOD), false, "left the server");
  assert.equal(await watcherMayReceive({ guild: fakeGuild({ hidden: true }) as never, channelId: ch }, MOD), false, "channel hidden from Aegis");
  assert.equal(await watcherMayReceive({ guild: fakeGuild({ canView: false }) as never }, MOD), true, "join/leave/role alerts have no channel");
});

test("Ghost Watch: alert-channel posts are redacted when the source channel is private", async () => {
  const { sourceIsPrivate, redactAlertEmbed } = await import("../src/services/watchlistService");
  const ch = "700000000000000001";
  assert.equal(sourceIsPrivate({ guild: fakeGuild({ everyoneCanView: true }) as never, channelId: ch }), false);
  assert.equal(sourceIsPrivate({ guild: fakeGuild({ everyoneCanView: false }) as never, channelId: ch }), true);
  assert.equal(sourceIsPrivate({ guild: fakeGuild({}) as never }), false);
  const embed = new EmbedBuilder().setTitle("x").addFields(
    { name: "👤 User", value: "a" }, { name: "🔗 Jump", value: "[Open](https://discord.com)" }, { name: "💬 Content", value: "secret" },
  );
  const red = redactAlertEmbed(embed).toJSON();
  const names = (red.fields ?? []).map(f => f.name);
  assert.ok(names.includes("👤 User"));
  assert.ok(!names.some(n => /Content|Jump/.test(n)));
  assert.ok(!JSON.stringify(red).includes("secret"));
  assert.equal(embed.toJSON().fields?.length, 3, "the DM copy is untouched");
});

/* ── Giveaway entry is atomic ─────────────────────────────────────────── */

test("giveaway: two simultaneous clicks enter once; the second is told it is already entered", async () => {
  const { enterGiveaway, entryFilter } = await import("../src/services/giveawayEntry");
  const doc = { guildId: GUILD, messageId: "m1", ended: false, entrants: [] as string[] };
  const store = {
    // Simulates Mongo: the match and the update happen in one step.
    async enter(filter: Record<string, unknown>) {
      await new Promise(r => setImmediate(r));
      const ne = (filter.entrants as { $ne: string }).$ne;
      if (doc.ended || doc.entrants.includes(ne)) return null;
      doc.entrants.push(ne);
      return { entrants: [...doc.entrants] };
    },
    async exists() { return !doc.ended; },
  };
  const ids = { guildId: GUILD, messageId: "m1", userId: TARGET };
  const [a, b] = await Promise.all([enterGiveaway(store, ids, false), enterGiveaway(store, ids, false)]);
  assert.deepEqual([a.outcome, b.outcome].sort(), ["already", "entered"]);
  assert.equal(doc.entrants.length, 1);
  doc.ended = true;
  assert.equal((await enterGiveaway(store, { ...ids, userId: MOD }, false)).outcome, "closed");
  assert.deepEqual(entryFilter(GUILD, "m1", TARGET), { guildId: GUILD, messageId: "m1", ended: false, entrants: { $ne: TARGET } });
});

test("giveaway: titles stay within 256 characters and message links are accepted", async () => {
  const { giveawayTitle, parseMessageRef } = await import("../src/commands/community/giveaway");
  assert.ok(giveawayTitle("🎉 GIVEAWAY ENDED", "x".repeat(256)).length <= 256);
  assert.equal(parseMessageRef("123456789012345678"), "123456789012345678");
  assert.equal(parseMessageRef(`https://discord.com/channels/${GUILD}/700000000000000001/123456789012345679`), "123456789012345679");
  assert.equal(parseMessageRef("https://evil.example/channels/1/2/3"), null);
  assert.equal(parseMessageRef("abc"), null);
});

/* ── /suggest setup accepts text channels only ────────────────────────── */

function setupInteraction(channel: Record<string, unknown>, botPerms: bigint = PermissionFlagsBits.Administrator) {
  const calls: Array<{ method: string; payload: unknown }> = [];
  const me = { id: "bot" };
  const full = { ...channel, permissionsFor: () => new PermissionsBitField(botPerms) };
  return {
    calls,
    interaction: {
      id: "int-s", guildId: GUILD, user: { id: MOD, tag: "mod#0001" },
      memberPermissions: new PermissionsBitField(PermissionFlagsBits.ManageGuild),
      guild: { id: GUILD, members: { me }, channels: { cache: new Map([[channel.id as string, full]]) } },
      options: { getSubcommand: () => "setup", getChannel: () => full },
      async reply(payload: unknown) { calls.push({ method: "reply", payload }); },
    },
  };
}

test("/suggest setup refuses voice channels, categories and forums, and channels I can't post in", async () => {
  const { command, isSuggestionChannelType } = await import("../src/commands/community/suggest");
  const configuration = await import("../src/services/configuration");
  const save = mock.method(configuration.mongoGuildConfigStore, "save", async () => { throw new Error("must not save"); });
  try {
    for (const type of [ChannelType.GuildVoice, ChannelType.GuildCategory, ChannelType.GuildForum, ChannelType.PublicThread, ChannelType.GuildStageVoice]) {
      const { interaction, calls } = setupInteraction({ id: "700000000000000002", type });
      await command.execute(interaction as never);
      assert.match(String((calls[0].payload as { content: string }).content), /text\*\* or \*\*announcement/, `type ${type}`);
    }
    const noPerms = setupInteraction({ id: "700000000000000003", type: ChannelType.GuildText }, PermissionFlagsBits.ViewChannel);
    await command.execute(noPerms.interaction as never);
    assert.match(String((noPerms.calls[0].payload as { content: string }).content), /Send Messages.*Embed Links/);
    assert.equal(save.mock.callCount(), 0);
  } finally {
    save.mock.restore();
  }
  assert.ok(isSuggestionChannelType(ChannelType.GuildText));
  assert.ok(isSuggestionChannelType(ChannelType.GuildAnnouncement));
  assert.ok(!isSuggestionChannelType(ChannelType.GuildVoice));
  const opt = (command.data.toJSON().options ?? []).find(o => o.name === "setup") as { options: Array<{ channel_types?: number[] }> };
  assert.deepEqual(opt.options[0].channel_types, [ChannelType.GuildText, ChannelType.GuildAnnouncement]);
});

/* ── Message events and automod ───────────────────────────────────────── */

test("MessageUpdate: link previews and pins are not edits; uncached old messages count as edits", async () => {
  const { isContentEdit } = await import("../src/bot/eventFilters");
  assert.equal(isContentEdit({ content: "see https://x.y" }, { content: "see https://x.y" }), false);
  assert.equal(isContentEdit({ content: "teh" }, { content: "the" }), true);
  assert.equal(isContentEdit({ partial: true, content: null }, { content: "the" }), true);
});

test("automod: staff with Administrator or Manage Server are exempt; mention spam counts roles and @everyone", async () => {
  const { isExempt, mentionCount } = await import("../src/services/automodExecution");
  const roles = { cache: { some: () => false } };
  assert.equal(isExempt({ permissions: new PermissionsBitField(PermissionFlagsBits.Administrator), roles } as never, "c", [], []), true);
  assert.equal(isExempt({ permissions: new PermissionsBitField(PermissionFlagsBits.ManageGuild), roles } as never, "c", [], []), true);
  assert.equal(isExempt({ permissions: new PermissionsBitField(PermissionFlagsBits.SendMessages), roles } as never, "c", [], []), false);
  assert.equal(isExempt(null, "c", [], ["c"]), true);
  assert.equal(mentionCount({ users: { size: 2 }, roles: { size: 3 }, everyone: true }), 6);
  assert.equal(mentionCount({ users: { size: 0 }, roles: { size: 0 }, everyone: false }), 0);
});

/* ── Scheduler and temporary bans ─────────────────────────────────────── */

test("scheduler: a recurring task that keeps failing skips a run instead of being deleted", async () => {
  const { afterTaskFailure } = await import("../src/services/timedActions");
  assert.equal(afterTaskFailure(1, 3, false), "retry");
  assert.equal(afterTaskFailure(3, 3, false), "delete");
  assert.equal(afterTaskFailure(3, 3, true), "skip-to-next");
});

test("temporary bans: payload round-trips and an unreadable one still unbans", async () => {
  const { encodeTimedUnban, decodeTimedUnban } = await import("../src/services/timedActions");
  const p = { moderatorId: MOD, moderatorTag: "mod#1", caseId: "c1", durationSeconds: 86400 };
  assert.deepEqual(decodeTimedUnban(encodeTimedUnban(p)), p);
  assert.deepEqual(decodeTimedUnban("{not json"), { moderatorId: "", moderatorTag: "Unknown", caseId: null, durationSeconds: 0 });
});

test("/ban duration: friendly lengths, permanent by default, bounded", async () => {
  const { parseBanDuration } = await import("../src/commands/moderation/ban");
  assert.deepEqual(parseBanDuration(null), { ok: true, seconds: null });
  assert.deepEqual(parseBanDuration("permanent"), { ok: true, seconds: null });
  assert.deepEqual(parseBanDuration("7d"), { ok: true, seconds: 7 * 86400 });
  assert.deepEqual(parseBanDuration("1 week 2 days"), { ok: true, seconds: 9 * 86400 });
  assert.equal(parseBanDuration("10s").ok, false);
  assert.equal(parseBanDuration("400d").ok, false);
  assert.equal(parseBanDuration("soon").ok, false);
  const json = (await import("../src/commands/moderation/ban")).command.data.toJSON();
  const names = (json.options ?? []).map(o => o.name);
  for (const legacy of ["user", "preset", "reason", "delete_messages", "silent", "proof"]) assert.ok(names.includes(legacy), legacy);
  assert.ok(names.includes("duration"));
});

test("/timeout: custom_duration overrides the choice, 1 minute to 28 days", async () => {
  const { resolveTimeoutSeconds, command } = await import("../src/commands/moderation/timeout");
  assert.deepEqual(resolveTimeoutSeconds(600, null), { ok: true, seconds: 600 });
  assert.deepEqual(resolveTimeoutSeconds(600, "1h30m"), { ok: true, seconds: 5400 });
  assert.deepEqual(resolveTimeoutSeconds(null, "28 days"), { ok: true, seconds: 28 * 86400 });
  assert.equal(resolveTimeoutSeconds(null, "29d").ok, false);
  assert.equal(resolveTimeoutSeconds(null, "30s").ok, false);
  assert.equal(resolveTimeoutSeconds(null, null).ok, false, "one of the two is needed");
  const json = command.data.toJSON();
  const duration = (json.options ?? []).find(o => o.name === "duration") as { required?: boolean };
  assert.equal(duration.required ?? false, false, "duration is optional now that custom_duration exists");
  const required = (json.options ?? []).filter(o => (o as { required?: boolean }).required);
  assert.deepEqual(required.map(o => o.name), ["user"]);
});

test("duration autocomplete explains what was typed and stays within Discord's limits", async () => {
  const { buildDurationSuggestions } = await import("../src/utils/moderationPresets");
  const presets = [{ name: "1 day", value: "1d" }, { name: "1 week", value: "7d" }];
  const ok = buildDurationSuggestions("1d12h", presets, { minSeconds: 60, maxSeconds: 86400 * 365 });
  assert.equal(ok[0].name, "1d12h → 1 day 12 hours");
  assert.equal(ok[0].value, "1d12h");
  const bad = buildDurationSuggestions("soon", presets, { minSeconds: 60, maxSeconds: 3600 });
  assert.match(bad[0].name, /isn't a duration/);
  const big = buildDurationSuggestions("9".repeat(150), presets, { minSeconds: 60, maxSeconds: 3600 });
  assert.ok(big.every(c => c.name.length <= 100 && c.value.length <= 100));
  assert.equal(buildDurationSuggestions("", presets, { minSeconds: 60, maxSeconds: 3600 }).length, 2);
});

/* ── Friendly durations and Discord limits ────────────────────────────── */

test("parseFriendlyDuration: compound and spelled-out forms, whole numbers only", async () => {
  const { parseFriendlyDuration, formatDurationLong, parseDuration } = await import("../src/utils/duration");
  assert.equal(parseFriendlyDuration("1h30m"), 5400);
  assert.equal(parseFriendlyDuration("1d 12h"), 129600);
  assert.equal(parseFriendlyDuration("90 minutes"), 5400);
  assert.equal(parseFriendlyDuration("2 days"), 172800);
  assert.equal(parseFriendlyDuration("1 week, 2 days and 3 hours"), 788400);
  assert.equal(parseFriendlyDuration("30m"), parseDuration("30m"));
  for (const bad of ["", "10", "1.5h", "-5m", "1x", "abc", "0m", "5m extra"]) assert.equal(parseFriendlyDuration(bad), null, bad);
  assert.equal(formatDurationLong(129600), "1 day 12 hours");
  assert.equal(formatDurationLong(60), "1 minute");
});

test("auditReason fits Discord's 512-character URL-encoded limit; codeBlock can't be broken out of", async () => {
  const { auditReason, codeBlock, truncate } = await import("../src/utils/safeText");
  assert.equal(auditReason("Spam | Banned by mod"), "Spam | Banned by mod");
  assert.equal(auditReason(""), "No reason provided");
  for (const long of ["x".repeat(900), "é".repeat(400), "😀".repeat(300)]) {
    const r = auditReason(long);
    assert.ok(encodeURIComponent(r).length <= 512, `${long[0]} fits`);
    assert.ok(r.endsWith("…"));
  }
  const block = codeBlock("a```b" + "c".repeat(2000), 1024);
  assert.ok(block.length <= 1024);
  assert.equal(block.match(/```/g)?.length, 2, "only the fences remain");
  assert.equal(truncate("hello", 3), "he…");
});
