import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { Command } from "../../types/discord";
import { getWarningsForUser } from "../../services/warnings";

const KEY_PERMISSIONS: Array<{ flag: bigint; name: string }> = [
  { flag: PermissionFlagsBits.Administrator, name: "Administrator" },
  { flag: PermissionFlagsBits.ManageGuild, name: "Manage Server" },
  { flag: PermissionFlagsBits.ManageRoles, name: "Manage Roles" },
  { flag: PermissionFlagsBits.ManageChannels, name: "Manage Channels" },
  { flag: PermissionFlagsBits.BanMembers, name: "Ban Members" },
  { flag: PermissionFlagsBits.KickMembers, name: "Kick Members" },
  { flag: PermissionFlagsBits.ModerateMembers, name: "Moderate Members (Timeout)" },
  { flag: PermissionFlagsBits.ManageMessages, name: "Manage Messages" },
];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("View detailed member profile, key permissions, and server activity.")
    .addUserOption((option) =>
      option.setName("user").setDescription("The member to look up").setRequired(false),
    ),

  guildOnly: true,
  botPermissions: ["EmbedLinks"],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const user = interaction.options.getUser("user") ?? interaction.user;
    const member = await interaction.guild?.members.fetch(user.id).catch(() => null);

    if (!member) {
      await interaction.reply({ content: "❌ That user is not a member of this server.", ephemeral: true });
      return;
    }

    const warnings = await getWarningsForUser(interaction.guildId!, user.id);

    const roles = member.roles.cache
      .filter((role) => role.id !== interaction.guildId)
      .sort((left, right) => right.position - left.position)
      .map((role) => role.toString());
    const shownRoles = roles.slice(0, 10).join(" ") || "None";
    const extra = roles.length > 10 ? ` and ${roles.length - 10} more` : "";

    const userKeyPerms = KEY_PERMISSIONS.filter((p) => member.permissions.has(p.flag)).map((p) => p.name);
    const permsText = userKeyPerms.length > 0 ? userKeyPerms.join(", ") : "Standard Member";

    const embed = new EmbedBuilder()
      .setColor(member.displayColor || 0x5865F2)
      .setAuthor({ name: `${user.tag} (${user.id})`, iconURL: user.displayAvatarURL() })
      .setThumbnail(user.displayAvatarURL({ size: 512, forceStatic: false }))
      .addFields(
        { name: "👤 Member", value: `<@${user.id}>`, inline: true },
        { name: "⚠️ Warnings Record", value: `**${warnings.length}** warning(s)`, inline: true },
        { name: "📅 Account Created", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: "📥 Joined Server", value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "Unknown", inline: true },
        { name: "💎 Server Booster", value: member.premiumSinceTimestamp ? `Yes (Since <t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>)` : "No", inline: true },
        { name: "🔑 Key Permissions", value: permsText, inline: false },
        { name: `🎭 Roles (${roles.length})`, value: `${shownRoles}${extra}`.slice(0, 1024), inline: false }
      )
      .setFooter({ text: user.bot ? "Bot Account" : "Server Member" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
