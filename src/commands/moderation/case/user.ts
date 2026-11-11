/**
 * /case user: a member's cases, newest first, with an optional action filter,
 * a "hide revoked" toggle, and First/Prev/Next/Last paging.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from "discord.js";
import { ModerationCaseModel } from "../../../database/mongo";
import {
  MAX_CASES_BROWSABLE,
  caseCountLabel,
  caseUserQuery,
  describeCaseFilter,
  movePage,
  pageInfo,
  showJumpButtons,
  type PageMove,
} from "../../../services/casePaging";
import { guardCollect } from "../../../utils/collectorGuard";
import { truncate as clip } from "../../../utils/safeText";

export const CASE_ACTION_ICONS: Record<string, string> = {
  ban: "🔨",
  softban: "🧹",
  temprole: "🏷️",
  unban: "↩️",
  kick: "👢",
  timeout: "⏱️",
  untimeout: "🔓",
  warn: "⚠️",
  purge: "🗑️",
  lock: "🔒",
  unlock: "🔓",
};

export async function runCaseUser(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const user = interaction.options.getUser("user", true);
  const filter = {
    action: interaction.options.getString("action"),
    hideRevoked: interaction.options.getBoolean("hide_revoked") ?? false,
  };
  const query = caseUserQuery(guild.id, user.id, filter);
  // Acknowledge before the database read so a slow query never shows "This interaction failed".
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const [records, total] = await Promise.all([
    ModerationCaseModel.find(query)
      .select("_id action reason moderatorId revoked proofUrl createdAt")
      .sort({ createdAt: -1 })
      .limit(MAX_CASES_BROWSABLE)
      .lean(),
    ModerationCaseModel.countDocuments(query),
  ]);
  const filterText = describeCaseFilter(filter);

  if (records.length === 0) {
    await interaction.editReply({
      content: filterText
        ? `✅ No cases for **${user.tag}** (<@${user.id}>) match ${filterText}. Run \`/case user\` without filters to see everything.`
        : `✅ No moderation cases found on record for **${user.tag}** (<@${user.id}>).`,
      allowedMentions: { parse: [] },
    });
    return;
  }

  const ids: Record<PageMove, string> = {
    first: `case_first_${interaction.id}`,
    prev: `case_prev_${interaction.id}`,
    next: `case_next_${interaction.id}`,
    last: `case_last_${interaction.id}`,
  };
  const moveFor = new Map<string, PageMove>(Object.entries(ids).map(([move, id]) => [id, move as PageMove]));
  let page = 0;

  const render = (requested: number) => {
    const info = pageInfo(records.length, requested);
    const lines = records.slice(info.start, info.end).map((r, i) => {
      const icon = CASE_ACTION_ICONS[r.action.toLowerCase()] ?? "📜";
      const dateStr = `<t:${Math.floor(new Date(r.createdAt).getTime() / 1000)}:R>`;
      const flags = `${r.revoked ? " · *revoked*" : ""}${r.proofUrl ? " · 📎" : ""}`;
      return `**${info.start + i + 1}.** ${icon} \`${r.action.toUpperCase()}\` — ${clip((r.reason || "No reason").replace(/\s+/g, " "), 300)} (${dateStr})\n└ *ID:* \`${String(r._id)}\` · *Mod:* <@${r.moderatorId}>${flags}`;
    });
    const footer = [`Page ${info.page + 1}/${info.totalPages}`, filterText, "/case view case_id:<id> for details"].filter(Boolean).join(" · ");
    const embed = new EmbedBuilder()
      .setTitle(`📜 Case History for ${user.tag} (${caseCountLabel(records.length, total)})`)
      .setThumbnail(user.displayAvatarURL())
      .setColor(0x5865F2)
      .setDescription(clip(lines.join("\n\n"), 4096))
      .setFooter({ text: footer })
      .setTimestamp();
    const jump = showJumpButtons(info.totalPages);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...(jump ? [new ButtonBuilder().setCustomId(ids.first).setEmoji("⏮️").setStyle(ButtonStyle.Secondary).setDisabled(!info.hasPrev)] : []),
      new ButtonBuilder().setCustomId(ids.prev).setLabel("Prev").setEmoji("◀️").setStyle(ButtonStyle.Secondary).setDisabled(!info.hasPrev),
      new ButtonBuilder().setCustomId(ids.next).setLabel("Next").setEmoji("▶️").setStyle(ButtonStyle.Secondary).setDisabled(!info.hasNext),
      ...(jump ? [new ButtonBuilder().setCustomId(ids.last).setEmoji("⏭️").setStyle(ButtonStyle.Secondary).setDisabled(!info.hasNext)] : []),
    );
    return { embeds: [embed], components: info.totalPages > 1 ? [row] : [], allowedMentions: { parse: [] } };
  };

  const first = render(page);
  const message = await interaction.editReply(first);
  if (first.components.length === 0) return;

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120_000,
    filter: (i) => i.user.id === interaction.user.id && moveFor.has(i.customId),
  });
  collector.on("collect", (i) => guardCollect("case", i, async () => {
    page = movePage(page, moveFor.get(i.customId) ?? "next", records.length);
    await i.update(render(page)).catch(() => null);
  }));
  collector.on("end", () => {
    interaction.editReply({ components: [] }).catch(() => null);
  });
}
