/**
 * Where incidents are kept: Mongo in production, memory in tests. One
 * document per incident holds its options, every change it made (so ending it
 * restores the exact prior state, even after a restart), its counters and a
 * capped timeline. A partial unique index allows only one active incident per
 * server, which makes starting one concurrency-safe across processes.
 */
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import {
  INCIDENT_TIMELINE_MAX,
  type ChannelChange, type IncidentCounts, type IncidentOptions, type IncidentTrigger, type TimelineEvent,
} from "./incidentLogic";

export type IncidentStatus = "active" | "ending" | "ended";

export interface IncidentRecord {
  id: string;
  guildId: string;
  status: IncidentStatus;
  trigger: IncidentTrigger;
  reason: string;
  startedBy: { id: string; tag: string };
  startedAt: Date;
  endsAt: Date;
  endedAt: Date | null;
  endedBy: { id: string; tag: string } | null;
  endReason: string | null;
  options: IncidentOptions;
  changes: ChannelChange[];
  /** Whether Aegis paused invites (and so must resume them). */
  invitesPaused: boolean;
  timeline: TimelineEvent[];
  counts: IncidentCounts;
  caseIds: string[];
  /** True once the timeline cap dropped events (counters still include them). */
  timelineTruncated?: boolean;
  /** When the "ending" claim was taken, to recover a process that died mid-restore. */
  endingSince: Date | null;
}

export type NewIncident = Omit<IncidentRecord, "id" | "status" | "endedAt" | "endedBy" | "endReason" | "changes" | "invitesPaused" | "counts" | "caseIds" | "endingSince">;

export interface IncidentStore {
  /** Inserts an active incident, or returns null when the server already has one. */
  createActive(input: NewIncident): Promise<IncidentRecord | null>;
  getActive(guildId: string): Promise<IncidentRecord | null>;
  get(guildId: string, id: string): Promise<IncidentRecord | null>;
  list(guildId: string, limit: number): Promise<IncidentRecord[]>;
  saveChanges(id: string, changes: ChannelChange[], invitesPaused: boolean): Promise<void>;
  /** Adds an event to the server's active incident; counters always move, the timeline is capped. */
  appendEvent(guildId: string, event: TimelineEvent, inc?: Partial<IncidentCounts>, caseId?: string): Promise<boolean>;
  /** Atomically moves active (or a stale ending) → ending; only the caller that gets the record restores. */
  claimEnd(id: string, now: Date): Promise<IncidentRecord | null>;
  finish(id: string, patch: { endedAt: Date; endedBy: { id: string; tag: string } | null; endReason: string; event: TimelineEvent }): Promise<IncidentRecord | null>;
  /** Active incidents past their end time, and "ending" ones stuck for over five minutes. */
  listDue(now: Date): Promise<IncidentRecord[]>;
  listActive(): Promise<IncidentRecord[]>;
}

/* ── Mongo ────────────────────────────────────────────────────────── */

const IncidentSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  guildId: { type: String, required: true },
  status: { type: String, enum: ["active", "ending", "ended"], required: true },
  trigger: { type: String, required: true },
  reason: { type: String, default: "", maxlength: 512 },
  startedBy: { id: String, tag: String },
  startedAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  endedAt: { type: Date, default: null },
  endedBy: { type: mongoose.Schema.Types.Mixed, default: null },
  endReason: { type: String, default: null },
  options: { type: mongoose.Schema.Types.Mixed, required: true },
  changes: { type: mongoose.Schema.Types.Mixed, default: [] },
  invitesPaused: { type: Boolean, default: false },
  timeline: { type: mongoose.Schema.Types.Mixed, default: [] },
  counts: { joins: { type: Number, default: 0 }, gated: { type: Number, default: 0 }, cases: { type: Number, default: 0 }, deleted: { type: Number, default: 0 } },
  caseIds: { type: [String], default: [] },
  endingSince: { type: Date, default: null },
  timelineTruncated: { type: Boolean, default: false },
}, { minimize: false, versionKey: false });
// One active (or ending) incident per server.
IncidentSchema.index({ guildId: 1 }, { unique: true, partialFilterExpression: { status: { $in: ["active", "ending"] } }, name: "one_open_incident_per_guild" });
IncidentSchema.index({ guildId: 1, startedAt: -1 });
IncidentSchema.index({ status: 1, endsAt: 1 });
// Reports are kept for 90 days after the incident ends (TTL ignores the null of open incidents).
IncidentSchema.index({ endedAt: 1 }, { expireAfterSeconds: 90 * 86_400 });
export const IncidentModel = mongoose.models.Incident ?? mongoose.model("Incident", IncidentSchema);

function fromDoc(d: Record<string, unknown> | null): IncidentRecord | null {
  if (!d) return null;
  const { _id, ...rest } = d;
  return { ...(rest as Omit<IncidentRecord, "id">), id: String(_id), timeline: (rest.timeline as TimelineEvent[]) ?? [], caseIds: (rest.caseIds as string[]) ?? [] };
}

function isDuplicateKey(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && (err as { code?: unknown }).code === 11000);
}

function incPaths(inc: Partial<IncidentCounts> = {}): Record<string, number> {
  return Object.fromEntries(Object.entries(inc).filter(([, v]) => typeof v === "number" && v !== 0).map(([k, v]) => [`counts.${k}`, v as number]));
}

export function mongoIncidentStore(): IncidentStore {
  const lean = (q: { lean(): unknown }) => q.lean() as Promise<Record<string, unknown> | null>;
  return {
    async createActive(input) {
      try {
        const doc = await IncidentModel.create({ _id: randomUUID(), ...input, status: "active", counts: { joins: 0, gated: 0, cases: 0, deleted: 0 } });
        return fromDoc(doc.toObject());
      } catch (err) {
        if (isDuplicateKey(err)) return null;
        throw err;
      }
    },
    async getActive(guildId) {
      return fromDoc(await lean(IncidentModel.findOne({ guildId, status: { $in: ["active", "ending"] } })));
    },
    async get(guildId, id) {
      if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) return null;
      return fromDoc(await lean(IncidentModel.findOne({ _id: id, guildId })));
    },
    async list(guildId, limit) {
      const docs = (await IncidentModel.find({ guildId }).sort({ startedAt: -1 }).limit(limit).select({ timeline: 0 }).lean()) as Record<string, unknown>[];
      return docs.map(d => fromDoc(d)!);
    },
    async saveChanges(id, changes, invitesPaused) {
      await IncidentModel.updateOne({ _id: id }, { $set: { changes, invitesPaused } });
    },
    async appendEvent(guildId, event, inc, caseId) {
      const filter = { guildId, status: "active" };
      const counters = incPaths(inc);
      const always = event.kind === "start" || event.kind === "end";
      const capped = await IncidentModel.updateOne(
        always ? filter : { ...filter, [`timeline.${INCIDENT_TIMELINE_MAX - 1}`]: { $exists: false } },
        { $push: { timeline: event }, ...(Object.keys(counters).length ? { $inc: counters } : {}), ...(caseId ? { $addToSet: { caseIds: caseId } } : {}) },
      );
      if (capped.matchedCount > 0) return true;
      // Timeline full: still count it.
      const res = await IncidentModel.updateOne(filter, { ...(Object.keys(counters).length ? { $inc: counters } : {}), ...(caseId ? { $addToSet: { caseIds: caseId } } : {}), $set: { timelineTruncated: true } });
      return res.matchedCount > 0;
    },
    async claimEnd(id, now) {
      const stale = new Date(now.getTime() - 5 * 60_000);
      return fromDoc(await lean(IncidentModel.findOneAndUpdate(
        { _id: id, $or: [{ status: "active" }, { status: "ending", endingSince: { $lte: stale } }] },
        { $set: { status: "ending", endingSince: now } },
        { new: true },
      )));
    },
    async finish(id, patch) {
      return fromDoc(await lean(IncidentModel.findOneAndUpdate(
        { _id: id, status: "ending" },
        { $set: { status: "ended", endedAt: patch.endedAt, endedBy: patch.endedBy, endReason: patch.endReason, endingSince: null }, $push: { timeline: patch.event } },
        { new: true },
      )));
    },
    async listDue(now) {
      const docs = (await IncidentModel.find({ $or: [
        { status: "active", endsAt: { $lte: now } },
        { status: "ending", endingSince: { $lte: new Date(now.getTime() - 5 * 60_000) } },
      ] }).limit(50).lean()) as Record<string, unknown>[];
      return docs.map(d => fromDoc(d)!);
    },
    async listActive() {
      const docs = (await IncidentModel.find({ status: "active" }).select({ timeline: 0 }).limit(1000).lean()) as Record<string, unknown>[];
      return docs.map(d => fromDoc(d)!);
    },
  };
}

/* ── Memory (tests) ───────────────────────────────────────────────── */

export function memoryIncidentStore(): IncidentStore & { all(): IncidentRecord[] } {
  const rows = new Map<string, IncidentRecord>();
  const copy = (r: IncidentRecord | undefined | null) => (r ? structuredClone(r) : null);
  const open = (guildId: string) => [...rows.values()].find(r => r.guildId === guildId && r.status !== "ended");
  return {
    async createActive(input) {
      if (open(input.guildId)) return null;
      const rec: IncidentRecord = {
        ...structuredClone(input), id: randomUUID(), status: "active", endedAt: null, endedBy: null, endReason: null,
        changes: [], invitesPaused: false, counts: { joins: 0, gated: 0, cases: 0, deleted: 0 }, caseIds: [], endingSince: null,
      };
      rows.set(rec.id, rec);
      return copy(rec);
    },
    async getActive(guildId) { return copy(open(guildId)); },
    async get(guildId, id) { const r = rows.get(id); return r && r.guildId === guildId ? copy(r) : null; },
    async list(guildId, limit) {
      return [...rows.values()].filter(r => r.guildId === guildId).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime()).slice(0, limit).map(r => copy(r)!);
    },
    async saveChanges(id, changes, invitesPaused) {
      const r = rows.get(id);
      if (r) { r.changes = structuredClone(changes); r.invitesPaused = invitesPaused; }
    },
    async appendEvent(guildId, event, inc = {}, caseId) {
      const r = [...rows.values()].find(x => x.guildId === guildId && x.status === "active");
      if (!r) return false;
      if (event.kind === "start" || event.kind === "end" || r.timeline.length < INCIDENT_TIMELINE_MAX) r.timeline.push(structuredClone(event));
      else r.timelineTruncated = true;
      for (const [k, v] of Object.entries(inc)) r.counts[k as keyof IncidentCounts] += v ?? 0;
      if (caseId && !r.caseIds.includes(caseId)) r.caseIds.push(caseId);
      return true;
    },
    async claimEnd(id, now) {
      const r = rows.get(id);
      const stale = r?.status === "ending" && r.endingSince !== null && r.endingSince.getTime() <= now.getTime() - 5 * 60_000;
      if (!r || (r.status !== "active" && !stale)) return null;
      r.status = "ending"; r.endingSince = now;
      return copy(r);
    },
    async finish(id, patch) {
      const r = rows.get(id);
      if (!r || r.status !== "ending") return null;
      Object.assign(r, { status: "ended", endedAt: patch.endedAt, endedBy: patch.endedBy, endReason: patch.endReason, endingSince: null });
      r.timeline.push(structuredClone(patch.event));
      return copy(r);
    },
    async listDue(now) {
      return [...rows.values()].filter(r =>
        (r.status === "active" && r.endsAt <= now) ||
        (r.status === "ending" && r.endingSince !== null && r.endingSince.getTime() <= now.getTime() - 5 * 60_000)).map(r => copy(r)!);
    },
    async listActive() { return [...rows.values()].filter(r => r.status === "active").map(r => copy(r)!); },
    all: () => [...rows.values()].map(r => copy(r)!),
  };
}
