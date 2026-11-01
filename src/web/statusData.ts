/**
 * The public status payload: served as /api/status and rendered by /status.
 * Pure, so every state rule is unit-tested. It carries no secrets, hostnames,
 * IPs, environment values or error messages: only states, counts and times.
 */
import { bucketize, uptimeRatio, type CommandRegistration, type HeartbeatSample } from "../services/statusMonitor";
import { noticeOpen, type StatusNotice } from "./statusNotices";

export type ComponentState = "operational" | "degraded" | "outage" | "unknown";
export type OverallState = "operational" | "degraded" | "major_outage" | "maintenance";

export interface StatusInput {
  nowMs: number;
  online: boolean;
  ping: number;
  guilds: number;
  shards: number;
  memoryRss: number;
  version: string;
  startedAt: number;
  commands: number;
  dbConnected: boolean;
  dbLatency: number | null;
  registration: CommandRegistration;
  samples: readonly HeartbeatSample[];
  notices: readonly StatusNotice[];
}

export interface StatusComponent { id: string; name: string; state: ComponentState; detail: string }
export interface HistoryWindow { label: string; uptime: number | null; buckets: Array<{ start: string; end: string; uptime: number | null }> }

export interface StatusPayload {
  status: OverallState;
  headline: string;
  updatedAt: string;
  components: StatusComponent[];
  metrics: { uptimeSeconds: number; pingMs: number; guilds: number; shards: number; memoryMb: number; version: string; lastDeploy: string; commands: number };
  history: { day: HistoryWindow; week: HistoryWindow };
  notices: Array<{ title: string; body: string; kind: string; severity: string; startsAt: string; endsAt: string | null; resolvedAt: string | null; open: boolean }>;
}

const HEADLINES: Record<OverallState, string> = {
  operational: "All systems operational",
  degraded: "Some systems are degraded",
  major_outage: "Major outage",
  maintenance: "Maintenance in progress",
};

export function gatewayState(online: boolean, ping: number): StatusComponent {
  if (!online) return { id: "gateway", name: "Bot gateway", state: "outage", detail: "Not connected to Discord" };
  if (ping <= 0) return { id: "gateway", name: "Bot gateway", state: "degraded", detail: "Connected, waiting for the first heartbeat" };
  return { id: "gateway", name: "Bot gateway", state: "operational", detail: "Connected to Discord" };
}

export function latencyState(online: boolean, ping: number): StatusComponent {
  const base = { id: "latency", name: "Discord API latency" };
  if (!online || ping <= 0) return { ...base, state: "unknown", detail: "No heartbeat measured yet" };
  if (ping < 300) return { ...base, state: "operational", detail: `${ping} ms heartbeat round trip` };
  if (ping < 1000) return { ...base, state: "degraded", detail: `${ping} ms: commands may feel slow` };
  return { ...base, state: "outage", detail: `${ping} ms: Discord is struggling` };
}

export function databaseState(connected: boolean, latency: number | null): StatusComponent {
  const base = { id: "database", name: "Database" };
  if (!connected) return { ...base, state: "outage", detail: "Not connected: settings and cases can't be read or saved" };
  if (latency === null) return { ...base, state: "degraded", detail: "Connected, but not answering quickly" };
  if (latency > 500) return { ...base, state: "degraded", detail: `Slow (${latency} ms)` };
  return { ...base, state: "operational", detail: `Answering in ${latency} ms` };
}

export function registrationState(r: CommandRegistration): StatusComponent {
  const base = { id: "commands", name: "Command registration" };
  if (r.ok === null) return { ...base, state: "unknown", detail: "Not attempted since the last restart" };
  if (r.ok) return { ...base, state: "operational", detail: `${r.count} slash commands registered with Discord` };
  return { ...base, state: "degraded", detail: "The last registration failed; commands already registered keep working" };
}

function windowOf(label: string, samples: readonly HeartbeatSample[], nowMs: number, spanMs: number, count: number): HistoryWindow {
  return {
    label,
    uptime: uptimeRatio(samples, nowMs, spanMs),
    buckets: bucketize(samples, nowMs, spanMs, count).map(b => ({ start: new Date(b.start).toISOString(), end: new Date(b.end).toISOString(), uptime: b.uptime === null ? null : Math.round(b.uptime * 10000) / 10000 })),
  };
}

export function overallState(components: readonly StatusComponent[], notices: readonly StatusNotice[], nowMs: number): OverallState {
  const byId = new Map(components.map(c => [c.id, c.state]));
  if (byId.get("gateway") === "outage" || byId.get("database") === "outage") return "major_outage";
  const open = notices.filter(n => noticeOpen(n, nowMs));
  if (open.some(n => n.kind === "incident" && n.severity === "major")) return "major_outage";
  if (components.some(c => c.state === "outage" || c.state === "degraded") || open.some(n => n.kind === "incident")) return "degraded";
  if (open.some(n => n.kind === "maintenance" && n.startsAt.getTime() <= nowMs)) return "maintenance";
  return "operational";
}

export function buildStatusPayload(input: StatusInput): StatusPayload {
  const components: StatusComponent[] = [
    gatewayState(input.online, input.ping),
    { id: "web", name: "Dashboard & website", state: "operational", detail: "Serving pages (you are reading one)" },
    databaseState(input.dbConnected, input.dbLatency),
    latencyState(input.online, input.ping),
    registrationState(input.registration),
  ];
  const status = overallState(components, input.notices, input.nowMs);
  return {
    status,
    headline: HEADLINES[status],
    updatedAt: new Date(input.nowMs).toISOString(),
    components,
    metrics: {
      uptimeSeconds: Math.max(0, Math.floor((input.nowMs - input.startedAt) / 1000)),
      pingMs: Math.max(0, Math.round(input.ping)),
      guilds: input.guilds,
      shards: Math.max(1, input.shards),
      memoryMb: Math.round(input.memoryRss / 1048576),
      version: input.version,
      lastDeploy: new Date(input.startedAt).toISOString(),
      commands: input.commands,
    },
    history: {
      day: windowOf("Last 24 hours", input.samples, input.nowMs, 86_400_000, 24),
      week: windowOf("Last 7 days", input.samples, input.nowMs, 7 * 86_400_000, 28),
    },
    notices: input.notices.map(n => ({
      title: n.title, body: n.body, kind: n.kind, severity: n.severity,
      startsAt: n.startsAt.toISOString(), endsAt: n.endsAt?.toISOString() ?? null, resolvedAt: n.resolvedAt?.toISOString() ?? null,
      open: noticeOpen(n, input.nowMs),
    })),
  };
}
