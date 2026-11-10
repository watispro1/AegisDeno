import {
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildBasedChannel,
} from "discord.js";
import type { Command } from "../../types/discord";
import { channelTypeLabel, slowmodeLabel, yesNo } from "../../services/lookupFormat";
import { dateAndAgo } from "../../services/infoFormat";
import { isObfuscatedChannel } from "../../utils/channels";
import { truncate } from "../../utils/safeText";
import { postAccessLabel } from "../../services/infoAccess";

/** Type-specific lines: topic and slowmode for text, bitrate and limit for voice. */
function detailFields(channel: GuildBasedChannel): Array<{ name: string; value: string; inline: boolean }> {
  const out: Array<{ name: string; value: string; inline: boolean }> = [];
  if ("topic" in channel && channel.topic) out.push({ name: "Topic", value: truncate(channel.topic, 1024), inline: false });
  if ("rateLimitPerUser" in channel) {
    out.push({ name: "Slowmode", value: slowmodeLabel(channel.rateLimitPerUser), inline: true });
  }
  if ("nsfw" in channel) out.push({ name: "Age-restricted", value: yesNo(Boolean(channel.nsfw)), inline: true });
  if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
    out.push({ name: "Bitrate", value: `${Math.round(channel.bitrate / 1000)} kbps`, inline: true });
    out.push({ name: "User limit", value: channel.userLimit ? String(channel.userLimit) : "None", inline: true });
    out.push({ name: "Connected now", value: String(channel.members.size), inline: true });
  }
  if (channel.type === ChannelType.GuildCategory) {
    out.push({ name: "Channels inside", value: String(channel.children.cache.size), inline: true });
  }
  if (channel.isThread()) {
    out.push({ name: "Archived", value: yesNo(Boolean(channel.archived)), inline: true });
    if (channel.parentId) out.push({ name: "Parent", value: `<#${channel.parentId}>`, inline: true });
  }
  return out;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("channelinfo")
    .setDescription("Show a channel's type, category, topic, slowmode and creation date.")
    .addChannelOption(o => o.setName("channel").setDescription("The channel to look up (defaults to this one)").setRequired(false)),
  guildOnly: true,
  cooldownMs: 2000,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const picked = interaction.options.getChannel("channel") ?? interaction.channel;
    const channel = picked ? (guild.channels.cache.get(picked.id) ?? await guild.channels.fetch(picked.id).catch(() => null)) : null;
    if (!channel) {
      await interaction.reply({ content: "❌ I couldn't find that channel in this server.", flags: MessageFlags.Ephemeral });
      return;
    }
    // Don't describe channels the member can't see.
    const viewer = interaction.memberPermissions && "permissionsFor" in channel ? channel.permissionsFor(interaction.user.id) : null;
    if (viewer && !viewer.has("ViewChannel")) {
      await interaction.reply({ content: "❌ You can't see that channel.", flags: MessageFlags.Ephemeral });
      return;
    }

    const overwrites = "permissionOverwrites" in channel ? channel.permissionOverwrites.cache.size : 0;
    const botMember = guild.members.me;
    const botPerms = botMember && "permissionsFor" in channel ? channel.permissionsFor(botMember) : null;
    const postLabel = postAccessLabel({
      isThread: channel.isThread(),
      isPrivateThread: channel.type === ChannelType.PrivateThread,
      botInThread: channel.isThread() && botMember ? channel.members.cache.has(botMember.id) : false,
      locked: channel.isThread() ? Boolean(channel.locked) : false,
      has: permission => Boolean(botPerms?.has(permission)),
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`#${truncate(channel.name, 200)}`)
      .addFields(
        { name: "ID", value: `\`${channel.id}\``, inline: true },
        { name: "Type", value: channelTypeLabel(channel.type), inline: true },
        { name: "Category", value: channel.parent ? truncate(channel.parent.name, 100) : "None", inline: true },
        ...detailFields(channel),
        { name: "Permission overwrites", value: String(overwrites), inline: true },
        { name: "Aegis can send", value: postLabel, inline: true },
        { name: "Created", value: dateAndAgo(channel.createdTimestamp ?? Date.now()), inline: true },
      );
    if (isObfuscatedChannel(channel)) embed.setFooter({ text: "Aegis can't view this channel, so some details may be missing." });
    await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
};

export default command;
