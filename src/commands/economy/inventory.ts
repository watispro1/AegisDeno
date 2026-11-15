import { SlashCommandBuilder, InteractionContextType, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { economyGate } from "../../services/economyDiscord";
import { runInventory } from "../../services/economyInventoryView";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("inventory")
    .setDescription("Shop items you (or another member) own and what they sell for. Use or sell them from the menus.")
    .setContexts(InteractionContextType.Guild)
    .addUserOption(o => o.setName("user").setDescription("Whose inventory to show (default: you)")),
  category: "economy",
  guildOnly: true,
  async execute(interaction: ChatInputCommandInteraction) {
    const cfg = await economyGate(interaction);
    if (!cfg) return;
    const user = interaction.options.getUser("user") ?? interaction.user;
    if (user.bot) return interaction.reply({ content: "🤖 Bots don't have inventories.", flags: MessageFlags.Ephemeral });
    await runInventory(interaction, cfg, user);
  },
};

export default command;
