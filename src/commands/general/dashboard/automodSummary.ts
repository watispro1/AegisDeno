/** Text for the /dashboard AutoMod button, kept inside Discord's 2000-character message limit. */
import type { AutomodConfig } from "../../../services/automod";

export const DISCORD_MESSAGE_LIMIT = 2000;
const LIST_BUDGET = 700;

/**
 * Joins mentions with ", " up to `budget` characters, then ends with
 * "and N more" so a long list never breaks the message.
 */
export function mentionList(ids: readonly string[], mention: (id: string) => string, budget = LIST_BUDGET): string {
  if (!ids.length) return "None";
  const shown: string[] = [];
  let used = 0;
  for (const [i, id] of ids.entries()) {
    const part = mention(id);
    const rest = ids.length - i - 1;
    const tail = rest > 0 ? ` and ${rest} more`.length : 0;
    if (used + (shown.length ? 2 : 0) + part.length + tail > budget) break;
    used += (shown.length ? 2 : 0) + part.length;
    shown.push(part);
  }
  const hidden = ids.length - shown.length;
  if (!shown.length) return `${ids.length} set`;
  return hidden > 0 ? `${shown.join(", ")} and ${hidden} more` : shown.join(", ");
}

/** Cuts text to Discord's message limit on a line break where possible. */
export function clipMessage(text: string, limit = DISCORD_MESSAGE_LIMIT): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 1);
  const nl = cut.lastIndexOf("\n");
  return `${nl > limit / 2 ? cut.slice(0, nl) : cut}…`;
}

type SummaryConfig = Pick<AutomodConfig, "words" | "links" | "mentions" | "spam" | "exemptRoleIds" | "exemptChannelIds">;

export function automodSummaryText(guildName: string, automod: SummaryConfig): string {
  const on = (enabled: boolean) => (enabled ? "✅ Enabled" : "❌ Disabled");
  return clipMessage([
    `🛡️ **AutoMod Configuration for ${guildName}:**`,
    ``,
    `**Word Filter:** ${on(automod.words.enabled)} — Action: \`${automod.words.action}\` — Words: \`${automod.words.list.length}\``,
    `**Link Filter:** ${on(automod.links.enabled)} — Action: \`${automod.links.action}\``,
    `**Mention Spam:** ${on(automod.mentions.enabled)} — Threshold: \`${automod.mentions.threshold}\``,
    `**Chat Spam:** ${on(automod.spam.enabled)} — Limit: \`${automod.spam.maxMessages}\` msgs / \`${automod.spam.windowSeconds}s\``,
    ``,
    `**Exempt Roles:** ${mentionList(automod.exemptRoleIds, id => `<@&${id}>`)}`,
    `**Exempt Channels:** ${mentionList(automod.exemptChannelIds, id => `<#${id}>`)}`,
  ].join("\n"));
}
