import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, MessageFlags } from "discord.js";
import { Command } from "../../types/discord";
import { getGuildConfig } from "../../services/configuration";
import { getAutomodConfig } from "../../services/automod";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("diagnostics")
    .setDescription("Run a diagnostic check on the server's configuration and bot permissions.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageGuild],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guild = interaction.guild!;
    const botMember = guild.members.me;

    if (!botMember) {
      await interaction.reply({ content: "❌ Could not find bot member in this server.", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // 1. Fetch Configs
    const [guildConfig, automodConfig] = await Promise.all([getGuildConfig(guild.id), getAutomodConfig(guild.id)]);

    // 2. Check Permissions
    const p = botMember.permissions;
    const hasManageMessages = p.has(PermissionFlagsBits.ManageMessages);
    const hasModerateMembers = p.has(PermissionFlagsBits.ModerateMembers);
    const hasBanMembers = p.has(PermissionFlagsBits.BanMembers);
    const hasKickMembers = p.has(PermissionFlagsBits.KickMembers);
    const hasViewAuditLog = p.has(PermissionFlagsBits.ViewAuditLog);
    const hasManageChannels = p.has(PermissionFlagsBits.ManageChannels);
    const hasManageRoles = p.has(PermissionFlagsBits.ManageRoles);
    const hasReadHistory = p.has(PermissionFlagsBits.ReadMessageHistory);

    const permissionsCheck = [
      `${hasManageMessages ? "✅" : "❌"} Manage Messages`,
      `${hasModerateMembers ? "✅" : "❌"} Moderate Members (Timeout)`,
      `${hasBanMembers ? "✅" : "❌"} Ban Members`,
      `${hasKickMembers ? "✅" : "❌"} Kick Members`,
      `${hasViewAuditLog ? "✅" : "❌"} View Audit Log`,
      `${hasManageChannels ? "✅" : "❌"} Manage Channels (Tickets)`,
      `${hasManageRoles ? "✅" : "❌"} Manage Roles (Role Panels)`,
      `${hasReadHistory ? "✅" : "❌"} Read Message History (Transcripts)`,
    ].join("\n");

    const missingPermissions = !(hasManageMessages && hasModerateMembers && hasBanMembers && hasKickMembers && hasViewAuditLog && hasManageChannels && hasManageRoles && hasReadHistory);

    // 3. Check Channels
    let loggingStatus = "❌ Not configured";
    if (guildConfig.loggingEnabled && guildConfig.loggingChannelId) {
      const channel = guild.channels.cache.get(guildConfig.loggingChannelId)
        ?? await guild.channels.fetch(guildConfig.loggingChannelId).catch(() => null);
      if (channel && "permissionsFor" in channel) {
        const canSend = channel.permissionsFor(botMember)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]);
        loggingStatus = canSend ? `✅ Configured (<#${channel.id}>)` : `⚠️ Configured (<#${channel.id}>) but missing Send Messages permission`;
      } else {
        loggingStatus = `⚠️ Configured but channel was deleted`;
      }
    }

    let welcomeStatus = "❌ Not configured";
    if (guildConfig.welcomeEnabled && guildConfig.welcomeChannelId) {
      const channel = guild.channels.cache.get(guildConfig.welcomeChannelId)
        ?? await guild.channels.fetch(guildConfig.welcomeChannelId).catch(() => null);
      if (channel && "permissionsFor" in channel) {
        const canSend = channel.permissionsFor(botMember)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]);
        welcomeStatus = canSend ? `✅ Configured (<#${channel.id}>)` : `⚠️ Configured (<#${channel.id}>) but missing Send Messages permission`;
      } else {
        welcomeStatus = `⚠️ Configured but channel was deleted`;
      }
    }

    let welcomeRoleStatus = "ℹ️ Not configured";
    if (guildConfig.welcomeRoleId) {
      const role = guild.roles.cache.get(guildConfig.welcomeRoleId)
        ?? await guild.roles.fetch(guildConfig.welcomeRoleId).catch(() => null);
      welcomeRoleStatus = !role
        ? "⚠️ Configured role was deleted"
        : !role.editable
          ? `⚠️ <@&${role.id}> is above my role`
          : `✅ Configured (<@&${role.id}>)`;
    }

    // 4. Check Automod
    const hasAnyAutomod = automodConfig.words.enabled || automodConfig.links.enabled || automodConfig.mentions.enabled || automodConfig.spam.enabled;
    const automodStatus = hasAnyAutomod
      ? `✅ Active (Rules enabled: ${[
          automodConfig.words.enabled ? "Words" : "",
          automodConfig.links.enabled ? "Links" : "",
          automodConfig.mentions.enabled ? "Mentions" : "",
          automodConfig.spam.enabled ? "Spam" : "",
        ].filter(Boolean).join(", ")})`
      : "❌ All rules disabled";

    // 5. Build Embed
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("🛠️ Server Diagnostics & Setup")
      .setDescription("Here is the current status of the bot's configuration in this server.")
      .addFields(
        { name: "Bot Permissions", value: permissionsCheck, inline: false },
        { name: "Logging Channel", value: loggingStatus, inline: true },
        { name: "Welcome Channel", value: welcomeStatus, inline: true },
        { name: "Welcome Role", value: welcomeRoleStatus, inline: true },
        { name: "Automod", value: automodStatus, inline: false },
      );

    const recommendations: string[] = [];
    if (missingPermissions) {
      recommendations.push("• Grant missing permissions to the bot's role in server settings.");
    }
    if (!guildConfig.loggingEnabled || !guildConfig.loggingChannelId) {
      recommendations.push("• Set up a logging channel using `/logging channel`.");
    }
    if (!hasAnyAutomod) {
      recommendations.push("• Enable some automod features using `/automod <rule> toggle`.");
    }

    if (recommendations.length > 0) {
      embed.addFields({ name: "Recommendations", value: recommendations.join("\n"), inline: false });
    } else {
      embed.addFields({ name: "Recommendations", value: "✅ Everything looks good!", inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};

