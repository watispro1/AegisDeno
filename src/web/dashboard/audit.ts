/**
 * The dashboard's own audit trail: every change made through the dashboard,
 * per server, with who made it. Shown on /dashboard/:guildId/activity.
 * Recording never blocks or fails a save; a write error is only logged.
 */
import { DashboardAuditModel } from "../../database/mongo";
import { logger } from "../../utils/logger";

export interface AuditEntry {
  guildId: string;
  userId: string;
  username: string;
  /** Dotted action name, e.g. "settings.automod", "case.revoke", "appeal.approved". */
  action: string;
  target: string | null;
  summary: string;
  createdAt: Date;
}

export interface AuditStore {
  record(entry: Omit<AuditEntry, "createdAt"> & { createdAt?: Date }): Promise<void>;
  list(guildId: string, opts: { page: number; perPage: number }): Promise<{ items: AuditEntry[]; total: number }>;
}

export const AUDIT_SUMMARY_MAX = 600;

function clean(entry: Omit<AuditEntry, "createdAt"> & { createdAt?: Date }): AuditEntry {
  return {
    guildId: entry.guildId,
    userId: entry.userId,
    username: entry.username.slice(0, 64),
    action: entry.action.slice(0, 64),
    target: entry.target ? entry.target.slice(0, 100) : null,
    summary: entry.summary.slice(0, AUDIT_SUMMARY_MAX),
    createdAt: entry.createdAt ?? new Date(),
  };
}

export function memoryAuditStore(): AuditStore & { all(): AuditEntry[] } {
  const rows: AuditEntry[] = [];
  return {
    async record(entry) {
      rows.push(clean(entry));
    },
    async list(guildId, { page, perPage }) {
      const mine = rows.filter(r => r.guildId === guildId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return { items: mine.slice((page - 1) * perPage, page * perPage), total: mine.length };
    },
    all: () => rows.slice(),
  };
}

export function mongoAuditStore(): AuditStore {
  return {
    async record(entry) {
      try {
        await DashboardAuditModel.create(clean(entry));
      } catch (err) {
        logger.warn(`Dashboard audit write failed: ${(err as Error)?.message ?? err}`);
      }
    },
    async list(guildId, { page, perPage }) {
      const [docs, total] = await Promise.all([
        DashboardAuditModel.find({ guildId }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * perPage).limit(perPage).lean(),
        DashboardAuditModel.countDocuments({ guildId }),
      ]);
      return {
        items: docs.map(d => ({
          guildId: d.guildId,
          userId: d.userId,
          username: d.username,
          action: d.action,
          target: d.target ?? null,
          summary: d.summary ?? "",
          createdAt: new Date(d.createdAt),
        })),
        total,
      };
    },
  };
}

/** Form keys that hold lists (word list one per line; picked IDs comma-joined). */
export const DEFAULT_LIST_KEYS: Record<string, string> = {
  words_list: "\n",
  exempt_roles: ",",
  exempt_channels: ",",
  ignoredChannels: ",",
  ignoredRoles: ",",
};

/** Friendlier names for the list fields in the activity log. */
export const DEFAULT_FIELD_LABELS: Record<string, string> = {
  words_list: "blocked words",
  exempt_roles: "exempt roles",
  exempt_channels: "exempt channels",
  ignoredChannels: "ignored channels",
  ignoredRoles: "ignored roles",
};

/**
 * Human-readable list of what changed between two flattened forms, e.g.
 * `threshold: 3 → 5; selfStar: off → on`. Keys in `labels` get friendlier
 * names; long values are shortened.
 */
export function describeChanges(
  before: Record<string, string | boolean>,
  after: Record<string, string | boolean>,
  labels: Record<string, string> = DEFAULT_FIELD_LABELS,
  /** Keys holding lists, with their separator; reported as added and removed items. */
  lists: Record<string, string> = DEFAULT_LIST_KEYS,
): string {
  const show = (v: string | boolean | undefined) => {
    if (v === undefined || v === "") return "(none)";
    if (typeof v === "boolean") return v ? "on" : "off";
    const one = v.replace(/\s+/g, " ");
    return one.length > 60 ? `${one.slice(0, 57)}…` : one;
  };
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const parts: string[] = [];
  for (const key of keys) {
    if (before[key] === after[key]) continue;
    if ((before[key] ?? "") === (after[key] ?? "")) continue;
    const sep = lists[key];
    if (sep !== undefined) {
      const split = (v: string | boolean | undefined) => (typeof v === "string" ? v.split(sep).map(x => x.trim()).filter(Boolean) : []);
      const old = split(before[key]);
      const now = split(after[key]);
      const added = now.filter(x => !old.includes(x));
      const removed = old.filter(x => !now.includes(x));
      const list = (xs: string[]) => (xs.length > 5 ? `${xs.slice(0, 5).join(", ")} and ${xs.length - 5} more` : xs.join(", "));
      const bits = [added.length ? `+${list(added)}` : "", removed.length ? `-${list(removed)}` : ""].filter(Boolean);
      if (bits.length) parts.push(`${labels[key] ?? key}: ${bits.join(" ")}`);
      continue;
    }
    parts.push(`${labels[key] ?? key}: ${show(before[key])} → ${show(after[key])}`);
  }
  return parts.join("; ");
}
