/**
 * Incident Mode orchestration: start, end (by hand, on expiry, or after a
 * restart), the join gate, the optional join-burst auto-trigger, and the
 * timeline that becomes the incident report. Discord and storage come in
 * through IncidentOps and IncidentStore, so the whole flow runs in tests.
 */
import {
  JoinBurstTracker, joinGateDecision, normalizeIncidentOptions, planIncidentChanges, planRestore, summarizeIncident, formatMinutes,
  type ChannelChange, type ChannelSnapshot, type GateDecision, type IncidentConfig, type IncidentCounts, type IncidentOptions,
  type IncidentTrigger, type OverwriteRestore, type TimelineEvent,
} from "./incidentLogic";
import type { IncidentRecord, IncidentStore } from "./incidentStore";

export interface ModLogMessage {
  title: string;
  description: string;
  color: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
}

/** Everything Incident Mode asks of Discord. Implemented in incidentDiscord.ts. */
export interface IncidentOps {
  snapshotChannels(guildId: string): Promise<ChannelSnapshot[]>;
  setSlowmode(guildId: string, channelId: string, seconds: number, reason: string): Promise<void>;
  setEveryoneSend(guildId: string, channelId: string, change: OverwriteRestore, reason: string): Promise<void>;
  /** null when the server is unknown. */
  invitesState(guildId: string): { disabled: boolean; canChange: boolean } | null;
  setInvitesDisabled(guildId: string, disabled: boolean, reason: string): Promise<void>;
  /** Posts to the mod log with no pings at all. */
  postModLog(guildId: string, message: ModLogMessage): Promise<void>;
  gateMember(guildId: string, userId: string, action: "timeout" | "kick", timeoutMinutes: number, reason: string): Promise<void>;
  recordCase(guildId: string, userId: string, action: "timeout" | "kick", reason: string, details: string): Promise<string | null>;
  botUserId(): string;
}

export interface Actor { id: string; tag: string }

export interface IncidentServiceDeps {
  store: IncidentStore;
  ops: IncidentOps;
  getConfig(guildId: string): Promise<IncidentConfig>;
  now?: () => number;
  /** Pause between Discord writes (ms). Discord.js also queues on rate limits; this keeps bursts small. */
  paceMs?: number;
  reportUrl?: (guildId: string, incidentId: string) => string | null;
  log?: { warn(...a: unknown[]): void; info(...a: unknown[]): void };
}

export type StartResult =
  | { ok: true; incident: IncidentRecord; applied: ChannelChange[]; skipped: Array<{ name: string; reason: string }>; invitesNote: string | null }
  | { ok: false; error: "already_active"; active: IncidentRecord | null }
  | { ok: false; error: "busy" };

export type EndResult =
  | { ok: true; incident: IncidentRecord; restored: number; notes: string[] }
  | { ok: false; error: "not_active" | "busy" };

const COLOR_ALERT = 0xed4245;
const COLOR_DONE = 0x57f287;

export function createIncidentService(deps: IncidentServiceDeps) {
  const now = () => deps.now?.() ?? Date.now();
  const pace = () => (deps.paceMs ?? 350) > 0 ? new Promise<void>(r => setTimeout(r, deps.paceMs ?? 350)) : Promise.resolve();
  const log = deps.log ?? { warn: () => undefined, info: () => undefined };
  /** Servers with an active incident, so joins and events skip the database otherwise. */
  const active = new Map<string, { id: string; options: IncidentOptions }>();
  const busy = new Set<string>();
  const tracker = new JoinBurstTracker();
  let sweepTimer: NodeJS.Timeout | null = null;

  const event = (kind: TimelineEvent["kind"], text: string, extra: Partial<TimelineEvent> = {}): TimelineEvent => ({ at: new Date(now()), kind, text: text.slice(0, 300), ...extra });

  async function record(guildId: string, ev: TimelineEvent, inc?: Partial<IncidentCounts>, caseId?: string): Promise<void> {
    if (!active.has(guildId)) return;
    await deps.store.appendEvent(guildId, ev, inc, caseId).catch(err => log.warn(`Incident timeline write failed in ${guildId}:`, err));
  }

  async function start(guildId: string, input: { options: Partial<IncidentOptions>; reason: string; trigger: IncidentTrigger; actor: Actor }): Promise<StartResult> {
    if (busy.has(guildId)) return { ok: false, error: "busy" };
    busy.add(guildId);
    try {
      const options = normalizeIncidentOptions(input.options);
      const startedAt = new Date(now());
      const reason = (input.reason || "No reason given").slice(0, 512);
      const rec = await deps.store.createActive({
        guildId, trigger: input.trigger, reason, startedBy: input.actor, startedAt,
        endsAt: new Date(startedAt.getTime() + options.durationMinutes * 60_000), options,
        timeline: [event("start", `${input.trigger === "auto" ? "Auto-started by a join burst" : `Started by ${input.actor.tag}`}: ${reason}`, { userId: input.actor.id })],
      });
      if (!rec) return { ok: false, error: "already_active", active: await deps.store.getActive(guildId) };
      active.set(guildId, { id: rec.id, options });

      const plan = planIncidentChanges(await deps.ops.snapshotChannels(guildId).catch(() => []), options);
      // Recorded before any edit, so a crash mid-way still restores what was touched.
      await deps.store.saveChanges(rec.id, plan.changes, false);
      const applied: ChannelChange[] = [];
      const auditReason = `Incident Mode: ${reason}`.slice(0, 400);
      for (const change of plan.changes) {
        const done: ChannelChange = { channelId: change.channelId, name: change.name };
        if (change.slowmode) {
          try { await deps.ops.setSlowmode(guildId, change.channelId, change.slowmode.to, auditReason); done.slowmode = change.slowmode; }
          catch { plan.skipped.push({ channelId: change.channelId, name: change.name, reason: "slowmode edit failed" }); }
        }
        if (change.lock) {
          try { await deps.ops.setEveryoneSend(guildId, change.channelId, { kind: "set", value: false }, auditReason); done.lock = change.lock; }
          catch { plan.skipped.push({ channelId: change.channelId, name: change.name, reason: "lock failed" }); }
        }
        if (done.slowmode || done.lock) applied.push(done);
        await pace();
      }

      let invitesPaused = false;
      let invitesNote: string | null = null;
      if (options.pauseInvites) {
        const state = deps.ops.invitesState(guildId);
        if (!state || !state.canChange) invitesNote = "Invites not paused: Aegis needs Manage Server.";
        else if (state.disabled) invitesNote = "Invites were already paused, so they stay paused after the incident.";
        else {
          try { await deps.ops.setInvitesDisabled(guildId, true, auditReason); invitesPaused = true; }
          catch { invitesNote = "Invites could not be paused."; }
        }
      }
      await deps.store.saveChanges(rec.id, applied, invitesPaused);
      const slowed = applied.filter(c => c.slowmode).length;
      const locked = applied.filter(c => c.lock).length;
      await record(guildId, event("change", `Applied: ${slowed} channel(s) slowed, ${locked} locked${invitesPaused ? ", invites paused" : ""}${plan.skipped.length ? `; ${plan.skipped.length} skipped` : ""}`));

      const endsUnix = Math.floor((startedAt.getTime() + options.durationMinutes * 60_000) / 1000);
      await deps.ops.postModLog(guildId, {
        title: input.trigger === "auto" ? "🚨 Incident Mode auto-started" : "🚨 Incident Mode started",
        color: COLOR_ALERT,
        description: `**Reason:** ${reason}\nStaff: check the mod log and use \`/incident status\`. Ends <t:${endsUnix}:R> or with \`/incident end\`.`,
        fields: [
          { name: "Started by", value: input.trigger === "auto" ? "Auto-trigger (join burst)" : input.actor.tag, inline: true },
          { name: "Channels", value: `${slowed} slowed${options.slowmodeSeconds ? ` (${options.slowmodeSeconds}s)` : ""}, ${locked} locked`, inline: true },
          { name: "Join gate", value: options.joinGate === "off" ? "Off" : `${options.joinGate === "kick" ? "Kick" : `Time out ${formatMinutes(options.gateTimeoutMinutes)}`} accounts under ${options.minAccountAgeDays}d`, inline: true },
          ...(options.pauseInvites ? [{ name: "Invites", value: invitesPaused ? "Paused" : invitesNote ?? "Unchanged", inline: true }] : []),
        ],
      }).catch(() => undefined);

      const incident = (await deps.store.get(guildId, rec.id)) ?? rec;
      return { ok: true, incident, applied, skipped: plan.skipped.map(s => ({ name: s.name, reason: s.reason })), invitesNote };
    } finally {
      busy.delete(guildId);
    }
  }

  async function finishIncident(rec: IncidentRecord, actor: Actor | null, reason: string): Promise<EndResult> {
    const claimed = await deps.store.claimEnd(rec.id, new Date(now()));
    if (!claimed) return { ok: false, error: "not_active" };
    const guildId = claimed.guildId;
    active.delete(guildId);
    tracker.cooldown(guildId, now());
    const snapshot = new Map((await deps.ops.snapshotChannels(guildId).catch(() => [])).map(c => [c.id, c]));
    const notes: string[] = [];
    let restored = 0;
    const auditReason = `Incident Mode ended: ${reason}`.slice(0, 400);
    for (const change of claimed.changes) {
      const step = planRestore(change, snapshot.get(change.channelId) ?? null);
      for (const n of step.notes) notes.push(`#${change.name}: ${n}`);
      try {
        if (step.slowmode !== undefined) await deps.ops.setSlowmode(guildId, change.channelId, step.slowmode, auditReason);
        if (step.overwrite) await deps.ops.setEveryoneSend(guildId, change.channelId, step.overwrite, auditReason);
        if (step.slowmode !== undefined || step.overwrite) restored++;
      } catch {
        notes.push(`#${change.name}: could not be restored; check it by hand`);
      }
      await pace();
    }
    if (claimed.invitesPaused) {
      try { await deps.ops.setInvitesDisabled(guildId, false, auditReason); }
      catch { notes.push("Invites could not be resumed; turn them back on in Server Settings → Invites."); }
    }
    const endedAt = new Date(now());
    const finished = await deps.store.finish(claimed.id, {
      endedAt, endedBy: actor, endReason: reason.slice(0, 512),
      event: event("end", `${actor ? `Ended by ${actor.tag}` : "Ended automatically"}: ${reason}. Restored ${restored} channel(s)${notes.length ? `, ${notes.length} note(s)` : ""}`, { userId: actor?.id ?? null }),
    }) ?? claimed;

    const summary = summarizeIncident({ startedAt: finished.startedAt, endedAt, counts: finished.counts, changes: finished.changes, invitesPaused: finished.invitesPaused, caseIds: finished.caseIds });
    const url = deps.reportUrl?.(guildId, finished.id) ?? null;
    await deps.ops.postModLog(guildId, {
      title: "✅ Incident Mode ended: report",
      color: COLOR_DONE,
      description: [
        `**Reason:** ${finished.reason}`,
        `**Ended:** ${actor ? `by ${actor.tag}` : "automatically"} (${reason})`,
        "", ...summary.map(l => `• ${l}`),
        ...(notes.length ? ["", "**Restore notes**", ...notes.slice(0, 10).map(n => `• ${n}`)] : []),
        ...(url ? ["", `Full timeline: ${url}`] : []),
      ].join("\n").slice(0, 4000),
    }).catch(() => undefined);
    return { ok: true, incident: finished, restored, notes };
  }

  async function end(guildId: string, input: { actor: Actor; reason: string }): Promise<EndResult> {
    if (busy.has(guildId)) return { ok: false, error: "busy" };
    busy.add(guildId);
    try {
      const rec = await deps.store.getActive(guildId);
      if (!rec || rec.status !== "active") return { ok: false, error: "not_active" };
      return await finishIncident(rec, input.actor, input.reason || "Ended by staff");
    } finally {
      busy.delete(guildId);
    }
  }

  /** Ends incidents past their time (and finishes any a dead process left half-ended). */
  async function sweep(): Promise<number> {
    const due = await deps.store.listDue(new Date(now())).catch(() => []);
    let ended = 0;
    for (const rec of due) {
      if (busy.has(rec.guildId)) continue;
      busy.add(rec.guildId);
      try {
        const result = await finishIncident(rec, null, rec.status === "ending" ? "recovered after a restart" : "duration reached");
        if (result.ok) ended++;
      } catch (err) {
        log.warn(`Incident expiry failed in ${rec.guildId}:`, err);
      } finally {
        busy.delete(rec.guildId);
      }
    }
    return ended;
  }

  /** Loads active incidents after a restart, ends overdue ones, and checks every 30 seconds from then on. */
  async function boot(intervalMs = 30_000): Promise<void> {
    for (const rec of await deps.store.listActive().catch(() => [])) active.set(rec.guildId, { id: rec.id, options: rec.options });
    await sweep();
    if (sweepTimer) clearInterval(sweepTimer);
    sweepTimer = setInterval(() => { sweep().catch(err => log.warn("Incident sweep failed:", err)); }, intervalMs);
    sweepTimer.unref?.();
  }

  function stop(): void {
    if (sweepTimer) clearInterval(sweepTimer);
    sweepTimer = null;
  }

  /** Called for every join. Gates it during an incident, or starts one when the auto-trigger fires. */
  async function onMemberJoin(guildId: string, member: { userId: string; tag: string; isBot: boolean; createdAt: Date; actionable: boolean }): Promise<GateDecision> {
    if (!active.has(guildId)) {
      const config = await deps.getConfig(guildId).catch(() => null);
      if (config && tracker.shouldTrigger(guildId, now(), config.autoTrigger)) {
        const bot = deps.ops.botUserId();
        const result = await start(guildId, {
          options: config.defaults, trigger: "auto", actor: { id: bot, tag: "Aegis auto-trigger" },
          reason: `${config.autoTrigger.joins}+ joins within ${config.autoTrigger.seconds}s`,
        });
        if (!result.ok) return { act: "none", why: "auto-trigger could not start" };
      }
    }
    const current = active.get(guildId);
    if (!current) return { act: "none", why: "no incident" };
    const decision = joinGateDecision(current.options, { isBot: member.isBot, accountCreatedAt: member.createdAt, actionable: member.actionable }, now());
    await record(guildId, event("join", `${member.tag} joined${member.isBot ? " (bot)" : ""}`, { userId: member.userId }), { joins: 1 });
    if (decision.act === "none") return decision;
    try {
      await deps.ops.gateMember(guildId, member.userId, decision.act, current.options.gateTimeoutMinutes, decision.reason);
      const caseId = await deps.ops.recordCase(guildId, member.userId, decision.act, decision.reason, `Incident ${current.id}`);
      await record(guildId, event("gate", `${decision.act === "kick" ? "Kicked" : "Timed out"} ${member.tag}: ${decision.reason}`, { userId: member.userId, caseId }), { gated: 1 });
    } catch (err) {
      await record(guildId, event("error", `Could not ${decision.act} ${member.tag}`, { userId: member.userId }));
      log.warn(`Incident join gate failed for ${member.userId} in ${guildId}:`, err);
      return { act: "none", why: "action failed" };
    }
    return decision;
  }

  return {
    start, end, sweep, boot, stop, onMemberJoin, record,
    isActive: (guildId: string) => active.has(guildId),
    getActive: (guildId: string) => deps.store.getActive(guildId),
    get: (guildId: string, id: string) => deps.store.get(guildId, id),
    list: (guildId: string, limit = 10) => deps.store.list(guildId, limit),
  };
}

export type IncidentService = ReturnType<typeof createIncidentService>;
