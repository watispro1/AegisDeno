import { logger } from "../../utils/logger";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { Command } from "../../types/discord";
import { getGuildConfig, updateGuildConfig } from "../../services/configuration";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("View or update server configuration settings.")
    .addSubcommand(sub =>
      sub.setName("view").setDescription("View all current server configuration values.")
    )
    .addSubcommand(sub =>
      sub
        .setName("logging")
        .setDescription("Configure the mod-log channel.")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Channel to send mod logs to").setRequired(false)
        )
        .addBooleanOption(opt =>
          opt.setName("enabled").setDescription("Enable or disable mod logging").setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("welcome")
        .setDescription("Configure the welcome message system.")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Channel to send welcome messages").setRequired(false)
        )
        .addBooleanOption(opt =>
          opt.setName("enabled").setDescription("Enable or disable welcome messages").setRequired(false)
        )
        .addStringOption(opt =>
          opt
            .setName("message")
            .setDescription("Custom welcome message (use {user}, {server}, {member_count})")
            .setRequired(false)
            .setMaxLength(500)
        )
        .addRoleOption(opt =>
          opt.setName("role").setDescription("Role to auto-assign to new members").setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("suggestions")
        .setDescription("Configure where suggestions are posted.")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Suggestions channel").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("language")
        .setDescription("Set the bot language for this server.")
        .addStringOption(opt =>
          opt
            .setName("language")
            .setDescription("Language code")
            .setRequired(true)
            .addChoices(
              { name: "English (en)", value: "en" },
              { name: "Spanish (es)", value: "es" },
              { name: "French (fr)", value: "fr" },
              { name: "German (de)", value: "de" },
            )
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageGuild],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    await interaction.deferReply({ ephemeral: true });
    try {
      const config = await getGuildConfig(guildId);

      if (sub === "view") {
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(`⚙️ Server Configuration — ${interaction.guild!.name}`)
          .addFields(
            {
              name: "📋 Mod Logging",
              value: config.loggingEnabled
                ? `✅ Enabled → <#${config.loggingChannelId}>`
                : "❌ Disabled",
              inline: true,
            },
            {
              name: "👋 Welcome Messages",
              value: config.welcomeEnabled
                ? `✅ Enabled → <#${config.welcomeChannelId}>`
                : "❌ Disabled",
              inline: true,
            },
            {
              name: "💬 Welcome Message",
              value: `\`${config.welcomeMessage || "Not set"}\``,
              inline: false,
            },
            {
              name: "🎭 Auto-Role on Join",
              value: config.welcomeRoleId ? `<@&${config.welcomeRoleId}>` : "None",
              inline: true,
            },
            {
              name: "💡 Suggestions Channel",
              value: config.suggestionsChannelId ? `<#${config.suggestionsChannelId}>` : "Not set",
              inline: true,
            },
            {
              name: "🌐 Language",
              value: `\`${config.language || "en"}\``,
              inline: true,
            },
          )
          .setFooter({ text: "Use /config <subcommand> to update individual settings." })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (sub === "logging") {
        const channel = interaction.options.getChannel("channel");
        const enabled = interaction.options.getBoolean("enabled");
        const updates: Record<string, unknown> = {};
        if (channel !== null) updates.loggingChannelId = channel.id;
        if (enabled !== null) updates.loggingEnabled = enabled;
        if (Object.keys(updates).length === 0) {
          await interaction.editReply("❌ Please provide at least one option to update.");
          return;
        }
        await updateGuildConfig(guildId, updates);
        const lines = [];
        if (channel !== null) lines.push(`Channel → <#${channel.id}>`);
        if (enabled !== null) lines.push(`Enabled → \`${enabled}\``);
        await interaction.editReply(`✅ **Mod Logging** updated:\n${lines.join("\n")}`);
        return;
      }

      if (sub === "welcome") {
        const channel = interaction.options.getChannel("channel");
        const enabled = interaction.options.getBoolean("enabled");
        const message = interaction.options.getString("message");
        const role = interaction.options.getRole("role");
        const updates: Record<string, unknown> = {};
        if (channel !== null) updates.welcomeChannelId = channel.id;
        if (enabled !== null) updates.welcomeEnabled = enabled;
        if (message !== null) updates.welcomeMessage = message;
        if (role !== null) updates.welcomeRoleId = role.id;
        if (Object.keys(updates).length === 0) {
          await interaction.editReply("❌ Please provide at least one option to update.");
          return;
        }
        await updateGuildConfig(guildId, updates);
        await interaction.editReply("✅ **Welcome** configuration updated.");
        return;
      }

      if (sub === "suggestions") {
        const channel = interaction.options.getChannel("channel", true);
        await updateGuildConfig(guildId, { suggestionsChannelId: channel.id });
        await interaction.editReply(`✅ **Suggestions** will now be posted to <#${channel.id}>.`);
        return;
      }

      if (sub === "language") {
        const lang = interaction.options.getString("language", true);
        await updateGuildConfig(guildId, { language: lang });
        await interaction.editReply(`✅ **Language** set to \`${lang}\`.`);
        return;
      }
    } catch (err) {
      logger.error(`Failed to handle /config ${sub} for guild ${guildId}`, err);
      await interaction.editReply("❌ Failed to update configuration. Please try again.");
    }
  },
};

export default command;
