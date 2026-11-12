import {
  SlashCommandBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits,
  type AutocompleteInteraction, type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../../types/discord";
import { economyGate, inventoryAutocomplete, NO_PINGS } from "../../services/economyDiscord";
import { useAction } from "../../services/economyItemActions";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("use")
    .setDescription("Use an item from your inventory, such as a role pass, rob shield or work boost.")
    .setContexts(InteractionContextType.Guild)
    .addStringOption(o => o.setName("item").setDescription("Item to use").setRequired(true).setAutocomplete(true)),
  category: "economy",
  guildOnly: true,
  cooldownMs: 3000,
  // Role items hand out roles; checked (with the role's position) when used.
  featurePermissions: [PermissionFlagsBits.ManageRoles],
  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await economyGate(interaction))) return;
    const r = await useAction(interaction.guild!, interaction.user.id, interaction.channelId, interaction.options.getString("item", true));
    await interaction.reply({ content: r.content, ...(r.ephemeral ? { flags: MessageFlags.Ephemeral } : {}), allowedMentions: NO_PINGS });
  },
  async autocomplete(interaction: AutocompleteInteraction) {
    await inventoryAutocomplete(interaction);
  },
};

export default command;
