import { logger } from "../../utils/logger";
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { Command } from "../../types/discord";
import { getGuildConfig, updateGuildConfig } from "../../services/configuration";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("Configure the server's welcome messages and auto-roles.")
    .addSubcommand(sub =>
      sub.setName("toggle").setDescription("Enable or disable welcome messages.")
        .addBooleanOption(opt => opt.setName("enabled").setDescription("Enabled status").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("channel").setDescription("Set the channel for welcome messages.")
        .addChannelOption(opt => opt.setName("channel").setDescription("The channel to send messages to").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("message").setDescription("Set the welcome message.")
        .addStringOption(opt => 
          opt.setName("text")
             .setDescription("Message text. Use {user}, {username}, {server}, {member_count}.")
             .setRequired(true)
             .setMaxLength(2000)
        )
    )
    .addSubcommand(sub =>
      sub.setName("role").setDescription("Set a role to automatically assign to new members.")
        .addRoleOption(opt => opt.setName("role").setDescription("The role to assign (or omit to clear)").setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName("status").setDescription("View current welcome configuration.")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageGuild],
  botPermissions: [PermissionFlagsBits.ManageRoles, PermissionFlagsBits.SendMessages],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    await interaction.deferReply({ ephemeral: true });

    try {
      const config = await getGuildConfig(guildId);

      if (sub === "status") {
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("👋 Welcome Configuration")
          .addFields(
            { name: "Status", value: config.welcomeEnabled ? "✅ Enabled" : "❌ Disabled", inline: true },
            { name: "Channel", value: config.welcomeChannelId ? `<#${config.welcomeChannelId}>` : "Not set", inline: true },
            { name: "Auto-Role", value: config.welcomeRoleId ? `<@&${config.welcomeRoleId}>` : "Not set", inline: true },
            { name: "Message", value: `\`\`\`\n${config.welcomeMessage}\n\`\`\``, inline: false },
          )
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (sub === "toggle") {
        const enabled = interaction.options.getBoolean("enabled", true);
        await updateGuildConfig(guildId, { welcomeEnabled: enabled });
        await interaction.editReply(`✅ Welcome messages are now **${enabled ? "enabled" : "disabled"}**.`);
        return;
      }

      if (sub === "channel") {
        const channel = interaction.options.getChannel("channel", true);
        await updateGuildConfig(guildId, { welcomeChannelId: channel.id });
        await interaction.editReply(`✅ Welcome channel set to <#${channel.id}>.`);
        return;
      }

      if (sub === "message") {
        const text = interaction.options.getString("text", true);
        await updateGuildConfig(guildId, { welcomeMessage: text });
        await interaction.editReply(`✅ Welcome message updated.\n**Preview:**\n${text}`);
        return;
      }

      if (sub === "role") {
        const role = interaction.options.getRole("role", false);
        if (role) {
          await updateGuildConfig(guildId, { welcomeRoleId: role.id });
          await interaction.editReply(`✅ Auto-role set to <@&${role.id}>.`);
        } else {
          await updateGuildConfig(guildId, { welcomeRoleId: null });
          await interaction.editReply("✅ Auto-role cleared.");
        }
        return;
      }
    } catch (err) {
      logger.error(`Failed to handle /welcome ${sub} for guild ${guildId}`, err);
      await interaction.editReply("❌ Failed to update welcome configuration. Please try again.");
    }
  },
};
