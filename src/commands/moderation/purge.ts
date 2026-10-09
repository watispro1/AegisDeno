import { logger } from "../../utils/logger";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
} from "discord.js";
import { Command } from "../../types/discord";
import { sendGuildLog } from "../../services/logging";

type FilterMode = "all" | "bots" | "humans" | "links" | "images" | "embeds";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Bulk-delete messages from this channel with advanced filters.")
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
          { name: "All messages", value: "all" },
          { name: "Bot messages only", value: "bots" },
          { name: "Human messages only", value: "humans" },
          { name: "Messages with links", value: "links" },
          { name: "Messages with images/attachments", value: "images" },
          { name: "Messages with embeds", value: "embeds" },
        )
    )
    .addUserOption(opt =>
      opt.setName("user").setDescription("Only delete messages from this specific user").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageMessages],
  botPermissions: [PermissionFlagsBits.ManageMessages],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const amount  = interaction.options.getInteger("amount", true);
    const filter  = (interaction.options.getString("filter") ?? "all") as FilterMode;
    const target  = interaction.options.getUser("user");
    const channel = interaction.channel;
    const guildId = interaction.guildId!;

    if (!channel || !channel.isTextBased() || !("bulkDelete" in channel)) {
      return interaction.reply({ content: "❌ This command can only be used in a text channel that supports bulk-deleting.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const fetched = await channel.messages.fetch({ limit: 100 });

      const URL_REGEX = /https?:\/\//i;

      let toDelete = [...fetched.values()].filter((msg: Message) => {
        // Age filter — Discord can only bulk-delete messages under 14 days old
        const ageMs = Date.now() - msg.createdTimestamp;
        if (ageMs > 14 * 24 * 60 * 60 * 1000) return false;

        // User filter
        if (target && msg.author.id !== target.id) return false;

        // Content filter
        switch (filter) {
          case "bots":   return msg.author.bot;
          case "humans": return !msg.author.bot;
          case "links":  return URL_REGEX.test(msg.content);
          case "images": return msg.attachments.size > 0;
          case "embeds": return msg.embeds.length > 0;
          default:       return true;
        }
      }).slice(0, amount);

      if (toDelete.length === 0) {
        await interaction.editReply("⚠️ No messages matched your filters, or all matching messages are older than 14 days.");
        return;
      }

      const deleted = await channel.bulkDelete(toDelete, true);

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle("🗑️ Messages Purged")
        .addFields(
          { name: "📌 Channel",  value: `<#${channel.id}>`, inline: true },
          { name: "🗑️ Deleted", value: `**${deleted.size}** message(s)`, inline: true },
          { name: "🔍 Filter",   value: `\`${filter}\`${target ? ` + from <@${target.id}>` : ""}`, inline: true },
          { name: "🛡️ Moderator", value: interaction.user.tag, inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ content: null, embeds: [embed] });
      await sendGuildLog(interaction.client, guildId, {
        title: "🗑️ Messages Purged",
        color: 0xED4245,
        description: `**Channel:** <#${channel.id}>\n**Deleted:** ${deleted.size}\n**Filter:** \`${filter}\`\n**User Filter:** ${target ? `<@${target.id}>` : "None"}\n**Moderator:** ${interaction.user.tag}`,
      });
    } catch (err) {
      logger.error(`Failed to purge messages in channel ${channel.id} guild ${guildId}`, err);
      await interaction.editReply("❌ Failed to delete messages. Messages older than 14 days cannot be bulk-deleted.");
    }
  },
};

export default command;
