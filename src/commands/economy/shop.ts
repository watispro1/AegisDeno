import {
  SlashCommandBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits,
  type ChatInputCommandInteraction, type AutocompleteInteraction,
} from "discord.js";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate, inventoryAutocomplete, shopItemAutocomplete, shopRoleRefusal, NO_PINGS } from "../../services/economyDiscord";
import { MAX_BALANCE, SHOP_LIMITS, formatCoins } from "../../services/economyLogic";
import { EFFECT_LIMITS, isItemEffect } from "../../services/economyProgress";
import { buyAction, sellAction } from "../../services/economyItemActions";
import { isShopShow, isShopSort, shopItemLine, SHOP_SHOW_LABEL, SHOP_SORT_LABEL } from "../../services/economyShopView";
import { runShopView } from "../../services/economyShopPager";

export { roleSummary } from "../../services/economyShopView";

const EFFECT_CHOICES = [
  { name: "No effect", value: "none" },
  { name: "Rob shield", value: "rob_shield" },
  { name: "Work boost", value: "work_boost" },
];

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
    .addSubcommand(s => s.setName("view").setDescription("See what's for sale, a page at a time, and buy from the menu.")
      .addStringOption(o => o.setName("sort").setDescription("Order items by (default: price, low to high)")
        .addChoices(...(Object.keys(SHOP_SORT_LABEL) as Array<keyof typeof SHOP_SORT_LABEL>).map(v => ({ name: SHOP_SORT_LABEL[v], value: v }))))
      .addStringOption(o => o.setName("show").setDescription("Which items to list (default: all)")
        .addChoices(...(Object.keys(SHOP_SHOW_LABEL) as Array<keyof typeof SHOP_SHOW_LABEL>).map(v => ({ name: SHOP_SHOW_LABEL[v], value: v }))))
      .addBooleanOption(o => o.setName("affordable").setDescription("Only list items you can afford right now")))
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
      .addBooleanOption(o => o.setName("use_to_grant").setDescription("Role items: give the role on /use instead of on purchase"))
      .addStringOption(o => o.setName("effect").setDescription("Consumable effect on /use (not with a role)").addChoices(...EFFECT_CHOICES))
      .addIntegerOption(o => o.setName("effect_hours").setDescription("Effect items: how many hours it lasts").setMinValue(1).setMaxValue(EFFECT_LIMITS.maxHours))
      .addIntegerOption(o => o.setName("boost_percent").setDescription("Work boosts: extra /work pay in percent").setMinValue(1).setMaxValue(EFFECT_LIMITS.maxPercent)))
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
      .addBooleanOption(o => o.setName("use_to_grant").setDescription("Give the role on /use (true) or on purchase (false)"))
      .addStringOption(o => o.setName("effect").setDescription("New effect on /use (No effect clears it)").addChoices(...EFFECT_CHOICES))
      .addIntegerOption(o => o.setName("effect_hours").setDescription("New effect length in hours").setMinValue(1).setMaxValue(EFFECT_LIMITS.maxHours))
      .addIntegerOption(o => o.setName("boost_percent").setDescription("New work boost percent").setMinValue(1).setMaxValue(EFFECT_LIMITS.maxPercent)))
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
      const sortRaw = interaction.options.getString("sort");
      const showRaw = interaction.options.getString("show");
      return runShopView(interaction, cfg, {
        sort: isShopSort(sortRaw) ? sortRaw : "price_asc",
        show: interaction.options.getBoolean("affordable") ? "affordable" : isShopShow(showRaw) ? showRaw : "all",
      });
    }

    if (sub === "buy") {
      const r = await buyAction(guild, interaction.user.id, interaction.channelId, interaction.options.getString("item", true), cfg);
      return interaction.reply({ content: r.content, ...(r.ephemeral ? { flags: MessageFlags.Ephemeral } : {}), allowedMentions: NO_PINGS });
    }

    if (sub === "sell") {
      const r = await sellAction(guild.id, interaction.user.id, interaction.options.getString("item", true), cfg);
      return ephemeral(interaction, r.content);
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
        effect: interaction.options.getString("effect"),
        effectHours: interaction.options.getInteger("effect_hours"),
        effectPercent: interaction.options.getInteger("boost_percent"),
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
    const effectRaw = interaction.options.getString("effect");
    const effect = effectRaw === "none" ? null : isItemEffect(effectRaw) ? effectRaw : item.effect;
    const r = await svc.editItem(guild.id, item.id, {
      effect,
      effectHours: effect ? interaction.options.getInteger("effect_hours") ?? item.effectHours : null,
      effectPercent: effect === "work_boost" ? interaction.options.getInteger("boost_percent") ?? item.effectPercent : null,
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
    return ephemeral(interaction, `✅ Updated.\n${shopItemLine(cfg, r.value)}`);
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    if (interaction.options.getSubcommand() === "sell") return inventoryAutocomplete(interaction);
    await shopItemAutocomplete(interaction);
  },
};

export default command;
