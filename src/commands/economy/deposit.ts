import { SlashCommandBuilder, InteractionContextType, type AutocompleteInteraction, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { bankAutocomplete, runBank } from "./lib/bank";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("deposit")
    .setDescription("Move coins from your wallet into your bank, where /rob and /crime fines can't reach them.")
    .setContexts(InteractionContextType.Guild)
    .addStringOption(o => o.setName("amount").setDescription("How much: a number (1500, 2.5k), all or half of your wallet").setRequired(true).setMaxLength(20).setAutocomplete(true)),
  category: "economy",
  guildOnly: true,
  cooldownMs: 2000,
  async execute(interaction: ChatInputCommandInteraction) {
    await runBank(interaction, "deposit");
  },
  async autocomplete(interaction: AutocompleteInteraction) {
    await bankAutocomplete(interaction, "deposit");
  },
};

export default command;
