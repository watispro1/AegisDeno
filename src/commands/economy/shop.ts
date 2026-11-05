import {
  SlashCommandBuilder, EmbedBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits,
  type ChatInputCommandInteraction, type AutocompleteInteraction,
} from "discord.js";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate, grantShopRole, inventoryAutocomplete, shopItemAutocomplete, shopRoleRefusal, NO_PINGS } from "../../services/economyDiscord";
import { MAX_BALANCE, SHOP_LIMITS, formatCoins, type EconomyConfig, type ShopItem } from "../../services/economyLogic";
import { COLORS, footer } from "../../utils/embedStyle";
import { truncate } from "../../utils/safeText";

/** " · gives @Role for 24h on /use": what a role item does. */
export function roleSummary(i: Pick<ShopItem, "roleId" | "roleDurationHours" | "useToGrant">): string {
  if (!i.roleId) return "";
  return ` · gives <@&${i.roleId}>${i.roleDurationHours ? ` for ${i.roleDurationHours}h` : ""}${i.useToGrant ? " on `/use`" : ""}`;
}

function itemLine(cfg: EconomyConfig, i: ShopItem): string {
  const stock = i.stock === null ? "" : i.stock === 0 ? " · **sold out**" : ` · ${i.stock} left`;
  const limit = i.perUserLimit === null ? "" : ` · max ${i.perUserLimit} each`;
  return `**${i.name}** · ${formatCoins(cfg, i.price)}${roleSummary(i)}${stock}${limit}${i.description ? `\n> ${i.description}` : ""}`;
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
      .addIntegerOption(o => o.setName("stock").setDescription("How many can be sold (blank = unlimited)").setMinValue(0).setMaxValue(SHOP_LIMITS.maxStock))
      .addIntegerOption(o => o.setName("per_user_limit").setDescription("Most each member can buy (blank = no limit)").setMinValue(1).setMaxValue(SHOP_LIMITS.maxPerUser))
      .addIntegerOption(o => o.setName("role_hours").setDescription("Role items: hours until the role is taken back (blank = permanent)").setMinValue(1).setMaxValue(SHOP_LIMITS.maxRoleHours))
      .addBooleanOption(o => o.setName("use_to_grant").setDescription("Role items: give the role on /use instead of on purchase")))
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
      .addBooleanOption(o => o.setName("unlimited").setDescription("Make stock unlimited"))
      .addIntegerOption(o => o.setName("per_user_limit").setDescription("New per-member limit").setMinValue(1).setMaxValue(SHOP_LIMITS.maxPerUser))
      .addBooleanOption(o => o.setName("no_user_limit").setDescription("Remove the per-member limit"))
      .addIntegerOption(o => o.setName("role_hours").setDescription("New role duration in hours").setMinValue(1).setMaxValue(SHOP_LIMITS.maxRoleHours))
      .addBooleanOption(o => o.setName("permanent_role").setDescription("Make the role permanent"))
      .addBooleanOption(o => o.setName("use_to_grant").setDescription("Give the role on /use (true) or on purchase (false)")))
    .addSubcommand(s => s.setName("sell").setDescription("Sell an item from your inventory back to the shop at a reduced rate.")
      .addStringOption(o => o.setName("item").setDescription("Item to sell").setRequired(true).setAutocomplete(true))),
  category: "economy",
  guildOnly: true,
  // Used by subcommands, buttons or background work; requested on the invite, checked where used.
  featurePermissions: [PermissionFlagsBits.ManageRoles],
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
      const itemId = interaction.options.getString("item", true);
      const r = await svc.buy(guild.id, interaction.user.id, itemId, {
        ownsRole: (roleId) => Boolean(member?.roles.cache.has(roleId)),
        grantRole: async (roleId, hours) => {
          const name = (await svc.item(guild.id, itemId))?.name ?? "item";
          return grantShopRole(guild, interaction.user.id, roleId, { hours, channelId: interaction.channelId, itemName: name });
        },
      });
      if (!r.ok) {
        const msg = r.reason === "not_found" ? "That item isn't in the shop. Pick one from the list."
          : r.reason === "sold_out" ? "That item is sold out."
          : r.reason === "limit" ? `You've reached the limit for that item (${r.limit} per member).`
          : r.reason === "already_owned" ? "You already have that role."
          : r.reason === "insufficient" ? `It costs ${formatCoins(cfg, r.price)} and you have ${formatCoins(cfg, r.balance)}.`
          : r.reason === "role_failed" ? `${r.detail} You were not charged.` : "That didn't work.";
        return ephemeral(interaction, `❌ ${msg}`);
      }
      const got = r.item.roleId && !r.item.useToGrant ? ` and got <@&${r.item.roleId}>${r.item.roleDurationHours ? ` for ${r.item.roleDurationHours}h` : ""}` : "";
      const hint = r.item.useToGrant ? " Run `/use` when you want its role." : "";
      return interaction.reply({
        content: `🛍️ You bought **${r.item.name}** for ${formatCoins(cfg, r.item.price)}${got}. Balance: ${formatCoins(cfg, r.balance)}.${hint}`,
        allowedMentions: NO_PINGS,
      });
    }

    if (sub === "sell") {
      const r = await svc.sellItem(guild.id, interaction.user.id, interaction.options.getString("item", true));
      if (!r.ok) {
        const msg = r.reason === "off" ? "Selling items back is turned off in this server."
          : r.reason === "not_owned" ? "You don't have that item. Pick one from your inventory."
          : r.reason === "not_sellable" ? "That item can't be sold back (it's no longer in the shop, or its role was given on purchase)."
          : "Your balance is at the maximum, so nothing was sold.";
        return ephemeral(interaction, `❌ ${msg}`);
      }
      return ephemeral(interaction, `💱 Sold **${r.item.name}** for ${formatCoins(cfg, r.price)} (${cfg.shopSellPercent}% of its price). Balance: ${formatCoins(cfg, r.balance)}.`);
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
        perUserLimit: interaction.options.getInteger("per_user_limit"),
        roleDurationHours: interaction.options.getInteger("role_hours"),
        useToGrant: interaction.options.getBoolean("use_to_grant") ?? false,
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
    const roleId = interaction.options.getBoolean("clear_role") ? null : role?.id ?? item.roleId;
    const r = await svc.editItem(guild.id, item.id, {
      name: interaction.options.getString("name") ?? item.name,
      price: interaction.options.getInteger("price") ?? item.price,
      description: description === "-" ? "" : description ?? item.description,
      roleId,
      stock: interaction.options.getBoolean("unlimited") ? null : interaction.options.getInteger("stock") ?? item.stock,
      perUserLimit: interaction.options.getBoolean("no_user_limit") ? null : interaction.options.getInteger("per_user_limit") ?? item.perUserLimit,
      roleDurationHours: !roleId || interaction.options.getBoolean("permanent_role") ? null : interaction.options.getInteger("role_hours") ?? item.roleDurationHours,
      useToGrant: interaction.options.getBoolean("use_to_grant") ?? item.useToGrant,
    });
    if (!r.ok) return ephemeral(interaction, `❌ ${firstError(r.errors)}`);
    return ephemeral(interaction, `✅ Updated.\n${itemLine(cfg, r.value)}`);
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    if (interaction.options.getSubcommand() === "sell") return inventoryAutocomplete(interaction);
    await shopItemAutocomplete(interaction);
  },
};

export default command;
