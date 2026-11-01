import { getGuildConfig } from "../../services/configuration";
import { memberPageUrl } from "../../config/links";
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
  MessageFlags,
} from "discord.js";
import { Command } from "../../types/discord";
import { getWarningsForUser } from "../../services/warnings";
import { getModerationCases } from "../../services/moderationCases";
import { scoreBar } from "../../services/trustScore";
import { getMemberTrust, subjectFromMember } from "../../services/trustService";
import { normalizeTrustConfig } from "../../services/trustEngine";
import { hasModerationPermissions } from "../../services/commandAccess";

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
      await interaction.reply({ content: "❌ That user is not a member of this server.", flags: MessageFlags.Ephemeral });
      return;
    }

    // Warn counts, trust score and the mod-record buttons are only for moderators,
    // and their reply is ephemeral so the record is not shown to the channel.
    const viewerIsMod = hasModerationPermissions(interaction.memberPermissions?.bitfield ?? null);

    const [warnings, cases] = viewerIsMod
      ? await Promise.all([
          getWarningsForUser(interaction.guildId!, user.id),
          getModerationCases(interaction.guildId!, user.id, 5),
        ])
      : [[], []] as [Awaited<ReturnType<typeof getWarningsForUser>>, Awaited<ReturnType<typeof getModerationCases>>];

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
        { name: "📅 Account Created", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D> (<t:${Math.floor(user.createdTimestamp / 1000)}:R>)`, inline: true },
        { name: "📥 Joined Server", value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D> (<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)` : "Unknown", inline: true },
        { name: "💎 Booster Since", value: member.premiumSinceTimestamp ? `<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>` : "Not boosting", inline: true },
        { name: "🎮 Activity", value: activityText, inline: false },
        { name: "🔑 Key Permissions", value: permsText, inline: false },
        { name: `🎭 Roles (${roles.length})`, value: `${shownRoles}${extraRoles}`.slice(0, 1024), inline: false },
      )
      .setFooter({ text: badges.length > 0 ? `Badges: ${badges.join(" • ")}` : (user.bot ? "Bot Account" : "Server Member") })
      .setTimestamp();

    if (viewerIsMod) {
      // Trust Score v2 (same engine as /trust user); a lookup failure leaves the field out.
      const trustConfig = normalizeTrustConfig((await getGuildConfig(interaction.guildId!).catch(() => null))?.trust);
      const trust = await getMemberTrust(subjectFromMember(member), { preset: trustConfig.preset }).catch(() => null);
      embed.addFields(
        { name: "⚠️ Warnings", value: `**${warnings.length}** warning(s)`, inline: true },
        ...(trust ? [{ name: "🧠 Trust Score", value: `**${trust.score}**/100 · ${trust.bandLabel}\n\`${scoreBar(trust.score)}\`\nDetails: \`/trust user\``, inline: true }] : []),
      );
    }

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    if (viewerIsMod) {
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
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
          // The dashboard's member page: cases, warnings, notes and quick actions in one place.
          new ButtonBuilder()
            .setLabel("Member page")
            .setStyle(ButtonStyle.Link)
            .setURL(memberPageUrl(interaction.guildId!, user.id))
            .setEmoji("🧭"),
        ),
      );
    }

    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
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
      ),
    );

    const sent = await interaction.reply({
      embeds: [embed],
      components: rows,
      fetchReply: true,
      ...(viewerIsMod ? { flags: MessageFlags.Ephemeral as const } : {}),
    });

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 90_000,
    });

    collector.on("collect", async (i) => {
      const isModRecord = i.customId.startsWith("userinfo_warns_") || i.customId.startsWith("userinfo_cases_");
      if (isModRecord && !hasModerationPermissions(i.memberPermissions?.bitfield ?? null)) {
        await i.reply({ content: "❌ Moderation records are only visible to moderators.", flags: MessageFlags.Ephemeral });
        return;
      }
      if (i.customId.startsWith("userinfo_warns_")) {
        if (warnings.length === 0) {
          await i.reply({ content: `✅ <@${user.id}> has zero warnings on record.`, flags: MessageFlags.Ephemeral });
        } else {
          const warnText = warnings
            .slice(0, 10)
            .map((w, idx) => `**${idx + 1}.** \`${w.reason}\` — <@${w.moderatorId}> (<t:${Math.floor(new Date(w.createdAt).getTime() / 1000)}:R>)`)
            .join("\n");
          await i.reply({ content: `📜 **Warning History for <@${user.id}> (${warnings.length}):**\n${warnText}`, flags: MessageFlags.Ephemeral });
        }
      } else if (i.customId.startsWith("userinfo_cases_")) {
        if (cases.length === 0) {
          await i.reply({ content: `✅ <@${user.id}> has no moderation cases on record.`, flags: MessageFlags.Ephemeral });
        } else {
          const caseText = cases
            .slice(0, 5)
            .map((c, idx) => `**${idx + 1}.** \`${c.action.toUpperCase()}\` — ${c.reason} (<t:${Math.floor(new Date(c.createdAt).getTime() / 1000)}:R>)`)
            .join("\n");
          await i.reply({ content: `📂 **Recent Mod Cases for <@${user.id}>:**\n${caseText}`, flags: MessageFlags.Ephemeral });
        }
      } else if (i.customId.startsWith("userinfo_roles_")) {
        const fullRoles = roles.join(", ") || "None";
        await i.reply({ content: `🎭 **All Roles for <@${user.id}> (${roles.length}):**\n${fullRoles.slice(0, 1900)}`, flags: MessageFlags.Ephemeral });
      } else if (i.customId.startsWith("userinfo_perms_")) {
        await i.reply({
          content: `🔑 **All Key Permissions for <@${user.id}>:**\n\`\`\`\n${userKeyPerms.join("\n") || "Standard Member"}\n\`\`\``,
          flags: MessageFlags.Ephemeral,
        });
      }
    });

    collector.on("end", async () => {
      await interaction.editReply({ components: [] }).catch(() => null);
    });
  },
};

export default command;
