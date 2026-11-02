import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, PermissionsBitField, EmbedBuilder, MessageFlags } from "discord.js";
import { Command } from "../../types/discord";
import { getGuildConfig } from "../../services/configuration";
import { getAutomodConfig } from "../../services/automod";
import { isObfuscatedChannel, hiddenChannelMessage } from "../../utils/channels";
import { botPermissionBitfield } from "../../web/catalogPermissions";
import { BOT_PERMISSION_WHY } from "../../permissions/botPermissionGuide";
import { permissionName } from "../../utils/embedStyle";
import { inviteUrl } from "../../config/links";

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

    // 1. Fetch Configs
    const [guildConfig, automodConfig] = await Promise.all([getGuildConfig(guild.id), getAutomodConfig(guild.id)]);

    // 2. Check Permissions: exactly the set the invite asks for, so a fresh
    // invite with the default permissions reports nothing missing.
    const { lines: permissionsCheck, missing: missingFlags } = invitePermissionReport(botMember.permissions);
    const missingPermissions = missingFlags.length > 0;

    // 3. Check Channels
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
      recommendations.push(`• Give Aegis's role ${missingFlags.map(f => `**${permissionName(f)}**`).join(", ")} (Server Settings → Roles → Aegis), or re-invite it from ${inviteUrl()}.`);
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

