import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { Command } from "../../types/discord";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("View useful details about this server."),

  guildOnly: true,
  botPermissions: ["EmbedLinks"],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guild = interaction.guild!;
    const owner = await guild.fetchOwner().catch(() => null);
    const channels = guild.channels.cache;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        { name: "Server ID", value: `\`${guild.id}\``, inline: true },
        { name: "Owner", value: owner ? `<@${owner.id}>` : "Unavailable", inline: true },
        { name: "Created", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        { name: "Members", value: guild.memberCount.toLocaleString(), inline: true },
        { name: "Channels", value: channels.size.toLocaleString(), inline: true },
        { name: "Roles", value: Math.max(0, guild.roles.cache.size - 1).toLocaleString(), inline: true },
      )
      .setFooter({ text: "Aegis server information" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
