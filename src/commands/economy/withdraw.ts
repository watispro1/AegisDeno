import { SlashCommandBuilder, InteractionContextType, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { runBankCommand } from "../../services/economyBankCommand";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("withdraw")
    .setDescription("Move coins from your bank to your wallet.")
    .setContexts(InteractionContextType.Guild)
    .addStringOption(o => o.setName("amount").setDescription("How much: a number, all or half").setRequired(true).setMaxLength(20)),
  category: "economy",
  guildOnly: true,
  cooldownMs: 2000,
  async execute(interaction: ChatInputCommandInteraction) {
    await runBankCommand(interaction, "withdraw");
  },
};

export default command;
