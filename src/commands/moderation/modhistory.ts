import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { getModerationCases } from "../../services/moderationCases";
import { Command } from "../../types/discord";

const ACTION_LABELS: Record<string, string> = {
  warn:          "⚠️ Warning",
  kick:          "👢 Kick",
  ban:           "🔨 Ban",
  timeout:       "⏱️ Timeout",
  untimeout:     "🔓 Timeout Removed",
  unban:         "✅ Unban",
  clearwarnings: "🗑️ Warnings Cleared",
  note:          "📝 Staff Note",
};

const ACTION_FILTER_CHOICES = [
  { label: "All Actions",       value: "all",          emoji: "📋" },
  { label: "Warnings",          value: "warn",         emoji: "⚠️" },
  { label: "Kicks",             value: "kick",         emoji: "👢" },
  { label: "Bans",              value: "ban",          emoji: "🔨" },
  { label: "Timeouts",          value: "timeout",      emoji: "⏱️" },
];

const PAGE_SIZE = 5;

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("modhistory")
    .setDescription("View paginated moderation case history for a user.")
    .addUserOption(option =>
      option.setName("user").setDescription("The user whose cases to view").setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName("filter")
        .setDescription("Filter by action type (default: all)")
        .setRequired(false)
        .addChoices(
          { name: "All Actions", value: "all" },
          { name: "Warnings",    value: "warn" },
          { name: "Kicks",       value: "kick" },
          { name: "Bans",        value: "ban" },
          { name: "Timeouts",    value: "timeout" },
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const target = interaction.options.getUser("user", true);
    const initialFilter = interaction.options.getString("filter") ?? "all";
    const guildId = interaction.guildId!;

    await interaction.deferReply({ ephemeral: true });

    let allCases = await getModerationCases(guildId, target.id);
    let filteredCases = initialFilter === "all" ? allCases : allCases.filter(c => c.action === initialFilter);

    let page = 0;
    let currentFilter = initialFilter;

    const totalPages = () => Math.max(1, Math.ceil(filteredCases.length / PAGE_SIZE));

    const buildEmbed = () => {
      const start = page * PAGE_SIZE;
      const pageCases = filteredCases.slice(start, start + PAGE_SIZE);

      const filterLabel = ACTION_FILTER_CHOICES.find(f => f.value === currentFilter)?.label ?? "All Actions";

      const embed = new EmbedBuilder()
        .setColor(filteredCases.length ? 0x5865F2 : 0x57F287)
        .setTitle(`📋 Moderation History — ${target.tag}`)
        .setThumbnail(target.displayAvatarURL())
        .setDescription(
          filteredCases.length
            ? `Showing **${filteredCases.length}** case(s) · Filter: **${filterLabel}** · Page **${page + 1}**/${totalPages()}`
            : `✅ No moderation cases found${currentFilter !== "all" ? ` for action: **${filterLabel}**` : ""}.`
        )
        .setTimestamp();

      if (filteredCases.length === 0) return embed;

      for (const entry of pageCases) {
        const timestamp = Math.floor(new Date(entry.createdAt).getTime() / 1000);
        const reason = entry.reason.slice(0, 300);
        const details = entry.details ? `\n> ${entry.details.slice(0, 100)}` : "";
        embed.addFields({
          name: `#${entry._id.slice(-8).toUpperCase()} · ${ACTION_LABELS[entry.action] ?? entry.action} · <t:${timestamp}:f>`,
          value: `**Reason:** ${reason}${details}\n**By:** <@${entry.moderatorId}>`,
        });
      }

      // Summary stats at the bottom
      const actionCounts = allCases.reduce((acc, c) => {
        acc[c.action] = (acc[c.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const summaryParts = Object.entries(actionCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([action, count]) => `${ACTION_LABELS[action]?.split(" ")[0] ?? "📋"} ${count}`)
        .join("  ·  ");

      if (summaryParts) {
        embed.addFields({ name: "📊 All-Time Summary", value: summaryParts, inline: false });
      }

      embed.setFooter({ text: `Total cases: ${allCases.length} · Showing: ${start + 1}–${Math.min(start + PAGE_SIZE, filteredCases.length)} of ${filteredCases.length}` });
      return embed;
    };

    const buildButtons = () => {
      const nav = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("mh_prev")
          .setLabel("Previous")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("◀️")
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId("mh_next")
          .setLabel("Next")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("▶️")
          .setDisabled(page >= totalPages() - 1),
        new ButtonBuilder()
          .setCustomId("mh_refresh")
          .setLabel("Refresh")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("🔄"),
      );

      const filters = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...ACTION_FILTER_CHOICES.map(f =>
          new ButtonBuilder()
            .setCustomId(`mh_filter_${f.value}`)
            .setLabel(f.label)
            .setStyle(currentFilter === f.value ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setEmoji(f.emoji)
        )
      );

      return [nav, filters];
    };

    const sent = await interaction.editReply({
      embeds: [buildEmbed()],
      components: filteredCases.length > 0 ? buildButtons() : [],
    });

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
      filter: (i) => i.user.id === interaction.user.id,
    });

    collector.on("collect", async (i) => {
      await i.deferUpdate();

      if (i.customId === "mh_prev") {
        page = Math.max(0, page - 1);
      } else if (i.customId === "mh_next") {
        page = Math.min(totalPages() - 1, page + 1);
      } else if (i.customId === "mh_refresh") {
        allCases = await getModerationCases(guildId, target.id);
        filteredCases = currentFilter === "all" ? allCases : allCases.filter(c => c.action === currentFilter);
        page = 0;
      } else if (i.customId.startsWith("mh_filter_")) {
        currentFilter = i.customId.replace("mh_filter_", "");
        filteredCases = currentFilter === "all" ? allCases : allCases.filter(c => c.action === currentFilter);
        page = 0;
      }

      await i.editReply({
        embeds: [buildEmbed()],
        components: filteredCases.length > 0 ? buildButtons() : [],
      });
    });

    collector.on("end", async () => {
      await interaction.editReply({ components: [] }).catch(() => null);
    });
  },
};

export default command;