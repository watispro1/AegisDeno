import { test } from "node:test";
import assert from "node:assert/strict";
import { PermissionFlagsBits } from "discord.js";
import { canManageGuild, guildInviteUrl, partitionGuilds, type OAuthGuild } from "../src/web/dashboard/permissions";
import {
  fieldValues,
  isStarboardEmoji,
  parseAppealFilter,
  parseAppealReview,
  parseRevoke,
  parseTicketPanel,
  parseVerificationPanel,
  parseWordList,
  parseAutomod,
  parseCaseFilter,
  parseCaseReason,
  parseEscalation,
  parseLogging,
  parseStarboard,
  parseTickets,
  parseVerification,
  parseWelcome,
  welcomePreview,
  type ValidationContext,
} from "../src/web/dashboard/validation";

const CH = "111111111111111111";
const CH2 = "222222222222222222";
const ROLE = "333333333333333333";
const HIGH_ROLE = "444444444444444444";

const ctx: ValidationContext = {
  textChannelIds: new Set([CH, CH2]),
  roles: new Map([[ROLE, { assignable: true }], [HIGH_ROLE, { assignable: false }]]),
};

/* ── Permissions ─────────────────────────────────────────────────── */

test("canManageGuild accepts Manage Server, Administrator and owners only", () => {
  assert.ok(canManageGuild(PermissionFlagsBits.ManageGuild.toString()));
  assert.ok(canManageGuild(PermissionFlagsBits.Administrator.toString()));
  assert.ok(canManageGuild((PermissionFlagsBits.ManageGuild | PermissionFlagsBits.SendMessages).toString()));
  assert.ok(canManageGuild(PermissionFlagsBits.ManageGuild));
  assert.ok(canManageGuild("0", true), "owner");
  assert.ok(!canManageGuild((PermissionFlagsBits.ModerateMembers | PermissionFlagsBits.BanMembers | PermissionFlagsBits.ManageChannels).toString()));
  assert.ok(!canManageGuild("0"));
  assert.ok(!canManageGuild("not a number"));
  assert.ok(!canManageGuild("-32"));
  assert.ok(!canManageGuild(undefined));
  assert.ok(!canManageGuild(1.5));
});

test("partitionGuilds splits manageable servers by whether the bot is in them", () => {
  const g = (id: string, name: string, permissions: string, owner = false): OAuthGuild => ({ id, name, icon: null, owner, permissions });
  const guilds = [
    g("100000000000000001", "Zeta", PermissionFlagsBits.ManageGuild.toString()),
    g("100000000000000002", "Alpha", PermissionFlagsBits.Administrator.toString()),
    g("100000000000000003", "Member only", PermissionFlagsBits.SendMessages.toString()),
    g("100000000000000004", "Owned", "0", true),
    g("bad", "Bad id", PermissionFlagsBits.Administrator.toString()),
  ];
  const inBot = new Set(["100000000000000001", "100000000000000002", "100000000000000003"]);
  const { manageable, invitable } = partitionGuilds(guilds, id => inBot.has(id));
  assert.deepEqual(manageable.map(x => x.name), ["Alpha", "Zeta"]);
  assert.deepEqual(invitable.map(x => x.name), ["Owned"]);
});

test("guildInviteUrl preselects the server", () => {
  const url = guildInviteUrl("https://discord.com/oauth2/authorize?client_id=1&scope=bot", "100000000000000001");
  assert.ok(url?.includes("guild_id=100000000000000001"));
  assert.ok(url?.includes("disable_guild_select=true"));
  assert.equal(guildInviteUrl("#", "1"), null);
  assert.equal(guildInviteUrl("", "1"), null);
});

/* ── Settings ────────────────────────────────────────────────────── */

test("logging requires a visible channel when enabled", () => {
  const ok = parseLogging({ loggingEnabled: "on", loggingChannelId: CH, cat_modActions: "on" }, ctx);
  assert.ok(ok.ok);
  assert.equal(ok.value.loggingChannelId, CH);
  assert.equal(ok.value.logCategories.modActions, true);
  assert.equal(ok.value.logCategories.messageDeletes, false);

  const missing = parseLogging({ loggingEnabled: "on" }, ctx);
  assert.ok(!missing.ok && missing.errors.loggingChannelId);
  const unknown = parseLogging({ loggingEnabled: "on", loggingChannelId: "999999999999999999" }, ctx);
  assert.ok(!unknown.ok && unknown.errors.loggingChannelId);
  const off = parseLogging({}, ctx);
  assert.ok(off.ok && off.value.loggingEnabled === false && off.value.loggingChannelId === null);
});

test("escalation validates steps, durations and duplicates", () => {
  const ok = parseEscalation({
    enabled: "on", warnExpiryDays: "30",
    t_at_0: "5", t_action_0: "ban",
    t_at_1: "3", t_action_1: "timeout", t_duration_1: "60",
    t_at_2: "", t_action_2: "none",
  });
  assert.ok(ok.ok);
  assert.deepEqual(ok.value.thresholds, [
    { atWarnings: 3, action: "timeout", durationMinutes: 60 },
    { atWarnings: 5, action: "ban" },
  ]);
  assert.equal(ok.value.warnExpiryDays, 30);

  const never = parseEscalation({ warnExpiryDays: "0" });
  assert.ok(never.ok && never.value.warnExpiryDays === null && never.value.enabled === false);

  const dup = parseEscalation({ t_at_0: "3", t_action_0: "kick", t_at_1: "3", t_action_1: "ban" });
  assert.ok(!dup.ok && dup.errors.t_at_1);
  const noDuration = parseEscalation({ t_at_0: "3", t_action_0: "timeout" });
  assert.ok(!noDuration.ok && noDuration.errors.t_duration_0);
  const badAction = parseEscalation({ t_at_0: "3", t_action_0: "explode" });
  assert.ok(!badAction.ok && badAction.errors.t_action_0);
  const tooMany = parseEscalation({ t_at_0: "101", t_action_0: "kick" });
  assert.ok(!tooMany.ok && tooMany.errors.t_at_0);
  const longTimeout = parseEscalation({ t_at_0: "2", t_action_0: "timeout", t_duration_0: "40321" });
  assert.ok(!longTimeout.ok && longTimeout.errors.t_duration_0);
  const expiry = parseEscalation({ warnExpiryDays: "366" });
  assert.ok(!expiry.ok && expiry.errors.warnExpiryDays);
  const emptyOn = parseEscalation({ enabled: "on" });
  assert.ok(!emptyOn.ok && emptyOn.errors.enabled);
  const notInt = parseEscalation({ t_at_0: "2.5", t_action_0: "kick" });
  assert.ok(!notInt.ok);
});

test("automod enforces the same ranges as the slash command", () => {
  const body = {
    words_enabled: "on", words_action: "delete",
    links_action: "warn",
    mentions_action: "timeout", mentions_threshold: "5",
    spam_enabled: "on", spam_action: "timeout", spam_maxMessages: "5", spam_windowSeconds: "5",
    caps_action: "delete", caps_threshold: "80",
  };
  const ok = parseAutomod(body, ctx);
  assert.ok(ok.ok);
  assert.equal(ok.value.words.enabled, true);
  assert.equal(ok.value.links.enabled, false);
  assert.equal(ok.value.spam.maxMessages, 5);

  for (const [key, value] of [["mentions_threshold", "1"], ["spam_maxMessages", "31"], ["spam_windowSeconds", "61"], ["caps_threshold", "49"], ["links_action", "ban"]]) {
    const r = parseAutomod({ ...body, [key]: value }, ctx);
    assert.ok(!r.ok && r.errors[key], key);
  }
});

test("welcome checks channel, length and role", () => {
  const ok = parseWelcome({ welcomeEnabled: "on", welcomeChannelId: CH, welcomeMessage: "  Hi {user}\r\nwelcome  ", welcomeRoleId: ROLE }, ctx);
  assert.ok(ok.ok);
  assert.equal(ok.value.welcomeMessage, "Hi {user}\nwelcome");
  assert.equal(ok.value.welcomeRoleId, ROLE);

  const long = parseWelcome({ welcomeMessage: "x".repeat(1001) }, ctx);
  assert.ok(!long.ok && long.errors.welcomeMessage);
  const empty = parseWelcome({ welcomeMessage: "   " }, ctx);
  assert.ok(!empty.ok && empty.errors.welcomeMessage);
  const high = parseWelcome({ welcomeMessage: "hi", welcomeRoleId: HIGH_ROLE }, ctx);
  assert.ok(!high.ok && high.errors.welcomeRoleId);
  const noChannel = parseWelcome({ welcomeEnabled: "on", welcomeMessage: "hi" }, ctx);
  assert.ok(!noChannel.ok && noChannel.errors.welcomeChannelId);
});

test("welcome preview fills placeholders once and shows mentions as plain names", () => {
  const out = welcomePreview("Hi {user} ({username}) to {server}, #{count} / {member_count} {unknown}", {
    username: "aj", serverName: "{user} club", memberCount: 42,
  });
  assert.equal(out, "Hi @aj (aj) to {user} club, #42 / 42 {unknown}");
});

test("tickets, verification and starboard ranges", () => {
  assert.ok(parseTickets({ autoCloseHours: "48", transcriptLogging: "on", logChannelId: CH2 }, ctx).ok);
  assert.ok(!parseTickets({ autoCloseHours: "721" }, ctx).ok);
  assert.ok(!parseTickets({ autoCloseHours: "-1" }, ctx).ok);

  const v = parseVerification({ enabled: "on", verifiedRoleId: ROLE, type: "captcha", kickUnverifiedMinutes: "30" }, ctx);
  assert.ok(v.ok && v.value.type === "captcha" && v.value.kickUnverifiedMinutes === 30);
  assert.ok(!parseVerification({ verifiedRoleId: ROLE, type: "magic", kickUnverifiedMinutes: "0" }, ctx).ok);
  assert.ok(!parseVerification({ type: "button", kickUnverifiedMinutes: "0" }, ctx).ok, "role required");
  assert.ok(!parseVerification({ verifiedRoleId: ROLE, type: "button", kickUnverifiedMinutes: "10081" }, ctx).ok);

  const s = parseStarboard({ enabled: "on", channelId: CH, threshold: "3", selfStar: "on" }, ctx);
  assert.ok(s.ok && s.value.selfStar === true && s.value.threshold === 3);
  assert.ok(!parseStarboard({ enabled: "on", threshold: "3" }, ctx).ok, "channel required when on");
  assert.ok(!parseStarboard({ threshold: "0" }, ctx).ok);
});

test("case reason and filters", () => {
  assert.deepEqual(parseCaseReason({ reason: "  spam  " }), { ok: true, value: "spam" });
  assert.ok(!parseCaseReason({ reason: "" }).ok);
  assert.ok(!parseCaseReason({ reason: "x".repeat(513) }).ok);
  assert.ok(!parseCaseReason({ reason: ["a", ""] }).ok, "last repeated value wins");

  assert.deepEqual(parseCaseFilter({ type: "ban", user: "<@!123456789012345678>", moderator: "nope", page: "3" }), {
    type: "ban", userId: "123456789012345678", moderatorId: null, query: null, page: 3,
  });
  assert.deepEqual(parseCaseFilter({ type: "$where", page: "-1" }), { type: null, userId: null, moderatorId: null, query: null, page: 1 });
  assert.equal(parseCaseFilter({ q: "  free   nitro " }).query, "free nitro");
  assert.equal(parseCaseFilter({ q: "x".repeat(300) }).query?.length, 100);
  assert.equal(parseCaseFilter({ page: ["2", "9"] }).page, 2);
});

/* ── v1.2.0 forms ────────────────────────────────────────────────── */

test("word list: one per line, lower-cased, de-duplicated, same length rules as /automod words add", () => {
  assert.deepEqual(parseWordList("Spam\r\n  free nitro \n\nspam\nSPAM"), { list: ["spam", "free nitro"], error: null });
  assert.match(parseWordList("ok\nx").error ?? "", /2 to 100/);
  assert.match(parseWordList("y".repeat(101)).error ?? "", /2 to 100/);
  assert.match(parseWordList(Array.from({ length: 501 }, (_, i) => `word${i}`).join("\n")).error ?? "", /500 words/);
  assert.deepEqual(parseWordList("a, b, c"), { list: ["a, b, c"], error: null }, "commas are part of a phrase");
});

test("automod exemptions accept visible IDs and previously saved ones only", () => {
  const body = {
    words_action: "delete", links_action: "delete", mentions_action: "delete", mentions_threshold: "5",
    spam_action: "delete", spam_maxMessages: "5", spam_windowSeconds: "5", caps_action: "delete", caps_threshold: "80",
  };
  const ok = parseAutomod({ ...body, exempt_roles: [HIGH_ROLE, HIGH_ROLE], exempt_channels: ["999999999999999999", CH] }, ctx, { exemptRoleIds: [], exemptChannelIds: ["999999999999999999"] });
  assert.ok(ok.ok);
  assert.deepEqual(ok.value.exemptRoleIds, [HIGH_ROLE], "any role, de-duplicated");
  assert.deepEqual(ok.value.exemptChannelIds, ["999999999999999999", CH]);
  const unknown = parseAutomod({ ...body, exempt_channels: "999999999999999999" }, ctx);
  assert.ok(!unknown.ok && unknown.errors.exempt_channels);
  const notId = parseAutomod({ ...body, exempt_roles: "@everyone" }, ctx);
  assert.ok(!notId.ok && notId.errors.exempt_roles);
  assert.deepEqual(fieldValues({ a: ["1", " ", 3, "2"] }, "a"), ["1", "2"]);
});

test("starboard emoji: one Unicode emoji or a custom emoji", () => {
  for (const e of ["⭐", "🌟", "❤️", "👍🏽", "🇺🇸", "<:aegis:123456789012345678>", "<a:spin:123456789012345678>"]) assert.ok(isStarboardEmoji(e), e);
  for (const e of ["", "star", ":star:", "⭐ ⭐", "<script>", "<:x:1>", "a⭐"]) assert.ok(!isStarboardEmoji(e), e);
  // The whole value must be one emoji sequence (Codex review on PR #12).
  for (const e of ["⭐1", "⭐⭐", "🌟x", "❤️!", "👍🏽👍", "1", "#", "<:aegis:123456789012345678>x", "⭐\u200b"]) assert.ok(!isStarboardEmoji(e), e);
  for (const e of ["1️⃣", "#️⃣", "👨‍👩‍👧‍👦", "🏳️‍🌈", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "🧑🏽‍💻"]) assert.ok(isStarboardEmoji(e), e);
  const s = parseStarboard({ threshold: "3", emoji: "", ignoredChannels: CH2, ignoredRoles: [ROLE, HIGH_ROLE] }, ctx);
  assert.ok(s.ok && s.value.emoji === "⭐", "blank emoji falls back to the default");
  assert.ok(s.ok && s.value.ignoredRoles.length === 2);
  assert.ok(!parseStarboard({ threshold: "3", emoji: "nope" }, ctx).ok);
});

test("panel forms: channel required, staff role may be any role, verified role must be assignable", () => {
  const t = parseTicketPanel({ channelId: CH, staffRoleId: HIGH_ROLE, title: "  Help  ", description: "" }, ctx);
  assert.deepEqual(t, { ok: true, value: { channelId: CH, staffRoleId: HIGH_ROLE, title: "Help", description: null } });
  assert.ok(!parseTicketPanel({ channelId: "" }, ctx).ok);
  assert.ok(!parseTicketPanel({ channelId: "555555555555555555" }, ctx).ok);
  assert.ok(!parseTicketPanel({ channelId: CH, description: "d".repeat(2001) }, ctx).ok);

  const v = parseVerificationPanel({ channelId: CH, verifiedRoleId: ROLE, type: "button", kickUnverifiedMinutes: "" }, ctx);
  assert.ok(v.ok && v.value.kickUnverifiedMinutes === 0 && v.value.title === null);
  assert.ok(!parseVerificationPanel({ channelId: CH, verifiedRoleId: HIGH_ROLE, type: "button" }, ctx).ok);
  assert.ok(!parseVerificationPanel({ channelId: CH, verifiedRoleId: ROLE, type: "both" }, ctx).ok);
  assert.ok(!parseVerificationPanel({ channelId: CH, verifiedRoleId: ROLE, type: "button", title: "t".repeat(101) }, ctx).ok);
});

test("appeal filter and review forms", () => {
  assert.deepEqual(parseAppealFilter({}), { status: "pending", page: 1 });
  assert.deepEqual(parseAppealFilter({ status: "all", page: "2" }), { status: "all", page: 2 });
  assert.deepEqual(parseAppealFilter({ status: { $ne: 1 }, page: "0" }), { status: "pending", page: 1 });
  assert.deepEqual(parseAppealReview({ decision: "denied", note: "  no  " }), { ok: true, value: { decision: "denied", note: "no" } });
  assert.deepEqual(parseAppealReview({ decision: "approved" }), { ok: true, value: { decision: "approved", note: null } });
  assert.ok(!parseAppealReview({ decision: "maybe" }).ok);
  assert.ok(!parseAppealReview({ decision: "denied", note: "n".repeat(513) }).ok);
  assert.deepEqual(parseRevoke({ unban: "on" }), { unban: true });
  assert.deepEqual(parseRevoke({}), { unban: false });
});
