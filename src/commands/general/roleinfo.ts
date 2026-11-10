import { EmbedBuilder, MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../../types/discord";
import { colorHex, notablePermissions, roleMemberCount, yesNo } from "../../services/lookupFormat";
import { dateAndAgo } from "../../services/infoFormat";
import { truncate } from "../../utils/safeText";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("roleinfo")
    .setDescription("Show a role's colour, position, members, permissions and creation date.")
    .addRoleOption(o => o.setName("role").setDescription("The role to look up").setRequired(true)),
  guildOnly: true,
  cooldownMs: 2000,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const picked = interaction.options.getRole("role", true);
    const role = guild.roles.cache.get(picked.id) ?? await guild.roles.fetch(picked.id).catch(() => null);
    if (!role) {
      await interaction.reply({ content: "❌ I couldn't find that role in this server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const isEveryone = role.id === guild.id;
    const perms = notablePermissions(role.permissions.bitfield);
    const highest = guild.roles.highest;
    const botMember = guild.members.me;
    const canManageRole = botMember ? botMember.roles.highest.position > role.position && botMember.permissions.has("ManageRoles") : false;

    const embed = new EmbedBuilder()
      .setColor(role.color || 0x99AAB5)
      .setTitle(`Role: ${truncate(role.name, 200)}`)
      .addFields(
        { name: "ID", value: `\`${role.id}\``, inline: true },
        { name: "Colour", value: colorHex(role.color), inline: true },
        { name: "Position", value: `${role.position} of ${Math.max(0, highest.position)}`, inline: true },
        { name: "Members", value: roleMemberCount(role.members.size, isEveryone, guild.memberCount), inline: true },
        { name: "Shown separately", value: yesNo(role.hoist), inline: true },
        { name: "Mentionable", value: yesNo(role.mentionable), inline: true },
        { name: "Managed", value: role.managed ? "Yes (by an integration or bot)" : "No", inline: true },
        { name: "Bot can assign", value: isEveryone ? "No (@everyone)" : yesNo(canManageRole), inline: true },
        { name: "Created", value: dateAndAgo(role.createdTimestamp), inline: true },
        { name: "Notable permissions", value: perms.length ? truncate(perms.join(", "), 1024) : "None", inline: false },
      );
    const icon = role.iconURL({ size: 256 });
    if (icon) embed.setThumbnail(icon);
    await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
};

export default command;
