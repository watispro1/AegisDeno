import { guardCollect } from "../../utils/collectorGuard";
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
import { EXPLICIT_FILTER_LEVELS, VERIFICATION_LEVELS, dateAndAgo, serverSecurityText } from "../../services/infoFormat";
import { assetSlots, boostProgress, emojiListLine, featureNames, memberBreakdown, roleListLine, TIER_PERKS } from "../../services/serverInfoExtras";
import { replyPagedList } from "../../utils/listPager";
import { COLORS, footer } from "../../utils/embedStyle";
import { truncate } from "../../utils/safeText";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Server stats: owner, members, channels, boosts, features and settings.")
    .addBooleanOption(o => o.setName("ephemeral").setDescription("Only show the response to you (default: false)").setRequired(false)),

  guildOnly: true,
  botPermissions: ["EmbedLinks"],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guild = interaction.guild!;
    // Owner, emoji and sticker fetches can be slow on big servers: defer first, fetch in parallel.
    await interaction.deferReply({ flags: interaction.options.getBoolean("ephemeral") ? MessageFlags.Ephemeral : undefined });
    const [owner, emojis, stickers] = await Promise.all([
      guild.fetchOwner().catch(() => null),
      guild.emojis.fetch().catch(() => null),
      guild.stickers.fetch().catch(() => null),
    ]);
    // Channels Discord has hidden from Aegis (obfuscated) are left out of the counts.
    const channels = guild.channels.cache.filter(c => !isObfuscatedChannel(c));
    const count = (...types: ChannelType[]) => channels.filter(c => types.includes(c.type)).size;
    const textChannels = count(ChannelType.GuildText, ChannelType.GuildAnnouncement);
    const voiceChannels = count(ChannelType.GuildVoice, ChannelType.GuildStageVoice);
    const categories = count(ChannelType.GuildCategory);
    const forumChannels = count(ChannelType.GuildForum, ChannelType.GuildMedia);
    const threads = count(ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread);

    const members = guild.members.cache;
    const bots = members.filter(m => m.user.bot).size;
    const breakdown = memberBreakdown(guild.memberCount, { humans: members.size - bots, bots });
    const tier = guild.premiumTier;
    const perks = TIER_PERKS[tier] ?? TIER_PERKS[0];
    const animatedEmojis = emojis?.filter(e => e.animated).size ?? 0;
    const features = featureNames(guild.features);
    const roleCount = Math.max(0, guild.roles.cache.size - 1);
    const notable = [
      guild.rulesChannelId ? `Rules: <#${guild.rulesChannelId}>` : null,
      guild.systemChannelId ? `System: <#${guild.systemChannelId}>` : null,
      guild.publicUpdatesChannelId ? `Updates: <#${guild.publicUpdatesChannelId}>` : null,
      guild.afkChannelId ? `AFK: <#${guild.afkChannelId}> (${Math.round(guild.afkTimeout / 60)} min)` : null,
    ].filter(Boolean).join("\n");

    const embed = new EmbedBuilder()
      .setColor(COLORS.brand)
      .setTitle(`🛡️ ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 512, forceStatic: false }))
      .addFields(
        { name: "👑 Server Owner", value: owner ? `${owner.user.tag} (<@${owner.id}>)` : "Unavailable", inline: true },
        { name: "🆔 Server ID", value: `\`${guild.id}\``, inline: true },
        { name: "📅 Created", value: dateAndAgo(guild.createdTimestamp), inline: true },
        { name: "👥 Members", value: breakdown, inline: true },
        { name: "💎 Server Boosts", value: boostProgress(tier, guild.premiumSubscriptionCount ?? 0), inline: true },
        { name: "📦 Level perks", value: `Uploads ${perks.upload} · Audio ${perks.bitrate}`, inline: true },
        { name: "🔒 Verification", value: VERIFICATION_LEVELS[guild.verificationLevel] ?? `Level ${guild.verificationLevel}`, inline: true },
        { name: "🛡️ Content Filter", value: EXPLICIT_FILTER_LEVELS[guild.explicitContentFilter] ?? "Default", inline: true },
        { name: "🌐 Locale", value: guild.preferredLocale ?? "—", inline: true },
        {
          name: "💬 Channels",
          value: `Text: **${textChannels}** | Voice: **${voiceChannels}** | Forums: **${forumChannels}** | Categories: **${categories}** | Active threads: **${threads}**`,
          inline: false,
        },
        {
          name: "🎨 Assets & Customization",
          value: `Roles: **${roleCount}** | ${assetSlots(tier, { total: emojis?.size ?? 0, animated: animatedEmojis }, stickers?.size ?? 0)}`,
          inline: false,
        },
      )
      .setFooter(footer(`Requested by ${interaction.user.tag}`))
      .setTimestamp();
    if (guild.description) embed.setDescription(truncate(guild.description, 300));
    if (notable) embed.addFields({ name: "📌 Key channels", value: notable, inline: false });
    if (guild.vanityURLCode) embed.addFields({ name: "🔗 Vanity invite", value: `discord.gg/${guild.vanityURLCode}`, inline: true });
    if (features.length) embed.addFields({ name: `✨ Features (${features.length})`, value: truncate(features.join(" · "), 1024), inline: false });
    const bannerUrl = guild.bannerURL({ size: 1024 });
    if (bannerUrl) embed.setImage(bannerUrl);

    const linkButtons: ButtonBuilder[] = [];
    const iconUrl = guild.iconURL({ size: 1024, forceStatic: false });
    if (iconUrl) linkButtons.push(new ButtonBuilder().setLabel("Icon").setStyle(ButtonStyle.Link).setURL(iconUrl).setEmoji("🖼️"));
    if (bannerUrl) linkButtons.push(new ButtonBuilder().setLabel("Banner").setStyle(ButtonStyle.Link).setURL(bannerUrl).setEmoji("🏳️"));

    const listRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("serverinfo_roles").setLabel(`Roles (${roleCount})`).setStyle(ButtonStyle.Secondary).setEmoji("🎨"),
      new ButtonBuilder().setCustomId("serverinfo_emojis").setLabel(`Emojis (${emojis?.size ?? 0})`).setStyle(ButtonStyle.Secondary).setEmoji("😀").setDisabled(!emojis?.size),
      new ButtonBuilder().setCustomId("serverinfo_channels").setLabel("Channels").setStyle(ButtonStyle.Secondary).setEmoji("💬"),
      new ButtonBuilder().setCustomId("serverinfo_security").setLabel("Security").setStyle(ButtonStyle.Secondary).setEmoji("🔒"),
    );
    const rows = [listRow, ...(linkButtons.length ? [new ActionRowBuilder<ButtonBuilder>().addComponents(...linkButtons)] : [])];
    const sent = await interaction.editReply({ embeds: [embed], components: rows, allowedMentions: { parse: [] } });

    const collector = sent.createMessageComponentCollector({ componentType: ComponentType.Button, idle: 120_000 });

    collector.on("collect", (i) => guardCollect("serverinfo", i, async () => {
      if (i.customId === "serverinfo_channels") {
        await i.reply({
          content: `💬 **Channel Breakdown for ${guild.name}:**\n- Text Channels: **${textChannels}**\n- Voice & Stage: **${voiceChannels}**\n- Forums & Media: **${forumChannels}**\n- Categories: **${categories}**\n- Active threads: **${threads}**\n- Total: **${channels.size}**`,
          flags: MessageFlags.Ephemeral,
        });
      } else if (i.customId === "serverinfo_roles") {
        const roles = guild.roles.cache
          .filter(r => r.id !== guild.id)
          .sort((a, b) => b.position - a.position)
          .map(r => ({ id: r.id, name: r.name, members: r.members.size, managed: r.managed }));
        await replyPagedList(i, {
          title: `🎨 Roles in ${truncate(guild.name, 200)} (${roles.length})`,
          header: "Highest first. Member counts include only members Aegis has loaded.",
          lines: roles.map(roleListLine),
          empty: "This server has no roles besides @everyone.",
          ephemeral: true,
        });
      } else if (i.customId === "serverinfo_emojis") {
        const list = [...(emojis?.values() ?? [])].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
        await replyPagedList(i, {
          title: `😀 Emojis in ${truncate(guild.name, 200)} (${list.length})`,
          lines: list.map(e => emojiListLine(e)),
          perPage: 25,
          empty: "No custom emojis.",
          ephemeral: true,
        });
      } else if (i.customId === "serverinfo_security") {
        await i.reply({ content: serverSecurityText(guild), flags: MessageFlags.Ephemeral });
      }
    }));

    collector.on("end", async () => {
      await interaction.editReply({ components: rows.slice(1) }).catch(() => null);
    });
  },
};

export default command;
