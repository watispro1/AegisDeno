/**
 * Pure helpers behind /automod's upgraded replies: the one-line "current
 * settings" summary shown after each change, autocomplete choices for the
 * existing words, domains and invite codes, warnings about permissions Aegis
 * lacks for a rule's action, and case-insensitive word lookup.
 */
import { PermissionFlagsBits } from "discord.js";
import type { AutomodConfig, AutomodRuleKey } from "../../../services/automod";
import { RULE_LABELS } from "../../../services/automodSettings";
import { rankChoices } from "../../../utils/autocomplete";

const ACTION_LABELS: Record<string, string> = { delete: "delete", warn: "delete + warn", timeout: "delete + timeout" };

function isRuleKey(value: string | null): value is AutomodRuleKey {
  return value !== null && value in RULE_LABELS;
}

/** One line describing a rule as it is now, e.g. "Spam filter: ✅ on · 5 msg / 5s · delete + timeout (5 min)". */
export function ruleSummary(cfg: AutomodConfig, key: AutomodRuleKey): string {
  const rule = cfg[key];
  const state = rule.enabled ? "✅ on" : "❌ off";
  const action = `${ACTION_LABELS[rule.action] ?? rule.action}${rule.action === "timeout" ? ` (${cfg.timeoutMinutes} min)` : ""}`;
  const detail: Record<AutomodRuleKey, string> = {
    words: `${cfg.words.list.length} word(s)`,
    links: `${cfg.links.allowedDomains.length} allowed domain(s)`,
    invites: `${cfg.invites.allowedCodes.length} allowed invite(s)`,
    mentions: `limit ${cfg.mentions.threshold}`,
    spam: `${cfg.spam.maxMessages} msg / ${cfg.spam.windowSeconds}s`,
    duplicates: `${cfg.duplicates.maxRepeats} copies / ${cfg.duplicates.windowSeconds}s`,
    caps: `${cfg.caps.threshold}% caps`,
    emoji: `over ${cfg.emoji.maxEmoji} emoji${cfg.emoji.zalgo ? ", zalgo" : ""}`,
  };
  const exempt = (rule.exemptRoleIds?.length ?? 0) + (rule.exemptChannelIds?.length ?? 0);
  return `**${RULE_LABELS[key]}:** ${state} · ${detail[key]} · ${action}${exempt ? ` · ${exempt} own exemption(s)` : ""}`;
}

/** The "Now:" line after a change to `group` (or the timeout length when group is null). */
export function afterChangeLine(cfg: AutomodConfig, group: string | null): string {
  if (isRuleKey(group)) return `\n> Now: ${ruleSummary(cfg, group)}`;
  return `\n> Now: timeouts last **${cfg.timeoutMinutes} minute(s)**.`;
}

/** Server-wide permissions a rule's action needs from Aegis. */
export function actionPermissions(action: string): Array<[bigint, string]> {
  const out: Array<[bigint, string]> = [[PermissionFlagsBits.ManageMessages, "Manage Messages"]];
  if (action === "timeout") out.push([PermissionFlagsBits.ModerateMembers, "Timeout Members"]);
  return out;
}

/**
 * A warning when Aegis lacks what an enabled rule's action needs, or "".
 * The setting is still saved; the rule just can't act until it's fixed.
 */
export function actionPermissionWarning(perms: { has(bit: bigint): boolean } | null | undefined, enabled: boolean, action: string, label: string): string {
  if (!perms || !enabled) return "";
  const missing = actionPermissions(action).filter(([bit]) => !perms.has(bit)).map(([, name]) => name);
  return missing.length
    ? `\n⚠️ Aegis lacks **${missing.join("**, **")}**, so the ${label.toLowerCase()} can't act yet. Give Aegis's role ${missing.length > 1 ? "them" : "it"} in Server Settings → Roles.`
    : "";
}

/** The stored spelling of a blocked word, matched without case; null when absent. */
export function findStoredWord(list: readonly string[], input: string): string | null {
  const q = input.trim().toLowerCase();
  return list.find(w => w.toLowerCase() === q) ?? null;
}

/** Autocomplete for /automod words remove, links unallow and invites unallow. */
export function automodChoices(cfg: AutomodConfig, option: string, query: string): { name: string; value: string }[] {
  const list = option === "word" ? cfg.words.list : option === "domain" ? cfg.links.allowedDomains : option === "code" ? cfg.invites.allowedCodes : [];
  return rankChoices(list.map(v => ({ name: v, value: v })), query);
}

/** Numbered lines for /automod words list. Words are shown in code spans so markdown can't break the list. */
export function wordListLines(list: readonly string[]): string[] {
  return [...list]
    .sort((a, b) => a.localeCompare(b))
    .map((w, i) => `${i + 1}. \`${w.replace(/`/g, "ˋ")}\``);
}
