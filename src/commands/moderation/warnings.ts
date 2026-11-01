import { guardCollect } from "../../utils/collectorGuard";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type User,
} from "discord.js";
import { Command } from "../../types/discord";
import { getWarningsForUser } from "../../services/warnings";
import { pageInfo, stepPage } from "../../services/casePaging";

export const WARNINGS_PER_PAGE = 5;

export interface WarningRow {
  reason: string;
  moderatorId: string;
  createdAt: Date | string;
  _id?: unknown;
}
/** How long the Prev / Next buttons keep working. */
const PAGER_TIMEOUT_MS = 120_000;

/**
 * Build one page of a member's active warnings (newest first). Pure, so the
 * paging and numbering can be tested without Discord.
 */
export function renderWarningsPage(
  target: Pick<User, "tag" | "id"> & { avatarUrl?: string },
  list: readonly WarningRow[],
  requestedPage: number,
): { embed: EmbedBuilder; page: number; totalPages: number; hasPrev: boolean; hasNext: boolean } {
  const info = pageInfo(list.length, requestedPage, WARNINGS_PER_PAGE);

  const embed = new EmbedBuilder()
    .setColor(list.length > 0 ? 0xFEE75C : 0x57F287)
    .setTitle(`Warnings for ${target.tag}`)
    .setDescription(
      list.length === 0
        ? `✅ <@${target.id}> has no active warnings.`
        : `**Active warnings:** ${list.length}`,
    )
    .setTimestamp();
  if (target.avatarUrl) embed.setThumbnail(target.avatarUrl);

  if (list.length > 0) {
    embed.addFields(
      list.slice(info.start, info.end).map((w, i) => {
        // Newest first, so the newest warning has the highest number.
        const number = list.length - (info.start + i);
        const at = Math.floor(new Date(w.createdAt).getTime() / 1000);
        const id = w._id ? `\n**ID:** \`${String(w._id)}\`` : "";
        return {
          name: `Warning ${number} • <t:${at}:f>`,
          value: `**Reason:** ${String(w.reason).slice(0, 800)}\n**Moderator:** <@${w.moderatorId}>${id}`,
        };
      }),
    );
    embed.setFooter({
      text: info.totalPages > 1
        ? `Page ${info.page + 1}/${info.totalPages} · Edit a reason with /case edit and the warning ID`
        : "Edit a reason with /case edit and the warning ID",
    });
  }

  return { embed, page: info.page, totalPages: info.totalPages, hasPrev: info.hasPrev, hasNext: info.hasNext };
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("View a member's active warnings, five per page.")
    .addUserOption(opt =>
      opt.setName("user").setDescription("The user whose warnings to view").setRequired(true)
    )
    .addBooleanOption(opt =>
      opt.setName("ephemeral").setDescription("Only you can see the reply (default: true)").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const target  = interaction.options.getUser("user", true);
    const ephemeral = interaction.options.getBoolean("ephemeral") ?? true;
    const guildId = interaction.guildId!;

    const warnings = await getWarningsForUser(guildId, target.id);
    const who = { tag: target.tag, id: target.id, avatarUrl: target.displayAvatarURL() };

    const prevId = `warnings_prev_${interaction.id}`;
    const nextId = `warnings_next_${interaction.id}`;
    let page = 0;

    const view = (requested: number) => {
      const r = renderWarningsPage(who, warnings, requested);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(prevId).setLabel("Prev").setStyle(ButtonStyle.Secondary).setDisabled(!r.hasPrev),
        new ButtonBuilder().setCustomId(nextId).setLabel("Next").setStyle(ButtonStyle.Secondary).setDisabled(!r.hasNext),
      );
      return { embeds: [r.embed], components: r.totalPages > 1 ? [row] : [], allowedMentions: { parse: [] as never[] } };
    };

    const first = view(page);
    const response = await interaction.reply({
      ...first,
      withResponse: true,
      ...(ephemeral ? { flags: MessageFlags.Ephemeral } : {}),
    });
    if (first.components.length === 0) return;
    const message = response.resource?.message;
    if (!message) return;

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: PAGER_TIMEOUT_MS,
      filter: (i) => i.user.id === interaction.user.id && (i.customId === prevId || i.customId === nextId),
    });
    collector.on("collect", (i) => guardCollect("warnings", i, async () => {
      page = stepPage(page, i.customId === nextId ? "next" : "prev", warnings.length, WARNINGS_PER_PAGE);
      await i.update(view(page)).catch(() => null);
    }));
    collector.on("end", () => {
      interaction.editReply({ components: [] }).catch(() => null);
    });
  },
};
