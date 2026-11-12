import { SlashCommandBuilder, EmbedBuilder, InteractionContextType, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { economy } from "../../services/economyService";
import { economyGate } from "../../services/economyDiscord";
import { formatCoins, type EconomyConfig } from "../../services/economyLogic";
import type { LeaderboardRank, LeaderboardRow, LeaderboardSort } from "../../services/economyStore";
import { runPager } from "../../services/economyPager";
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

/** The zero-based page a rank falls on. */
export function pageOfRank(rank: number, pageSize = LEADERBOARD_PAGE_SIZE): number {
  return Math.max(0, Math.floor((Math.max(1, rank) - 1) / Math.max(1, pageSize)));
}

/** Footer text for the viewer: their rank and the value ranked by, or how to get on the board. */
export function viewerRankText(cfg: EconomyConfig, mine: LeaderboardRank | null): string {
  if (!mine) return "You're not ranked yet. Earn coins with /daily or /work";
  const pct = mine.total > 1 ? ` · top ${Math.max(1, Math.ceil((mine.rank / mine.total) * 100))}%` : "";
  return `You: #${mine.rank.toLocaleString("en-US")} of ${mine.total.toLocaleString("en-US")} · ${formatCoins(cfg, mine.value)}${pct}`;
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
    const viewerId = interaction.user.id;
    const sortRaw = interaction.options.getString("sort");
    const sort: LeaderboardSort = sortRaw === "wallet" || sortRaw === "bank" ? sortRaw : "total";
    let total = 0;
    // Rank is read once per render (it can change while the board is open).
    let mine: LeaderboardRank | null = null;

    await runPager(interaction, {
      prefix: "lb",
      commandName: "leaderboard",
      pageSize: LEADERBOARD_PAGE_SIZE,
      startPage: (interaction.options.getInteger("page") ?? 1) - 1,
      total: async () => {
        const [board, rank] = await Promise.all([economy().leaderboard(guildId, 1, 1, sort), economy().rank(guildId, viewerId, sort)]);
        total = board.total;
        mine = rank;
        return total;
      },
      myPage: async () => (mine ? pageOfRank(mine.rank) : null),
      render: async (info) => {
        const { rows } = await economy().leaderboard(guildId, info.page + 1, LEADERBOARD_PAGE_SIZE, sort);
        const embed = new EmbedBuilder()
          .setColor(COLORS.brand)
          .setTitle(`🏆 ${interaction.guild?.name ?? "Server"} leaderboard`)
          .setDescription(rows.length ? leaderboardLines(rows, info.start, cfg, viewerId, sort).join("\n") : "Nobody has any coins yet. Start with `/daily`.")
          .setFooter(footer(`${viewerRankText(cfg, mine)}\nBy ${SORT_LABEL[sort]} · Page ${info.page + 1} of ${info.totalPages} · ${total.toLocaleString("en-US")} member${total === 1 ? "" : "s"}`));
        return { embed };
      },
    });
  },
};

export default command;
