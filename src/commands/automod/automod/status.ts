/** The /automod status card and its quick-toggle buttons. */
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import type { AutomodConfig, AutomodRuleKey } from "../../../services/automod";
import { perRuleExemptionLines } from "../../../services/automodExempt";

const onOff = (on: boolean) => (on ? "✅ On" : "❌ Off");

/** Rules with a quick-toggle button, in button order; five per row. */
export const TOGGLE_BUTTONS: ReadonlyArray<{ key: AutomodRuleKey; label: string; emoji: string }> = [
  { key: "words", label: "Words", emoji: "🔤" },
  { key: "links", label: "Links", emoji: "🔗" },
  { key: "invites", label: "Invites", emoji: "✉️" },
  { key: "mentions", label: "Mentions", emoji: "📢" },
  { key: "spam", label: "Spam", emoji: "⚡" },
  { key: "duplicates", label: "Duplicates", emoji: "🔁" },
  { key: "caps", label: "Caps", emoji: "🔠" },
  { key: "emoji", label: "Emoji", emoji: "😀" },
];

export const toggleId = (key: AutomodRuleKey) => `am_toggle_${key}`;

export function toggleKeyFromId(customId: string): AutomodRuleKey | null {
  return TOGGLE_BUTTONS.find(b => toggleId(b.key) === customId)?.key ?? null;
}

export function buildStatusPayload(cfg: AutomodConfig): { embed: EmbedBuilder; rows: ActionRowBuilder<ButtonBuilder>[] } {
  const exemptRoles = cfg.exemptRoleIds.map(id => `<@&${id}>`).join(", ") || "None";
  const exemptChannels = cfg.exemptChannelIds.map(id => `<#${id}>`).join(", ") || "None";
  const domains = cfg.links.allowedDomains.length ? ` · Allowed: ${cfg.links.allowedDomains.slice(0, 8).join(", ")}${cfg.links.allowedDomains.length > 8 ? ` +${cfg.links.allowedDomains.length - 8}` : ""}` : "";
  const codes = cfg.invites.allowedCodes.length ? ` · ${cfg.invites.allowedCodes.length} allowed code(s)` : "";
  const perRule = perRuleExemptionLines(cfg);

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle("🛡️ Automod Settings")
    .setDescription(`Use the buttons to switch rules on or off. Timeouts last **${cfg.timeoutMinutes} minute(s)** (\`/automod timeout\`).`)
    .addFields(
      { name: "🔤 Blocked Words", value: `${onOff(cfg.words.enabled)} (${cfg.words.list.length} words) · \`${cfg.words.action}\``, inline: false },
      { name: "🔗 Links", value: `${onOff(cfg.links.enabled)} · \`${cfg.links.action}\`${domains}`.slice(0, 1024), inline: false },
      { name: "✉️ Invites", value: `${onOff(cfg.invites.enabled)} · \`${cfg.invites.action}\`${codes}`, inline: true },
      { name: "📢 Mention Spam", value: `${onOff(cfg.mentions.enabled)} (limit ${cfg.mentions.threshold}) · \`${cfg.mentions.action}\``, inline: true },
      { name: "⚡ Message Spam", value: `${onOff(cfg.spam.enabled)} (${cfg.spam.maxMessages} msg / ${cfg.spam.windowSeconds}s) · \`${cfg.spam.action}\``, inline: true },
      { name: "🔁 Duplicates", value: `${onOff(cfg.duplicates.enabled)} (${cfg.duplicates.maxRepeats} copies / ${cfg.duplicates.windowSeconds}s) · \`${cfg.duplicates.action}\``, inline: true },
      { name: "🔠 Caps & Floods", value: `${onOff(cfg.caps.enabled)} (${cfg.caps.threshold}% uppercase) · \`${cfg.caps.action}\``, inline: true },
      { name: "😀 Emoji & Zalgo", value: `${onOff(cfg.emoji.enabled)} (over ${cfg.emoji.maxEmoji}${cfg.emoji.zalgo ? ", zalgo" : ""}) · \`${cfg.emoji.action}\``, inline: true },
      { name: "🛡️ Exempt Roles", value: exemptRoles.slice(0, 1024), inline: false },
      { name: "📌 Exempt Channels", value: exemptChannels.slice(0, 1024), inline: false },
      ...(perRule.length ? [{ name: "🎯 Per-rule exemptions", value: perRule.join("\n").slice(0, 1024), inline: false }] : []),
    )
    .setTimestamp();

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < TOGGLE_BUTTONS.length; i += 5) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(TOGGLE_BUTTONS.slice(i, i + 5).map(b =>
      new ButtonBuilder()
        .setCustomId(toggleId(b.key))
        .setLabel(`${b.label} (${cfg[b.key].enabled ? "ON" : "OFF"})`)
        .setStyle(cfg[b.key].enabled ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setEmoji(b.emoji),
    )));
  }
  return { embed, rows };
}
