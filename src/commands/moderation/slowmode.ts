import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, TextChannel } from "discord.js";
import { Command } from "../../types/discord";
import { sendGuildLog } from "../../services/logging";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set the slowmode for this channel.")
    .addIntegerOption(opt =>
      opt
        .setName("seconds")
        .setDescription("Slowmode duration in seconds (0 to disable)")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageChannels],
  botPermissions:  [PermissionFlagsBits.ManageChannels],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const seconds = interaction.options.getInteger("seconds", true);
    const channel = interaction.channel as TextChannel;
    const guildId = interaction.guildId!;

    if (!channel.isTextBased() || !("setRateLimitPerUser" in channel)) {
      return interaction.reply({ content: "❌ Slowmode cannot be set on this channel type.", ephemeral: true });
    }

    await interaction.deferReply();
    try {
      await channel.setRateLimitPerUser(seconds, `Slowmode set by ${interaction.user.tag}`);
      
      const status = seconds === 0 ? "disabled" : `set to **${seconds} seconds**`;
      await interaction.editReply(`✅ Slowmode has been ${status} for this channel.`);

      await sendGuildLog(interaction.client, guildId, {
        title: "🐌 Slowmode Changed",
        color: 0x3498DB,
        description: `**Channel:** <#${channel.id}>\n**New Duration:** ${seconds}s\n**Moderator:** ${interaction.user.tag}`,
      });
    } catch {
      await interaction.editReply("❌ Failed to set slowmode.");
    }
  },
};
