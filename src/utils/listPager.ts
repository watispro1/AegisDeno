/**
 * A small paged list for long, read-only lists (a role's members, a server's
 * roles or emojis, a user's reminders). The page maths is pure and tested;
 * `replyPagedList` replies with an embed and ◀ ▶ buttons that only the person
 * who asked can press, and drops the buttons after two minutes.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ContextMenuCommandInteraction,
  type Message,
} from "discord.js";
import { guardCollect } from "./collectorGuard";
import { COLORS, footer } from "./embedStyle";

/** Discord's embed description limit is 4096; stay well under it. */
export const PAGE_CHAR_BUDGET = 3_800;
export const LIST_PAGER_IDLE_MS = 120_000;

export interface ListPage {
  lines: string[];
  page: number;
  totalPages: number;
}

/**
 * Split lines into pages of at most `perPage` lines and `charBudget`
 * characters each (a line longer than the budget is cut). Pure.
 */
export function paginateLines(lines: readonly string[], perPage = 20, charBudget = PAGE_CHAR_BUDGET): string[][] {
  const size = Math.max(1, Math.floor(perPage));
  const pages: string[][] = [];
  let current: string[] = [];
  let chars = 0;
  for (const raw of lines) {
    const line = raw.length > charBudget ? `${raw.slice(0, charBudget - 1)}…` : raw;
    const cost = line.length + 1;
    if (current.length >= size || (current.length > 0 && chars + cost > charBudget)) {
      pages.push(current);
      current = [];
      chars = 0;
    }
    current.push(line);
    chars += cost;
  }
  if (current.length || pages.length === 0) pages.push(current);
  return pages;
}

/** The page to show, clamped to the range. Pure. */
export function pickPage(pages: readonly string[][], requested: number): ListPage {
  const totalPages = Math.max(1, pages.length);
  const page = Math.min(Math.max(0, Math.floor(requested) || 0), totalPages - 1);
  return { lines: pages[page] ?? [], page, totalPages };
}

export interface PagedListOptions {
  title: string;
  lines: readonly string[];
  /** Shown when there are no lines. */
  empty?: string;
  perPage?: number;
  color?: number;
  /** Text above the list on every page. */
  header?: string;
  /** Footer text after "Page x/y". */
  note?: string;
  ephemeral?: boolean;
}

type Repliable = ChatInputCommandInteraction | ButtonInteraction | ContextMenuCommandInteraction;

function renderPage(opts: PagedListOptions, pages: string[][], page: number, idPrefix: string) {
  const view = pickPage(pages, page);
  const body = view.lines.length ? view.lines.join("\n") : (opts.empty ?? "Nothing to show.");
  const embed = new EmbedBuilder()
    .setColor(opts.color ?? COLORS.brand)
    .setTitle(opts.title.slice(0, 256))
    .setDescription(`${opts.header ? `${opts.header}\n\n` : ""}${body}`.slice(0, 4096))
    .setFooter(footer([view.totalPages > 1 ? `Page ${view.page + 1}/${view.totalPages}` : "", opts.note ?? ""].filter(Boolean).join(" · ")));
  const components = view.totalPages > 1
    ? [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`${idPrefix}:prev`).setEmoji("◀️").setStyle(ButtonStyle.Secondary).setDisabled(view.page === 0),
        new ButtonBuilder().setCustomId(`${idPrefix}:pos`).setLabel(`${view.page + 1} / ${view.totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId(`${idPrefix}:next`).setEmoji("▶️").setStyle(ButtonStyle.Secondary).setDisabled(view.page >= view.totalPages - 1),
      )]
    : [];
  return { embeds: [embed], components, page: view.page };
}

/**
 * Reply (or follow up, when the interaction was already answered) with a
 * paged list. Only `interaction.user` can turn the pages.
 */
export async function replyPagedList(interaction: Repliable, opts: PagedListOptions): Promise<void> {
  const pages = paginateLines(opts.lines, opts.perPage ?? 20);
  const idPrefix = `lpage_${interaction.id}`;
  let page = 0;
  const first = renderPage(opts, pages, page, idPrefix);
  const base = { embeds: first.embeds, components: first.components, allowedMentions: { parse: [] as never[] } };
  const payload = { ...base, ...(opts.ephemeral ? { flags: MessageFlags.Ephemeral as const } : {}) };
  let message: Message;
  // A deferred reply already chose its visibility when it was deferred.
  if (interaction.deferred && !interaction.replied) message = await interaction.editReply(base);
  else if (interaction.replied) message = await interaction.followUp(payload);
  else message = (await interaction.reply({ ...payload, withResponse: true })).resource!.message!;
  if (pages.length <= 1 || !message) return;

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    idle: LIST_PAGER_IDLE_MS,
    filter: (i) => i.customId.startsWith(idPrefix),
  });
  collector.on("collect", (i) => guardCollect("list-pager", i, async () => {
    if (i.user.id !== interaction.user.id) {
      await i.reply({ content: "Run the command yourself to page through this list.", flags: MessageFlags.Ephemeral });
      return;
    }
    page += i.customId.endsWith(":next") ? 1 : -1;
    const next = renderPage(opts, pages, page, idPrefix);
    page = next.page;
    await i.update({ embeds: next.embeds, components: next.components });
  }));
  collector.on("end", () => {
    // Works for ephemeral replies and follow-ups too, unlike message.edit().
    interaction.webhook.editMessage(message, { components: [] }).catch(() => null);
  });
}
