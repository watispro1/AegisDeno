import {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
  InteractionContextType, MessageFlags, type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate, NO_PINGS } from "../../services/economyDiscord";
import { formatCoins, type EconomyConfig } from "../../services/economyLogic";
import { pageInfo } from "../../services/casePaging";
import type { LeaderboardRow, LeaderboardSort } from "../../services/economyStore";
import { guardCollect } from "../../utils/collectorGuard";
import { COLORS, footer } from "../../utils/embedStyle";

export const LEADERBOARD_PAGE_SIZE = 10;
const MEDALS = ["🥇", "🥈", "🥉"];

/** Leaderboard lines. Mentions render as names but never ping (allowedMentions is empty). */
export function leaderboardLines(rows: LeaderboardRow[], offset: number, cfg: EconomyConfig, viewerId: string, sort: LeaderboardSort = "total"): string[] {
  return rows.map((r, i) => {
    const rank = offset + i + 1;
    const badge = MEDALS[rank - 1] ?? `**${rank}.**`;
    const value = sort === "wallet" ? r.balance : sort === "bank" ? r.bank : r.total;
    return `${badge} <@${r.userId}> · ${formatCoins(cfg, value)}${r.userId === viewerId ? " ← you" : ""}`;
  });
}

const SORT_LABEL: Record<LeaderboardSort, string> = { total: "wallet + bank", wallet: "wallet", bank: "bank" };

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("The richest members in this server's economy.")
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption(o => o.setName("page").setDescription("Page to open (default 1)").setMinValue(1).setMaxValue(1000))
    .addStringOption(o => o.setName("sort").setDescription("Rank by (default: wallet + bank)")
      .addChoices({ name: "Wallet + bank", value: "total" }, { name: "Wallet", value: "wallet" }, { name: "Bank", value: "bank" })),
  category: "economy",
  guildOnly: true,
  async execute(interaction: ChatInputCommandInteraction) {
    const cfg = await economyGate(interaction);
    if (!cfg) return;
    const guildId = interaction.guildId!;
    const prevId = `lb_prev_${interaction.id}`;
    const nextId = `lb_next_${interaction.id}`;
    let page = (interaction.options.getInteger("page") ?? 1) - 1;
    const sortRaw = interaction.options.getString("sort");
    const sort: LeaderboardSort = sortRaw === "wallet" || sortRaw === "bank" ? sortRaw : "total";

    const render = async (requested: number) => {
      let result = await economy().leaderboard(guildId, Math.max(0, requested) + 1, LEADERBOARD_PAGE_SIZE, sort);
      const info = pageInfo(result.total, requested, LEADERBOARD_PAGE_SIZE);
      if (info.page !== Math.max(0, requested)) result = await economy().leaderboard(guildId, info.page + 1, LEADERBOARD_PAGE_SIZE, sort);
      const { rows, total } = result;
      page = info.page;
      const embed = new EmbedBuilder()
        .setColor(COLORS.brand)
        .setTitle(`🏆 ${interaction.guild?.name ?? "Server"} leaderboard`)
        .setDescription(rows.length ? leaderboardLines(rows, info.start, cfg, interaction.user.id, sort).join("\n") : "Nobody has any coins yet. Start with `/daily`.")
        .setFooter(footer(`By ${SORT_LABEL[sort]} · Page ${info.page + 1} of ${info.totalPages} · ${total.toLocaleString("en-US")} member${total === 1 ? "" : "s"}`));
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(prevId).setLabel("Prev").setEmoji("◀️").setStyle(ButtonStyle.Secondary).setDisabled(!info.hasPrev),
        new ButtonBuilder().setCustomId(nextId).setLabel("Next").setEmoji("▶️").setStyle(ButtonStyle.Secondary).setDisabled(!info.hasNext),
      );
      return { embeds: [embed], components: info.totalPages > 1 ? [row] : [], allowedMentions: NO_PINGS };
    };

    const first = await render(page);
    const response = await interaction.reply({ ...first, withResponse: true });
    const message = response.resource?.message;
    if (!message || first.components.length === 0) return;
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
      filter: (i) => i.customId === prevId || i.customId === nextId,
    });
    collector.on("collect", (i) => guardCollect("leaderboard", i, async () => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: "❌ Only the person who ran `/leaderboard` can change pages.", flags: MessageFlags.Ephemeral });
        return;
      }
      await i.update(await render(page + (i.customId === nextId ? 1 : -1)));
    }));
    collector.on("end", () => { interaction.editReply({ components: [] }).catch(() => null); });
  },
};

export default command;
