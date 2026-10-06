import { logger } from "../../utils/logger";
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, TextChannel } from "discord.js";
import { Command } from "../../types/discord";
import { sendGuildLog } from "../../services/logging";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Bulk-delete messages from this channel.")
    .addIntegerOption(opt =>
      opt
        .setName("amount")
        .setDescription("Number of messages to delete (1–100)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addUserOption(opt =>
      opt.setName("user").setDescription("Only delete messages from this user").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageMessages],
  botPermissions:  [PermissionFlagsBits.ManageMessages],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const amount  = interaction.options.getInteger("amount", true);
    const target  = interaction.options.getUser("user");
    const channel = interaction.channel;
    const guildId = interaction.guildId!;

    if (!(channel instanceof TextChannel)) {
      return interaction.reply({ content: "❌ This command can only be used in a text channel.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      // Fetch enough messages to filter by user if needed
      const fetched = await channel.messages.fetch({ limit: target ? 100 : amount });
      const toDelete = target
        ? fetched.filter(m => m.author.id === target.id).first(amount)
        : [...fetched.values()].slice(0, amount);

      const deleted = await channel.bulkDelete(toDelete, true); // true = filter messages older than 14 days

      await interaction.editReply(`✅ Deleted **${deleted.size}** message(s).`);
      await sendGuildLog(interaction.client, guildId, {
        title: "🗑️ Messages Purged",
        color: 0xED4245,
        description: `**Channel:** <#${channel.id}>\n**Count:** ${deleted.size}\n**Filter:** ${target ? `Messages from <@${target.id}>` : "All messages"}\n**Moderator:** ${interaction.user.tag}`,
      });
    } catch (err) {
      logger.error(`Failed to purge messages in channel ${channel.id} guild ${guildId}`, err);
      await interaction.editReply("❌ Failed to delete messages. Messages older than 14 days cannot be bulk-deleted.");
    }
  },
};
