import { logger } from "../../utils/logger";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { Command } from "../../types/discord";
import { sendGuildLog } from "../../services/logging";

type FilterMode = "all" | "bots" | "humans" | "links" | "images" | "embeds" | "keyword";

const FILTER_LABELS: Record<FilterMode, string> = {
  all:     "All messages",
  bots:    "Bot messages only",
  humans:  "Human messages only",
  links:   "Messages with links",
  images:  "Messages with images/attachments",
  embeds:  "Messages with embeds",
  keyword: "Messages matching keyword",
};

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Bulk-delete messages from this channel with advanced filters and a preview.")
    .addIntegerOption(opt =>
      opt
        .setName("amount")
        .setDescription("Number of messages to scan (1–100)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addStringOption(opt =>
      opt
        .setName("filter")
        .setDescription("Filter which messages to delete (default: all)")
        .setRequired(false)
        .addChoices(
          { name: "All messages",                  value: "all" },
          { name: "Bot messages only",             value: "bots" },
          { name: "Human messages only",           value: "humans" },
          { name: "Messages with links",           value: "links" },
          { name: "Messages with images/attachments", value: "images" },
          { name: "Messages with embeds",          value: "embeds" },
          { name: "Messages matching keyword",     value: "keyword" },
        )
    )
    .addUserOption(opt =>
      opt.setName("user").setDescription("Only delete messages from this specific user").setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName("keyword").setDescription("Keyword to search for (required when filter=keyword)").setRequired(false).setMaxLength(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageMessages],
  botPermissions: [PermissionFlagsBits.ManageMessages],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const amount  = interaction.options.getInteger("amount", true);
    const filter  = (interaction.options.getString("filter") ?? "all") as FilterMode;
    const target  = interaction.options.getUser("user");
    const keyword = interaction.options.getString("keyword");
    const channel = interaction.channel;
    const guildId = interaction.guildId!;

    if (!channel || !channel.isTextBased() || !("bulkDelete" in channel)) {
      return interaction.reply({ content: "❌ This command can only be used in a text channel.", ephemeral: true });
    }

    if (filter === "keyword" && !keyword) {
      return interaction.reply({ content: "❌ You must provide a `keyword` when using the `keyword` filter.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const fetched = await channel.messages.fetch({ limit: 100 });
      const URL_REGEX = /https?:\/\//i;
      const kwRegex = keyword ? new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;

      let toDelete = [...fetched.values()].filter((msg: Message) => {
        // Discord can only bulk-delete messages under 14 days old
        const ageMs = Date.now() - msg.createdTimestamp;
        if (ageMs > 14 * 24 * 60 * 60 * 1000) return false;

        // User filter
        if (target && msg.author.id !== target.id) return false;

        switch (filter) {
          case "bots":    return msg.author.bot;
          case "humans":  return !msg.author.bot;
          case "links":   return URL_REGEX.test(msg.content);
          case "images":  return msg.attachments.size > 0;
          case "embeds":  return msg.embeds.length > 0;
          case "keyword": return kwRegex ? kwRegex.test(msg.content) : false;
          default:        return true;
        }
      }).slice(0, amount);

      if (toDelete.length === 0) {
        await interaction.editReply("⚠️ No messages matched your filters, or all matching messages are older than 14 days.");
        return;
      }

      // Build preview embed before deleting
      const sampleMessages = toDelete.slice(0, 5).map(m => {
        const author = m.author.tag.slice(0, 20);
        const content = (m.content || "[embed/attachment]").slice(0, 60);
        return `• **${author}**: ${content}${(m.content || "").length > 60 ? "…" : ""}`;
      });

      const previewEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle("🗑️ Purge Preview")
        .setDescription(
          `Found **${toDelete.length}** message(s) matching your filter.\n\n` +
          `**Sample (up to 5):**\n${sampleMessages.join("\n")}`
        )
        .addFields(
          { name: "📌 Channel",  value: `<#${channel.id}>`, inline: true },
          { name: "🔍 Filter",   value: `\`${FILTER_LABELS[filter]}\`${keyword ? ` — \`${keyword}\`` : ""}`, inline: true },
          { name: "👤 User",     value: target ? `<@${target.id}>` : "All users", inline: true },
          { name: "🗑️ To Delete", value: `**${toDelete.length}** message(s)`, inline: true },
        )
        .setFooter({ text: "Confirm to proceed with deletion." })
        .setTimestamp();

      const previewRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("purge_confirm")
          .setLabel(`Delete ${toDelete.length} message(s)`)
          .setStyle(ButtonStyle.Danger)
          .setEmoji("🗑️"),
        new ButtonBuilder()
          .setCustomId("purge_cancel")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("✖️"),
      );

      const preview = await interaction.editReply({ embeds: [previewEmbed], components: [previewRow] });

      const collector = preview.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30_000,
        filter: (i) => i.user.id === interaction.user.id,
        max: 1,
      });

      collector.on("collect", async (i) => {
        if (i.customId === "purge_cancel") {
          await i.update({ content: "❌ Purge cancelled.", embeds: [], components: [] });
          return;
        }

        await i.deferUpdate();
        try {
          const deleted = await channel.bulkDelete(toDelete, true);

          // Build a progress bar representation
          const pct = Math.round((deleted.size / toDelete.length) * 100);
          const barFilled = Math.round(pct / 10);
          const progressBar = "█".repeat(barFilled) + "░".repeat(10 - barFilled) + ` ${pct}%`;

          const resultEmbed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("🗑️ Messages Purged")
            .addFields(
              { name: "📌 Channel",    value: `<#${channel.id}>`, inline: true },
              { name: "🗑️ Deleted",   value: `**${deleted.size}** of ${toDelete.length} message(s)`, inline: true },
              { name: "🔍 Filter",     value: `\`${filter}\`${keyword ? ` — \`${keyword}\`` : ""}${target ? ` + from <@${target.id}>` : ""}`, inline: true },
              { name: "🛡️ Moderator", value: interaction.user.tag, inline: true },
              { name: "📊 Completion", value: `\`${progressBar}\``, inline: false },
            )
            .setFooter({ text: deleted.size < toDelete.length ? "Some messages may have been too old to delete (>14 days)." : "All messages deleted successfully." })
            .setTimestamp();

          await i.editReply({ content: null, embeds: [resultEmbed], components: [] });

          await sendGuildLog(interaction.client, guildId, {
            title: "🗑️ Messages Purged",
            color: 0xED4245,
            description: `**Channel:** <#${channel.id}>\n**Deleted:** ${deleted.size}/${toDelete.length}\n**Filter:** \`${filter}\`${keyword ? ` — \`${keyword}\`` : ""}\n**User Filter:** ${target ? `<@${target.id}>` : "None"}\n**Moderator:** ${interaction.user.tag}`,
          });
        } catch (err) {
          logger.error(`Failed to purge messages in channel ${channel.id} guild ${guildId}`, err);
          await i.editReply({ content: "❌ Failed to delete messages. Messages older than 14 days cannot be bulk-deleted.", embeds: [], components: [] });
        }
      });

      collector.on("end", async (_, stopReason) => {
        if (stopReason === "time") {
          await interaction.editReply({ content: "⏰ Purge confirmation timed out.", embeds: [], components: [] }).catch(() => null);
        }
      });
    } catch (err) {
      logger.error(`Failed to fetch messages in channel ${channel.id} guild ${guildId}`, err);
      await interaction.editReply("❌ Failed to fetch messages. Check my permissions.");
    }
  },
};

export default command;
