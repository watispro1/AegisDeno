import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from "discord.js";
import { Command } from "../../types/discord";
import { isObfuscatedChannel } from "../../utils/channels";

const VERIFICATION_LEVELS: Record<number, string> = {
  0: "None (Unrestricted)",
  1: "Low (Verified Email)",
  2: "Medium (Registered > 5m)",
  3: "High (Member > 10m)",
  4: "Highest (Verified Phone)",
};

const EXPLICIT_FILTER_LEVELS: Record<number, string> = {
  0: "Disabled",
  1: "Members Without Roles",
  2: "All Members",
};

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("View comprehensive stats, metrics, and information about this server."),

  guildOnly: true,
  botPermissions: ["EmbedLinks"],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guild = interaction.guild!;
    const owner = await guild.fetchOwner().catch(() => null);
    // Channels Discord has hidden from Aegis (obfuscated) are left out of the counts.
    const channels = guild.channels.cache.filter(c => !isObfuscatedChannel(c));

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
        { name: "🔒 Verification", value: VERIFICATION_LEVELS[guild.verificationLevel] ?? `Level ${guild.verificationLevel}`, inline: true },
        { name: "🛡️ Content Filter", value: EXPLICIT_FILTER_LEVELS[guild.explicitContentFilter] ?? "Default", inline: true },
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

    const linkButtons: ButtonBuilder[] = [];
    const iconUrl = guild.iconURL({ size: 1024, forceStatic: false });
    if (iconUrl) {
      linkButtons.push(
        new ButtonBuilder()
          .setLabel("Server Icon")
          .setStyle(ButtonStyle.Link)
          .setURL(iconUrl)
          .setEmoji("🖼️")
      );
    }
    const bannerUrl = guild.bannerURL({ size: 1024 });
    if (bannerUrl) {
      linkButtons.push(
        new ButtonBuilder()
          .setLabel("Server Banner")
          .setStyle(ButtonStyle.Link)
          .setURL(bannerUrl)
          .setEmoji("🏳️")
      );
    }

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("serverinfo_channels")
        .setLabel("Channels")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("💬"),
      new ButtonBuilder()
        .setCustomId("serverinfo_roles")
        .setLabel("Roles")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🎨"),
      new ButtonBuilder()
        .setCustomId("serverinfo_security")
        .setLabel("Security")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🔒"),
      ...linkButtons
    );

    const sent = await interaction.reply({ embeds: [embed], components: [buttons], fetchReply: true });

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 90_000,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "serverinfo_channels") {
        await i.reply({
          content: `💬 **Channel Breakdown for ${guild.name}:**\n- Text Channels: **${textChannels}**\n- Voice Rooms: **${voiceChannels}**\n- Forum Forums: **${forumChannels}**\n- Categories: **${categories}**\n- Total Channels: **${channels.size}**`,
          flags: MessageFlags.Ephemeral,
        });
      } else if (i.customId === "serverinfo_roles") {
        const topRoles = guild.roles.cache
          .filter(r => r.id !== guild.id)
          .sort((a, b) => b.position - a.position)
          .map(r => r.name)
          .slice(0, 15)
          .join(", ");
        await i.reply({
          content: `🎨 **Server Customization Assets:**\n- Total Roles: **${Math.max(0, guild.roles.cache.size - 1)}**\n- Top Roles: ${topRoles}\n- Custom Emojis: **${emojis?.size ?? 0}**\n- Stickers: **${stickers?.size ?? 0}**`,
          flags: MessageFlags.Ephemeral,
        });
      } else if (i.customId === "serverinfo_security") {
        await i.reply({
          content: `🔒 **Security & Safety Overview:**\n- Verification Level: \`${guild.verificationLevel}\`\n- Explicit Content Filter: \`${guild.explicitContentFilter}\`\n- Default Notifications: \`${guild.defaultMessageNotifications}\`\n- MFA Level: \`${guild.mfaLevel}\``,
          flags: MessageFlags.Ephemeral,
        });
      }
    });

    collector.on("end", async () => {
      if (linkButtons.length > 0) {
        const preservedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(...linkButtons);
        await interaction.editReply({ components: [preservedRow] }).catch(() => null);
      } else {
        await interaction.editReply({ components: [] }).catch(() => null);
      }
    });
  },
};

export default command;
