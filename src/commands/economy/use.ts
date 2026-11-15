import {
  SlashCommandBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits,
  type AutocompleteInteraction, type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate, inventoryAutocomplete, NO_PINGS } from "../../services/economyDiscord";
import { useAction } from "../../services/economyItemActions";
import type { ShopItem } from "../../services/economyLogic";
import type { InventoryRow } from "../../services/economyStore";
import { rankChoices } from "../../utils/autocomplete";
import { withMemberLock } from "./lib/memberLock";
import { STILL_RUNNING } from "./lib/ui";

/** What using an item does, for its autocomplete label. Pure, for tests. */
export function useChoiceLabel(row: InventoryRow, item: ShopItem | undefined): string {
  const what = !item ? "no longer in the shop"
    : item.effect === "rob_shield" ? `rob shield ${item.effectHours ?? "?"}h`
    : item.effect === "work_boost" ? `+${item.effectPercent ?? "?"}% work pay ${item.effectHours ?? "?"}h`
    : item.roleId && item.useToGrant ? `role${item.roleDurationHours ? ` for ${item.roleDurationHours}h` : ""}`
    : "can't be used";
  return `${row.name}${row.quantity > 1 ? ` ×${row.quantity}` : ""} · ${what}`;
}

/** Whether /use can do anything with an item. */
export function isUsable(item: ShopItem | undefined): boolean {
  return Boolean(item && (item.effect || (item.roleId && item.useToGrant)));
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("use")
    .setDescription("Use an item from your inventory, such as a role pass, rob shield or work boost.")
    .setContexts(InteractionContextType.Guild)
    .addStringOption(o => o.setName("item").setDescription("Item to use; the list shows only items that do something").setRequired(true).setAutocomplete(true)),
  category: "economy",
  guildOnly: true,
  cooldownMs: 3000,
  // Role items hand out roles; checked (with the role's position) when used.
  featurePermissions: [PermissionFlagsBits.ManageRoles],
  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await economyGate(interaction))) return;
    const guild = interaction.guild!;
    const itemId = interaction.options.getString("item", true);
    const locked = await withMemberLock(guild.id, interaction.user.id, () => useAction(guild, interaction.user.id, interaction.channelId, itemId));
    if (!locked.ok) return interaction.reply({ content: STILL_RUNNING, flags: MessageFlags.Ephemeral });
    const r = locked.value;
    await interaction.reply({ content: r.content, ...(r.ephemeral ? { flags: MessageFlags.Ephemeral } : {}), allowedMentions: NO_PINGS });
  },
  async autocomplete(interaction: AutocompleteInteraction) {
    const guildId = interaction.guildId;
    if (!guildId) return interaction.respond([]);
    const [rows, items] = await Promise.all([
      economy().inventory(guildId, interaction.user.id).catch(() => null),
      economy().items(guildId).catch(() => null),
    ]);
    // If either lookup failed, fall back to the plain inventory list.
    if (!rows || !items) return inventoryAutocomplete(interaction);
    const byId = new Map(items.map(i => [i.id, i]));
    const usable = rows.filter(r => isUsable(byId.get(r.itemId)));
    const choices = rankChoices(usable.map(r => ({ name: useChoiceLabel(r, byId.get(r.itemId)), value: r.itemId })), String(interaction.options.getFocused() ?? ""));
    await interaction.respond(choices.length || usable.length ? choices : [{ name: "You have no usable items. Browse /shop view", value: "none" }]).catch(() => undefined);
  },
};

export default command;
