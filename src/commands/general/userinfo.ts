import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ActivityType,
} from "discord.js";
import { Command } from "../../types/discord";
import { getWarningsForUser } from "../../services/warnings";
import { getModerationCases } from "../../services/moderationCases";

const KEY_PERMISSIONS: Array<{ flag: bigint; name: string }> = [
  { flag: PermissionFlagsBits.Administrator, name: "Administrator" },
  { flag: PermissionFlagsBits.ManageGuild, name: "Manage Server" },
  { flag: PermissionFlagsBits.ManageRoles, name: "Manage Roles" },
  { flag: PermissionFlagsBits.ManageChannels, name: "Manage Channels" },
  { flag: PermissionFlagsBits.BanMembers, name: "Ban Members" },
  { flag: PermissionFlagsBits.KickMembers, name: "Kick Members" },
  { flag: PermissionFlagsBits.ModerateMembers, name: "Moderate Members (Timeout)" },
  { flag: PermissionFlagsBits.ManageMessages, name: "Manage Messages" },
  { flag: PermissionFlagsBits.MentionEveryone, name: "Mention Everyone" },
  { flag: PermissionFlagsBits.ViewAuditLog, name: "View Audit Log" },
];

const STATUS_EMOJI: Record<string, string> = {
  online: "🟢",
  idle: "🌙",
  dnd: "🔴",
  offline: "⚫",
};

const ACTIVITY_TYPE_LABEL: Record<number, string> = {
  [ActivityType.Playing]: "Playing",
  [ActivityType.Streaming]: "Streaming",
  [ActivityType.Listening]: "Listening to",
  [ActivityType.Watching]: "Watching",
  [ActivityType.Competing]: "Competing in",
  [ActivityType.Custom]: "",
};

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("View detailed member profile, permissions, activity, and moderation record.")
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

    const [warnings, cases] = await Promise.all([
      getWarningsForUser(interaction.guildId!, user.id),
      getModerationCases(interaction.guildId!, user.id, 5),
    ]);

    const roles = member.roles.cache
      .filter((role) => role.id !== interaction.guildId)
      .sort((left, right) => right.position - left.position)
      .map((role) => role.toString());
    const shownRoles = roles.slice(0, 8).join(" ") || "None";
    const extraRoles = roles.length > 8 ? ` +${roles.length - 8} more` : "";

    const userKeyPerms = KEY_PERMISSIONS.filter((p) => member.permissions.has(p.flag)).map((p) => p.name);
    const permsText = userKeyPerms.length > 0 ? userKeyPerms.slice(0, 5).join(", ") : "Standard Member";

    // Activity / status
    const presence = member.presence;
    const statusKey = presence?.status ?? "offline";
    const statusEmoji = STATUS_EMOJI[statusKey] ?? "⚫";
    const activity = presence?.activities?.[0];
    let activityText = "No current activity";
    if (activity) {
      const typeLabel = ACTIVITY_TYPE_LABEL[activity.type] ?? "";
      activityText = activity.type === ActivityType.Custom
        ? (activity.state ?? activity.name)
        : `${typeLabel} **${activity.name}**`;
    }

    // Acknowledgements / badges
    const badges: string[] = [];
    if (member.id === interaction.guild?.ownerId) badges.push("👑 Server Owner");
    if (user.bot) badges.push("🤖 Bot");
    if (member.premiumSinceTimestamp) badges.push("💎 Server Booster");
    if (userKeyPerms.includes("Administrator")) badges.push("🛡️ Admin");
    else if (userKeyPerms.includes("Moderate Members (Timeout)") || userKeyPerms.includes("Manage Messages")) badges.push("⚔️ Moderator");

    const embed = new EmbedBuilder()
      .setColor(member.displayColor || 0x5865F2)
      .setAuthor({ name: `${user.tag} (${user.id})`, iconURL: user.displayAvatarURL() })
      .setThumbnail(user.displayAvatarURL({ size: 512, forceStatic: false }))
      .addFields(
        { name: "👤 Member", value: `<@${user.id}>`, inline: true },
        { name: "🏷️ Status", value: `${statusEmoji} ${statusKey.charAt(0).toUpperCase() + statusKey.slice(1)}`, inline: true },
        { name: "⚠️ Warnings", value: `**${warnings.length}** warning(s)`, inline: true },
        { name: "📅 Account Created", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D> (<t:${Math.floor(user.createdTimestamp / 1000)}:R>)`, inline: true },
        { name: "📥 Joined Server", value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D> (<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)` : "Unknown", inline: true },
        { name: "💎 Booster Since", value: member.premiumSinceTimestamp ? `<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>` : "Not boosting", inline: true },
        { name: "🎮 Activity", value: activityText, inline: false },
        { name: "🔑 Key Permissions", value: permsText, inline: false },
        { name: `🎭 Roles (${roles.length})`, value: `${shownRoles}${extraRoles}`.slice(0, 1024), inline: false },
      )
      .setFooter({ text: badges.length > 0 ? `Badges: ${badges.join(" • ")}` : (user.bot ? "Bot Account" : "Server Member") })
      .setTimestamp();

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`userinfo_warns_${user.id}`)
        .setLabel("Warn History")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("📜"),
      new ButtonBuilder()
        .setCustomId(`userinfo_cases_${user.id}`)
        .setLabel("Mod Cases")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("📂"),
      new ButtonBuilder()
        .setCustomId(`userinfo_roles_${user.id}`)
        .setLabel("All Roles")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🎭"),
      new ButtonBuilder()
        .setCustomId(`userinfo_perms_${user.id}`)
        .setLabel("Permissions")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🔑"),
      new ButtonBuilder()
        .setLabel("Avatar")
        .setStyle(ButtonStyle.Link)
        .setURL(user.displayAvatarURL({ size: 1024, forceStatic: false }))
        .setEmoji("🖼️"),
    );

    const sent = await interaction.reply({ embeds: [embed], components: [buttons], fetchReply: true });

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 90_000,
    });

    collector.on("collect", async (i) => {
      if (i.customId.startsWith("userinfo_warns_")) {
        if (warnings.length === 0) {
          await i.reply({ content: `✅ <@${user.id}> has zero warnings on record.`, ephemeral: true });
        } else {
          const warnText = warnings
            .slice(0, 10)
            .map((w, idx) => `**${idx + 1}.** \`${w.reason}\` — <@${w.moderatorId}> (<t:${Math.floor(new Date(w.createdAt).getTime() / 1000)}:R>)`)
            .join("\n");
          await i.reply({ content: `📜 **Warning History for <@${user.id}> (${warnings.length}):**\n${warnText}`, ephemeral: true });
        }
      } else if (i.customId.startsWith("userinfo_cases_")) {
        if (cases.length === 0) {
          await i.reply({ content: `✅ <@${user.id}> has no moderation cases on record.`, ephemeral: true });
        } else {
          const caseText = cases
            .slice(0, 5)
            .map((c, idx) => `**${idx + 1}.** \`${c.action.toUpperCase()}\` — ${c.reason} (<t:${Math.floor(new Date(c.createdAt).getTime() / 1000)}:R>)`)
            .join("\n");
          await i.reply({ content: `📂 **Recent Mod Cases for <@${user.id}>:**\n${caseText}`, ephemeral: true });
        }
      } else if (i.customId.startsWith("userinfo_roles_")) {
        const fullRoles = roles.join(", ") || "None";
        await i.reply({ content: `🎭 **All Roles for <@${user.id}> (${roles.length}):**\n${fullRoles.slice(0, 1900)}`, ephemeral: true });
      } else if (i.customId.startsWith("userinfo_perms_")) {
        await i.reply({
          content: `🔑 **All Key Permissions for <@${user.id}>:**\n\`\`\`\n${userKeyPerms.join("\n") || "Standard Member"}\n\`\`\``,
          ephemeral: true,
        });
      }
    });

    collector.on("end", async () => {
      await interaction.editReply({ components: [] }).catch(() => null);
    });
  },
};

export default command;
