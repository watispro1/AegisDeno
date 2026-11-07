import { SlashCommandBuilder, EmbedBuilder, InteractionContextType, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate, NO_PINGS } from "../../services/economyDiscord";
import { COLORS, footer } from "../../utils/embedStyle";
import { truncate } from "../../utils/safeText";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("inventory")
    .setDescription("Items you (or another member) bought from the shop.")
    .setContexts(InteractionContextType.Guild)
    .addUserOption(o => o.setName("user").setDescription("Whose inventory to show (default: you)")),
  category: "economy",
  guildOnly: true,
  async execute(interaction: ChatInputCommandInteraction) {
    const cfg = await economyGate(interaction);
    if (!cfg) return;
    const user = interaction.options.getUser("user") ?? interaction.user;
    if (user.bot) return interaction.reply({ content: "🤖 Bots don't have inventories.", flags: MessageFlags.Ephemeral });
    const rows = await economy().inventory(interaction.guildId!, user.id);
    const lines = rows.map(r => `• **${r.name}** ×${r.quantity}${r.roleId ? ` · <@&${r.roleId}>` : ""}`);
    const embed = new EmbedBuilder()
      .setColor(COLORS.brand)
      .setAuthor({ name: `${user.displayName ?? user.username}'s inventory`, iconURL: user.displayAvatarURL() })
      .setDescription(lines.length ? truncate(lines.join("\n"), 4000) : "Nothing here yet. Browse the shop with `/shop view`.")
      .addFields(lines.length && user.id === interaction.user.id ? [{ name: "Use or sell", value: `\`/use\` gives an item's role · \`/shop sell\` returns ${cfg.shopSellPercent}% of the price${cfg.shopSellPercent > 0 ? "" : " (selling is off)"}` }] : [])
      .setFooter(footer(`${rows.reduce((n, r) => n + r.quantity, 0)} item(s)`));
    await interaction.reply({ embeds: [embed], allowedMentions: NO_PINGS });
  },
};

export default command;
