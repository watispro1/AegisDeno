import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/discord";
import { setupVerification, getVerificationConfig } from "../../services/verificationService";
import { VerificationModel } from "../../database/mongo";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Server anti-raid and member verification settings.")
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName("setup")
        .setDescription("Post a verification panel in a channel.")
        .addChannelOption(opt => opt.setName("channel").setDescription("Target channel").addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addRoleOption(opt => opt.setName("verified_role").setDescription("Role granted upon verification").setRequired(true))
        .addStringOption(opt =>
          opt
            .setName("type")
            .setDescription("Verification challenge type")
            .setRequired(false)
            .addChoices(
              { name: "One-Click Button", value: "button" },
              { name: "CAPTCHA Verification", value: "captcha" }
            )
        )
        .addStringOption(opt => opt.setName("title").setDescription("Panel header title").setRequired(false))
        .addStringOption(opt => opt.setName("description").setDescription("Panel instruction description").setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName("user")
        .setDescription("Manually verify a server member.")
        .addUserOption(opt => opt.setName("target").setDescription("Member to verify").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("info")
        .setDescription("Display current verification settings.")
    )
    .addSubcommand(sub =>
      sub
        .setName("disable")
        .setDescription("Disable the verification system.")
    ),

  category: "verification",
  guildOnly: true,

  async execute(interaction) {
    if (!interaction.guild) return;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "setup") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: "❌ You need `Manage Server` permission to configure verification.", ephemeral: true });
        return;
      }

      const channel = interaction.options.getChannel("channel", true) as TextChannel;
      const role = interaction.options.getRole("verified_role", true);
      const type = (interaction.options.getString("type") || "button") as "button" | "captcha";
      const title = interaction.options.getString("title") || undefined;
      const description = interaction.options.getString("description") || undefined;

      await interaction.deferReply({ ephemeral: true });
      const result = await setupVerification(interaction.guild, channel, role.id, type, title, description);

      if (result) {
        await interaction.editReply({ content: `✅ Verification panel successfully posted in ${channel}!` });
      } else {
        await interaction.editReply({ content: "❌ Failed to set up verification panel." });
      }
      return;
    }

    if (subcommand === "user") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
        await interaction.reply({ content: "❌ You need `Manage Roles` permission to manually verify members.", ephemeral: true });
        return;
      }

      const config = await getVerificationConfig(interaction.guild.id);
      if (!config || !config.verifiedRoleId) {
        await interaction.reply({ content: "❌ Verification is not set up on this server. Run `/verify setup` first.", ephemeral: true });
        return;
      }

      const targetMember = await interaction.guild.members.fetch(interaction.options.getUser("target", true).id).catch(() => null);
      if (!targetMember) {
        await interaction.reply({ content: "❌ Target member not found.", ephemeral: true });
        return;
      }

      await targetMember.roles.add(config.verifiedRoleId).catch(() => null);
      await interaction.reply({ content: `✅ Manually verified <@${targetMember.id}> and assigned <@&${config.verifiedRoleId}>.`, ephemeral: true });
      return;
    }

    if (subcommand === "info") {
      const config = await getVerificationConfig(interaction.guild.id);
      if (!config || !config.enabled) {
        await interaction.reply({ content: "ℹ️ Verification system is currently **Disabled**.", ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle("🛡️ Verification System Info")
        .setColor(0x2ECC71)
        .addFields(
          { name: "Status", value: "🟢 Enabled", inline: true },
          { name: "Mode", value: config.type.toUpperCase(), inline: true },
          { name: "Verified Role", value: `<@&${config.verifiedRoleId}>`, inline: true },
          { name: "Channel", value: config.channelId ? `<#${config.channelId}>` : "Not set", inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (subcommand === "disable") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: "❌ You need `Manage Server` permission to disable verification.", ephemeral: true });
        return;
      }

      await VerificationModel.updateOne({ guildId: interaction.guild.id }, { $set: { enabled: false } });
      await interaction.reply({ content: "🔴 Verification system has been disabled.", ephemeral: true });
      return;
    }
  },
};

export default command;
