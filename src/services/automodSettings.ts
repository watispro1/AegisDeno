/**
 * The edits behind /automod's rule subcommands, as pure functions so every
 * reply and limit can be tested without Discord. Each edit returns only the
 * part of the config that changes; updateAutomodConfig merges it.
 */
import {
  MAX_ALLOWLIST,
  cleanDomain,
  cleanInviteCode,
  type AutomodConfig,
  type AutomodPatch,
  type AutomodRule,
  type AutomodRuleKey,
} from "./automod";

export const RULE_LABELS: Record<AutomodRuleKey, string> = {
  words: "Blocked words filter",
  links: "Link filter",
  invites: "Invite filter",
  mentions: "Mention-spam filter",
  spam: "Spam filter",
  duplicates: "Duplicate-message filter",
  caps: "Caps filter",
  emoji: "Emoji filter",
};

export interface AutomodEditInput {
  enabled?: boolean | null;
  action?: string | null;
  word?: string | null;
  domain?: string | null;
  code?: string | null;
  count?: number | null;
  max?: number | null;
  window?: number | null;
  repeats?: number | null;
  percent?: number | null;
  zalgo?: boolean | null;
  minutes?: number | null;
}

export type AutomodEdit = { ok: true; patch: AutomodPatch; message: string } | { ok: false; message: string };

const fail = (message: string): AutomodEdit => ({ ok: false, message: `❌ ${message}` });
const done = (patch: AutomodPatch, message: string): AutomodEdit => ({ ok: true, patch, message: `✅ ${message}` });

function isRuleKey(value: string | null): value is AutomodRuleKey {
  return value !== null && value in RULE_LABELS;
}

function listEdit(current: readonly string[], value: string, add: boolean, noun: string, label: string): { next: string[] } | { error: string } {
  const exists = current.some(v => v.toLowerCase() === value.toLowerCase());
  if (add && exists) return { error: `\`${value}\` is already on the ${label} allowed list.` };
  if (!add && !exists) return { error: `\`${value}\` isn't on the ${label} allowed list.` };
  if (add && current.length >= MAX_ALLOWLIST) return { error: `The ${label} allows at most ${MAX_ALLOWLIST} ${noun}s. Remove one first.` };
  return { next: add ? [...current, value] : current.filter(v => v.toLowerCase() !== value.toLowerCase()) };
}

/** Work out the change for `/automod <group> <sub>` (or a top-level sub when group is null). */
export function automodEdit(config: AutomodConfig, group: string | null, sub: string, input: AutomodEditInput): AutomodEdit {
  if (group === null && sub === "timeout") {
    const minutes = input.minutes ?? 0;
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 10_080) return fail("Pick between 1 and 10080 minutes (7 days).");
    return done({ timeoutMinutes: minutes }, `Rules set to **Delete and timeout** now time members out for **${minutes} minute(s)**.`);
  }
  if (!isRuleKey(group)) return fail("Unknown automod setting.");
  const label = RULE_LABELS[group];
  const patchRule = (fields: Partial<AutomodRule> & Record<string, unknown>): AutomodPatch => ({ [group]: fields } as AutomodPatch);

  if (sub === "toggle") {
    const enabled = input.enabled === true;
    return done(patchRule({ enabled }), `${label} is now **${enabled ? "on" : "off"}**.`);
  }
  if (sub === "action") {
    const action = input.action;
    if (action !== "delete" && action !== "warn" && action !== "timeout") return fail("Pick delete, warn or timeout.");
    const extra = action === "timeout" ? ` Members are timed out for ${config.timeoutMinutes} minute(s); change it with \`/automod timeout\`.` : "";
    return done(patchRule({ action }), `${label} action set to **${action}**.${extra}`);
  }

  if (group === "words" && (sub === "add" || sub === "remove")) {
    const word = (input.word ?? "").trim().toLowerCase();
    if (sub === "add") {
      if (word.length < 2 || word.length > 100) return fail("Blocked words must be between 2 and 100 characters.");
      if (config.words.list.includes(word)) return fail("That word is already blocked.");
      return done({ words: { list: [...config.words.list, word] } }, `Added \`${word}\` to blocked words (total: ${config.words.list.length + 1}).`);
    }
    if (!config.words.list.includes(word)) return fail(`\`${word}\` was not in the blocked words list.`);
    return done({ words: { list: config.words.list.filter(w => w !== word) } }, `Removed \`${word}\` from blocked words.`);
  }

  if (group === "links" && (sub === "allow" || sub === "unallow")) {
    const domain = cleanDomain(input.domain);
    if (!domain) return fail("That doesn't look like a domain. Try something like `youtube.com`.");
    const r = listEdit(config.links.allowedDomains, domain, sub === "allow", "domain", "link filter");
    if ("error" in r) return fail(r.error);
    return done({ links: { allowedDomains: r.next } }, sub === "allow"
      ? `Links to **${domain}** and its subdomains now pass the link filter.`
      : `**${domain}** is no longer allowed by the link filter.`);
  }

  if (group === "invites" && (sub === "allow" || sub === "unallow")) {
    const code = cleanInviteCode(input.code);
    if (!code) return fail("That doesn't look like an invite. Paste the code or a discord.gg link.");
    const r = listEdit(config.invites.allowedCodes, code, sub === "allow", "invite", "invite filter");
    if ("error" in r) return fail(r.error);
    return done({ invites: { allowedCodes: r.next } }, sub === "allow"
      ? `Invite \`${code}\` now passes the invite filter.`
      : `Invite \`${code}\` is no longer allowed.`);
  }

  if (sub === "limit") {
    if (group === "mentions" && input.count) {
      return done({ mentions: { threshold: input.count } }, `Mention-spam limit set to **${input.count}** mentions.`);
    }
    if (group === "spam" && input.max && input.window) {
      return done({ spam: { maxMessages: input.max, windowSeconds: input.window } }, `Spam limit set to **${input.max}** messages per **${input.window}s**.`);
    }
    if (group === "duplicates" && input.repeats && input.window) {
      return done({ duplicates: { maxRepeats: input.repeats, windowSeconds: input.window } },
        `Members may now send the same message **${input.repeats}** times in **${input.window}s**; the next copy is acted on.`);
    }
    if (group === "caps" && input.percent) {
      return done({ caps: { threshold: input.percent } }, `Caps filter now acts at **${input.percent}%** uppercase letters (messages under 8 letters are ignored).`);
    }
    if (group === "emoji" && input.max) {
      const zalgo = input.zalgo ?? config.emoji.zalgo;
      return done({ emoji: { maxEmoji: input.max, zalgo } }, `Emoji filter acts above **${input.max}** emoji per message; zalgo text is **${zalgo ? "caught" : "allowed"}**.`);
    }
  }
  return fail("That setting isn't available for this rule.");
}
