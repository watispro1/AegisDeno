import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, TextChannel } from "discord.js";
import { Command } from "../../types/discord";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send an announcement to a channel.")
    .addChannelOption(opt =>
      opt.setName("channel").setDescription("Channel to send the announcement to").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("message").setDescription("The announcement message (use \\n for newlines)").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageMessages],
  botPermissions: [PermissionFlagsBits.SendMessages],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const channel = interaction.options.getChannel("channel", true);
    const message = interaction.options.getString("message", true).replace(/\\n/g, "\n");

    if (!(channel instanceof TextChannel)) {
      return interaction.reply({ content: "❌ You must select a text channel.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    try {
      await (channel as TextChannel).send({ content: message });
      await interaction.editReply(`✅ Announcement sent to <#${channel.id}>.`);
    } catch {
      await interaction.editReply("❌ Failed to send announcement. Check my permissions in that channel.");
    }
  },
};
