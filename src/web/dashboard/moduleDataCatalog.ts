/**
 * Static facts about each dashboard module: the icon (same glyph as the
 * sidebar), a one-line description, the category it is grouped under on the
 * overview and the slash command it mirrors. Pure data, no
 * I/O, so views and tests can read it freely.
 */

export type ModuleCategory = "Moderation" | "Community" | "Automation";

export const MODULE_CATEGORIES: readonly ModuleCategory[] = ["Moderation", "Community", "Automation"];

export interface ModuleMeta {
  icon: string;
  description: string;
  category: ModuleCategory;
  /** The slash command that does the same job in Discord (shown on module pages). */
  command?: string;
}

export const MODULE_META: Readonly<Record<string, ModuleMeta>> = {
  incident: { icon: "⚠", category: "Moderation", description: "Lock the server down fast during a raid.", command: "/incident" },
  moderation: { icon: "⚖", category: "Moderation", description: "Escalate automatically as warnings add up.", command: "/warn" },
  automod: { icon: "⛨", category: "Moderation", description: "Filter spam, links, invites, caps and bad words.", command: "/automod" },
  logging: { icon: "≡", category: "Moderation", description: "Record moderation and server events in a channel.", command: "/config logging" },
  appeals: { icon: "✉", category: "Moderation", description: "Let members appeal bans and warnings.", command: "/appeal" },
  welcome: { icon: "☺", category: "Community", description: "Greet new members with a message and a role.", command: "/config welcome" },
  goodbye: { icon: "☺", category: "Community", description: "Post a note when someone leaves.", command: "/config goodbye" },
  verification: { icon: "✓", category: "Community", description: "Make new members verify before they can talk.", command: "/verify setup" },
  panels: { icon: "▦", category: "Community", description: "Self-assign role buttons and menus.", command: "/rolepanel" },
  tickets: { icon: "✎", category: "Community", description: "Private support threads with transcripts.", command: "/ticket setup" },
  starboard: { icon: "★", category: "Community", description: "Repost the server's most-starred messages.", command: "/starboard" },
  suggestions: { icon: "?", category: "Community", description: "Collect and review member suggestions.", command: "/suggest" },
  giveaways: { icon: "✦", category: "Community", description: "Run timed giveaways with automatic draws.", command: "/giveaway" },
  autoresponders: { icon: "↩", category: "Automation", description: "Reply automatically to trigger phrases.", command: "/autoresponder" },
  automations: { icon: "◷", category: "Automation", description: "Schedule one-off or repeating messages.", command: "/automation" },
};

const FALLBACK: ModuleMeta = { icon: "•", category: "Community", description: "" };

export function moduleMeta(key: string): ModuleMeta {
  return MODULE_META[key] ?? FALLBACK;
}

/** The public command reference entry for a module (its root slash command), else the docs. */
export function moduleDocsHref(key: string): string {
  const root = moduleMeta(key).command?.replace(/^\//, "").split(" ")[0];
  return root ? `/commands#cmd-${root}` : "/docs";
}

/** How ready a module is: working, switched on but missing something, or blocked by a permission/visibility problem. */
export type Readiness = "ready" | "setup" | "problem" | "off";

export const READINESS_LABEL: Readonly<Record<Readiness, string>> = {
  ready: "Configured",
  setup: "Needs setup",
  problem: "Problem",
  off: "Not in use",
};
