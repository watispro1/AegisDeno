import { SlashCommandBuilder, InteractionContextType, type AutocompleteInteraction, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { bankAutocomplete, runBank } from "./lib/bank";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("withdraw")
    .setDescription("Move coins from your bank back into your wallet so you can spend them.")
    .setContexts(InteractionContextType.Guild)
    .addStringOption(o => o.setName("amount").setDescription("How much: a number (1500, 2.5k), all or half of your bank").setRequired(true).setMaxLength(20).setAutocomplete(true)),
  category: "economy",
  guildOnly: true,
  cooldownMs: 2000,
  async execute(interaction: ChatInputCommandInteraction) {
    await runBank(interaction, "withdraw");
  },
  async autocomplete(interaction: AutocompleteInteraction) {
    await bankAutocomplete(interaction, "withdraw");
  },
};

export default command;
