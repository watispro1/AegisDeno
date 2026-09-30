import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { Command } from "../../types/discord";
import { getGuildConfig, updateGuildConfig } from "../../services/configuration";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("Configure welcome messages.")
    .addSubcommand(sub =>
      sub
        .setName("channel")
        .setDescription("Set the welcome channel")
        .addChannelOption(opt => opt.setName("channel").setDescription("The channel to welcome new members").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("message")
        .setDescription("Set the welcome message")
        .addStringOption(opt => 
          opt.setName("text")
             .setDescription("Message text. Use {user}, {username}, {server}, {member_count}.")
             .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("toggle")
        .setDescription("Enable or disable welcome messages")
        .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable welcomes?").setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageGuild],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const config = await getGuildConfig(guildId);

    if (sub === "toggle") {
      const enabled = interaction.options.getBoolean("enabled", true);
      config.welcomeEnabled = enabled;
      await updateGuildConfig(guildId, config);
      return interaction.reply(`✅ Welcome messages are now **${enabled ? "enabled" : "disabled"}**.`);
    }

    if (sub === "channel") {
      const channel = interaction.options.getChannel("channel", true);
      config.welcomeChannelId = channel.id;
      await updateGuildConfig(guildId, config);
      return interaction.reply(`✅ Welcome channel set to <#${channel.id}>.`);
    }

    if (sub === "message") {
      const text = interaction.options.getString("text", true);
      config.welcomeMessage = text;
      await updateGuildConfig(guildId, config);
      return interaction.reply(`✅ Welcome message updated.\n\n**Preview:**\n${text.replace(/{user}/g, `<@${interaction.user.id}>`).replace(/{username}/g, interaction.user.username).replace(/{server}/g, interaction.guild!.name).replace(/{member_count}/g, String(interaction.guild!.memberCount))}`);
    }
  },
};
