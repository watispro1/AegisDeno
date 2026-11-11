/**
 * Filtering for the command reference: access levels, the search text and the
 * query-string filter. Shared by the server-rendered page (so filters work
 * without JavaScript) and mirrored by the client script.
 */
import type { CommandInfo } from "../catalog";
import { escapeHtml } from "./shared";

export type CommandAccess = "everyone" | "moderator" | "admin";

/** Who can run a command, as a level for the badges and the access filter. */
export function commandAccess(cmd: CommandInfo): CommandAccess {
  const perms = [...new Set([...cmd.declaredPermissions, ...cmd.enforcedPermissions])];
  // Server-wide settings count as admin: no command declares Administrator itself,
  // but Manage Server is the permission that gates configuration.
  if (perms.includes("Administrator") || perms.includes("Manage Server")) return "admin";
  return perms.length ? "moderator" : "everyone";
}

/** Lower-cased text the search box matches against, shared by the server-side and client-side filters. */
export function commandSearchText(cmd: CommandInfo): string {
  const options = [
    ...cmd.options,
    ...cmd.subcommands.flatMap(s => s.options.map(o => ({ ...o, name: `${s.path} ${o.name}` }))),
  ];
  return [
    cmd.name,
    cmd.category,
    cmd.description,
    ...cmd.subcommands.map(s => `${s.path} ${s.description}`),
    ...options.map(o => `${o.name} ${o.description} ${o.choices.join(" ")}`),
    ...cmd.declaredPermissions,
    ...cmd.enforcedPermissions,
  ]
    .join(" ")
    .toLowerCase();
}

/** Filters read from the query string, so the page filters without JavaScript too. */
export interface CommandFilter {
  q: string;
  cat: string;
  access: CommandAccess | "all";
  subs: boolean;
  auto: boolean;
}

const NO_FILTER: CommandFilter = { q: "", cat: "all", access: "all", subs: false, auto: false };

function first(v: unknown): string {
  if (Array.isArray(v)) return first(v[0]);
  return typeof v === "string" ? v : "";
}

/** Normalises an Express query object; unknown categories and access levels fall back to "all". */
export function parseCommandFilter(query: Record<string, unknown> | undefined, categories: string[]): CommandFilter {
  if (!query) return { ...NO_FILTER };
  const q = first(query.q).trim().slice(0, 100);
  const cat = first(query.cat);
  const access = first(query.access);
  return {
    q,
    cat: categories.includes(cat) ? cat : "all",
    access: access === "everyone" || access === "moderator" || access === "admin" ? access : "all",
    subs: first(query.subs) === "1",
    auto: first(query.auto) === "1",
  };
}

export function hasAutocomplete(cmd: CommandInfo): boolean {
  return [...cmd.options, ...cmd.subcommands.flatMap(s => s.options)].some(o => o.autocomplete);
}

/** Same rule as the client script: substring match, a leading "/" ignored. */
export function matchesFilter(cmd: CommandInfo, f: CommandFilter): boolean {
  const q = f.q.toLowerCase().replace(/^\//, "");
  return (!q || commandSearchText(cmd).includes(q)) &&
    (f.cat === "all" || cmd.category === f.cat) &&
    (f.access === "all" || commandAccess(cmd) === f.access) &&
    (!f.subs || cmd.subcommands.length > 0) &&
    (!f.auto || hasAutocomplete(cmd));
}

/** A /commands URL for a filter state (already escaped for an attribute). */
export function filterHref(f: CommandFilter): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.cat !== "all") p.set("cat", f.cat);
  if (f.access !== "all") p.set("access", f.access);
  if (f.subs) p.set("subs", "1");
  if (f.auto) p.set("auto", "1");
  const qs = p.toString();
  return escapeHtml(`/commands${qs ? `?${qs}` : ""}`);
}

