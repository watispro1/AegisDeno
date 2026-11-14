import { guardCollect } from "../../utils/collectorGuard";
import { getGuildConfig } from "../../services/configuration";
import { caseListUrl, memberPageUrl } from "../../config/links";
import {
  ChatInputCommandInteraction,
  type UserContextMenuCommandInteraction,
  type User,
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
import { dateAndAgo, timeoutLine } from "../../services/infoFormat";
import { balanceSummary } from "../../services/economyDiscord";
import { fitRecordLines, recordLine, userInfoEphemeral, warningSummary } from "../../services/userInfoFormat";
import { COLORS, footer } from "../../utils/embedStyle";
import { truncate } from "../../utils/safeText";

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

type UserInfoInteraction = ChatInputCommandInteraction | UserContextMenuCommandInteraction;
const NO_PINGS = { parse: [] as never[] };

/** Profile card for someone who is not (or no longer) in the server; moderators also see ban status and record counts. */
async function showOutsider(interaction: UserInfoInteraction, user: User, viewerIsMod: boolean, ephemeral: boolean): Promise<void> {
  if (!interaction.deferred) await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {});
  const full = await user.fetch(true).catch(() => user);
  const embed = new EmbedBuilder()
    .setColor(full.accentColor ?? COLORS.muted)
    .setAuthor({ name: `${user.tag} (${user.id})`, iconURL: user.displayAvatarURL() })
    .setThumbnail(user.displayAvatarURL({ size: 512 }))
    .setDescription("Not a member of this server.")
    .addFields({ name: "📅 Account Created", value: dateAndAgo(user.createdTimestamp), inline: true })
    .setFooter(footer(user.bot ? "Bot account" : "User lookup"));
  if (viewerIsMod && interaction.guild) {
    const [ban, cases] = await Promise.all([
      interaction.guild.bans.fetch({ user: user.id, force: false }).catch(() => null),
      getModerationCases(interaction.guildId!, user.id, 10).catch(() => []),
    ]);
    embed.addFields(
      { name: "🔨 Banned", value: ban ? `Yes · ${truncate(ban.reason ?? "no reason recorded", 200)}` : "No", inline: true },
      { name: "📂 Recent Cases", value: cases.length ? fitRecordLines(cases.map(recordLine), 1024) : "None on record", inline: false },
    );
  }
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setLabel("Avatar").setStyle(ButtonStyle.Link).setURL(user.displayAvatarURL({ size: 1024 })).setEmoji("🖼️"),
    ...(viewerIsMod ? [new ButtonBuilder().setLabel("Cases on dashboard").setStyle(ButtonStyle.Link).setURL(caseListUrl(interaction.guildId!, user.id)).setEmoji("🧭")] : []),
  );
  await interaction.editReply({ embeds: [embed], components: [row], allowedMentions: NO_PINGS });
}

/**
 * The member profile behind /userinfo and the User Info context menu.
 * Moderators get warnings, cases and the Trust Score in a private reply.
 */
export async function showUserInfo(interaction: UserInfoInteraction, user: User, requestedEphemeral: boolean | null = null): Promise<void> {
  const viewerIsMod = hasModerationPermissions(interaction.memberPermissions?.bitfield ?? null);
  const ephemeral = userInfoEphemeral({ viewerIsMod, contextMenu: interaction.isUserContextMenuCommand(), requested: requestedEphemeral });
  const member = await interaction.guild?.members.fetch(user.id).catch(() => null);
  if (!member) {
    await showOutsider(interaction, user, viewerIsMod, ephemeral);
    return;
  }

  // Moderators get several lookups (warnings, cases, Trust Score): defer so a slow
  // database never runs past Discord's 3-second reply window.
  if (!interaction.deferred) await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {});

  const [warnings, cases, balance] = await Promise.all([
    viewerIsMod ? getWarningsForUser(interaction.guildId!, user.id).catch(() => []) : Promise.resolve([]),
    viewerIsMod ? getModerationCases(interaction.guildId!, user.id, 15).catch(() => []) : Promise.resolve([]),
    user.bot ? Promise.resolve(null) : balanceSummary(interaction.guildId!, user.id).catch(() => null),
  ]);

  const roles = member.roles.cache
    .filter((role) => role.id !== interaction.guildId)
    .sort((left, right) => right.position - left.position)
    .map((role) => role.toString());
  const shownRoles = roles.slice(0, 8).join(" ") || "None";
  const extraRoles = roles.length > 8 ? ` +${roles.length - 8} more` : "";

  const userKeyPerms = KEY_PERMISSIONS.filter((p) => member.permissions.has(p.flag)).map((p) => p.name);
  const permsText = userKeyPerms.length > 0 ? userKeyPerms.slice(0, 5).join(", ") + (userKeyPerms.length > 5 ? ` +${userKeyPerms.length - 5}` : "") : "Standard Member";

  const presence = member.presence;
  const statusKey = presence?.status ?? "offline";
  const activity = presence?.activities?.[0];
  let activityText = "No current activity";
  if (activity) {
    const typeLabel = ACTIVITY_TYPE_LABEL[activity.type] ?? "";
    activityText = activity.type === ActivityType.Custom ? (activity.state ?? activity.name) : `${typeLabel} **${activity.name}**`;
  }

  const badges: string[] = [];
  if (member.id === interaction.guild?.ownerId) badges.push("👑 Server Owner");
  if (user.bot) badges.push("🤖 Bot");
  if (member.premiumSinceTimestamp) badges.push("💎 Server Booster");
  if (member.pending) badges.push("🚪 Pending screening");
  if (userKeyPerms.includes("Administrator")) badges.push("🛡️ Admin");
  else if (userKeyPerms.includes("Moderate Members (Timeout)") || userKeyPerms.includes("Manage Messages")) badges.push("⚔️ Moderator");

  const nick = member.nickname ? ` · nickname **${truncate(member.nickname, 64)}**` : "";
  const embed = new EmbedBuilder()
    .setColor(member.displayColor || COLORS.brand)
    .setAuthor({ name: `${user.tag} (${user.id})`, iconURL: user.displayAvatarURL() })
    .setThumbnail(member.displayAvatarURL({ size: 512, forceStatic: false }))
    .setDescription(`<@${user.id}>${nick}${badges.length ? `\n${badges.join(" · ")}` : ""}`)
    .addFields(
      { name: "🏷️ Status", value: `${STATUS_EMOJI[statusKey] ?? "⚫"} ${statusKey.charAt(0).toUpperCase() + statusKey.slice(1)}`, inline: true },
      { name: "📅 Account Created", value: dateAndAgo(user.createdTimestamp), inline: true },
      { name: "📥 Joined Server", value: member.joinedTimestamp ? dateAndAgo(member.joinedTimestamp) : "Unknown", inline: true },
      { name: "💎 Booster Since", value: member.premiumSinceTimestamp ? `<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>` : "Not boosting", inline: true },
      { name: "⬆️ Highest Role", value: member.roles.highest.id === interaction.guildId ? "None" : member.roles.highest.toString(), inline: true },
      { name: "🎮 Activity", value: truncate(activityText, 1024), inline: false },
      { name: "🔑 Key Permissions", value: permsText, inline: false },
      { name: `🎭 Roles (${roles.length})`, value: `${shownRoles}${extraRoles}`.slice(0, 1024), inline: false },
    )
    .setFooter(footer(user.bot ? "Bot account" : "Member profile"))
    .setTimestamp();

  const timedOut = timeoutLine(member.communicationDisabledUntilTimestamp);
  if (timedOut) embed.addFields({ name: "⏳ Timeout", value: timedOut, inline: true });
  if (balance) embed.addFields({ name: "💰 Balance", value: balance, inline: true });

  if (viewerIsMod) {
    // Trust Score v2 (same engine as /trust user); a lookup failure leaves the field out.
    const trustConfig = normalizeTrustConfig((await getGuildConfig(interaction.guildId!).catch(() => null))?.trust);
    const trust = await getMemberTrust(subjectFromMember(member), { preset: trustConfig.preset }).catch(() => null);
    embed.addFields(
      { name: "⚠️ Warnings", value: warningSummary(warnings), inline: true },
      { name: "📂 Cases", value: `**${cases.filter(c => c.action !== "warn").length}** recent`, inline: true },
      ...(trust ? [{ name: "🧠 Trust Score", value: `**${trust.score}**/100 · ${trust.bandLabel}\n${scoreBar(trust.score)}\nDetails: \`/trust user\``, inline: true }] : []),
    );
  }

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  const ids = { warns: `userinfo_warns_${interaction.id}`, cases: `userinfo_cases_${interaction.id}`, roles: `userinfo_roles_${interaction.id}`, perms: `userinfo_perms_${interaction.id}` };
  if (viewerIsMod) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(ids.warns).setLabel(`Warnings (${warnings.length})`).setStyle(ButtonStyle.Secondary).setEmoji("📜").setDisabled(warnings.length === 0),
      new ButtonBuilder().setCustomId(ids.cases).setLabel("Mod Cases").setStyle(ButtonStyle.Secondary).setEmoji("📂").setDisabled(cases.length === 0),
      // The dashboard's member page: cases, warnings, notes and quick actions in one place.
      new ButtonBuilder().setLabel("Member page").setStyle(ButtonStyle.Link).setURL(memberPageUrl(interaction.guildId!, user.id)).setEmoji("🧭"),
    ));
  }
  rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(ids.roles).setLabel("All Roles").setStyle(ButtonStyle.Secondary).setEmoji("🎭").setDisabled(roles.length === 0),
    new ButtonBuilder().setCustomId(ids.perms).setLabel("Permissions").setStyle(ButtonStyle.Secondary).setEmoji("🔑"),
    new ButtonBuilder().setLabel("Avatar").setStyle(ButtonStyle.Link).setURL(member.displayAvatarURL({ size: 1024, forceStatic: false })).setEmoji("🖼️"),
  ));

  const sent = await interaction.editReply({ embeds: [embed], components: rows, allowedMentions: NO_PINGS });
  const collector = sent.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120_000,
    filter: (i) => Object.values(ids).includes(i.customId),
  });

  const recordEmbed = (title: string, lines: string[]) => new EmbedBuilder()
    .setColor(COLORS.warn)
    .setTitle(title)
    .setDescription(fitRecordLines(lines, 4000, "See them all with `/case user`."))
    .setFooter(footer("Copy an ID into /case view for the full record"));

  collector.on("collect", (i) => guardCollect("userinfo", i, async () => {
    const isModRecord = i.customId === ids.warns || i.customId === ids.cases;
    if (isModRecord && !hasModerationPermissions(i.memberPermissions?.bitfield ?? null)) {
      await i.reply({ content: "❌ Moderation records are only visible to moderators.", flags: MessageFlags.Ephemeral });
      return;
    }
    const tag = truncate(user.tag, 80);
    if (i.customId === ids.warns) {
      const lines = warnings.map((w) => recordLine({ ...w, action: "warn" }));
      await i.reply({ embeds: [recordEmbed(`📜 Active warnings for ${tag} (${warnings.length})`, lines)], flags: MessageFlags.Ephemeral, allowedMentions: NO_PINGS });
    } else if (i.customId === ids.cases) {
      await i.reply({ embeds: [recordEmbed(`📂 Recent cases for ${tag}`, cases.map(recordLine))], flags: MessageFlags.Ephemeral, allowedMentions: NO_PINGS });
    } else if (i.customId === ids.roles) {
      const e = new EmbedBuilder().setColor(member.displayColor || COLORS.brand).setTitle(`🎭 Roles for ${tag} (${roles.length})`)
        .setDescription(fitRecordLines(roles, 4000));
      await i.reply({ embeds: [e], flags: MessageFlags.Ephemeral, allowedMentions: NO_PINGS });
    } else if (i.customId === ids.perms) {
      const all = member.permissions.toArray().map((p) => p.replace(/([a-z])([A-Z])/g, "$1 $2"));
      const e = new EmbedBuilder().setColor(COLORS.brand).setTitle(`🔑 Permissions for ${tag}`)
        .setDescription(truncate(member.permissions.has(PermissionFlagsBits.Administrator) ? "**Administrator**: every permission, in every channel." : all.join(", ") || "None", 4000))
        .setFooter(footer("Server-wide permissions; channel overrides can add or remove some"));
      await i.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    }
  }));

  collector.on("end", async () => {
    await interaction.editReply({ components: rows.map(r => new ActionRowBuilder<ButtonBuilder>().addComponents(r.components.filter(b => "url" in b.data && b.data.url))).filter(r => r.components.length) }).catch(() => null);
  });
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("View a member's profile, roles, permissions and (for staff) moderation record.")
    .addUserOption((option) =>
      option.setName("user").setDescription("The member or user to look up (defaults to you)").setRequired(false),
    )
    .addBooleanOption((option) =>
      option.setName("private").setDescription("Only you can see the reply (always on for staff views)").setRequired(false),
    ),

  guildOnly: true,
  botPermissions: ["EmbedLinks"],
  cooldownMs: 2000,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const user = interaction.options.getUser("user") ?? interaction.user;
    await showUserInfo(interaction, user, interaction.options.getBoolean("private"));
  },
};

export default command;
