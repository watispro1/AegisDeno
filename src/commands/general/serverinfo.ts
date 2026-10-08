import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  ChannelType,
} from "discord.js";
import { Command } from "../../types/discord";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("View comprehensive stats, metrics, and information about this server."),

  guildOnly: true,
  botPermissions: ["EmbedLinks"],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guild = interaction.guild!;
    const owner = await guild.fetchOwner().catch(() => null);
    const channels = guild.channels.cache;

    const textChannels = channels.filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement).size;
    const voiceChannels = channels.filter(c => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice).size;
    const categories = channels.filter(c => c.type === ChannelType.GuildCategory).size;
    const forumChannels = channels.filter(c => c.type === ChannelType.GuildForum).size;

    const emojis = await guild.emojis.fetch().catch(() => null);
    const stickers = await guild.stickers.fetch().catch(() => null);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`🛡️ ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 512, forceStatic: false }))
      .addFields(
        { name: "👑 Server Owner", value: owner ? `${owner.user.tag} (<@${owner.id}>)` : "Unavailable", inline: true },
        { name: "🆔 Server ID", value: `\`${guild.id}\``, inline: true },
        { name: "📅 Created", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        { name: "👥 Members", value: `**${guild.memberCount.toLocaleString()}** members`, inline: true },
        { name: "💎 Server Boosts", value: `Level **${guild.premiumTier}** (${guild.premiumSubscriptionCount ?? 0} boosts)`, inline: true },
        { name: "🔒 Verification Level", value: `\`${guild.verificationLevel}\``, inline: true },
        {
          name: "💬 Channels",
          value: `Text: **${textChannels}** | Voice: **${voiceChannels}** | Forums: **${forumChannels}** | Categories: **${categories}**`,
          inline: false,
        },
        {
          name: "🎨 Assets & Customization",
          value: `Roles: **${Math.max(0, guild.roles.cache.size - 1)}** | Emojis: **${emojis?.size ?? 0}** | Stickers: **${stickers?.size ?? 0}**`,
          inline: false,
        }
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}` })
      .setTimestamp();

    if (guild.bannerURL()) {
      embed.setImage(guild.bannerURL({ size: 1024 })!);
    }

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
