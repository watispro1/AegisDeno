import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { Command } from "../../types/discord";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("View a member's profile and server membership details.")
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

    const roles = member.roles.cache
      .filter((role) => role.id !== interaction.guildId)
      .sort((left, right) => right.position - left.position)
      .map((role) => role.toString());
    const shownRoles = roles.slice(0, 10).join(" ") || "None";
    const extra = roles.length > 10 ? ` and ${roles.length - 10} more` : "";

    const embed = new EmbedBuilder()
      .setColor(member.displayColor || 0x5865f2)
      .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: "User ID", value: `\`${user.id}\``, inline: true },
        { name: "Account created", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: "Joined server", value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "Unknown", inline: true },
        { name: `Roles (${roles.length})`, value: `${shownRoles}${extra}`.slice(0, 1024) },
      )
      .setFooter({ text: user.bot ? "Bot account" : "Member profile" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
