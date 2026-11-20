/**
 * /premium: this server's Aegis Premium status, what it adds, and Discord's
 * native Subscribe button. Premium is sold only as a Discord in-app
 * subscription, never through a web checkout. Anyone in the server may run it;
 * the reply is private. Without the Discord SKU configured it says Premium is
 * coming soon on Discord.
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
import { discordPremiumOffer } from "../../config/discordSku";
import { applyDiscordEntitlement } from "../../services/discordEntitlements";
import { PREMIUM_BADGE, PREMIUM_GRACE_DAYS, PREMIUM_PRICE_LABEL, premiumBenefitLines } from "../../config/premium";
import { premiumSummary, type PremiumSummary } from "../../services/premium";
import { graceEndsAt } from "../../services/premiumState";

/** The dashboard page showing the server's Premium status (and, for an earlier Stripe subscriber, the billing portal). */
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
    .setDescription("This server's Aegis Premium status, what it adds, and where to subscribe or manage it.")
    .setContexts(InteractionContextType.Guild),

  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.guildId) return;
    const offer = discordPremiumOffer();
    if (!offer) {
      await interaction.reply({ content: "Aegis Premium is coming soon on Discord. It will be sold only as a Discord in-app subscription, not on the website. Everything Aegis does stays free.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (interaction.entitlements && interaction.entitlements.size > 0) {
      for (const ent of interaction.entitlements.values()) {
        if (ent.guildId === interaction.guildId) {
          await applyDiscordEntitlement(ent).catch(() => null);
        }
      }
    }
    const summary = await premiumSummary(interaction.guildId).catch(() => null);
    const embed = new EmbedBuilder()
      .setColor(COLORS.brand)
      .setTitle(summary?.premium ? `${PREMIUM_BADGE} · ${interaction.guild?.name ?? "This server"}` : "Aegis Premium")
      .setDescription(`${summary ? premiumStatusLine(summary) : "I couldn't read this server's Premium status just now."}\n\n` +
        `**${PREMIUM_PRICE_LABEL} per server** (Discord shows the price in your local currency). Anyone in the server can subscribe in Discord: press **Subscribe** below, or open Aegis's profile and choose **Subscribe**. Discord handles billing, cancellation and refunds.`)
      .addFields({ name: "What Premium adds", value: premiumBenefitLines().map(l => `• ${l}`).join("\n").slice(0, 1024) },
        { name: "Nothing free changes", value: "Every feature stays free. If Premium ends, nothing you made is deleted; you just can't add more past the free limits.", inline: false })
      .setFooter(footer("Premium is per server"));

    const buttons: ButtonBuilder[] = [];
    if (!summary?.premium) {
      // Discord's native Subscribe button for the Premium SKU: the purchase happens in Discord.
      buttons.push(new ButtonBuilder().setStyle(ButtonStyle.Premium).setSKUId(offer.skuId));
    } else {
      buttons.push(new ButtonBuilder().setLabel("Premium status").setStyle(ButtonStyle.Link).setURL(premiumDashboardUrl(interaction.guildId)));
    }
    buttons.push(new ButtonBuilder().setLabel("About Premium").setStyle(ButtonStyle.Link).setURL(siteUrl("/premium")));
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
    await interaction.editReply({ embeds: [embed], components: [row] });
  },
};
