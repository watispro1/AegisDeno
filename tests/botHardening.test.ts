/** Crash handling, scheduler restore policy, env validation, JSON logs, automod eviction, deferrals. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ChannelType } from "discord.js";
import {
  envProblems, validateEnv, EnvValidationError, parseOwnerIds, DEFAULT_BOT_OWNER_ID, loadDotenv, stripeSalesEnabled,
} from "../src/config/env";
import { formatJsonLine, resolveLogFormat, resolveLogLevel, setupLogger, loggerSettings } from "../src/utils/logger";
import { createFatalHandler, effectiveExitCode } from "../src/utils/fatal";
import {
  loadPendingTasks, formatCounts, planRestore, MUST_RUN_TYPES, ALL_TASK_TYPES, type PendingTaskSource, type ScheduledTask, type TaskType,
} from "../src/services/scheduler";
import { DuplicateTracker } from "../src/services/automodChecks";
import { PenaltyCooldown, SlidingWindowCounter } from "../src/services/automodRate";
import { isGuildPostChannel } from "../src/utils/channels";
import { withinDeadline } from "../src/utils/deadline";

const read = (f: string) => fs.readFileSync(f, "utf8");

// ── Environment ──────────────────────────────────────────────────────────────

const BASE = {
  DISCORD_TOKEN: "token-value",
  DISCORD_APPLICATION_ID: "123456789012345678",
  MONGO_URI: "mongodb+srv://u:p@cluster/db",
  BOT_ENV: "development",
};

test("env: a minimal development env is valid", () => {
  assert.deepEqual(envProblems(BASE), []);
  const env = validateEnv(BASE);
  assert.equal(env.DISCORD_APPLICATION_ID, BASE.DISCORD_APPLICATION_ID);
  assert.equal(env.dashboardEnabled, false);
  assert.equal(env.stripeSalesEnabled, false);
});

test("env: every missing or invalid variable is reported in one error", () => {
  const bad = { DISCORD_APPLICATION_ID: "nope", MONGO_URI: "postgres://x", PORT: "99999", LOG_FORMAT: "xml", BOT_ENV: "production" };
  let err: unknown;
  try { validateEnv(bad); } catch (e) { err = e; }
  assert.ok(err instanceof EnvValidationError);
  const names = (err as EnvValidationError).problems.map(p => p.split(" ")[0]);
  for (const n of ["DISCORD_TOKEN", "DISCORD_APPLICATION_ID", "MONGO_URI", "AEGIS_BACKEND_SECRET", "PORT", "LOG_FORMAT"]) assert.ok(names.includes(n), n);
  assert.match((err as Error).message, /6 problems/);
  // Never echoes values.
  assert.doesNotMatch((err as Error).message, /postgres:\/\/x|99999/);
});

test("env: AEGIS_BACKEND_SECRET is required only outside development/test", () => {
  assert.deepEqual(envProblems({ ...BASE, BOT_ENV: "test" }), []);
  assert.ok(envProblems({ ...BASE, BOT_ENV: "production" }).some(p => p.startsWith("AEGIS_BACKEND_SECRET")));
  assert.deepEqual(envProblems({ ...BASE, BOT_ENV: "production", AEGIS_BACKEND_SECRET: "s".repeat(32) }), []);
});

test("env: the dashboard session secret is required once the dashboard client secret is set", () => {
  assert.ok(envProblems({ ...BASE, DISCORD_CLIENT_SECRET: "cs" }).some(p => p.startsWith("DASHBOARD_SESSION_SECRET (missing")));
  assert.ok(envProblems({ ...BASE, DISCORD_CLIENT_SECRET: "cs", DASHBOARD_SESSION_SECRET: "short" }).some(p => p.includes("at least 32")));
  assert.deepEqual(envProblems({ ...BASE, DISCORD_CLIENT_SECRET: "cs", DASHBOARD_SESSION_SECRET: "x".repeat(32) }), []);
});

test("env: leftover Stripe secrets never block startup while web checkout is off", () => {
  // Web checkout is off in code, so stray STRIPE_* values (kept for earlier subscribers) are fine.
  const partial = { ...BASE, STRIPE_SECRET_KEY: "sk_test_abc", STRIPE_PUBLISHABLE_KEY: "pk_test_abc", STRIPE_PRICE_ID: "price_abc" };
  assert.equal(stripeSalesEnabled(partial), false);
  assert.deepEqual(envProblems(partial), []);
  assert.deepEqual(envProblems({ ...BASE, STRIPE_WEBHOOK_SECRET: "whsec_abc" }), []);
  // If checkout were switched back on, the same values would count as sales on.
  assert.equal(stripeSalesEnabled(partial, true), true);
  assert.equal(stripeSalesEnabled({ STRIPE_WEBHOOK_SECRET: "whsec_abc" }, true), false);
  // A SITE_URL that is set must still be a URL.
  assert.ok(envProblems({ ...BASE, SITE_URL: "not a url" }).some(p => p.startsWith("SITE_URL")));
});

test("env: owner IDs come from BOT_OWNER_IDS/DISCORD_OWNER_ID with a documented fallback", () => {
  assert.deepEqual([...parseOwnerIds({})], [DEFAULT_BOT_OWNER_ID]);
  assert.deepEqual([...parseOwnerIds({ BOT_OWNER_IDS: "111111111111111111, 222222222222222222" })].sort(), ["111111111111111111", "222222222222222222"]);
  assert.deepEqual([...parseOwnerIds({ DISCORD_OWNER_ID: "333333333333333333" })], ["333333333333333333"]);
  assert.ok(envProblems({ ...BASE, BOT_OWNER_IDS: "111111111111111111,abc" }).some(p => p.startsWith("BOT_OWNER_IDS")));
  assert.match(read(".env.example"), /BOT_OWNER_IDS=/);
  assert.match(read(".env.example"), new RegExp(DEFAULT_BOT_OWNER_ID));
  assert.match(read("DEPLOYMENT.md"), new RegExp(`BOT_OWNER_IDS[\\s\\S]*${DEFAULT_BOT_OWNER_ID}`));
  // The developer commands no longer hard-code the ID.
  assert.doesNotMatch(read("src/config/env.ts").replace(/DEFAULT_BOT_OWNER_ID = "\d+"/, ""), /\[\s*"\d{17,20}"/);
});

test("env: dotenv is skipped in production and the module never exits the process", () => {
  assert.equal(loadDotenv({ NODE_ENV: "production" }), false);
  const src = read("src/config/env.ts");
  assert.doesNotMatch(src, /process\.exit/);
  assert.doesNotMatch(src, /from "zod"/);
  const main = read("src/main.ts");
  assert.doesNotMatch(main, /dotenv\/config/);
  assert.match(main, /validateEnv\(\)/);
});

// ── Logger ───────────────────────────────────────────────────────────────────

test("logger: LOG_FORMAT wins, else json in production and pretty elsewhere", () => {
  assert.equal(resolveLogFormat({ NODE_ENV: "production" }), "json");
  assert.equal(resolveLogFormat({ NODE_ENV: "production", LOG_FORMAT: "pretty" }), "pretty");
  assert.equal(resolveLogFormat({ LOG_FORMAT: "JSON" }), "json");
  assert.equal(resolveLogFormat({}), "pretty");
  assert.equal(resolveLogLevel({ LOG_LEVEL: "warn" }), "warn");
  assert.equal(resolveLogLevel({ LOG_LEVEL: "loud" }), "info");
  const before = loggerSettings();
  assert.deepEqual(setupLogger({ LOG_FORMAT: "json", LOG_LEVEL: "debug" }), { format: "json", level: "debug" });
  setupLogger({ LOG_FORMAT: before.format, LOG_LEVEL: before.level });
});

test("logger: a JSON line is one parseable object with no ANSI codes, redacted, with fields and the error", () => {
  const env = { DISCORD_TOKEN: "super-secret-token-value" };
  const err = Object.assign(new Error("boom super-secret-token-value"), { code: 50013 });
  const line = formatJsonLine("error", "[AE-7KQ2XM] failed", [err, { guild: "g1" }], { errorId: "AE-7KQ2XM", command: "/ban" }, new Date("2026-01-02T03:04:05.000Z"), env);
  assert.doesNotMatch(line, /\n/);
  assert.doesNotMatch(line, /\x1b\[/);
  assert.doesNotMatch(line, /super-secret-token-value/);
  const obj = JSON.parse(line);
  assert.equal(obj.time, "2026-01-02T03:04:05.000Z");
  assert.equal(obj.level, "error");
  assert.equal(obj.errorId, "AE-7KQ2XM");
  assert.equal(obj.command, "/ban");
  assert.match(obj.msg, /failed .*guild/);
  assert.equal(obj.err.code, 50013);
  assert.match(obj.err.message, /\[redacted:DISCORD_TOKEN\]/);
  assert.ok(typeof obj.err.stack === "string");
});

test("logger: setupLogger is called from main and command/component errors log their errorId", () => {
  assert.match(read("src/main.ts"), /setupLogger\(\)/);
  assert.match(read("src/commands/executor.ts"), /logger\.child\(\{ errorId/);
  assert.match(read("src/bot/interactions/router.ts"), /logger\.child\(\{ errorId/);
});

test("no console.* outside the logger and no explicit any in src", () => {
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(`${d}/${e.name}`) : e.name.endsWith(".ts") ? [`${d}/${e.name}`] : []));
  for (const f of walk("src")) {
    const s = read(f);
    if (f !== "src/utils/logger.ts") assert.doesNotMatch(s, /\bconsole\.(log|warn|error|info|debug)\(/, f);
    // Comments and prose can say "any"; only code is checked.
    const code = s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(code, /:\s*any\s*[;,)=\]>|]|\bas any\s*[;,).\]]|<any>|any\[\]/, f);
  }
});

// ── Crash handling ───────────────────────────────────────────────────────────

test("fatal handler: logs, sets exit code 1, shuts down once, and ignores re-entry", async () => {
  const lines: string[] = [];
  const reasons: string[] = [];
  let exitCode = 0;
  const onFatal = createFatalHandler({
    shutdown: async (r) => { reasons.push(r); },
    log: { error: (m: string) => lines.push(m) },
    setExitCode: (c) => { exitCode = c; },
  });
  onFatal("uncaughtException", new Error("x"));
  onFatal("unhandledRejection", new Error("y"));
  await new Promise(r => setImmediate(r));
  assert.equal(exitCode, 1);
  assert.deepEqual(reasons, ["uncaughtException"]);
  assert.equal(lines.length, 2);
  assert.match(lines[1], /already shutting down/);
});

test("fatal handler: a failing shutdown is logged, not thrown", async () => {
  const lines: string[] = [];
  const onFatal = createFatalHandler({ shutdown: async () => { throw new Error("db"); }, log: { error: (m: string) => lines.push(m) }, setExitCode: () => {} });
  onFatal("unhandledRejection", "reason");
  await new Promise(r => setImmediate(r));
  assert.ok(lines.some(l => /shutdown after a fatal error failed/.test(l)));
});

test("fatal exit code: a clean shutdown after a crash still exits 1", () => {
  assert.equal(effectiveExitCode(0, 1), 1);
  assert.equal(effectiveExitCode(0, undefined), 0);
  assert.equal(effectiveExitCode(1, 0), 1);
  const main = read("src/main.ts");
  assert.match(main, /createFatalHandler\(\{ shutdown/);
  assert.match(main, /effectiveExitCode\(code, process\.exitCode\)/);
});

// ── Scheduler restore ────────────────────────────────────────────────────────

function fakeTasks(type: TaskType, n: number): ScheduledTask[] {
  return Array.from({ length: n }, (_, i) => ({
    _id: `${type}-${i}`, id: `${type}-${i}`, guildId: "g", channelId: "c", creatorId: "u", type, payload: "",
    executeAt: new Date(0), intervalMs: null, createdAt: new Date(0),
  }));
}

function fakeSource(counts: Partial<Record<TaskType, number>>): PendingTaskSource & { calls: Array<[TaskType, number | null]> } {
  const calls: Array<[TaskType, number | null]> = [];
  return {
    calls,
    async find(type, limit) {
      calls.push([type, limit]);
      const all = fakeTasks(type, counts[type] ?? 0);
      return limit === null ? all : all.slice(0, limit);
    },
    async count(type) { return counts[type] ?? 0; },
  };
}

test("scheduler: must-run types load in full and are not counted against the cap", async () => {
  const source = fakeSource({ timed_unban: 50, temprole_remove: 5, slowmode_revert: 2, reminder: 30, personal_reminder: 10 });
  const r = await loadPendingTasks(0, source, 20);
  assert.equal(r.loaded.timed_unban, 50);
  assert.equal(r.loaded.temprole_remove, 5);
  assert.equal(r.loaded.slowmode_revert, 2);
  for (const t of MUST_RUN_TYPES) assert.ok(source.calls.some(([type, limit]) => type === t && limit === null), t);
  assert.equal(r.loaded.reminder, 20);
  assert.equal(r.loaded.personal_reminder, undefined);
  assert.equal(r.capHit, true);
  assert.deepEqual(r.capped, { reminder: 10, personal_reminder: 10 });
  assert.equal(r.tasks.length, 77);
});

test("scheduler: no cap report when everything fits", async () => {
  const r = await loadPendingTasks(0, fakeSource({ reminder: 3, channel_unlock: 2 }), 100);
  assert.equal(r.capHit, false);
  assert.deepEqual(r.capped, {});
  assert.equal(r.tasks.length, 5);
});

test("scheduler: every task type has a restore slot, must-run types first", () => {
  assert.deepEqual(ALL_TASK_TYPES.slice(0, 3), [...MUST_RUN_TYPES]);
  assert.equal(new Set(ALL_TASK_TYPES).size, 11);
});

test("scheduler: unbans, temp roles and slowmode reverts fire however overdue; stale reminders are skipped", () => {
  const NOW = 1_000 * 86_400_000;
  for (const type of MUST_RUN_TYPES) assert.equal(planRestore({ type, executeAt: new Date(NOW - 90 * 86_400_000), intervalMs: null }, NOW).kind, "fire", type);
  assert.equal(planRestore({ type: "personal_reminder", executeAt: new Date(NOW - 2 * 86_400_000), intervalMs: null }, NOW).kind, "drop");
});

test("scheduler: startup logs skipped and capped counts by type", () => {
  assert.equal(formatCounts({ reminder: 3, personal_reminder: 0, scheduled: 1 }), "reminder=3, scheduled=1");
  assert.equal(formatCounts({}), "none");
  const runner = read("src/services/schedulerRunner.ts");
  assert.match(runner, /restore cap of \$\{MAX_RESTORED_TASKS\}/);
  assert.match(runner, /skipped one-off task\(s\) overdue by more than a day/);
  assert.match(runner, /isGuildPostChannel\(channel\)/);
  assert.doesNotMatch(runner, /instanceof TextChannel/);
});

// ── Announcement channels and threads ───────────────────────────────────────

test("scheduled posts and guild logs accept announcement channels and threads", () => {
  const send = () => undefined;
  for (const type of [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread]) {
    assert.equal(isGuildPostChannel({ type, send }), true, String(type));
  }
  assert.equal(isGuildPostChannel({ type: ChannelType.GuildVoice, send }), false);
  assert.equal(isGuildPostChannel({ type: ChannelType.GuildCategory }), false);
  assert.equal(isGuildPostChannel({ type: ChannelType.GuildText }), false, "no send()");
  assert.equal(isGuildPostChannel(null), false);
  const logging = read("src/services/logging.ts");
  assert.match(logging, /isGuildPostChannel\(channel\)/);
  assert.doesNotMatch(logging, /instanceof TextChannel/);
});

// ── Automod eviction ─────────────────────────────────────────────────────────

test("DuplicateTracker sweeps members idle longer than the longest window", () => {
  const t = new DuplicateTracker(100, 1000, 5000);
  t.record("old", "hi", 60_000, 0);
  t.record("x", "hi", 60_000, 2000);
  assert.equal(t.size, 2);
  t.record("y", "hi", 60_000, 8000);
  assert.equal(t.size, 1, "the sweep at t=8000 dropped everyone last seen before t=3000");
  assert.equal(t.record("y", "hi", 60_000, 8001), 2, "active members keep their count");
});

test("PenaltyCooldown sweeps members whose cooldown ended long ago", () => {
  const p = new PenaltyCooldown(1000, 100, 1000, 5000);
  p.decide("a", 0);
  p.decide("b", 4000);
  assert.equal(p.size, 2);
  p.decide("c", 7000);
  assert.equal(p.size, 2, "'a' (cooldown ended at 1000) dropped; 'b' kept");
});

test("SlidingWindowCounter still evicts idle members over time", () => {
  const c = new SlidingWindowCounter(100, 1000, 5000);
  for (let i = 0; i < 50; i++) c.record(`u${i}`, 1000, i);
  assert.equal(c.size, 50);
  c.record("late", 1000, 10_000);
  assert.equal(c.size, 1);
});

// ── Deferrals ────────────────────────────────────────────────────────────────

test("withinDeadline: resolves with the value, or times out without cancelling the work", async () => {
  assert.deepEqual(await withinDeadline(Promise.resolve(5), 50), { ok: true, value: 5 });
  let resolve!: (v: number) => void;
  const slow = new Promise<number>(r => { resolve = r; });
  assert.deepEqual(await withinDeadline(slow, 5), { ok: false });
  resolve(7);
  assert.equal(await slow, 7);
});

test("ticket claim defers before database work; captcha start answers within the budget", () => {
  const tickets = read("src/bot/interactions/tickets.ts");
  const claim = tickets.slice(tickets.indexOf('name: "ticket-claim"'), tickets.indexOf('name: "ticket-close"'));
  assert.ok(claim.indexOf("deferUpdate()") > 0 && claim.indexOf("deferUpdate()") < claim.indexOf("claimTicket("));
  assert.doesNotMatch(claim, /interaction\.reply\(|interaction\.update\(/);
  const verification = read("src/bot/interactions/verification.ts");
  assert.match(verification, /withinDeadline\(loading, INTERACTION_RESPONSE_BUDGET_MS\)/);
  const captcha = verification.slice(verification.indexOf('name: "verify-captcha"'));
  assert.ok(captcha.indexOf("deferReply") < captcha.indexOf("captchaStore.check"));
});
