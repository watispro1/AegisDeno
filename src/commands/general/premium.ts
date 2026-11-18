/**
 * /premium: this server's Aegis Premium status, what it adds, and the link to
 * subscribe or manage it on the dashboard. Anyone in the server may run it;
 * the reply is private. While sales are paused (PREMIUM_SALES_ENABLED off, the
 * default) it says Premium is in development and not for sale yet, with no buy
 * button; a server that already has a subscription still sees its status.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../../types/discord";
import { COLORS, footer } from "../../utils/embedStyle";
import { siteUrl } from "../../config/links";
import { premiumOffered } from "../../config/paddle";
import { PREMIUM_BADGE, PREMIUM_DEV_BADGE, PREMIUM_GRACE_DAYS, PREMIUM_NOT_FOR_SALE, PREMIUM_PRICE_LABEL, premiumBenefitLines } from "../../config/premium";
import { premiumSummary, type PremiumSummary } from "../../services/premium";
import { graceEndsAt } from "../../services/premiumState";

/** The dashboard page where the server's Premium is bought and managed. */
export function premiumDashboardUrl(guildId: string): string {
  return siteUrl(`/dashboard/${encodeURIComponent(guildId)}/premium`);
}

const ts = (d: Date, style = "D") => `<t:${Math.floor(d.getTime() / 1000)}:${style}>`;

/** The status line for a summary. Pure. */
export function premiumStatusLine(s: PremiumSummary | null): string {
  const e = s?.entitlement;
  if (!s || !e) return "This server doesn't have Premium.";
  if (s.premium && e.status === "past_due") {
    const end = graceEndsAt(e);
    return `${PREMIUM_BADGE} is on, but the last payment failed. It stays on until ${end ? ts(end, "f") : `${PREMIUM_GRACE_DAYS} days after the failure`} while the payment is retried.`;
  }
  if (s.premium && e.cancelAt) return `${PREMIUM_BADGE} is on until ${ts(e.cancelAt)}, then ends (the subscription was cancelled).`;
  if (s.premium) return `${PREMIUM_BADGE} is on${e.currentPeriodEnd ? `, renewing ${ts(e.currentPeriodEnd)}` : ""}.`;
  if (e.status === "paused") return "Premium is paused for this server.";
  return "This server doesn't have Premium. Its earlier subscription has ended.";
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("premium")
    .setDescription("This server's Aegis Premium status and what it adds (in development, not for sale yet).")
    .setContexts(InteractionContextType.Guild),

  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.guildId) return;
    const forSale = premiumOffered();
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const summary = await premiumSummary(interaction.guildId).catch(() => null);
    const embed = premiumEmbed(summary, forSale, interaction.guild?.name ?? "This server");
    const row = new ActionRowBuilder<ButtonBuilder>();
    if (forSale || summary?.entitlement) {
      row.addComponents(new ButtonBuilder().setLabel(summary?.premium ? "Manage on dashboard" : forSale ? "Get Premium" : "Open on dashboard").setStyle(ButtonStyle.Link).setURL(premiumDashboardUrl(interaction.guildId)));
    }
    row.addComponents(new ButtonBuilder().setLabel("About Premium").setStyle(ButtonStyle.Link).setURL(siteUrl("/premium")));
    await interaction.editReply({ embeds: [embed], components: [row] });
  },
};

/** The /premium reply. Pure, so the not-for-sale wording is testable. */
export function premiumEmbed(summary: PremiumSummary | null, forSale: boolean, guildName: string): EmbedBuilder {
  const status = summary ? premiumStatusLine(summary) : "I couldn't read this server's Premium status just now.";
  const offer = forSale
    ? `**${PREMIUM_PRICE_LABEL} per server.** Anyone in the server can buy it on the dashboard. Payments are handled by Paddle.`
    : `**${PREMIUM_DEV_BADGE}: not for sale yet.** ${PREMIUM_NOT_FOR_SALE}`;
  return new EmbedBuilder()
    .setColor(COLORS.brand)
    .setTitle(summary?.premium ? `${PREMIUM_BADGE} · ${guildName}` : forSale ? "Aegis Premium" : `Aegis Premium · ${PREMIUM_DEV_BADGE}`)
    .setDescription(`${status}\n\n${offer}`)
    .addFields({ name: forSale ? "What Premium adds" : "What Premium will add", value: premiumBenefitLines().map(l => `• ${l}`).join("\n").slice(0, 1024) },
      { name: "Nothing free changes", value: "Every feature stays free. If Premium ends, nothing you made is deleted; you just can't add more past the free limits.", inline: false })
    .setFooter(footer(forSale ? "Premium is per server" : "Premium is in development"));
}
