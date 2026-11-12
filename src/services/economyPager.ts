/**
 * Shared paging for the economy commands (/leaderboard, /shop view,
 * /transactions, /inventory): First / Prev / [Jump to me] / Next / Last
 * buttons scoped to the member who ran the command, extra rows (select
 * menus) a command can add, and every component disabled when the
 * collector times out so stale buttons never look clickable.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type APIActionRowComponent,
  type APIComponentInActionRow,
  type ChatInputCommandInteraction,
  type EmbedBuilder,
  type Message,
  type MessageActionRowComponentBuilder,
  type MessageComponentInteraction,
} from "discord.js";
import { movePage, pageInfo, showJumpButtons, type PageInfo, type PageMove } from "./casePaging";
import { NO_PINGS } from "./economyDiscord";
import { guardCollect } from "../utils/collectorGuard";

export const PAGER_TIMEOUT_MS = 120_000;

export type NavMove = PageMove | "me";

/** Custom IDs for one command run, so two pagers in a channel never cross. */
export function pagerIds(prefix: string, interactionId: string): Record<NavMove, string> & { base: string } {
  const base = `${prefix}_${interactionId}`;
  return { base, first: `${base}_first`, prev: `${base}_prev`, me: `${base}_me`, next: `${base}_next`, last: `${base}_last` };
}

/** Which navigation buttons a page shows, in order, and whether each is disabled. Pure, for tests. */
export function navButtonSpecs(info: PageInfo, opts: { jumpToMe?: boolean; myPage?: number | null } = {}): Array<{ move: NavMove; disabled: boolean }> {
  const jump = showJumpButtons(info.totalPages);
  const specs: Array<{ move: NavMove; disabled: boolean }> = [];
  if (jump) specs.push({ move: "first", disabled: !info.hasPrev });
  specs.push({ move: "prev", disabled: !info.hasPrev });
  if (opts.jumpToMe) specs.push({ move: "me", disabled: opts.myPage === null || opts.myPage === undefined || opts.myPage === info.page });
  specs.push({ move: "next", disabled: !info.hasNext });
  if (jump) specs.push({ move: "last", disabled: !info.hasNext });
  return specs;
}

const NAV_LOOK: Record<NavMove, { emoji: string; label?: string }> = {
  first: { emoji: "⏮️" }, prev: { emoji: "◀️", label: "Prev" }, me: { emoji: "📍", label: "Jump to me" },
  next: { emoji: "▶️", label: "Next" }, last: { emoji: "⏭️" },
};

export function navRow(ids: Record<NavMove, string>, info: PageInfo, opts: { jumpToMe?: boolean; myPage?: number | null } = {}): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(navButtonSpecs(info, opts).map(({ move, disabled }) => {
    const b = new ButtonBuilder().setCustomId(ids[move]).setEmoji(NAV_LOOK[move].emoji).setStyle(move === "me" ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(disabled);
    return NAV_LOOK[move].label ? b.setLabel(NAV_LOOK[move].label!) : b;
  }));
}

/** A component row as JSON with every component disabled (for the timed-out message). */
export function disabledRows(rows: Array<{ toJSON(): APIActionRowComponent<APIComponentInActionRow> }>): APIActionRowComponent<APIComponentInActionRow>[] {
  return rows.map(r => {
    const json = r.toJSON();
    return { ...json, components: json.components.map(c => ({ ...c, disabled: true })) } as APIActionRowComponent<APIComponentInActionRow>;
  });
}

export interface PageView {
  embed: EmbedBuilder;
  /** Rows shown under the navigation row (select menus, toggles). At most four. */
  extraRows?: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

export interface PagerOptions {
  /** Short label for logs and the custom-ID prefix, e.g. "lb". */
  prefix: string;
  /** The command's name, for the "only the person who ran /x" notice. */
  commandName: string;
  pageSize: number;
  /** How many entries there are (re-read on every render, so it can change). */
  total: () => Promise<number> | number;
  /** Render one page; `info` is already clamped to the range. */
  render: (info: PageInfo) => Promise<PageView> | PageView;
  /** The zero-based page the invoker is on, for the Jump-to-me button (omit to hide it). */
  myPage?: () => Promise<number | null>;
  startPage?: number;
  ephemeral?: boolean;
  /**
   * A press on an extra row. Return a page to move to and re-render, "keep"
   * to re-render the same page, or "handled" when the handler replied itself
   * (and the view may be refreshed with `refresh`).
   */
  onExtra?: (i: MessageComponentInteraction, page: number, refresh: () => Promise<void>) => Promise<number | "keep" | "handled">;
}

/** Reply with a paged view and drive its buttons until the collector times out. */
export async function runPager(interaction: ChatInputCommandInteraction, opts: PagerOptions): Promise<void> {
  const ids = pagerIds(opts.prefix, interaction.id);
  const moveFor = new Map<string, NavMove>((["first", "prev", "me", "next", "last"] as NavMove[]).map(m => [ids[m], m]));
  let page = Math.max(0, opts.startPage ?? 0);
  let lastRows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

  const build = async (requested: number) => {
    const total = await opts.total();
    const info = pageInfo(total, requested, opts.pageSize);
    page = info.page;
    const [view, myPage] = await Promise.all([opts.render(info), opts.myPage ? opts.myPage() : Promise.resolve(null)]);
    const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
    if (info.totalPages > 1 || (opts.myPage && myPage !== null && myPage !== info.page)) {
      rows.push(navRow(ids, info, { jumpToMe: Boolean(opts.myPage), myPage }) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>);
    }
    rows.push(...(view.extraRows ?? []).slice(0, 5 - rows.length));
    lastRows = rows;
    return { embeds: [view.embed], components: rows, allowedMentions: NO_PINGS };
  };

  const first = await build(page);
  const response = await interaction.reply({ ...first, ...(opts.ephemeral ? { flags: MessageFlags.Ephemeral } : {}), withResponse: true });
  const message: Message | null | undefined = response.resource?.message;
  if (!message || first.components.length === 0) return;

  const collector = message.createMessageComponentCollector({
    time: PAGER_TIMEOUT_MS,
    filter: (i) => i.customId.startsWith(ids.base),
  });
  collector.on("collect", (i) => guardCollect(opts.prefix, i, async () => {
    if (i.user.id !== interaction.user.id) {
      await i.reply({ content: `❌ Only the person who ran \`/${opts.commandName}\` can use these buttons. Run it yourself to get your own.`, flags: MessageFlags.Ephemeral });
      return;
    }
    const move = moveFor.get(i.customId);
    if (move) {
      const total = await opts.total();
      const target = move === "me" ? (await opts.myPage?.()) ?? page : movePage(page, move, total, opts.pageSize);
      await i.update(await build(target));
      return;
    }
    if (!opts.onExtra) return;
    const refresh = async () => { await interaction.editReply(await build(page)).catch(() => null); };
    const next = await opts.onExtra(i, page, refresh);
    if (next === "handled") return;
    await i.update(await build(next === "keep" ? page : next));
  }));
  collector.on("end", () => {
    interaction.editReply({ components: disabledRows(lastRows) }).catch(() => null);
  });
}
