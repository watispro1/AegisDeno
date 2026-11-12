/**
 * The interactive /shop view: paged item list, sort and "show" menus, and a
 * Buy menu for the items on the page. A purchase from the menu asks the
 * member to confirm privately, then runs the same guarded buy as /shop buy.
 */
import {
  ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, MessageFlags,
  type ChatInputCommandInteraction, type MessageActionRowComponentBuilder,
} from "discord.js";
import { economy } from "./economyService";
import { NO_PINGS } from "./economyDiscord";
import type { EconomyConfig, ShopItem } from "./economyLogic";
import { runPager } from "./economyPager";
import { buyAction, buyPrompt, confirmShortcut, whileEnabled } from "./economyItemActions";
import {
  SHOP_PAGE_SIZE, SHOP_SHOW_LABEL, SHOP_SORT_LABEL, arrangeShop, buyChoices, isShopShow, isShopSort, shopFooter, shopItemLine,
  type ShopShow, type ShopSort,
} from "./economyShopView";
import { COLORS, footer } from "../utils/embedStyle";

type Row = ActionRowBuilder<MessageActionRowComponentBuilder>;

export async function runShopView(interaction: ChatInputCommandInteraction, cfg: EconomyConfig, start: { sort: ShopSort; show: ShopShow }): Promise<void> {
  const guild = interaction.guild!;
  const userId = interaction.user.id;
  let { sort, show } = start;
  let all: ShopItem[] = [];
  let list: ShopItem[] = [];
  let balance = 0;
  const base = `shop_${interaction.id}`;
  const ids = { buy: `${base}_xbuy`, sort: `${base}_xsort`, show: `${base}_xshow` };

  const load = async () => {
    const [items, acct] = await Promise.all([economy().items(guild.id), economy().balance(guild.id, userId)]);
    all = items;
    balance = acct.balance;
    list = arrangeShop(all, { sort, show, balance });
    return list.length;
  };

  await runPager(interaction, {
    prefix: "shop",
    commandName: "shop view",
    pageSize: SHOP_PAGE_SIZE,
    total: load,
    render: (info) => {
      const page = list.slice(info.start, info.end);
      const empty = all.length === 0
        ? "The shop is empty. Staff can add items with `/shop add` or on the dashboard."
        : show === "affordable" ? "Nothing here fits your wallet yet. Earn more with `/work` or `/daily`, or show all items."
        : "Everything is sold out right now.";
      const embed = new EmbedBuilder()
        .setColor(COLORS.brand)
        .setTitle(`🛒 ${guild.name} shop`)
        .setDescription(page.length ? page.map(i => shopItemLine(cfg, i, balance)).join("\n\n") : empty)
        .setFooter(footer(`${shopFooter(cfg, list.length, all.length, balance, show)}\nPage ${info.page + 1} of ${info.totalPages} · ✅ you can afford · 🔒 not yet`));
      const extraRows: Row[] = [];
      const choices = buyChoices(cfg, page, balance);
      if (choices.length) {
        extraRows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
          new StringSelectMenuBuilder().setCustomId(ids.buy).setPlaceholder("🛍️ Buy an item from this page…").addOptions(choices)));
      }
      if (all.length > 1) {
        extraRows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
          new StringSelectMenuBuilder().setCustomId(ids.sort).setPlaceholder("Sort").addOptions(
            (Object.keys(SHOP_SORT_LABEL) as ShopSort[]).map(v => ({ label: SHOP_SORT_LABEL[v], value: v, default: v === sort }))),
        ));
        extraRows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
          new StringSelectMenuBuilder().setCustomId(ids.show).setPlaceholder("Show").addOptions(
            (Object.keys(SHOP_SHOW_LABEL) as ShopShow[]).map(v => ({ label: SHOP_SHOW_LABEL[v], value: v, default: v === show }))),
        ));
      }
      return { embed, extraRows };
    },
    onExtra: async (i, _page, refresh) => {
      if (!i.isStringSelectMenu()) return "keep";
      const value = i.values[0];
      if (i.customId === ids.sort && isShopSort(value)) { sort = value; return 0; }
      if (i.customId === ids.show && isShopShow(value)) { show = value; return 0; }
      if (i.customId !== ids.buy) return "keep";
      const item = all.find(x => x.id === value);
      if (!item) {
        await i.reply({ content: "❌ That item isn't in the shop any more.", flags: MessageFlags.Ephemeral });
        return "handled";
      }
      const wallet = (await economy().balance(guild.id, userId)).balance;
      if (wallet < item.price) {
        await i.reply({ content: `❌ ${buyPrompt(cfg, item, wallet)}`, flags: MessageFlags.Ephemeral, allowedMentions: NO_PINGS });
        return "handled";
      }
      const result = await confirmShortcut(i, buyPrompt(cfg, item, wallet), `Buy for ${item.price.toLocaleString("en-US")}`,
        () => whileEnabled(guild.id, () => buyAction(guild, userId, interaction.channelId, item.id, cfg)));
      // A role grant is worth announcing like /shop buy does; everything else stays private.
      if (result?.ok && !result.ephemeral && item.roleId && !item.useToGrant) {
        await i.followUp({ content: result.content, allowedMentions: NO_PINGS }).catch(() => null);
      }
      if (result) await refresh();
      return "handled";
    },
  });
}
