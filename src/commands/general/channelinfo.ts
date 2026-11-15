import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  OverwriteType,
  PermissionsBitField,
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
import { COLORS, footer, permissionName } from "../../utils/embedStyle";
import { replyPagedList } from "../../utils/listPager";
import { guardCollect } from "../../utils/collectorGuard";
import { channelLink } from "../shared/inputChecks";

/** One permission overwrite as a list line: who, then what it allows and denies. Pure. */
export function overwriteLine(o: { id: string; type: OverwriteType; allow: bigint; deny: bigint }, everyoneId: string): string {
  const who = o.id === everyoneId ? "@everyone" : o.type === OverwriteType.Role ? `<@&${o.id}>` : `<@${o.id}>`;
  const names = (bits: bigint) => new PermissionsBitField(bits).toArray().map(f => permissionName(f));
  const allow = names(o.allow);
  const deny = names(o.deny);
  const parts = [allow.length ? `✅ ${allow.join(", ")}` : "", deny.length ? `❌ ${deny.join(", ")}` : ""].filter(Boolean);
  return `**${who}**\n${parts.join("\n") || "No changes (neutral)"}`;
}

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
  if ((channel.type === ChannelType.GuildForum || channel.type === ChannelType.GuildMedia) && channel.availableTags.length) {
    out.push({ name: `Tags (${channel.availableTags.length})`, value: truncate(channel.availableTags.map(t => `\`${t.name}\``).join(" "), 1024), inline: false });
  }
  if (channel.isThread()) {
    out.push({ name: "Archived", value: yesNo(Boolean(channel.archived)), inline: true });
    if (channel.parentId) out.push({ name: "Parent", value: `<#${channel.parentId}>`, inline: true });
    if (typeof channel.memberCount === "number") out.push({ name: "Thread members", value: String(channel.memberCount), inline: true });
  }
  return out;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("channelinfo")
    .setDescription("Show a channel's type, category, topic, slowmode, permission overwrites and creation date.")
    .addChannelOption(o => o.setName("channel").setDescription("The channel to look up (defaults to this one)").setRequired(false))
    .addBooleanOption(o => o.setName("private").setDescription("Only you can see the reply (default: false)").setRequired(false)),
  guildOnly: true,
  cooldownMs: 2000,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const picked = interaction.options.getChannel("channel") ?? interaction.channel;
    const channel = picked ? (guild.channels.cache.get(picked.id) ?? await guild.channels.fetch(picked.id).catch(() => null)) : null;
    if (!channel) {
      await interaction.reply({ content: "❌ I couldn't find that channel in this server. Pick one from the list, or run this inside the channel.", flags: MessageFlags.Ephemeral });
      return;
    }
    // Don't describe channels the member can't see.
    const viewer = interaction.memberPermissions && "permissionsFor" in channel ? channel.permissionsFor(interaction.user.id) : null;
    if (viewer && !viewer.has("ViewChannel")) {
      await interaction.reply({ content: "❌ You can't see that channel.", flags: MessageFlags.Ephemeral });
      return;
    }

    const overwriteList = "permissionOverwrites" in channel ? [...channel.permissionOverwrites.cache.values()] : [];
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
      .setColor(COLORS.brand)
      .setTitle(`#${truncate(channel.name, 200)}`)
      .addFields(
        { name: "ID", value: `\`${channel.id}\``, inline: true },
        { name: "Type", value: channelTypeLabel(channel.type), inline: true },
        { name: "Category", value: channel.parent ? truncate(channel.parent.name, 100) : "None", inline: true },
        ...detailFields(channel),
        { name: "Permission overwrites", value: String(overwriteList.length), inline: true },
        { name: "Aegis can send", value: postLabel, inline: true },
        { name: "Created", value: dateAndAgo(channel.createdTimestamp ?? Date.now()), inline: true },
      )
      .setFooter(footer(isObfuscatedChannel(channel) ? "Aegis can't view this channel, so some details may be missing." : "Overwrites button: who is allowed or denied what"));

    const overwritesId = `channelinfo_ow_${interaction.id}`;
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setLabel("Open channel").setStyle(ButtonStyle.Link).setURL(channelLink(guild.id, channel.id)).setEmoji("🔗"),
      new ButtonBuilder().setCustomId(overwritesId).setLabel(`Overwrites (${overwriteList.length})`).setStyle(ButtonStyle.Secondary).setEmoji("🔐").setDisabled(overwriteList.length === 0),
    );
    const ephemeral = interaction.options.getBoolean("private") ?? false;
    const response = await interaction.reply({
      embeds: [embed], components: [row], allowedMentions: { parse: [] }, withResponse: true,
      ...(ephemeral ? { flags: MessageFlags.Ephemeral as const } : {}),
    });
    const message = response?.resource?.message;
    if (!message || !overwriteList.length) return;

    const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, idle: 120_000, filter: i => i.customId === overwritesId });
    collector.on("collect", (i) => guardCollect("channelinfo", i, async () => {
      // Roles first (highest first), then members.
      const sorted = [...overwriteList].sort((a, b) => (a.type - b.type) || ((guild.roles.cache.get(b.id)?.position ?? 0) - (guild.roles.cache.get(a.id)?.position ?? 0)));
      await replyPagedList(i, {
        title: `🔐 Overwrites in #${truncate(channel.name, 180)} (${sorted.length})`,
        lines: sorted.map(o => overwriteLine({ id: o.id, type: o.type, allow: o.allow.bitfield, deny: o.deny.bitfield }, guild.id)),
        perPage: 8,
        ephemeral: true,
      });
    }));
    collector.on("end", () => {
      interaction.editReply({ components: [new ActionRowBuilder<ButtonBuilder>().addComponents(row.components[0])] }).catch(() => null);
    });
  },
};

export default command;
