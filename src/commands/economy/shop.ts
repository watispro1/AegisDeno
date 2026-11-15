import {
  SlashCommandBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits,
  type ChatInputCommandInteraction, type AutocompleteInteraction,
} from "discord.js";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate, inventoryAutocomplete, shopItemAutocomplete, shopRoleRefusal, NO_PINGS } from "../../services/economyDiscord";
import { MAX_BALANCE, SHOP_LIMITS, formatCoins, needsPayConfirmation } from "../../services/economyLogic";
import { EFFECT_LIMITS, isItemEffect } from "../../services/economyProgress";
import { isShopShow, isShopSort, shopItemLine, SHOP_SHOW_LABEL, SHOP_SORT_LABEL } from "../../services/economyShopView";
import { runShopView } from "../../services/economyShopPager";
import { requestConfirmation } from "../../utils/confirmation";
import { MAX_TRADE_QUANTITY, buyItemAutocomplete, buyPlanned, planBuy, quantityAutocomplete, sellMany, type TradeReply } from "./lib/shopTrade";
import { withMemberLock } from "./lib/memberLock";
import { STILL_RUNNING, sayPrivately } from "./lib/ui";
import { editConflict } from "./lib/shopEdit";

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

/** Send a buy/sell result: public results as a new message, private ones in place. */
async function sendTrade(interaction: ChatInputCommandInteraction, r: TradeReply, confirmed: boolean): Promise<void> {
  const payload = { content: r.content ?? "", embeds: r.embed ? [r.embed] : [], allowedMentions: NO_PINGS };
  if (confirmed) {
    // The private prompt becomes the private result; a public result is posted for everyone.
    if (r.ephemeral || !r.ok) return void await interaction.editReply({ ...payload, components: [] });
    await interaction.editReply({ content: "✅ Done.", embeds: [], components: [] });
    await interaction.followUp(payload);
    return;
  }
  if (interaction.deferred) {
    if (r.ok || !r.ephemeral) return void await interaction.editReply(payload);
    // A refusal stays private even though the reply was deferred in public.
    await interaction.deleteReply().catch(() => null);
    return void await interaction.followUp({ ...payload, flags: MessageFlags.Ephemeral });
  }
  await interaction.reply({ ...payload, ...(r.ephemeral ? { flags: MessageFlags.Ephemeral } : {}) });
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Browse, buy and sell shop items with coins. Staff can add, edit and remove items.")
    .setContexts(InteractionContextType.Guild)
    .addSubcommand(s => s.setName("view").setDescription("See what's for sale, a page at a time, and buy from the menu.")
      .addStringOption(o => o.setName("sort").setDescription("Order items by (default: price, low to high)")
        .addChoices(...(Object.keys(SHOP_SORT_LABEL) as Array<keyof typeof SHOP_SORT_LABEL>).map(v => ({ name: SHOP_SORT_LABEL[v], value: v }))))
      .addStringOption(o => o.setName("show").setDescription("Which items to list (default: all)")
        .addChoices(...(Object.keys(SHOP_SHOW_LABEL) as Array<keyof typeof SHOP_SHOW_LABEL>).map(v => ({ name: SHOP_SHOW_LABEL[v], value: v }))))
      .addBooleanOption(o => o.setName("affordable").setDescription("Only list items you can afford right now")))
    .addSubcommand(s => s.setName("buy").setDescription("Buy an item (or several) with coins from your wallet.")
      .addStringOption(o => o.setName("item").setDescription("Item to buy; the list shows price, stock and what you can afford").setRequired(true).setAutocomplete(true))
      .addIntegerOption(o => o.setName("quantity").setDescription(`How many to buy (default 1, up to ${MAX_TRADE_QUANTITY})`).setMinValue(1).setMaxValue(MAX_TRADE_QUANTITY).setAutocomplete(true)))
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
    .addSubcommand(s => s.setName("sell").setDescription("Sell items from your inventory back to the shop at a reduced rate.")
      .addStringOption(o => o.setName("item").setDescription("Item to sell, from your inventory").setRequired(true).setAutocomplete(true))
      .addIntegerOption(o => o.setName("quantity").setDescription(`How many to sell (default 1, up to ${MAX_TRADE_QUANTITY})`).setMinValue(1).setMaxValue(MAX_TRADE_QUANTITY).setAutocomplete(true))),
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
      const quantity = interaction.options.getInteger("quantity") ?? 1;
      const [item, acct] = await Promise.all([svc.item(guild.id, interaction.options.getString("item", true)), svc.balance(guild.id, interaction.user.id)]);
      const plan = planBuy(cfg, item, quantity, acct);
      if (!plan.ok) return ephemeral(interaction, plan.content);
      // Several units at once, for a large total, ask first like a large /pay does.
      let confirmed = false;
      if (plan.quantity > 1 && needsPayConfirmation(plan.total, cfg)) {
        const answer = await requestConfirmation(interaction, {
          content: `Buy **${plan.quantity}× ${plan.item.name}** for ${formatCoins(cfg, plan.total)}? You'll have ${formatCoins(cfg, plan.wallet - plan.total)} left.`,
          confirmLabel: `Buy ${plan.quantity}`,
        });
        if (answer !== "confirmed") return;
        confirmed = true;
      } else if (plan.quantity > 1) {
        await interaction.deferReply();
      }
      const r = await withMemberLock(guild.id, interaction.user.id, () => buyPlanned(guild, interaction.user.id, interaction.channelId, cfg, plan));
      if (!r.ok) return sendTrade(interaction, { ok: false, ephemeral: true, content: STILL_RUNNING }, confirmed);
      return sendTrade(interaction, r.value, confirmed);
    }

    if (sub === "sell") {
      const quantity = interaction.options.getInteger("quantity") ?? 1;
      const r = await withMemberLock(guild.id, interaction.user.id, () => sellMany(guild.id, interaction.user.id, interaction.options.getString("item", true), quantity, cfg));
      if (!r.ok) return ephemeral(interaction, STILL_RUNNING);
      return sendTrade(interaction, r.value, false);
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
      const answer = await requestConfirmation(interaction, { content: `Remove **${item.name}** (${formatCoins(cfg, item.price)}) from the shop? Members who bought it keep it.`, confirmLabel: "Remove item" });
      if (answer !== "confirmed") return;
      const removed = await svc.removeItem(guild.id, item.id);
      return sayPrivately(interaction, removed ? `🗑️ Removed **${item.name}**. Members who bought it keep it.` : "❌ That item was already removed.");
    }

    // edit
    const conflict = editConflict({
      role: interaction.options.getRole("role") !== null, clearRole: interaction.options.getBoolean("clear_role") === true,
      stock: interaction.options.getInteger("stock") !== null, unlimited: interaction.options.getBoolean("unlimited") === true,
      perUser: interaction.options.getInteger("per_user_limit") !== null, noUserLimit: interaction.options.getBoolean("no_user_limit") === true,
      roleHours: interaction.options.getInteger("role_hours") !== null, permanentRole: interaction.options.getBoolean("permanent_role") === true,
      changes: interaction.options.data[0]?.options?.filter(o => o.name !== "item").length ?? 0,
    });
    if (conflict) return ephemeral(interaction, `❌ ${conflict}`);
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
    const sub = interaction.options.getSubcommand();
    const focused = interaction.options.getFocused(true).name;
    if (focused === "quantity") return quantityAutocomplete(interaction, sub === "sell" ? "sell" : "buy");
    if (sub === "sell") return inventoryAutocomplete(interaction);
    if (sub === "buy") return buyItemAutocomplete(interaction);
    await shopItemAutocomplete(interaction);
  },
};

export default command;
