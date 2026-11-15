/** The /logging status card, its buttons, and the test entry. Pure builders, tested without Discord. */
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { isLogCategoryOn, type LogCategory } from "../../../services/logging";
import type { GuildConfig } from "../../../services/configuration";
import { dashboardButton } from "../../config/kit/setupKit";

/** What gets logged in each category. */
export const LOG_CATEGORIES: ReadonlyArray<{ key: LogCategory; label: string; emoji: string; desc: string }> = [
  { key: "modActions",   label: "Mod Actions",     emoji: "🛡️", desc: "Bans, kicks, warns, timeouts" },
  { key: "memberJoins",  label: "Member Joins",    emoji: "📥", desc: "New member join events" },
  { key: "memberLeaves", label: "Member Leaves",   emoji: "📤", desc: "Member leave/kick/ban departures" },
  { key: "messageEdits", label: "Message Edits",   emoji: "✏️", desc: "Edited message content (before/after)" },
  { key: "messageDeletes", label: "Msg Deletes",   emoji: "🗑️", desc: "Deleted messages and bulk purges" },
  { key: "roleChanges",  label: "Role Changes",    emoji: "🎭", desc: "Member role additions and removals" },
  { key: "channelEvents", label: "Channel Events", emoji: "📌", desc: "Channel creates, deletes, renames" },
  { key: "voiceEvents",  label: "Voice Activity",  emoji: "🔊", desc: "Voice channel joins, leaves and moves (off by default)" },
];

export const LOG_CATEGORY_CHOICES = LOG_CATEGORIES.map(c => ({ name: c.label, value: c.key }));

export function isLogCategoryKey(value: string | null | undefined): value is LogCategory {
  return LOG_CATEGORIES.some(c => c.key === value);
}

export function categoryLabel(key: string): string {
  return LOG_CATEGORIES.find(c => c.key === key)?.label ?? key;
}

/** Every category's current on/off value, filling defaults, so one can be flipped without touching the rest. */
export function fullCategoryMap(cats: Record<string, boolean> | null | undefined): Record<string, boolean> {
  return Object.fromEntries(LOG_CATEGORIES.map(c => [c.key, isLogCategoryOn(cats, c.key)]));
}

type LoggingView = Pick<GuildConfig, "loggingEnabled" | "loggingChannelId" | "logCategories" | "logChannels">;

export function buildLoggingEmbed(cfg: LoggingView): EmbedBuilder {
  const enabled = cfg.loggingEnabled ?? false;
  const catLines = LOG_CATEGORIES.map(c => {
    const on = isLogCategoryOn(cfg.logCategories, c.key);
    const own = cfg.logChannels?.[c.key];
    return `${c.emoji} **${c.label}** — ${on ? "✅ On" : "❌ Off"}${own ? ` → <#${own}>` : ""}\n> ${c.desc}`;
  }).join("\n");
  const warning = enabled && !cfg.loggingChannelId ? "\n⚠️ Logging is on but no channel is set, so nothing is posted. Run `/logging channel`." : "";
  return new EmbedBuilder()
    .setColor(enabled && cfg.loggingChannelId ? 0x3498DB : 0xED4245)
    .setTitle("📋 Logging Configuration")
    .setDescription(`Use the buttons to switch categories on or off.${warning}`)
    .addFields(
      { name: "🟢 Status",   value: enabled ? "**Enabled**" : "**Disabled**", inline: true },
      { name: "📌 Channel",  value: cfg.loggingChannelId ? `<#${cfg.loggingChannelId}>` : "❌ Not set", inline: true },
      { name: "📊 Log Events", value: catLines.slice(0, 1024), inline: false },
    )
    .setFooter({ text: "Per-category channels can be set on the dashboard." })
    .setTimestamp();
}

export function buildLoggingButtons(cfg: LoggingView, guildId: string): ActionRowBuilder<ButtonBuilder>[] {
  const enabled = cfg.loggingEnabled ?? false;
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < LOG_CATEGORIES.length; i += 4) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(LOG_CATEGORIES.slice(i, i + 4).map(c =>
      new ButtonBuilder()
        .setCustomId(`log_cat_${c.key}`)
        .setLabel(c.label)
        .setEmoji(c.emoji)
        .setStyle(isLogCategoryOn(cfg.logCategories, c.key) ? ButtonStyle.Success : ButtonStyle.Secondary),
    )));
  }
  rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("log_toggle_master")
      .setLabel(enabled ? "Disable Logging" : "Enable Logging")
      .setStyle(enabled ? ButtonStyle.Danger : ButtonStyle.Success)
      .setEmoji(enabled ? "🔴" : "🟢")
      .setDisabled(!enabled && !cfg.loggingChannelId),
    new ButtonBuilder()
      .setCustomId("log_send_test")
      .setLabel("Send Test Log")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🔔")
      .setDisabled(!cfg.loggingChannelId || !enabled),
    dashboardButton(guildId, "settings/logging"),
  ));
  return rows;
}

/** The test entry posted to the log. */
export function testLogEntry(userId: string, category?: LogCategory | null) {
  return {
    title: "🔔 Test Log Entry",
    color: 0x5865F2,
    description: `This is a test log entry sent by <@${userId}>${category ? ` for **${categoryLabel(category)}**` : ""}.\n\nIf you see this, logging is configured correctly ✅`,
  };
}

/** Why a test entry wasn't posted, given the saved settings. */
export function testFailureReason(cfg: LoggingView, category?: LogCategory | null): string {
  if (!cfg.loggingChannelId) return "❌ No logging channel set. Use `/logging channel` first.";
  if (!cfg.loggingEnabled) return "❌ Logging is switched off. Turn it on with `/logging toggle enabled:True`.";
  if (category && !isLogCategoryOn(cfg.logCategories, category)) return `❌ **${categoryLabel(category)}** logging is off. Switch it on with \`/logging category\` or the \`/logging status\` buttons.`;
  const target = (category && cfg.logChannels?.[category]) || cfg.loggingChannelId;
  return `❌ Aegis couldn't post in <#${target}>. Check it still exists and that Aegis has **View Channel**, **Send Messages** and **Embed Links** there.`;
}
