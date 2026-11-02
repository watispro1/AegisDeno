import {
  SlashCommandBuilder, EmbedBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits,
  type ChatInputCommandInteraction, type AutocompleteInteraction,
} from "discord.js";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate, grantShopRole, shopItemAutocomplete, shopRoleRefusal, NO_PINGS } from "../../services/economyDiscord";
import { MAX_BALANCE, SHOP_LIMITS, formatCoins, type EconomyConfig, type ShopItem } from "../../services/economyLogic";
import { COLORS, footer } from "../../utils/embedStyle";
import { truncate } from "../../utils/safeText";

function itemLine(cfg: EconomyConfig, i: ShopItem): string {
  const stock = i.stock === null ? "" : i.stock === 0 ? " · **sold out**" : ` · ${i.stock} left`;
  return `**${i.name}** · ${formatCoins(cfg, i.price)}${i.roleId ? ` · gives <@&${i.roleId}>` : ""}${stock}${i.description ? `\n> ${i.description}` : ""}`;
}

const ephemeral = (interaction: ChatInputCommandInteraction, content: string) =>
  interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_PINGS });

function firstError(errors: Record<string, string | undefined>): string {
  return Object.values(errors).find(Boolean) ?? "That item isn't valid.";
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Browse and buy items with coins. Staff can manage the shop.")
    .setContexts(InteractionContextType.Guild)
    .addSubcommand(s => s.setName("view").setDescription("See what's for sale."))
    .addSubcommand(s => s.setName("buy").setDescription("Buy an item.")
      .addStringOption(o => o.setName("item").setDescription("Item to buy").setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName("add").setDescription("Staff: add an item (Manage Server).")
      .addStringOption(o => o.setName("name").setDescription("Item name").setRequired(true).setMaxLength(SHOP_LIMITS.name))
      .addIntegerOption(o => o.setName("price").setDescription("Price in coins").setRequired(true).setMinValue(1).setMaxValue(MAX_BALANCE))
      .addStringOption(o => o.setName("description").setDescription("Short description").setMaxLength(SHOP_LIMITS.description))
      .addRoleOption(o => o.setName("role").setDescription("Role given on purchase (must be below Aegis and you)"))
      .addIntegerOption(o => o.setName("stock").setDescription("How many can be sold (blank = unlimited)").setMinValue(0).setMaxValue(SHOP_LIMITS.maxStock)))
    .addSubcommand(s => s.setName("remove").setDescription("Staff: remove an item (Manage Server).")
      .addStringOption(o => o.setName("item").setDescription("Item to remove").setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName("edit").setDescription("Staff: change an item (Manage Server).")
      .addStringOption(o => o.setName("item").setDescription("Item to change").setRequired(true).setAutocomplete(true))
      .addStringOption(o => o.setName("name").setDescription("New name").setMaxLength(SHOP_LIMITS.name))
      .addIntegerOption(o => o.setName("price").setDescription("New price").setMinValue(1).setMaxValue(MAX_BALANCE))
      .addStringOption(o => o.setName("description").setDescription("New description (\"-\" clears it)").setMaxLength(SHOP_LIMITS.description))
      .addRoleOption(o => o.setName("role").setDescription("New role to give"))
      .addBooleanOption(o => o.setName("clear_role").setDescription("Stop giving a role"))
      .addIntegerOption(o => o.setName("stock").setDescription("New stock").setMinValue(0).setMaxValue(SHOP_LIMITS.maxStock))
      .addBooleanOption(o => o.setName("unlimited").setDescription("Make stock unlimited"))),
  category: "economy",
  guildOnly: true,
  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const staff = sub === "add" || sub === "remove" || sub === "edit";
    if (staff && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return ephemeral(interaction, "❌ Managing the shop needs the **Manage Server** permission.");
    }
    const cfg = staff ? await economy().config(interaction.guildId!) : await economyGate(interaction);
    if (!cfg) return;
    const guild = interaction.guild!;
    const svc = economy();

    if (sub === "view") {
      const items = await svc.items(guild.id);
      const embed = new EmbedBuilder()
        .setColor(COLORS.brand)
        .setTitle(`🛒 ${guild.name} shop`)
        .setDescription(items.length ? truncate(items.map(i => itemLine(cfg, i)).join("\n\n"), 4000) : "The shop is empty. Staff can add items with `/shop add` or on the dashboard.")
        .setFooter(footer("Buy with /shop buy"));
      return interaction.reply({ embeds: [embed], allowedMentions: NO_PINGS });
    }

    if (sub === "buy") {
      const member = await guild.members.fetch(interaction.user.id).catch(() => null);
      const r = await svc.buy(guild.id, interaction.user.id, interaction.options.getString("item", true), {
        ownsRole: (roleId) => Boolean(member?.roles.cache.has(roleId)),
        grantRole: (roleId) => grantShopRole(guild, interaction.user.id, roleId),
      });
      if (!r.ok) {
        const msg = r.reason === "not_found" ? "That item isn't in the shop. Pick one from the list."
          : r.reason === "sold_out" ? "That item is sold out."
          : r.reason === "already_owned" ? "You already have that role."
          : r.reason === "insufficient" ? `It costs ${formatCoins(cfg, r.price)} and you have ${formatCoins(cfg, r.balance)}.`
          : r.reason === "role_failed" ? `${r.detail} You were not charged.` : "That didn't work.";
        return ephemeral(interaction, `❌ ${msg}`);
      }
      return interaction.reply({
        content: `🛍️ You bought **${r.item.name}** for ${formatCoins(cfg, r.item.price)}${r.item.roleId ? ` and got <@&${r.item.roleId}>` : ""}. Balance: ${formatCoins(cfg, r.balance)}.`,
        allowedMentions: NO_PINGS,
      });
    }

    if (sub === "add") {
      const role = interaction.options.getRole("role");
      if (role) {
        const refusal = await shopRoleRefusal(guild, role.id, interaction.user.id);
        if (refusal) return ephemeral(interaction, `❌ ${refusal}`);
      }
      const r = await svc.addItem(guild.id, {
        name: interaction.options.getString("name", true),
        price: interaction.options.getInteger("price", true),
        description: interaction.options.getString("description") ?? "",
        roleId: role?.id ?? null,
        stock: interaction.options.getInteger("stock"),
      });
      if (!r.ok) return ephemeral(interaction, `❌ ${firstError(r.errors)}`);
      return ephemeral(interaction, `✅ Added **${r.value.name}** for ${formatCoins(cfg, r.value.price)}.${cfg.enabled ? "" : " The economy is off, so members can't buy it until you run `/economy toggle`."}`);
    }

    const itemId = interaction.options.getString("item", true);
    const item = await svc.item(guild.id, itemId);
    if (!item) return ephemeral(interaction, "❌ That item isn't in the shop. Pick one from the list.");

    if (sub === "remove") {
      await svc.removeItem(guild.id, item.id);
      return ephemeral(interaction, `🗑️ Removed **${item.name}**. Members who bought it keep it.`);
    }

    // edit
    const role = interaction.options.getRole("role");
    if (role) {
      const refusal = await shopRoleRefusal(guild, role.id, interaction.user.id);
      if (refusal) return ephemeral(interaction, `❌ ${refusal}`);
    }
    const description = interaction.options.getString("description");
    const r = await svc.editItem(guild.id, item.id, {
      name: interaction.options.getString("name") ?? item.name,
      price: interaction.options.getInteger("price") ?? item.price,
      description: description === "-" ? "" : description ?? item.description,
      roleId: interaction.options.getBoolean("clear_role") ? null : role?.id ?? item.roleId,
      stock: interaction.options.getBoolean("unlimited") ? null : interaction.options.getInteger("stock") ?? item.stock,
    });
    if (!r.ok) return ephemeral(interaction, `❌ ${firstError(r.errors)}`);
    return ephemeral(interaction, `✅ Updated.\n${itemLine(cfg, r.value)}`);
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    await shopItemAutocomplete(interaction);
  },
};

export default command;
