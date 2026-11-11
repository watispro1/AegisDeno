/**
 * Bot improvements, pass 2: graceful shutdown, client diagnostics, automod
 * burst handling, /case user filters and paging, /infractions totals, join
 * risk hints, /massban planning, batch verify, and new case indexes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createShutdown } from "../src/utils/shutdown";
import { RateLimitLogThrottle, describeRateLimit } from "../src/bot/clientDiagnostics";
import { PenaltyCooldown, SlidingWindowCounter } from "../src/services/automodRate";
import {
  CASE_USER_ACTIONS,
  caseCountLabel,
  caseUserQuery,
  describeCaseFilter,
  movePage,
  showJumpButtons,
} from "../src/services/casePaging";
import { CASE_SEARCH_ACTIONS } from "../src/commands/shared/caseSearch";
import { actionSummary, reasonLine } from "../src/commands/moderation/infractions";
import { assessJoinRisk, joinLogColor, looksGenerated, priorRecordText, roughAge } from "../src/services/joinRisk";
import { MASS_BAN_MAX, idList, parseUserIds, planMassBan, summarizeSkips } from "../src/services/massBan";
import { parseBatchIds, verifiedRoleProblem } from "../src/commands/verification/verify/members";
import { ModerationCaseModel, WarningModel } from "../src/database/mongo";
import { addModerationCases } from "../src/services/moderationCases";

const src = (f: string) => fs.readFileSync(f, "utf8");
const quietLog = () => {
  const lines: string[] = [];
  return { lines, info: (m: string) => lines.push(`info ${m}`), warn: (m: string) => lines.push(`warn ${m}`), error: (m: string) => lines.push(`error ${m}`) };
};

// ── Graceful shutdown ────────────────────────────────────────────────────────

test("shutdown: steps run in order, once, even when signalled twice", async () => {
  const order: string[] = [];
  const exits: number[] = [];
  const log = quietLog();
  const shutdown = createShutdown({
    log,
    exit: (c) => exits.push(c),
    steps: [
      { name: "a", run: () => { order.push("a"); } },
      { name: "b", run: async () => { await new Promise(r => setTimeout(r, 5)); order.push("b"); } },
      { name: "c", run: () => { order.push("c"); } },
    ],
  });
  const first = shutdown("SIGTERM");
  const second = shutdown("SIGINT");
  assert.equal(await first, "clean");
  assert.equal(await second, "clean");
  assert.deepEqual(order, ["a", "b", "c"]);
  assert.deepEqual(exits, [0], "exit is called exactly once");
  assert.ok(log.lines.some(l => l.includes("already shutting down")));
});

test("shutdown: a failing step is logged and the rest still run", async () => {
  const order: string[] = [];
  const exits: number[] = [];
  const shutdown = createShutdown({
    log: quietLog(),
    exit: (c) => exits.push(c),
    steps: [
      { name: "boom", run: () => { throw new Error("db gone"); } },
      { name: "after", run: () => { order.push("after"); } },
    ],
  });
  assert.equal(await shutdown("SIGTERM"), "errors");
  assert.deepEqual(order, ["after"]);
  assert.deepEqual(exits, [0]);
});

test("shutdown: a hung step hits the deadline and exits with code 1", async () => {
  const exits: number[] = [];
  const log = quietLog();
  const shutdown = createShutdown({
    log,
    timeoutMs: 20,
    exit: (c) => exits.push(c),
    steps: [{ name: "hang", run: () => new Promise(() => undefined) }],
  });
  assert.equal(await shutdown("SIGTERM"), "timeout");
  assert.deepEqual(exits, [1]);
  assert.ok(log.lines.some(l => l.startsWith("error") && l.includes("20ms")));
});

test("main.ts wires the shutdown helper and the non-deprecated ready event", () => {
  const s = src("src/main.ts");
  assert.match(s, /createShutdown\(/);
  assert.match(s, /shutdownGiveawayTimers\(\)/);
  assert.match(s, /client\.once\(Events\.ClientReady/);
  assert.doesNotMatch(s, /client\.once\("ready"/);
  // Discord disconnects before the database closes, so no event hits a closed pool.
  assert.ok(s.indexOf('name: "discord client"') < s.indexOf('name: "database"'));
});

// ── Client diagnostics ───────────────────────────────────────────────────────

test("rate-limit log throttle: one line per key per window, then reports the suppressed count", () => {
  const t = new RateLimitLogThrottle(1000, 3);
  assert.equal(t.shouldLog("a", 0), 0);
  assert.equal(t.shouldLog("a", 100), null);
  assert.equal(t.shouldLog("a", 200), null);
  assert.equal(t.shouldLog("b", 300), 0, "other routes are independent");
  assert.equal(t.shouldLog("a", 1500), 2, "two hits were suppressed since the last line");
  t.shouldLog("c", 1600);
  t.shouldLog("d", 1700);
  assert.ok(t.size <= 3, "bounded");
});

test("describeRateLimit names the route, retry time and suppressed hits", () => {
  const line = describeRateLimit({ global: false, method: "patch", route: "/channels/:id", retryAfter: 1234, limit: 5 }, 3);
  assert.match(line, /PATCH \/channels\/:id/);
  assert.match(line, /retry in 1\.2s/);
  assert.match(line, /3 more/);
  assert.match(describeRateLimit({ global: true, method: "get", route: "/x", retryAfter: 40, limit: 50 }), /the global limit.*40ms/);
});

test("client registers error, shard and rate-limit listeners", () => {
  assert.match(src("src/bot/client.ts"), /registerClientDiagnostics\(client\)/);
  const d = src("src/bot/clientDiagnostics.ts");
  for (const ev of ["Events.Error", "Events.ShardError", "RESTEvents.RateLimited", "RESTEvents.InvalidRequestWarning"]) assert.ok(d.includes(ev), ev);
  assert.match(src("src/bot/client.ts"), /invalidRequestWarningInterval/);
});

// ── Automod burst handling ───────────────────────────────────────────────────

test("SlidingWindowCounter counts inside the window and evicts the least recently used keys", () => {
  const c = new SlidingWindowCounter(2, 60_000);
  assert.equal(c.record("a", 1000, 0), 1);
  assert.equal(c.record("a", 1000, 500), 2);
  assert.equal(c.record("a", 1000, 1600), 1, "older hits fall out of the window");
  c.record("b", 1000, 1700);
  c.record("c", 1000, 1800);
  assert.equal(c.size, 2);
  assert.equal(c.record("a", 1000, 1900), 1, "'a' was evicted as least recently used");
});

test("SlidingWindowCounter sweeps stale keys at most once per interval", () => {
  const c = new SlidingWindowCounter(100, 1000, 5000);
  c.record("old", 1000, 0);
  c.record("x", 1000, 2000);
  assert.equal(c.size, 2, "'old' is not stale yet at t=2000");
  c.record("y", 1000, 8000);
  assert.equal(c.size, 1, "a sweep at t=8000 dropped everything older than the longest window");
});

test("PenaltyCooldown: a burst gets one penalty and one log entry; the next one reports what was folded in", () => {
  const p = new PenaltyCooldown(60_000);
  assert.deepEqual(p.decide("g:u", 0), { punish: true, log: true, suppressed: 0 });
  assert.deepEqual(p.decide("g:u", 1000), { punish: false, log: false, suppressed: 1 });
  assert.deepEqual(p.decide("g:u", 2000), { punish: false, log: false, suppressed: 2 });
  assert.deepEqual(p.decide("g:other", 2000), { punish: true, log: true, suppressed: 0 }, "other members are unaffected");
  assert.deepEqual(p.decide("g:u", 61_000), { punish: true, log: true, suppressed: 2 });
});

test("automod applies the penalty cooldown and skips re-timing-out a timed-out member", () => {
  const s = src("src/services/automodExecution.ts");
  assert.match(s, /penaltyCooldown\.decide\(`\$\{message\.guildId\}:\$\{message\.author\.id\}:\$\{triggeredRule\.action\}`\)/);
  assert.match(s, /if \(!decision\.punish\)/);
  assert.match(s, /if \(!decision\.log\) return;/);
  assert.match(s, /isCommunicationDisabled/);
  assert.doesNotMatch(s, /spamTracker/);
});

// ── /case user ───────────────────────────────────────────────────────────────

test("movePage jumps to the ends and clamps", () => {
  assert.equal(movePage(3, "first", 40), 0);
  assert.equal(movePage(0, "last", 40), 7);
  assert.equal(movePage(7, "next", 40), 7);
  assert.equal(movePage(0, "prev", 40), 0);
  assert.equal(movePage(2, "next", 40), 3);
  assert.equal(movePage(0, "last", 0), 0);
  assert.equal(showJumpButtons(2), false);
  assert.equal(showJumpButtons(3), true);
});

test("caseUserQuery adds the action and revoked filters only when set", () => {
  assert.deepEqual(caseUserQuery("g", "u"), { guildId: "g", userId: "u" });
  assert.deepEqual(caseUserQuery("g", "u", { action: "ban", hideRevoked: true }), { guildId: "g", userId: "u", action: "ban", revoked: { $ne: true } });
  assert.equal(describeCaseFilter({ action: "kick", hideRevoked: true }), "action: kick · revoked hidden");
  assert.equal(describeCaseFilter({}), "");
  assert.equal(caseCountLabel(12, 12), "12");
  assert.equal(caseCountLabel(100, 240), "showing 100 of 240");
  for (const a of CASE_USER_ACTIONS) assert.ok((CASE_SEARCH_ACTIONS as readonly string[]).includes(a), a);
});

test("/case user lives in case/user.ts, defers, counts the true total and offers filters", () => {
  const s = src("src/commands/moderation/case/user.ts");
  assert.match(s, /deferReply\(/);
  assert.match(s, /countDocuments\(query\)/);
  assert.match(s, /guardCollect\("case"/);
  const c = src("src/commands/moderation/case.ts");
  assert.match(c, /setName\("hide_revoked"\)/);
  assert.match(c, /runCaseUser\(interaction\)/);
  // Long reasons and details can no longer break the /case view embed.
  assert.match(c, /clip\(record\.details, 1024\)/);
});

// ── /infractions ─────────────────────────────────────────────────────────────

test("reasonLine collapses whitespace, defuses backticks and clips", () => {
  assert.equal(reasonLine("a\n\n b   c"), "a b c");
  assert.equal(reasonLine("use `rm`"), "use ˋrmˋ");
  assert.equal(reasonLine(null), "No reason provided");
  assert.equal(reasonLine("x".repeat(300), 10).length, 10);
});

test("actionSummary counts live actions by frequency and revoked ones separately", () => {
  assert.equal(actionSummary([]), "None");
  assert.equal(
    actionSummary([{ action: "timeout" }, { action: "ban", revoked: true }, { action: "timeout" }, { action: "kick" }]),
    "`timeout` ×2  `kick` ×1  (1 revoked)",
  );
});

test("/infractions no longer merges warnings into the case count", () => {
  const s = src("src/commands/moderation/infractions.ts");
  assert.doesNotMatch(s, /getModerationCases\(/);
  assert.match(s, /ModerationCaseModel\.countDocuments\(\{ guildId, userId: target\.id \}\)/);
  assert.match(s, /ID: \\`\$\{String\(c\._id\)\}\\`/, "case IDs are shown in full");
});

// ── Join risk hints ──────────────────────────────────────────────────────────

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

test("roughAge and looksGenerated", () => {
  assert.equal(roughAge(5 * 60_000), "5 minutes");
  assert.equal(roughAge(3 * 3_600_000), "3 hours");
  assert.equal(roughAge(5 * DAY), "5 days");
  assert.equal(roughAge(30 * DAY), "4 weeks");
  assert.equal(looksGenerated("user48213"), true);
  assert.equal(looksGenerated("alex_2024"), true);
  assert.equal(looksGenerated("alex"), false);
  assert.equal(looksGenerated("12345678"), false, "an all-digit name is not flagged");
});

test("assessJoinRisk: an established account with an avatar raises nothing", () => {
  assert.deepEqual(assessJoinRisk({ accountCreatedAt: NOW - 400 * DAY, now: NOW, defaultAvatar: false, username: "sam" }), { level: "none", hints: [] });
});

test("assessJoinRisk: account age tiers", () => {
  const at = (age: number) => assessJoinRisk({ accountCreatedAt: NOW - age, now: NOW, defaultAvatar: false, username: "sam" });
  assert.equal(at(2 * 3_600_000).level, "high");
  assert.match(at(2 * 3_600_000).hints[0], /Brand-new account: created 2 hours ago/);
  assert.equal(at(3 * DAY).level, "low");
  const month = at(20 * DAY);
  assert.equal(month.level, "none");
  assert.match(month.hints[0], /under 30 days/);
});

test("assessJoinRisk: a returning member with a ban or kick is high, warnings only are low", () => {
  const base = { accountCreatedAt: NOW - 400 * DAY, now: NOW, defaultAvatar: false, username: "sam" };
  const banned = assessJoinRisk({ ...base, priorCases: { ban: 1, timeout: 2 } });
  assert.equal(banned.level, "high");
  assert.match(banned.hints[0], /Returning member with a record here: 1 ban, 2 timeouts/);
  const warned = assessJoinRisk({ ...base, priorWarnings: 2 });
  assert.equal(warned.level, "low");
  assert.equal(priorRecordText({ kick: 1, unban: 3 }, 1), "1 kick, 1 warning", "unrelated actions are not listed");
});

test("assessJoinRisk: several weak signals add up to a low risk", () => {
  const r = assessJoinRisk({ accountCreatedAt: NOW - 20 * DAY, now: NOW, defaultAvatar: true, username: "user99812" });
  assert.equal(r.hints.length, 3);
  assert.equal(r.level, "low");
  assert.equal(joinLogColor("none"), 0x57F287);
  assert.equal(joinLogColor("high"), 0xED4245);
});

test("the join log moved out of client.ts and skips lookups when the category is off", () => {
  assert.match(src("src/bot/client.ts"), /logMemberJoin\(client, member\)\.catch\(/);
  const s = src("src/bot/events/memberJoinLog.ts");
  assert.match(s, /isLogCategoryOn\(config\.logCategories, "memberJoins"\)/);
  assert.match(s, /"memberJoins"\);/);
});

// ── /massban ─────────────────────────────────────────────────────────────────

const A = "100000000000000001"; // moderator
const BOT = "100000000000000002";
const OWNER = "100000000000000003";
const id = (n: number) => String(200000000000000000n + BigInt(n));

test("parseUserIds accepts mentions and separators, dedupes and caps", () => {
  const p = parseUserIds(`<@${id(1)}>, ${id(2)}\n${id(1)} junk 123`);
  assert.deepEqual(p, { ids: [id(1), id(2)], overCap: 0, duplicates: 1 });
  const many = parseUserIds(Array.from({ length: MASS_BAN_MAX + 7 }, (_, i) => id(i)).join(" "));
  assert.equal(many.ids.length, MASS_BAN_MAX);
  assert.equal(many.overCap, 7);
  assert.deepEqual(parseUserIds(""), { ids: [], overCap: 0, duplicates: 0 });
});

test("planMassBan enforces self, bot, owner and hierarchy rules, and bans non-members by ID", () => {
  const plan = planMassBan([A, BOT, OWNER, id(1), id(2), id(3), id(4), id(5)], {
    actorId: A, botId: BOT, ownerId: OWNER, actorTop: 10, botTop: 8,
    memberTops: new Map([[id(1), 5], [id(2), 10], [id(3), 9]]),
    alreadyBanned: new Set([id(5)]),
  });
  assert.deepEqual(plan.ban, [id(1), id(4)]);
  assert.deepEqual(plan.skipped, [
    { id: A, reason: "self" },
    { id: BOT, reason: "bot" },
    { id: OWNER, reason: "owner" },
    { id: id(2), reason: "you_cannot" },
    { id: id(3), reason: "i_cannot" },
    { id: id(5), reason: "already_banned" },
  ]);
  assert.equal(summarizeSkips(plan.skipped), "6 skipped: 1 you, 1 Aegis itself, 1 the server owner, 1 role equal to or above yours, 1 role equal to or above mine, 1 already banned");
});

test("planMassBan: the owner outranks everyone but the bot's own position still applies", () => {
  const plan = planMassBan([id(1)], {
    actorId: OWNER, botId: BOT, ownerId: OWNER, actorTop: 0, botTop: 3,
    memberTops: new Map([[id(1), 50]]), alreadyBanned: new Set(),
  });
  assert.deepEqual(plan.skipped, [{ id: id(1), reason: "i_cannot" }]);
});

test("idList fits the limit and says how many were cut", () => {
  assert.equal(idList([]), "None");
  const ids = Array.from({ length: 60 }, (_, i) => id(i));
  const out = idList(ids, 300);
  assert.ok(out.length <= 300, String(out.length));
  assert.match(out, /… and \d+ more$/);
});

test("/massban declares permissions, a cooldown, confirmation and a re-check", () => {
  const s = src("src/commands/moderation/massban.ts");
  assert.match(s, /userPermissions: \[PermissionFlagsBits\.BanMembers\]/);
  assert.match(s, /botPermissions: \[PermissionFlagsBits\.BanMembers\]/);
  assert.match(s, /cooldownMs: 30_000/);
  assert.match(s, /requestConfirmation\(/);
  assert.match(s, /const fresh = await buildPlan\(/);
  assert.match(s, /addModerationCases\(/);
  assert.match(s, /"modActions"\)/);
});

test("addModerationCases with nothing to record makes no database call", async () => {
  assert.deepEqual(await addModerationCases([]), []);
});

// ── Batch verify ─────────────────────────────────────────────────────────────

test("parseBatchIds dedupes, caps and reports what was dropped", () => {
  const ids = Array.from({ length: 53 }, (_, i) => id(i));
  const r = parseBatchIds([...ids, ids[0]].join(","));
  assert.equal(r.ids.length, 50);
  assert.equal(r.dropped, 3);
});

test("verifiedRoleProblem explains a missing, managed or too-high role", () => {
  const guild = (role: unknown) => ({ roles: { cache: { get: () => role } } }) as never;
  assert.match(verifiedRoleProblem(guild(undefined), "1")!, /no longer exists/);
  assert.match(verifiedRoleProblem(guild({ managed: true, editable: true }), "1")!, /managed by an integration/);
  assert.match(verifiedRoleProblem(guild({ managed: false, editable: false }), "1")!, /Drag the Aegis role above it/);
  assert.equal(verifiedRoleProblem(guild({ managed: false, editable: true }), "1"), null);
});

test("batch verify fetches all members in one request", () => {
  assert.match(src("src/commands/verification/verify/members.ts"), /guild\.members\.fetch\(\{ user: ids, time: 15_000 \}\)/);
});

// ── Indexes ──────────────────────────────────────────────────────────────────

test("case and warning collections index the action and moderator filters", () => {
  const keys = (m: { schema: { indexes(): Array<[Record<string, unknown>, unknown]> } }) => m.schema.indexes().map(([k]) => JSON.stringify(k));
  const cases = keys(ModerationCaseModel as never);
  assert.ok(cases.includes(JSON.stringify({ guildId: 1, action: 1, createdAt: -1 })));
  assert.ok(cases.includes(JSON.stringify({ guildId: 1, moderatorId: 1, createdAt: -1 })));
  assert.ok(keys(WarningModel as never).includes(JSON.stringify({ guildId: 1, moderatorId: 1, createdAt: -1 })));
});
