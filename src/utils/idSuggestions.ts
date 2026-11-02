/**
 * Autocomplete suggestions for ID options that used to need copy-paste:
 * scheduled task IDs on /automation cancel and appeal codes on /appeal view
 * and /appeal review. Pure functions over plain rows, so they can be tested
 * without Discord or Mongo; the commands do the permission checks and lookups.
 */
import { rankChoices, shortAge, type AutocompleteItem } from "./autocomplete";

export interface TaskSuggestionRow {
  id: string;
  type: string;
  creatorId: string;
  channelId: string;
  executeAt: Date;
  intervalMs?: number | null;
  /** Readable preview of the payload (message text or embed title). */
  preview: string;
}

/** Short "in 3h" style label for a future time. Discord timestamps don't render in choices. */
export function shortUntil(date: Date | string | number, now = Date.now()): string {
  const ms = new Date(date).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 60_000) return "due now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `in ${h}h`;
  return `in ${Math.floor(h / 24)}d`;
}

/**
 * Tasks the member may cancel: their own, or every task in the server when
 * they have Manage Server (the same rule /automation cancel enforces).
 */
export function taskIdSuggestions(
  rows: readonly TaskSuggestionRow[],
  query: string,
  viewer: { userId: string; canManageServer: boolean },
  now = Date.now(),
): { name: string; value: string }[] {
  const items: AutocompleteItem[] = rows
    .filter((row) => viewer.canManageServer || row.creatorId === viewer.userId)
    .sort((a, b) => new Date(a.executeAt).getTime() - new Date(b.executeAt).getTime())
    .map((row) => {
      const kind = row.type === "reminder" ? "⏰ Reminder" : row.intervalMs ? "🔁 Repeating" : "📅 Message";
      const preview = row.preview.replace(/\s+/g, " ").trim() || "(no text)";
      return {
        name: `${kind} · ${shortUntil(row.executeAt, now)} · ${preview}`,
        value: row.id,
        keywords: `${row.type} ${preview}`,
      };
    });
  return rankChoices(items, query);
}

export interface AppealSuggestionRow {
  appealCode: string;
  userId: string;
  status: string;
  banReason?: string | null;
  createdAt: Date;
}

const APPEAL_ICONS: Record<string, string> = { pending: "⏳", approved: "✅", denied: "❌", expired: "💤" };

/**
 * Appeal codes for /appeal view and review, newest first. `review` only offers
 * pending appeals, since a decided appeal can't be reviewed again.
 */
export function appealCodeSuggestions(
  rows: readonly AppealSuggestionRow[],
  query: string,
  mode: "view" | "review",
  now = Date.now(),
): { name: string; value: string }[] {
  const items: AutocompleteItem[] = rows
    .filter((row) => mode === "view" || row.status === "pending")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((row) => ({
      name: `${row.appealCode} · ${APPEAL_ICONS[row.status] ?? "•"} ${row.status} · user ${row.userId} · ${shortAge(row.createdAt, now)}${row.banReason ? ` · ${row.banReason}` : ""}`,
      value: row.appealCode,
      keywords: `${row.userId} ${row.banReason ?? ""}`,
    }));
  return rankChoices(items, query);
}
