/** Incident Mode: pure rules, the full start → join gate → end flow, expiry, restart recovery and concurrency. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_INCIDENT_OPTIONS, INCIDENT_MAX_CHANNELS, INCIDENT_TIMELINE_MAX, JoinBurstTracker, joinGateDecision, normalizeIncidentConfig,
  normalizeIncidentOptions, parseIncidentDuration, planIncidentChanges, planRestore, summarizeIncident,
  type ChannelSnapshot, type IncidentOptions, type OverwriteRestore,
} from "../src/services/incidentLogic";
import { memoryIncidentStore } from "../src/services/incidentStore";
import { createIncidentService, type IncidentOps, type ModLogMessage } from "../src/services/incidentService";
import { parseFriendlyDuration } from "../src/utils/duration";
import { command as incidentCommand, startOptionsFrom } from "../src/commands/moderation/incident";

const G = "800000000000000001";
const ch = (id: string, over: Partial<ChannelSnapshot> = {}): ChannelSnapshot => ({
  id, name: `c${id.slice(-2)}`, kind: "text", hidden: false, isPublic: true, canEditChannel: true, canEditOverwrites: true,
  rateLimitPerUser: 0, everyoneSend: "neutral", hasEveryoneOverwrite: false, everyoneOverwriteOnlySendDeny: false, ...over,
});
const opts = (over: Partial<IncidentOptions> = {}): IncidentOptions => ({ ...DEFAULT_INCIDENT_OPTIONS, ...over });

/* ── Pure rules ───────────────────────────────────────────────────── */

test("options and config are clamped; auto-trigger is off by default", () => {
  const o = normalizeIncidentOptions({ slowmodeSeconds: 99999, durationMinutes: 5000, minAccountAgeDays: 0, joinGate: "ban", lockMode: "everything", lockChannelIds: ["x", "700000000000000001", "700000000000000001"] });
  assert.equal(o.slowmodeSeconds, 21600);
  assert.equal(o.durationMinutes, 1440, "never longer than 24h");
  assert.equal(o.minAccountAgeDays, 1);
  assert.equal(o.joinGate, "timeout", "unknown action falls back");
  assert.equal(o.lockMode, "none");
  assert.deepEqual(o.lockChannelIds, ["700000000000000001"], "non-snowflakes and duplicates dropped");
  const c = normalizeIncidentConfig(undefined);
  assert.equal(c.autoTrigger.enabled, false);
  assert.equal(normalizeIncidentConfig({ autoTrigger: { enabled: true, joins: 1, seconds: 9999 } }).autoTrigger.joins, 3);
  assert.equal(normalizeIncidentConfig({ autoTrigger: { enabled: "yes" } }).autoTrigger.enabled, false, "only true turns it on");
});

test("duration: friendly lengths, default 1h, capped at 24h", () => {
  assert.deepEqual(parseIncidentDuration("", parseFriendlyDuration), { minutes: 60 });
  assert.deepEqual(parseIncidentDuration("2h", parseFriendlyDuration), { minutes: 120 });
  assert.deepEqual(parseIncidentDuration("24h", parseFriendlyDuration), { minutes: 1440 });
  assert.ok("error" in parseIncidentDuration("25h", parseFriendlyDuration));
  assert.ok("error" in parseIncidentDuration("soon", parseFriendlyDuration));
});

test("plan: slowmode hits visible public text channels only; hidden channels are never touched", () => {
  const channels = [
    ch("700000000000000001"),
    ch("700000000000000002", { isPublic: false }),
    ch("700000000000000003", { hidden: true }),
    ch("700000000000000004", { kind: "announcement" }),
    ch("700000000000000005", { rateLimitPerUser: 30 }),
    ch("700000000000000006", { canEditChannel: false }),
  ];
  const plan = planIncidentChanges(channels, opts({ slowmodeSeconds: 10, lockMode: "none" }));
  assert.deepEqual(plan.changes.map(c => c.channelId), ["700000000000000001"]);
  assert.deepEqual(plan.changes[0].slowmode, { from: 0, to: 10 });
  assert.ok(plan.skipped.some(s => s.channelId === "700000000000000006"), "missing permission is reported");
  assert.ok(!plan.skipped.some(s => s.channelId === "700000000000000003"), "hidden channels are not even listed");
});

test("plan: lock records the previous @everyone state; already-locked channels are left out", () => {
  const channels = [
    ch("700000000000000001", { everyoneSend: "allow", hasEveryoneOverwrite: true }),
    ch("700000000000000002"),
    ch("700000000000000003", { everyoneSend: "deny", hasEveryoneOverwrite: true }),
    ch("700000000000000004", { canEditOverwrites: false }),
  ];
  const plan = planIncidentChanges(channels, opts({ slowmodeSeconds: 0, lockMode: "public" }));
  assert.deepEqual(plan.changes.map(c => [c.channelId, c.lock]), [
    ["700000000000000001", { previous: "allow", hadOverwrite: true }],
    ["700000000000000002", { previous: "neutral", hadOverwrite: false }],
  ]);
  const selected = planIncidentChanges(channels, opts({ slowmodeSeconds: 0, lockMode: "selected", lockChannelIds: ["700000000000000002", "700000000000000099"] }));
  assert.deepEqual(selected.changes.map(c => c.channelId), ["700000000000000002"], "unknown IDs ignored");
});

test("plan: capped at 50 channels", () => {
  const many = Array.from({ length: 70 }, (_, i) => ch(`7000000000000${String(10000 + i)}`));
  const plan = planIncidentChanges(many, opts({ slowmodeSeconds: 5 }));
  assert.equal(plan.changes.length, INCIDENT_MAX_CHANNELS);
  assert.equal(plan.skipped.filter(s => /limit/.test(s.reason)).length, 20);
});

test("restore: exact prior state, and hand changes made during the incident are kept", () => {
  const change = { channelId: "1", name: "general", slowmode: { from: 5, to: 30 }, lock: { previous: "neutral" as const, hadOverwrite: false } };
  const locked = ch("1", { rateLimitPerUser: 30, everyoneSend: "deny", hasEveryoneOverwrite: true, everyoneOverwriteOnlySendDeny: true });
  assert.deepEqual(planRestore(change, locked), { channelId: "1", name: "general", slowmode: 5, overwrite: { kind: "delete" }, notes: [] });
  // The overwrite gained other permissions meanwhile: only Send Messages goes back.
  assert.deepEqual(planRestore(change, { ...locked, everyoneOverwriteOnlySendDeny: false }).overwrite, { kind: "set", value: null });
  assert.deepEqual(planRestore({ ...change, lock: { previous: "allow", hadOverwrite: true } }, locked).overwrite, { kind: "set", value: true });
  const handEdited = planRestore(change, { ...locked, rateLimitPerUser: 60, everyoneSend: "allow" });
  assert.equal(handEdited.slowmode, undefined);
  assert.equal(handEdited.overwrite, undefined);
  assert.equal(handEdited.notes.length, 2);
  assert.match(planRestore(change, null).notes[0], /no longer exists/);
  assert.match(planRestore(change, { ...locked, hidden: true }).notes[0], /can no longer see/);
});

test("join gate: never bots, never members above Aegis, only young accounts", () => {
  const now = Date.parse("Sun 2026-11-01 8:00 AM CST (UTC-06:00)");
  const young = new Date(now - 2 * 86_400_000);
  const old = new Date(now - 30 * 86_400_000);
  const o = { joinGate: "timeout" as const, minAccountAgeDays: 7 };
  assert.equal(joinGateDecision(o, { isBot: false, accountCreatedAt: young, actionable: true }, now).act, "timeout");
  assert.equal(joinGateDecision({ ...o, joinGate: "kick" }, { isBot: false, accountCreatedAt: young, actionable: true }, now).act, "kick");
  assert.equal(joinGateDecision(o, { isBot: true, accountCreatedAt: young, actionable: true }, now).act, "none");
  assert.equal(joinGateDecision(o, { isBot: false, accountCreatedAt: young, actionable: false }, now).act, "none");
  assert.equal(joinGateDecision(o, { isBot: false, accountCreatedAt: old, actionable: true }, now).act, "none");
  assert.equal(joinGateDecision({ ...o, joinGate: "off" }, { isBot: false, accountCreatedAt: young, actionable: true }, now).act, "none");
});

test("join burst tracker: N joins in M seconds, then a cooldown", () => {
  const t = new JoinBurstTracker();
  const auto = { enabled: true, joins: 3, seconds: 10 };
  assert.equal(t.shouldTrigger(G, 0, auto), false);
  assert.equal(t.shouldTrigger(G, 11_000, auto), false, "the first join fell out of the window");
  assert.equal(t.shouldTrigger(G, 12_000, auto), false);
  assert.equal(t.shouldTrigger(G, 13_000, auto), true);
  for (let i = 0; i < 5; i++) assert.equal(t.shouldTrigger(G, 14_000 + i, auto), false, "cooling down");
  assert.equal(t.shouldTrigger(G, 1, { ...auto, enabled: false }), false);
});

test("summary lines list counts, changes and case IDs", () => {
  const lines = summarizeIncident({ startedAt: new Date(0), endedAt: new Date(90 * 60_000), counts: { joins: 12, gated: 4, cases: 4, deleted: 9 }, changes: [{ channelId: "1", name: "a", slowmode: { from: 0, to: 5 } }], invitesPaused: true, caseIds: ["c1", "c2"] });
  assert.deepEqual(lines, ["Duration: 1h 30m", "Joins: 12 (gated 4)", "Channels: 1 slowed, 0 locked; invites paused", "Cases: 4 · Messages deleted: 9", "Case IDs: c1, c2"]);
});

/* ── Service flow with a fake server ──────────────────────────────── */

function fakeServer() {
  const channels = new Map<string, ChannelSnapshot>([
    ["700000000000000001", ch("700000000000000001", { name: "general" })],
    ["700000000000000002", ch("700000000000000002", { name: "memes", everyoneSend: "allow", hasEveryoneOverwrite: true })],
    ["700000000000000003", ch("700000000000000003", { name: "staff", isPublic: false })],
    ["700000000000000004", ch("700000000000000004", { hidden: true })],
  ]);
  const writes: string[] = [];
  const logs: ModLogMessage[] = [];
  const gated: string[] = [];
  let invitesDisabled = false;
  let caseN = 0;
  const ops: IncidentOps = {
    async snapshotChannels() { return [...channels.values()].map(c => ({ ...c })); },
    async setSlowmode(_g, id, seconds) {
      const c = channels.get(id)!;
      assert.ok(!c.hidden, "never edits a hidden channel");
      writes.push(`slow ${id} ${seconds}`); c.rateLimitPerUser = seconds;
    },
    async setEveryoneSend(_g, id, change: OverwriteRestore) {
      const c = channels.get(id)!;
      assert.ok(!c.hidden, "never edits a hidden channel");
      writes.push(`send ${id} ${change.kind === "delete" ? "delete" : String(change.value)}`);
      if (change.kind === "delete") Object.assign(c, { everyoneSend: "neutral", hasEveryoneOverwrite: false, everyoneOverwriteOnlySendDeny: false });
      else Object.assign(c, { everyoneSend: change.value === true ? "allow" : change.value === false ? "deny" : "neutral", everyoneOverwriteOnlySendDeny: change.value === false && !c.hasEveryoneOverwrite, hasEveryoneOverwrite: true });
    },
    invitesState: () => ({ disabled: invitesDisabled, canChange: true }),
    async setInvitesDisabled(_g, d) { writes.push(`invites ${d}`); invitesDisabled = d; },
    async postModLog(_g, m) { logs.push(m); },
    async gateMember(_g, userId, action) { gated.push(`${action} ${userId}`); },
    async recordCase() { return `case${++caseN}`; },
    botUserId: () => "100000000000000001",
  };
  return { channels, writes, logs, gated, ops, invites: () => invitesDisabled };
}

const actor = { id: "900000000000000001", tag: "mod#0001" };

test("start → gate young joins → end restores the exact prior state and posts a report", async () => {
  const srv = fakeServer();
  const store = memoryIncidentStore();
  let clock = Date.parse("Sun 2026-11-01 8:00 AM CST (UTC-06:00)");
  const svc = createIncidentService({ store, ops: srv.ops, getConfig: async () => normalizeIncidentConfig(undefined), now: () => clock, paceMs: 0 });

  const started = await svc.start(G, { options: opts({ slowmodeSeconds: 15, lockMode: "public", pauseInvites: true }), reason: "raid", trigger: "command", actor });
  assert.ok(started.ok);
  assert.equal(srv.channels.get("700000000000000001")!.rateLimitPerUser, 15);
  assert.equal(srv.channels.get("700000000000000002")!.everyoneSend, "deny");
  assert.equal(srv.channels.get("700000000000000003")!.everyoneSend, "neutral", "private channels untouched");
  assert.equal(srv.invites(), true);
  assert.match(srv.logs[0].title, /Incident Mode started/);
  assert.doesNotMatch(JSON.stringify(srv.logs[0]), /@everyone|@here|<@&/, "the staff alert pings nobody");

  const again = await svc.start(G, { options: opts(), reason: "dup", trigger: "command", actor });
  assert.deepEqual(again.ok ? "started twice" : again.error, "already_active");

  const young = await svc.onMemberJoin(G, { userId: "500000000000000001", tag: "new#1", isBot: false, createdAt: new Date(clock - 3_600_000), actionable: true });
  assert.equal(young.act, "timeout");
  const bot = await svc.onMemberJoin(G, { userId: "500000000000000002", tag: "bot#1", isBot: true, createdAt: new Date(clock - 3_600_000), actionable: true });
  assert.equal(bot.act, "none");
  const high = await svc.onMemberJoin(G, { userId: "500000000000000003", tag: "alt#1", isBot: false, createdAt: new Date(clock - 3_600_000), actionable: false });
  assert.equal(high.act, "none");
  assert.deepEqual(srv.gated, ["timeout 500000000000000001"]);
  await svc.record(G, { at: new Date(clock), kind: "delete", text: "3 deleted" }, { deleted: 3 });

  // A moderator changes slowmode on #general by hand during the incident.
  srv.channels.get("700000000000000001")!.rateLimitPerUser = 120;
  clock += 20 * 60_000;
  const ended = await svc.end(G, { actor, reason: "calm" });
  assert.ok(ended.ok);
  assert.equal(srv.channels.get("700000000000000001")!.rateLimitPerUser, 120, "hand change kept");
  assert.ok(ended.notes.some(n => /general/.test(n)));
  const memes = srv.channels.get("700000000000000002")!;
  assert.equal(memes.everyoneSend, "allow", "previous allow restored");
  assert.equal(srv.invites(), false, "invites resumed");
  const report = srv.logs.at(-1)!;
  assert.match(report.title, /report/);
  assert.match(report.description, /Joins: 3 \(gated 1\)/);
  assert.match(report.description, /Messages deleted: 3/);
  const rec = ended.incident;
  assert.equal(rec.status, "ended");
  assert.deepEqual(rec.timeline.map(e => e.kind).filter(k => k !== "join"), ["start", "change", "gate", "delete", "end"]);
  assert.deepEqual((await svc.end(G, { actor, reason: "again" })).ok, false, "ending twice is a no-op");
  assert.equal(svc.isActive(G), false);
  // Joins after the end are not gated.
  assert.equal((await svc.onMemberJoin(G, { userId: "500000000000000004", tag: "x", isBot: false, createdAt: new Date(clock), actionable: true })).act, "none");
});

test("a channel that was neutral with no overwrite gets its overwrite removed on end", async () => {
  const srv = fakeServer();
  const svc = createIncidentService({ store: memoryIncidentStore(), ops: srv.ops, getConfig: async () => normalizeIncidentConfig(undefined), paceMs: 0 });
  await svc.start(G, { options: opts({ slowmodeSeconds: 0, lockMode: "selected", lockChannelIds: ["700000000000000001"] }), reason: "", trigger: "dashboard", actor });
  assert.equal(srv.channels.get("700000000000000001")!.everyoneSend, "deny");
  await svc.end(G, { actor, reason: "done" });
  assert.ok(srv.writes.includes("send 700000000000000001 delete"));
  assert.equal(srv.channels.get("700000000000000001")!.hasEveryoneOverwrite, false);
});

test("expiry: the sweep ends an incident at its time and survives a restart (new service, same store)", async () => {
  const srv = fakeServer();
  const store = memoryIncidentStore();
  let clock = 1_000_000;
  const first = createIncidentService({ store, ops: srv.ops, getConfig: async () => normalizeIncidentConfig(undefined), now: () => clock, paceMs: 0 });
  await first.start(G, { options: opts({ slowmodeSeconds: 20, durationMinutes: 30 }), reason: "", trigger: "command", actor });
  first.stop();
  // "Restart": a fresh service over the same stored state.
  clock += 31 * 60_000;
  const second = createIncidentService({ store, ops: srv.ops, getConfig: async () => normalizeIncidentConfig(undefined), now: () => clock, paceMs: 0 });
  await second.boot(60_000);
  second.stop();
  assert.equal(srv.channels.get("700000000000000001")!.rateLimitPerUser, 0, "restored after restart");
  assert.equal(store.all()[0].status, "ended");
  assert.match(store.all()[0].endReason ?? "", /duration/);
});

test("a half-ended incident (process died mid-restore) is finished by the next sweep", async () => {
  const srv = fakeServer();
  const store = memoryIncidentStore();
  let clock = 5_000_000;
  const svc = createIncidentService({ store, ops: srv.ops, getConfig: async () => normalizeIncidentConfig(undefined), now: () => clock, paceMs: 0 });
  const started = await svc.start(G, { options: opts({ slowmodeSeconds: 20 }), reason: "", trigger: "command", actor });
  assert.ok(started.ok);
  await store.claimEnd(started.incident.id, new Date(clock)); // claimed, then the process died
  clock += 6 * 60_000;
  assert.equal(await svc.sweep(), 1);
  assert.equal(store.all()[0].status, "ended");
  assert.equal(srv.channels.get("700000000000000001")!.rateLimitPerUser, 0);
});

test("concurrency: two simultaneous starts make one incident; two ends restore once", async () => {
  const srv = fakeServer();
  const store = memoryIncidentStore();
  const a = createIncidentService({ store, ops: srv.ops, getConfig: async () => normalizeIncidentConfig(undefined), paceMs: 0 });
  const b = createIncidentService({ store, ops: srv.ops, getConfig: async () => normalizeIncidentConfig(undefined), paceMs: 0 });
  const results = await Promise.all([
    a.start(G, { options: opts({ slowmodeSeconds: 5 }), reason: "1", trigger: "command", actor }),
    b.start(G, { options: opts({ slowmodeSeconds: 5 }), reason: "2", trigger: "command", actor }),
  ]);
  assert.equal(results.filter(r => r.ok).length, 1);
  assert.equal(store.all().length, 1);
  const ends = await Promise.all([a.end(G, { actor, reason: "x" }), b.end(G, { actor, reason: "y" })]);
  assert.equal(ends.filter(r => r.ok).length, 1);
  assert.equal(srv.writes.filter(w => w === "slow 700000000000000001 0").length, 1, "restored exactly once");
});

test("auto-trigger: off by default; when on, a burst starts an incident with the defaults and gates the burst", async () => {
  const srv = fakeServer();
  let clock = 10_000_000;
  let config = normalizeIncidentConfig(undefined);
  const svc = createIncidentService({ store: memoryIncidentStore(), ops: srv.ops, getConfig: async () => config, now: () => clock, paceMs: 0 });
  const join = (n: number) => svc.onMemberJoin(G, { userId: `5000000000000000${String(n).padStart(2, "0")}`, tag: `u${n}`, isBot: false, createdAt: new Date(clock - 60_000), actionable: true });
  for (let i = 0; i < 20; i++) { clock += 100; await join(i); }
  assert.equal(svc.isActive(G), false, "default config never auto-starts");
  config = normalizeIncidentConfig({ autoTrigger: { enabled: true, joins: 5, seconds: 10 }, defaults: { slowmodeSeconds: 30 } });
  const results = [];
  for (let i = 20; i < 26; i++) { clock += 100; results.push(await join(i)); }
  assert.equal(svc.isActive(G), true);
  assert.equal(srv.channels.get("700000000000000001")!.rateLimitPerUser, 30);
  assert.equal(results[4].act, "timeout", "the join that tripped it is gated");
  assert.match(srv.logs[0].title, /auto-started/);
});

test("timeline is capped but counters keep counting", async () => {
  const store = memoryIncidentStore();
  const rec = await store.createActive({ guildId: G, trigger: "command", reason: "", startedBy: actor, startedAt: new Date(), endsAt: new Date(Date.now() + 60_000), options: opts(), timeline: [] });
  assert.ok(rec);
  for (let i = 0; i < INCIDENT_TIMELINE_MAX + 25; i++) await store.appendEvent(G, { at: new Date(), kind: "join", text: "j" }, { joins: 1 });
  const after = await store.getActive(G);
  assert.equal(after!.timeline.length, INCIDENT_TIMELINE_MAX);
  assert.equal(after!.counts.joins, INCIDENT_TIMELINE_MAX + 25);
  assert.equal(after!.timelineTruncated, true);
  await store.appendEvent(G, { at: new Date(), kind: "end", text: "end" });
  assert.equal((await store.getActive(G))!.timeline.at(-1)!.kind, "end", "start/end always recorded");
});

/* ── /incident command ────────────────────────────────────────────── */

test("/incident: Manage Server, subcommands, and start options over the saved defaults", () => {
  const json = incidentCommand.data.toJSON() as { name: string; default_member_permissions?: string; options: Array<{ name: string; options?: Array<{ name: string }> }> };
  assert.equal(json.name, "incident");
  assert.equal(json.default_member_permissions, String(1n << 5n), "Manage Server");
  assert.deepEqual(json.options.map(o => o.name), ["start", "end", "status", "auto"]);
  const getter = (values: Record<string, string | number | boolean | null>) => ({
    string: (n: string) => (values[n] as string) ?? null, integer: (n: string) => (values[n] as number) ?? null,
    boolean: (n: string) => (values[n] as boolean) ?? null, channelId: (n: string) => (values[n] as string) ?? null,
  });
  const defaults = opts({ slowmodeSeconds: 12, durationMinutes: 90 });
  const parsed = startOptionsFrom(getter({}), defaults);
  assert.ok("options" in parsed);
  assert.equal(parsed.options.slowmodeSeconds, 12);
  assert.equal(parsed.options.durationMinutes, 90);
  const one = startOptionsFrom(getter({ lock: "channel", channel: "700000000000000009", duration: "3h", join_gate: "kick" }), defaults);
  assert.ok("options" in one);
  assert.deepEqual([one.options.lockMode, one.options.lockChannelIds, one.options.durationMinutes, one.options.joinGate], ["selected", ["700000000000000009"], 180, "kick"]);
  assert.ok("error" in startOptionsFrom(getter({ lock: "channel" }), defaults));
  assert.ok("error" in startOptionsFrom(getter({ duration: "2d" }), defaults));
});
