/**
 * /config overview: one screen with every module's state (on, off, or on but
 * missing something it needs) and the server-wide permissions Aegis lacks.
 * Per-channel checks stay in /diagnostics.
 */
import { EmbedBuilder, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import type { GuildConfig } from "../../services/configuration";
import type { AutomodConfig } from "../../services/automod";
import { getAutomodConfig } from "../../services/automod";
import { getStarboardConfig } from "../../services/starboard";
import { getVerificationConfig } from "../../services/verificationService";
import { getTicketSettings } from "../../services/ticketSettings";
import { normalizeTrustConfig } from "../../services/trustEngine";
import { normalizeModuleSwitches } from "../../services/guildConfigNormalize";
import { invitePermissionReport } from "../config/diagnostics";
import { permissionName } from "../../utils/embedStyle";

export type ModuleState = "on" | "off" | "attention";
export interface ModuleLine { name: string; state: ModuleState; detail: string; fix?: string }

const ICON: Record<ModuleState, string> = { on: "✅", off: "⚪", attention: "⚠️" };

export interface OverviewInput {
  guild: GuildConfig;
  automod: Pick<AutomodConfig, "words" | "links" | "mentions" | "spam" | "caps">;
  starboard: { enabled: boolean; channelId: string | null } | null;
  verification: { enabled: boolean; verifiedRoleId: string } | null;
  ticketLogChannelId: string | null;
}

/** Every module's line, in the order the dashboard sidebar lists them. Pure; tested directly. */
export function moduleLines(o: OverviewInput): ModuleLine[] {
  const g = o.guild;
  const switches = normalizeModuleSwitches(g.modules);
  const rules = (["words", "links", "mentions", "spam", "caps"] as const).filter(k => o.automod[k].enabled);
  const trust = normalizeTrustConfig(g.trust);
  const channelModule = (name: string, enabled: boolean, channelId: string | null | undefined, fix: string): ModuleLine =>
    !enabled ? { name, state: "off", detail: "Off", fix }
      : channelId ? { name, state: "on", detail: `<#${channelId}>` }
        : { name, state: "attention", detail: "On, but no channel is set", fix };
  return [
    channelModule("Logging", g.loggingEnabled, g.loggingChannelId, "`/logging channel`"),
    { name: "Automod", state: rules.length ? "on" : "off", detail: rules.length ? `${rules.length} of 5 rules on` : "All rules off", fix: rules.length ? undefined : "`/automod`" },
    { name: "Escalation", state: g.escalation.enabled ? (g.escalation.thresholds.length ? "on" : "attention") : "off",
      detail: g.escalation.enabled ? `${g.escalation.thresholds.length} step${g.escalation.thresholds.length === 1 ? "" : "s"}` : "Off", fix: g.escalation.enabled && g.escalation.thresholds.length ? undefined : "`/escalation add`" },
    channelModule("ModMail", g.modmail?.enabled === true, g.modmail?.channelId, "`/modmail setup`"),
    channelModule("Staff digest", g.digest?.enabled === true, g.digest?.channelId ?? g.loggingChannelId, "`/digest setup`"),
    { name: "Trust integrations", state: trust.enabled ? "on" : "off", detail: trust.enabled ? `Low trust below ${trust.lowThreshold}${trust.lowTrustRoleId ? `, role <@&${trust.lowTrustRoleId}>` : ""}` : "Off", fix: trust.enabled ? undefined : "`/trust config`" },
    channelModule("Welcome", g.welcomeEnabled, g.welcomeChannelId, "`/welcome`"),
    channelModule("Goodbye", g.goodbyeEnabled === true, g.goodbyeChannelId, "the dashboard's Welcome & Goodbye page"),
    { name: "Verification", state: o.verification?.enabled ? "on" : "off", detail: o.verification?.enabled ? `Gives <@&${o.verification.verifiedRoleId}>` : "Off", fix: o.verification?.enabled ? undefined : "`/verify setup`" },
    { name: "Tickets", state: switches.tickets ? "on" : "off", detail: switches.tickets ? (o.ticketLogChannelId ? `Transcripts to <#${o.ticketLogChannelId}>` : "On, no transcript channel") : "Switched off", fix: switches.tickets ? undefined : "the dashboard's Modules page" },
    channelModule("Starboard", o.starboard?.enabled === true, o.starboard?.channelId, "`/starboard setup`"),
    { name: "Suggestions", state: g.suggestionsChannelId ? "on" : "off", detail: g.suggestionsChannelId ? `<#${g.suggestionsChannelId}>` : "No channel", fix: g.suggestionsChannelId ? undefined : "`/config suggestions`" },
    { name: "Autoresponders", state: g.autorespondersEnabled === false ? "off" : "on", detail: g.autorespondersEnabled === false ? "Switched off" : "On" },
    { name: "Giveaways", state: switches.giveaways ? "on" : "off", detail: switches.giveaways ? "On" : "Switched off" },
    { name: "Scheduled messages", state: switches.scheduled ? "on" : "off", detail: switches.scheduled ? "On" : "Switched off" },
    { name: "Ban appeals", state: switches.appeals ? "on" : "off", detail: switches.appeals ? "On" : "Switched off" },
  ];
}

export function renderModuleLines(lines: readonly ModuleLine[]): string {
  return lines.map(l => `${ICON[l.state]} **${l.name}**: ${l.detail}${l.state !== "on" && l.fix ? ` · set up with ${l.fix}` : ""}`).join("\n");
}

export async function runConfigOverview(interaction: ChatInputCommandInteraction, guild: GuildConfig): Promise<void> {
  const guildId = interaction.guildId!;
  const [automod, starboard, verification, tickets] = await Promise.all([
    getAutomodConfig(guildId),
    getStarboardConfig(guildId).catch(() => null),
    getVerificationConfig(guildId).catch(() => null),
    getTicketSettings(guildId).catch(() => null),
  ]);
  const lines = moduleLines({ guild, automod, starboard, verification, ticketLogChannelId: tickets?.logChannelId ?? null });
  const me = interaction.guild?.members.me ?? null;
  const missing = me ? invitePermissionReport(me.permissions).missing : [];
  const on = lines.filter(l => l.state === "on").length;
  const attention = lines.filter(l => l.state === "attention").length;
  const embed = new EmbedBuilder()
    .setColor(attention || missing.length ? 0xfee75c : 0x57f287)
    .setTitle(`⚙️ ${interaction.guild?.name ?? "Server"} at a glance`)
    .setDescription(renderModuleLines(lines).slice(0, 4000))
    .addFields({
      name: "Aegis's permissions",
      value: !me ? "Couldn't read Aegis's permissions here."
        : missing.length ? `Missing ${missing.map(f => `**${permissionName(f)}**`).join(", ")}`.slice(0, 1024) : "✅ Every permission the invite asks for.",
    })
    .setFooter({ text: `${on} of ${lines.length} on${attention ? `, ${attention} need attention` : ""}. Run /diagnostics for per-channel checks.` });
  await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
}
