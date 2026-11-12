/**
 * Pure helpers for /shop view: item lines, sorting and filtering, and the
 * shortcut-menu choices. Kept free of Discord calls so they are tested directly.
 */
import { formatCoins, type EconomyConfig, type ShopItem } from "./economyLogic";
import { effectSummary } from "./economyProgress";
import { sellPrice } from "./economyRules";

export const SHOP_PAGE_SIZE = 6;
export type ShopSort = "price_asc" | "price_desc" | "name";
export type ShopShow = "all" | "affordable" | "in_stock";

export const SHOP_SORT_LABEL: Record<ShopSort, string> = { price_asc: "Price: low to high", price_desc: "Price: high to low", name: "Name: A to Z" };
export const SHOP_SHOW_LABEL: Record<ShopShow, string> = { all: "All items", affordable: "Only what I can afford", in_stock: "In stock only" };

export const isShopSort = (v: unknown): v is ShopSort => v === "price_asc" || v === "price_desc" || v === "name";
export const isShopShow = (v: unknown): v is ShopShow => v === "all" || v === "affordable" || v === "in_stock";

/** " · gives @Role for 24h on /use": what a role or effect item does. */
export function roleSummary(i: Pick<ShopItem, "roleId" | "roleDurationHours" | "useToGrant"> & Partial<Pick<ShopItem, "effect" | "effectHours" | "effectPercent">>): string {
  if (i.effect) return ` · ${effectSummary(i.effect, i.effectHours ?? 0, i.effectPercent ?? null)} on \`/use\``;
  if (!i.roleId) return "";
  return ` · gives <@&${i.roleId}>${i.roleDurationHours ? ` for ${i.roleDurationHours}h` : ""}${i.useToGrant ? " on `/use`" : ""}`;
}

export function stockText(stock: number | null): string {
  return stock === null ? "" : stock === 0 ? " · **sold out**" : ` · ${stock.toLocaleString("en-US")} left`;
}

/** One item in the shop list; with a balance, unaffordable items are marked. */
export function shopItemLine(cfg: EconomyConfig, i: ShopItem, balance?: number): string {
  const limit = i.perUserLimit === null ? "" : ` · max ${i.perUserLimit} each`;
  const mark = balance === undefined || i.stock === 0 ? "" : balance >= i.price ? "✅ " : "🔒 ";
  return `${mark}**${i.name}** · ${formatCoins(cfg, i.price)}${roleSummary(i)}${stockText(i.stock)}${limit}${i.description ? `\n> ${i.description}` : ""}`;
}

/** Sort and filter the shop for one viewer. Sold-out items sink to the bottom unless sorting by name. */
export function arrangeShop(items: readonly ShopItem[], opts: { sort?: ShopSort; show?: ShopShow; balance?: number } = {}): ShopItem[] {
  const sort = opts.sort ?? "price_asc";
  const show = opts.show ?? "all";
  const balance = opts.balance ?? 0;
  const kept = items.filter(i => show === "all" ? true : show === "in_stock" ? i.stock !== 0 : i.stock !== 0 && i.price <= balance);
  const byName = (a: ShopItem, b: ShopItem) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  return kept.slice().sort((a, b) => {
    if (sort === "name") return byName(a, b);
    const soldOut = Number(a.stock === 0) - Number(b.stock === 0);
    if (soldOut) return soldOut;
    return (sort === "price_desc" ? b.price - a.price : a.price - b.price) || byName(a, b);
  });
}

/** Items on a page a member can pick to buy: not sold out. Discord allows at most 25 options. */
export function buyChoices(cfg: EconomyConfig, items: readonly ShopItem[], balance: number): Array<{ label: string; value: string; description: string }> {
  return items.filter(i => i.stock !== 0).slice(0, 25).map(i => ({
    label: i.name.slice(0, 100),
    value: i.id,
    description: `${formatCoins(cfg, i.price)}${i.price > balance ? " · can't afford yet" : ""}${stockText(i.stock).replace(/\*\*/g, "")}`.slice(0, 100),
  }));
}

/** Shop footer: how many are shown and what the viewer has to spend. */
export function shopFooter(cfg: EconomyConfig, shown: number, total: number, balance: number, show: ShopShow): string {
  const count = shown === total ? `${total} item${total === 1 ? "" : "s"}` : `${shown} of ${total} items (${SHOP_SHOW_LABEL[show].toLowerCase()})`;
  return `${count} · Your wallet: ${formatCoins(cfg, balance)}`;
}

/** What an inventory item sells back for, or null when it can't be sold (selling off, item gone, role already given). */
export function inventorySellValue(item: ShopItem | undefined, sellPercent: number): number | null {
  return item ? sellPrice(item, sellPercent) : null;
}
