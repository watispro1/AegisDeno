/** Pure builders for /welcome: the status card, its buttons, and message checks. */
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import type { GuildConfig } from "../../../services/configuration";
import { TEMPLATE_VARIABLES } from "../../../services/templateText";
import { dashboardButton } from "../../config/kit/setupKit";

/** Longest welcome message the settings store keeps; anything longer was silently replaced by the default. */
export const WELCOME_MESSAGE_MAX = 1000;

/** Variables shown to admins ({member_count} still works as an alias of {count}). */
export const VARIABLES = ["{user}", "{username}", "{server}", "{count}", "{memberOrdinal}"];

const KNOWN = new Set(TEMPLATE_VARIABLES.map(([v]) => v).concat("{member_ordinal}"));

/** `{things}` in a message that Aegis won't fill in (typos like `{users}`), so they'd show up as-is. Pure. */
export function unknownVariables(text: string): string[] {
  const found = text.match(/\{[A-Za-z_]+\}/g) ?? [];
  return [...new Set(found.filter(v => !KNOWN.has(v)))];
}

/** Problems with a new welcome message, or null when it is fine. Pure. */
export function welcomeMessageProblem(text: string): string | null {
  const t = text.trim();
  if (!t) return "❌ The welcome message can't be empty.";
  if (t.length > WELCOME_MESSAGE_MAX) return `❌ Keep the welcome message to ${WELCOME_MESSAGE_MAX} characters (it's ${t.length}).`;
  return null;
}

type WelcomeView = Pick<GuildConfig, "welcomeEnabled" | "welcomeChannelId" | "welcomeMessage" | "welcomeRoleId" | "welcomeEmbed" | "goodbyeEnabled" | "goodbyeChannelId">;

export function buildWelcomeStatus(cfg: WelcomeView, iconUrl: string | null): EmbedBuilder {
  const enabled = cfg.welcomeEnabled ?? false;
  const warning = enabled && !cfg.welcomeChannelId ? "\n⚠️ Welcoming is on but there's no channel, so nothing is sent. Run `/welcome channel`." : "";
  return new EmbedBuilder()
    .setColor(enabled && cfg.welcomeChannelId ? 0x57F287 : 0xED4245)
    .setTitle("👋 Welcome Message Configuration")
    .setThumbnail(iconUrl)
    .setDescription(`Use the buttons to turn welcoming on or off, or preview the message.${warning}`)
    .addFields(
      { name: "🟢 Status", value: enabled ? "**Enabled** — messages are sent on join" : "**Disabled** — no messages are sent", inline: false },
      { name: "📌 Channel", value: cfg.welcomeChannelId ? `<#${cfg.welcomeChannelId}>` : "❌ Not set — use `/welcome channel`", inline: true },
      { name: "🎭 Auto-role", value: cfg.welcomeRoleId ? `<@&${cfg.welcomeRoleId}>` : "None — `/welcome role`", inline: true },
      { name: "🖼️ Embed", value: cfg.welcomeEmbed ? "✅ Set on the dashboard" : "None", inline: true },
      { name: "📝 Message", value: (cfg.welcomeMessage ? `\`\`\`\n${cfg.welcomeMessage.replace(/`/g, "ˋ").slice(0, 300)}${cfg.welcomeMessage.length > 300 ? "…" : ""}\n\`\`\`` : "⚠️ Using the default message"), inline: false },
      { name: "👋 Goodbye", value: cfg.goodbyeEnabled && cfg.goodbyeChannelId ? `On → <#${cfg.goodbyeChannelId}>` : "Off (set it up on the dashboard)", inline: true },
      { name: "🔣 Variables", value: VARIABLES.map(v => `\`${v}\``).join("  "), inline: false },
    )
    .setFooter({ text: "Edit the text with /welcome message · test it with /welcome test" })
    .setTimestamp();
}

export function buildWelcomeButtons(cfg: WelcomeView, guildId: string): ActionRowBuilder<ButtonBuilder> {
  const enabled = cfg.welcomeEnabled ?? false;
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("welcome_toggle_on").setLabel("Enable").setEmoji("🟢")
      .setStyle(enabled ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(enabled || !cfg.welcomeChannelId),
    new ButtonBuilder().setCustomId("welcome_toggle_off").setLabel("Disable").setEmoji("🔴")
      .setStyle(!enabled ? ButtonStyle.Danger : ButtonStyle.Secondary).setDisabled(!enabled),
    new ButtonBuilder().setCustomId("welcome_preview_btn").setLabel("Preview Message").setEmoji("👁️").setStyle(ButtonStyle.Primary),
    dashboardButton(guildId, "settings/welcome"),
  );
}
