import { SlashCommandBuilder, InteractionContextType, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate, NO_PINGS } from "../../services/economyDiscord";
import { formatCoins, relativeTimestamp, type EconomyConfig } from "../../services/economyLogic";
import { payTenureRefusal } from "../../services/economyRules";
import { withMemberLock } from "./lib/memberLock";
import { STILL_RUNNING, economyEmbed, waitText } from "./lib/ui";
import type { RobRefusal } from "../../services/economyProgress";

export function robRefusalText(cfg: EconomyConfig, refusal: RobRefusal): string {
  switch (refusal.reason) {
    case "off": return "💤 /rob is turned off in this server. A server manager can turn it on with `/economy risk rob:true`.";
    case "self": return "❌ You can't rob yourself.";
    case "bot": return "❌ Bots don't carry coins.";
    case "poor": return `❌ You need at least ${formatCoins(cfg, cfg.robMinWallet)} in your wallet to try a rob (that's what you'd risk if you're caught).`;
    case "target_poor": return `❌ They have less than ${formatCoins(cfg, cfg.robMinTargetWallet)} in their wallet. Not worth it.`;
    case "shielded": return "🛡️ They have a rob shield up.";
    case "cooldown": return `⏳ Lie low for a while. You can rob again ${waitText(refusal.retryAt)}.`;
    case "protected": return `🚓 They were robbed recently and are on guard ${waitText(refusal.retryAt)}.`;
  }
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("rob")
    .setDescription("Try to take coins from another member's wallet, if this server allows it. Get caught and pay a fine.")
    .setContexts(InteractionContextType.Guild)
    .addUserOption(o => o.setName("user").setDescription("Who to rob (their bank is safe; only their wallet is at risk)").setRequired(true)),
  category: "economy",
  guildOnly: true,
  cooldownMs: 3000,
  async execute(interaction: ChatInputCommandInteraction) {
    const cfg = await economyGate(interaction);
    if (!cfg) return;
    const guild = interaction.guild!;
    const target = interaction.options.getUser("user", true);
    if (!cfg.robEnabled) return interaction.reply({ content: robRefusalText(cfg, { reason: "off" }), flags: MessageFlags.Ephemeral });
    if (target.id === interaction.user.id) return interaction.reply({ content: robRefusalText(cfg, { reason: "self" }), flags: MessageFlags.Ephemeral });
    if (target.bot) return interaction.reply({ content: robRefusalText(cfg, { reason: "bot" }), flags: MessageFlags.Ephemeral });
    const victim = await guild.members.fetch(target.id).catch(() => null);
    if (!victim) return interaction.reply({ content: "❌ They aren't in this server.", flags: MessageFlags.Ephemeral });
    // Same tenure rule as /pay, so fresh alt accounts can't be used to farm or feed robberies.
    const robber = await guild.members.fetch(interaction.user.id).catch(() => null);
    const now = Date.now();
    const mine = payTenureRefusal(robber?.joinedTimestamp ?? null, now, cfg.payMinMemberHours);
    if (mine) return interaction.reply({ content: `❌ New members can rob ${cfg.payMinMemberHours}h after joining. You can ${waitText(mine.readyAt)}.`, flags: MessageFlags.Ephemeral });
    if (payTenureRefusal(victim.joinedTimestamp ?? null, now, cfg.payMinMemberHours)) {
      return interaction.reply({ content: "❌ They joined too recently to be robbed.", flags: MessageFlags.Ephemeral });
    }

    const locked = await withMemberLock(guild.id, interaction.user.id, () => economy().rob(guild.id, interaction.user.id, target.id, target.bot));
    if (!locked.ok) return interaction.reply({ content: STILL_RUNNING, flags: MessageFlags.Ephemeral });
    const r = locked.value;
    if (!r.ok) {
      const content = "refusal" in r ? robRefusalText(cfg, r.refusal)
        : r.reason === "cap" ? "❌ Your wallet is at the maximum, so nothing was taken. `/deposit` some coins first."
        : "❌ Your balance changed while that was running. Run it again.";
      return interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_PINGS });
    }
    const again = { name: "Rob again", value: relativeTimestamp(Date.now() + cfg.robCooldownMinutes * 60_000), inline: true };
    if (r.success) {
      // Only the target is pinged, so they know to bank their coins.
      return interaction.reply({
        content: `${target}`,
        embeds: [economyEmbed(cfg, {
          tone: "ok", title: "🦹 Robbery", balance: { wallet: r.balance }, fields: [again],
          description: `${interaction.user} robbed ${target} and got away with **${formatCoins(cfg, r.amount)}**!`,
          footer: "Coins in the bank can't be robbed. Use /deposit.",
        })],
        allowedMentions: { parse: [], users: [target.id] },
      });
    }
    const description = "escaped" in r
      ? `💨 ${target.username} slipped away before you could take anything.`
      : `🚓 You got caught trying to rob ${target.username}${r.fine > 0 ? ` and paid a **${formatCoins(cfg, r.fine)}** fine` : ""}.`;
    return interaction.reply({
      embeds: [economyEmbed(cfg, { tone: "escaped" in r ? "muted" : "danger", title: "escaped" in r ? "💨 Got away" : "🚨 Caught", description, balance: { wallet: r.balance }, fields: [again] })],
      allowedMentions: NO_PINGS,
    });
  },
};

export default command;
