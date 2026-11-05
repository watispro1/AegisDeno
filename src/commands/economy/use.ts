import {
  SlashCommandBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits,
  type AutocompleteInteraction, type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate, grantShopRole, inventoryAutocomplete, NO_PINGS } from "../../services/economyDiscord";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("use")
    .setDescription("Use an item from your inventory, such as a role pass.")
    .setContexts(InteractionContextType.Guild)
    .addStringOption(o => o.setName("item").setDescription("Item to use").setRequired(true).setAutocomplete(true)),
  category: "economy",
  guildOnly: true,
  cooldownMs: 3000,
  // Role items hand out roles; checked (with the role's position) when used.
  featurePermissions: [PermissionFlagsBits.ManageRoles],
  async execute(interaction: ChatInputCommandInteraction) {
    const cfg = await economyGate(interaction);
    if (!cfg) return;
    const guild = interaction.guild!;
    const member = await guild.members.fetch(interaction.user.id).catch(() => null);
    const itemId = interaction.options.getString("item", true);
    const r = await economy().useItem(guild.id, interaction.user.id, itemId, {
      ownsRole: (roleId) => Boolean(member?.roles.cache.has(roleId)),
      grantRole: async (roleId, hours) => {
        const item = await economy().item(guild.id, itemId);
        return grantShopRole(guild, interaction.user.id, roleId, { hours, channelId: interaction.channelId, itemName: item?.name ?? "item" });
      },
    });
    if (!r.ok) {
      const msg = r.reason === "not_owned" ? "You don't have that item. Pick one from your inventory."
        : r.reason === "role_failed" ? `${r.detail} You kept the item.` : r.detail;
      return interaction.reply({ content: `❌ ${msg}`, flags: MessageFlags.Ephemeral, allowedMentions: NO_PINGS });
    }
    const length = r.item.roleDurationHours ? ` for ${r.item.roleDurationHours}h` : "";
    await interaction.reply({ content: `✨ You used **${r.item.name}** and got <@&${r.item.roleId}>${length}.`, allowedMentions: NO_PINGS });
  },
  async autocomplete(interaction: AutocompleteInteraction) {
    await inventoryAutocomplete(interaction);
  },
};

export default command;
