import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { Command } from "../../types/discord";
import { getGuildConfig, updateGuildConfig } from "../../services/configuration";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("logging")
    .setDescription("Configure server logging.")
    .addSubcommand(sub =>
      sub
        .setName("channel")
        .setDescription("Set the logging channel")
        .addChannelOption(opt => opt.setName("channel").setDescription("The channel to send logs to").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("toggle")
        .setDescription("Enable or disable logging")
        .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable logging?").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("status").setDescription("View logging configuration status")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageGuild],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const config = await getGuildConfig(guildId);

    if (sub === "status") {
      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle("📋 Logging Configuration")
        .addFields(
          { name: "Enabled", value: config.loggingEnabled ? "Yes" : "No", inline: true },
          { name: "Channel", value: config.loggingChannelId ? `<#${config.loggingChannelId}>` : "Not set", inline: true },
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === "toggle") {
      const enabled = interaction.options.getBoolean("enabled", true);
      config.loggingEnabled = enabled;
      updateGuildConfig(guildId, config);
      return interaction.reply(`✅ Server logging is now **${enabled ? "enabled" : "disabled"}**.`);
    }

    if (sub === "channel") {
      const channel = interaction.options.getChannel("channel", true);
      config.loggingChannelId = channel.id;
      // Auto-enable if setting a channel
      config.loggingEnabled = true;
      updateGuildConfig(guildId, config);
      return interaction.reply(`✅ Logging channel set to <#${channel.id}>. Logging is now enabled.`);
    }
  },
};
