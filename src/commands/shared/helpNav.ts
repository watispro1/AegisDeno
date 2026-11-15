/**
 * /help hub navigation: which page comes before and after the one on screen,
 * how a long category splits into pages, and the button row that moves
 * between them. The maths is pure and unit-tested; the row is plain builders.
 */
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { paginateLines } from "../../utils/listPager";

/** customIds on the hub (scoped by the hub message, so collectors never clash). */
export const HELP_NAV_IDS = { prev: "help_nav_prev", home: "help_nav_home", next: "help_nav_next", more: "help_nav_more", browse: "help_nav_browse" } as const;

/** Characters one category page may use in an embed description (Discord allows 4096). */
export const HELP_PAGE_BUDGET = 3_900;

/** The hub's pages in order: Home, each category the member can use, then Apps. Pure. */
export function helpPageOrder(categories: readonly string[], appsPage: string): string[] {
  return ["all", ...categories.filter(c => c !== "all" && c !== appsPage), appsPage];
}

/** The page `step` places away from `current`, wrapping at both ends. Unknown pages count as Home. Pure. */
export function stepHelpPage(order: readonly string[], current: string, step: 1 | -1): string {
  if (!order.length) return "all";
  const at = Math.max(0, order.indexOf(current));
  return order[(at + step + order.length) % order.length];
}

/** A category's command lines split into pages that each fit one embed. Pure. */
export function helpCategoryPages(lines: readonly string[], budget = HELP_PAGE_BUDGET): string[] {
  if (!lines.length) return [""];
  return paginateLines(lines, 50, budget).map(page => page.join("\n"));
}

/** The label of the page after `current` in the order, for the Next button. Pure. */
export function neighbourLabels(order: readonly string[], current: string, label: (page: string) => string): { prev: string; next: string } {
  return { prev: label(stepHelpPage(order, current, -1)), next: label(stepHelpPage(order, current, 1)) };
}

/** ◀ previous category · 🏠 Home · next category ▶ · page x/y (when a category runs long). */
export function helpNavRow(opts: { prevLabel: string; nextLabel: string; onHome: boolean; page: number; pages: number }): ActionRowBuilder<ButtonBuilder> {
  const clip = (s: string) => (s.length > 30 ? `${s.slice(0, 29)}…` : s);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(HELP_NAV_IDS.prev).setLabel(clip(opts.prevLabel)).setEmoji("◀️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(HELP_NAV_IDS.home).setLabel("Home").setEmoji("🏠").setStyle(ButtonStyle.Secondary).setDisabled(opts.onHome),
    new ButtonBuilder().setCustomId(HELP_NAV_IDS.next).setLabel(clip(opts.nextLabel)).setEmoji("▶️").setStyle(ButtonStyle.Secondary),
  );
  if (opts.pages > 1) {
    row.addComponents(new ButtonBuilder().setCustomId(HELP_NAV_IDS.more)
      .setLabel(`Page ${opts.page + 1}/${opts.pages}`).setEmoji("📄").setStyle(ButtonStyle.Primary));
  }
  return row;
}

/** A usage line with every required option filled in as a placeholder, e.g. `/warn user:<user> reason:<reason>`. Pure. */
export function usageExample(name: string, options: ReadonlyArray<{ name: string; type: number; required?: boolean; options?: ReadonlyArray<{ name: string; type: number; required?: boolean }> }>): string {
  const sub = options.find(o => o.type === 1 || o.type === 2);
  if (sub) {
    const leaf = sub.type === 2 ? sub.options?.find(o => o.type === 1) : sub;
    const required = (leaf && "options" in leaf ? (leaf as { options?: ReadonlyArray<{ name: string; required?: boolean }> }).options ?? [] : []).filter(o => o.required);
    const path = sub.type === 2 && leaf ? `${sub.name} ${leaf.name}` : sub.name;
    return `/${name} ${path}${required.map(o => ` ${o.name}:<${o.name}>`).join("")}`;
  }
  return `/${name}${options.filter(o => o.required).map(o => ` ${o.name}:<${o.name}>`).join("")}`;
}
