/** /starboard top: the most-starred posts in the server, with links, excerpts and top authors. */
import { EmbedBuilder, MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import { getStarboardConfig } from "../../services/starboard";
import { discordExcerptFetcher } from "../../services/starboardExcerpt";
import {
  PERIOD_LABELS,
  STARBOARD_TOP_LIMIT,
  formatTopAuthors,
  formatTopDescription,
  formatTopLine,
  isStarboardTopPeriod,
  topTitle,
  type StarboardTopPeriod,
} from "../../services/starboardTop";
import { fillMissingExcerpts, findTopStarboardAuthors, findTopStarboardEntries } from "../../services/starboardTopQuery";

export async function runStarboardTop(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const raw = interaction.options.getString("period");
  const period: StarboardTopPeriod = isStarboardTopPeriod(raw) ? raw : "all";
  const user = interaction.options.getUser("user");
  const share = interaction.options.getBoolean("share") ?? false;
  await interaction.deferReply(share ? {} : { flags: MessageFlags.Ephemeral });

  const query = { period, authorId: user?.id ?? null, limit: STARBOARD_TOP_LIMIT };
  const [config, entries, authors] = await Promise.all([
    getStarboardConfig(guildId),
    findTopStarboardEntries(guildId, query),
    findTopStarboardAuthors(guildId, query, user ? 1 : undefined),
  ]);

  if (!entries.length) {
    const who = user ? ` by <@${user.id}>` : "";
    await interaction.editReply({
      content: `${config.emoji} No starred posts${who} in the ${PERIOD_LABELS[period]} yet.`,
      allowedMentions: { parse: [] },
    });
    return;
  }

  if (interaction.guild) await fillMissingExcerpts(guildId, entries, discordExcerptFetcher(interaction.guild));

  const lines = entries.map((e, i) => formatTopLine(e, i + 1, { guildId, emoji: config.emoji, starboardChannelId: config.channelId }));
  const authorsLine = user
    ? (authors[0] ? `**Total:** ${authors[0].stars} ${config.emoji} across ${authors[0].posts} post${authors[0].posts === 1 ? "" : "s"}` : null)
    : formatTopAuthors(authors, config.emoji);

  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle(`${config.emoji} ${topTitle(period, Boolean(user))}`)
    .setDescription(formatTopDescription(lines, authorsLine))
    .setFooter({ text: user ? `${user.username} · top ${entries.length}` : `Top ${entries.length} by star count` });

  await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
}
