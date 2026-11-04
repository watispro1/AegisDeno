/**
 * /automod exempt: global or per-rule role and channel exemptions. Pure list
 * edits (tested) plus the text shown in /automod status.
 */
import { AUTOMOD_RULE_KEYS, MAX_EXEMPTIONS, type AutomodConfig, type AutomodRuleKey } from "./automod";

export type ExemptScope = "all" | AutomodRuleKey;
export const EXEMPT_SCOPE_CHOICES: Array<{ name: string; value: ExemptScope }> = [
  { name: "All rules", value: "all" },
  { name: "Blocked words", value: "words" },
  { name: "Links", value: "links" },
  { name: "Mention spam", value: "mentions" },
  { name: "Message spam", value: "spam" },
  { name: "Caps and floods", value: "caps" },
  { name: "Invites", value: "invites" },
  { name: "Duplicate messages", value: "duplicates" },
  { name: "Emoji and zalgo", value: "emoji" },
];
const SCOPE_LABEL: Record<ExemptScope, string> = Object.fromEntries(EXEMPT_SCOPE_CHOICES.map(c => [c.value, c.name])) as Record<ExemptScope, string>;

export function parseScope(raw: string | null): ExemptScope {
  return raw && (AUTOMOD_RULE_KEYS as readonly string[]).includes(raw) ? (raw as AutomodRuleKey) : "all";
}

export type ExemptEdit =
  | { ok: true; patch: Partial<Omit<AutomodConfig, "guildId">>; message: string }
  | { ok: false; message: string };

/** Add or remove one role/channel from the global list or one rule's list. Returns only the part of the config that changes. */
export function editExemption(config: AutomodConfig, scope: ExemptScope, kind: "role" | "channel", id: string, add: boolean): ExemptEdit {
  const field = kind === "role" ? "exemptRoleIds" : "exemptChannelIds";
  const mention = kind === "role" ? `<@&${id}>` : `<#${id}>`;
  const current = scope === "all" ? config[field] : config[scope][field] ?? [];
  const where = scope === "all" ? "all automod rules" : `the ${SCOPE_LABEL[scope].toLowerCase()} rule`;
  if (add && current.includes(id)) return { ok: false, message: `❌ ${mention} is already exempt from ${where}.` };
  if (!add && !current.includes(id)) return { ok: false, message: `❌ ${mention} isn't exempt from ${where}.` };
  if (add && scope !== "all" && current.length >= MAX_EXEMPTIONS) return { ok: false, message: `❌ A rule can exempt at most ${MAX_EXEMPTIONS} ${kind}s. Remove one first.` };
  const next = add ? [...current, id] : current.filter(x => x !== id);
  const patch = scope === "all" ? { [field]: next } : { [scope]: { ...config[scope], [field]: next } };
  return {
    ok: true,
    patch: patch as Partial<Omit<AutomodConfig, "guildId">>,
    message: add ? `✅ ${mention} now bypasses ${where}.` : `✅ ${mention} no longer bypasses ${where}.`,
  };
}

/** One line per rule that has its own exemptions, for /automod status. */
export function perRuleExemptionLines(config: AutomodConfig): string[] {
  return AUTOMOD_RULE_KEYS.flatMap(key => {
    const r = config[key];
    const bits = [...(r.exemptRoleIds ?? []).map(id => `<@&${id}>`), ...(r.exemptChannelIds ?? []).map(id => `<#${id}>`)];
    return bits.length ? [`**${SCOPE_LABEL[key]}:** ${bits.join(", ")}`] : [];
  });
}
