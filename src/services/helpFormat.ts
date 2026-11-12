/**
 * Formatting helpers for /help: category labels and docs links, access labels,
 * cooldown display and the Apps (right-click) section. Kept out of help.ts so
 * the command file stays small; pure apart from reading command builders.
 */
import type { PermissionResolvable } from "discord.js";
import type { Command, ContextMenu } from "../types/discord";
import { DEFAULT_COOLDOWN_MS, formatPermissions as formatPermissionNames } from "../commands/executor";
import { COMMAND_CATEGORIES } from "../commands/loader";
import { DOC_ANCHORS, docsUrl } from "../config/links";

export function subcommandNames(cmd: Command): string[] {
  const json = cmd.data.toJSON() as { options?: Array<{ type: number; name: string; options?: Array<{ type: number; name: string }> }> };
  const out: string[] = [];
  for (const o of json.options ?? []) {
    if (o.type === 1) out.push(o.name);
    if (o.type === 2) for (const sub of o.options ?? []) out.push(`${o.name} ${sub.name}`);
  }
  return out;
}

export const CATEGORY_ICONS: Record<string, string> = {
  general: "🌐",
  moderation: "🔨",
  config: "⚙️",
  logging: "📋",
  automod: "🛡️",
  welcome: "👋",
  community: "🗳️",
  automation: "⏰",
  tickets: "🎫",
  verification: "🛡️",
  autoresponder: "🤖",
  roles: "🎭",
  economy: "💰",
  developer: "🔧",
};

export const CATEGORIES: Record<string, string> = Object.fromEntries(
  COMMAND_CATEGORIES.map((cat) => [
    cat,
    `${CATEGORY_ICONS[cat] ?? "•"} ${cat[0].toUpperCase()}${cat.slice(1)}`,
  ]),
);

/** Docs section that explains each command category. */
const CATEGORY_DOC_ANCHORS: Record<string, string> = {
  general: DOC_ANCHORS.quickstart,
  moderation: DOC_ANCHORS.moderation,
  config: DOC_ANCHORS.configuration,
  logging: DOC_ANCHORS.logging,
  automod: DOC_ANCHORS.automod,
  welcome: DOC_ANCHORS.welcome,
  community: DOC_ANCHORS.community,
  automation: DOC_ANCHORS.automation,
  tickets: DOC_ANCHORS.tickets,
  verification: DOC_ANCHORS.verification,
  autoresponder: DOC_ANCHORS.autoresponder,
  roles: DOC_ANCHORS.rolePanels,
  economy: DOC_ANCHORS.economy,
  developer: DOC_ANCHORS.configuration,
};

export function categoryDocsUrl(category: string | null | undefined): string {
  return docsUrl(category ? CATEGORY_DOC_ANCHORS[category] : undefined);
}

/** Short access label for a command, or null when everyone can run it. */
export function accessLabel(cmd: Command): string | null {
  if (cmd.userPermissions?.length) return formatPermissions(cmd.userPermissions);
  const json = cmd.data.toJSON() as { default_member_permissions?: string | null };
  const declared = json.default_member_permissions;
  if (declared && declared !== "0") {
    try {
      return formatPermissions([BigInt(declared)]);
    } catch {
      return null;
    }
  }
  return null;
}

export function formatPermissions(permissions?: PermissionResolvable[]): string {
  if (!permissions?.length) return "Everyone";
  return formatPermissionNames(permissions);
}

export function truncate(value: string, limit = 1_000): string {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

/** Seconds as "1.5s", "30s", "2m", "1m 30s", "1h", "24h". */
function formatDuration(ms: number): string {
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) return `${Number.isInteger(totalSeconds) ? totalSeconds : totalSeconds.toFixed(1).replace(/\.0$/, "")}s`;
  const seconds = Math.round(totalSeconds);
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60), s = seconds % 60;
    return s ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600), m = Math.round((seconds % 3600) / 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

/**
 * The per-member cooldown as /help shows it. Mirrors the executor: an unset
 * cooldown uses the default, and 0 turns the cooldown off.
 */
export function formatCooldown(cooldownMs: number | undefined): string {
  if (cooldownMs === undefined) return `${formatDuration(DEFAULT_COOLDOWN_MS)} (default)`;
  if (cooldownMs <= 0) return "None";
  return formatDuration(cooldownMs);
}

/** Select-menu value for the Apps (right-click commands) page. */
export const APPS_PAGE = "apps";

/** The Apps section: one line per context menu, with how to open it. */
export function appsSectionText(menus: Iterable<Pick<ContextMenu, "description" | "guildOnly"> & { data: { name: string } }>, inGuild: boolean): string {
  const lines = Array.from(menus, (m) => `**${m.data.name}** — ${m.description}`);
  if (!lines.length) return "No right-click commands.";
  const note = inGuild ? "" : "\n*These work in servers, not in DMs.*";
  return truncate(lines.join("\n") + note, 1_000);
}
