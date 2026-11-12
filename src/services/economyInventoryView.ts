/**
 * The interactive /inventory: paged items with what each sells back for,
 * the total sell value, and (on your own inventory) Use and Sell menus that
 * confirm privately and then run the same guarded actions as /use and
 * /shop sell.
 */
import {
  ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder,
  type ChatInputCommandInteraction, type MessageActionRowComponentBuilder, type User,
} from "discord.js";
import { economy } from "./economyService";
import { NO_PINGS } from "./economyDiscord";
import { formatCoins, type EconomyConfig, type ShopItem } from "./economyLogic";
import type { InventoryRow } from "./economyStore";
import { runPager } from "./economyPager";
import { confirmShortcut, sellAction, useAction, whileEnabled } from "./economyItemActions";
import { inventorySellValue } from "./economyShopView";
import { COLORS, footer } from "../utils/embedStyle";

export const INVENTORY_PAGE_SIZE = 8;

export interface InventoryEntry { row: InventoryRow; item: ShopItem | undefined; sellEach: number | null; usable: boolean }

/** Pair inventory rows with the shop items they came from. Pure, for tests. */
export function inventoryEntries(rows: readonly InventoryRow[], items: readonly ShopItem[], sellPercent: number): InventoryEntry[] {
  const byId = new Map(items.map(i => [i.id, i]));
  return rows.map(row => {
    const item = byId.get(row.itemId);
    return { row, item, sellEach: inventorySellValue(item, sellPercent), usable: Boolean(item && (item.effect || (item.roleId && item.useToGrant))) };
  });
}

export function inventoryLine(cfg: EconomyConfig, e: InventoryEntry): string {
  const role = e.row.roleId ? ` · <@&${e.row.roleId}>` : "";
  const sell = e.sellEach === null ? "" : ` · sells for ${formatCoins(cfg, e.sellEach)}${e.row.quantity > 1 ? " each" : ""}`;
  return `• **${e.row.name}** ×${e.row.quantity.toLocaleString("en-US")}${role}${e.usable ? " · usable" : ""}${sell}`;
}

/** Everything sellable, sold back right now. */
export function inventoryWorth(entries: readonly InventoryEntry[]): number {
  return entries.reduce((n, e) => n + (e.sellEach ?? 0) * e.row.quantity, 0);
}

type Row = ActionRowBuilder<MessageActionRowComponentBuilder>;

export async function runInventory(interaction: ChatInputCommandInteraction, cfg: EconomyConfig, user: User): Promise<void> {
  const guild = interaction.guild!;
  const self = user.id === interaction.user.id;
  const ids = { use: `inv_${interaction.id}_xuse`, sell: `inv_${interaction.id}_xsell` };
  let entries: InventoryEntry[] = [];

  await runPager(interaction, {
    prefix: "inv",
    commandName: "inventory",
    pageSize: INVENTORY_PAGE_SIZE,
    total: async () => {
      const [rows, items] = await Promise.all([economy().inventory(guild.id, user.id), economy().items(guild.id)]);
      entries = inventoryEntries(rows, items, cfg.shopSellPercent);
      return entries.length;
    },
    render: (info) => {
      const page = entries.slice(info.start, info.end);
      const count = entries.reduce((n, e) => n + e.row.quantity, 0);
      const worth = inventoryWorth(entries);
      const embed = new EmbedBuilder()
        .setColor(COLORS.brand)
        .setAuthor({ name: `${user.displayName ?? user.username}'s inventory`, iconURL: user.displayAvatarURL() })
        .setDescription(page.length ? page.map(e => inventoryLine(cfg, e)).join("\n") : "Nothing here yet. Browse the shop with `/shop view`.")
        .setFooter(footer(`${count.toLocaleString("en-US")} item(s)${worth > 0 ? ` · sells for ${formatCoins(cfg, worth)} in total` : ""}${info.totalPages > 1 ? ` · Page ${info.page + 1} of ${info.totalPages}` : ""}`));
      if (page.length && self) {
        embed.addFields({ name: "Use or sell", value: `Pick from the menus below, or run \`/use\` and \`/shop sell\`. Selling returns ${cfg.shopSellPercent}% of the price${cfg.shopSellPercent > 0 ? "" : " (selling is off)"}.` });
      }
      const extraRows: Row[] = [];
      if (self) {
        const usable = page.filter(e => e.usable).slice(0, 25);
        const sellable = page.filter(e => e.sellEach !== null).slice(0, 25);
        if (usable.length) extraRows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
          new StringSelectMenuBuilder().setCustomId(ids.use).setPlaceholder("✨ Use an item…")
            .addOptions(usable.map(e => ({ label: e.row.name.slice(0, 100), value: e.row.itemId, description: `You have ${e.row.quantity}` })))));
        if (sellable.length) extraRows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
          new StringSelectMenuBuilder().setCustomId(ids.sell).setPlaceholder("💱 Sell one…")
            .addOptions(sellable.map(e => ({ label: e.row.name.slice(0, 100), value: e.row.itemId, description: `Sells for ${formatCoins(cfg, e.sellEach!)}`.slice(0, 100) })))));
      }
      return { embed, extraRows };
    },
    onExtra: async (i, _page, refresh) => {
      if (!i.isStringSelectMenu() || !self) return "keep";
      const entry = entries.find(e => e.row.itemId === i.values[0]);
      if (!entry) return "keep";
      const selling = i.customId === ids.sell;
      const prompt = selling
        ? `Sell one **${entry.row.name}** for ${formatCoins(cfg, entry.sellEach ?? 0)}?`
        : `Use one **${entry.row.name}** now?`;
      const result = await confirmShortcut(i, prompt, selling ? "Sell" : "Use",
        () => whileEnabled(guild.id, () => selling ? sellAction(guild.id, user.id, entry.row.itemId, cfg) : useAction(guild, user.id, interaction.channelId, entry.row.itemId)));
      // A role from /use is announced like /use does; effects and sales stay private.
      if (result?.ok && !result.ephemeral) await i.followUp({ content: result.content, allowedMentions: NO_PINGS }).catch(() => null);
      if (result) await refresh();
      return "handled";
    },
  });
}
