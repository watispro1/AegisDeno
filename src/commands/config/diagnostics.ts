import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, PermissionsBitField, EmbedBuilder, MessageFlags } from "discord.js";
import { Command } from "../../types/discord";
import { getGuildConfig } from "../../services/configuration";
import { AUTOMOD_RULE_SHORT_LABELS, enabledAutomodRules, getAutomodConfig } from "../../services/automod";
import { isObfuscatedChannel, hiddenChannelMessage } from "../../utils/channels";
import { botPermissionBitfield } from "../../web/catalogPermissions";
import { BOT_PERMISSION_WHY } from "../../permissions/botPermissionGuide";
import { COLORS, permissionName } from "../../utils/embedStyle";
import { inviteUrl } from "../../config/links";
import { commands } from "../loader";
import { getStarboardConfig } from "../../services/starboard";
import { mediaSafetySummary } from "../../services/mediaSafety";
import { getTicketSettings } from "../../services/ticketSettings";
import { getVerificationConfig } from "../../services/verificationService";
import { checkConfiguredChannels, checkModmailChannel, configuredChannels, fitField } from "../../services/channelAccess";

/**
 * One line per permission the invite asks for (✅/❌ with what it is for),
 * and the flag names Aegis lacks. Exported for tests.
 */
export function invitePermissionReport(have: Pick<PermissionsBitField, "has">): { lines: string; missing: string[] } {
  const flags = new PermissionsBitField(botPermissionBitfield()).toArray();
  const missing = flags.filter(f => !have.has(f));
  const render = (withWhy: boolean) => flags
    .map(f => have.has(f) ? `✅ ${permissionName(f)}` : `❌ ${permissionName(f)}${withWhy ? ` — ${BOT_PERMISSION_WHY[f] ?? "needed by some commands"}` : ""}`)
    .join("\n");
  const detailed = render(true);
  // An embed field holds 1024 characters; drop the reasons before cutting a line.
  return { lines: detailed.length <= 1024 ? detailed : render(false), missing };
}

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

    const [guildConfig, automodConfig, starboard, tickets, verification] = await Promise.all([
      getGuildConfig(guild.id), getAutomodConfig(guild.id),
      getStarboardConfig(guild.id).catch(() => null), getTicketSettings(guild.id).catch(() => null), getVerificationConfig(guild.id).catch(() => null),
    ]);
    const channels = configuredChannels({ guild: guildConfig, starboard, ticketLogChannelId: tickets?.logChannelId ?? null, verification });
    const [channelProblems, modmailStatus] = await Promise.all([
      checkConfiguredChannels(guild, botMember, channels),
      checkModmailChannel(guild, botMember, guildConfig.modmail),
    ]);

    // Permissions: exactly the set the invite asks for, so a fresh
    // invite with the default permissions reports nothing missing.
    const { lines: permissionsCheck, missing: missingFlags } = invitePermissionReport(botMember.permissions);
    const missingPermissions = missingFlags.length > 0;

    let loggingStatus = "❌ Not configured";
    if (guildConfig.loggingEnabled && guildConfig.loggingChannelId) {
      const channel = guild.channels.cache.get(guildConfig.loggingChannelId)
        ?? await guild.channels.fetch(guildConfig.loggingChannelId).catch(() => null);
      if (isObfuscatedChannel(channel)) {
        loggingStatus = `⚠️ Configured but ${hiddenChannelMessage(guildConfig.loggingChannelId)}`;
      } else if (channel && "permissionsFor" in channel) {
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
      if (isObfuscatedChannel(channel)) {
        welcomeStatus = `⚠️ Configured but ${hiddenChannelMessage(guildConfig.welcomeChannelId)}`;
      } else if (channel && "permissionsFor" in channel) {
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

    const automodRules = enabledAutomodRules(automodConfig);
    const automodStatus = automodRules.length
      ? `✅ Active (Rules enabled: ${automodRules.map(k => AUTOMOD_RULE_SHORT_LABELS[k]).join(", ")})`
      : "❌ All rules disabled";

    const ping = Math.round(interaction.client.ws.ping);
    const commandsSynced = commands.size;
    const embedColor = missingPermissions ? COLORS.danger : (channelProblems.length || !guildConfig.loggingEnabled ? COLORS.warn : COLORS.ok);

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle("🛠️ Server Diagnostics & Setup")
      .setDescription("Here is the current status of the bot's configuration in this server.")
      .addFields(
        { name: "Bot Permissions", value: permissionsCheck, inline: false },
        { name: "📡 Gateway Ping", value: `\`${ping}ms\``, inline: true },
        { name: "📚 Commands Loaded", value: `**${commandsSynced}** slash commands`, inline: true },
        { name: "Logging Channel", value: loggingStatus, inline: true },
        { name: "Welcome Channel", value: welcomeStatus, inline: true },
        { name: "Welcome Role", value: welcomeRoleStatus, inline: true },
        { name: "Automod", value: automodStatus, inline: false },
        {
          name: "Channel access",
          value: channels.length === 0
            ? "ℹ️ No module is set to post in a channel yet."
            : channelProblems.length ? fitField(channelProblems) : `✅ Aegis can view, post and embed in all ${channels.length} configured channel${channels.length === 1 ? "" : "s"}.`,
          inline: false,
        },
        ...(modmailStatus ? [{ name: "ModMail staff channel", value: modmailStatus, inline: false }] : []),
        { name: "Flagged media", value: mediaSafetySummary(guildConfig.mediaSafety), inline: false },
      );

    const recommendations: string[] = [];
    if (missingPermissions) {
      recommendations.push(`• Give Aegis's role ${missingFlags.map(f => `**${permissionName(f)}**`).join(", ")} (Server Settings → Roles → Aegis), or re-invite it from ${inviteUrl()}.`);
    }
    if (!guildConfig.loggingEnabled || !guildConfig.loggingChannelId) {
      recommendations.push("• Set up a logging channel using `/logging channel`.");
    }
    if (channelProblems.length) {
      recommendations.push("• Fix the channels under **Channel access**. From 16 November 2026 Discord hides channels from bots without **View Channel**, so Aegis stops seeing them entirely.");
    }
    if (modmailStatus?.startsWith("⚠️")) {
      recommendations.push("• Give Aegis the permissions listed under **ModMail staff channel**, or members' DMs can't reach staff.");
    }
    if (!automodRules.length) {
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

