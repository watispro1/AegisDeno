import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
  type AutocompleteInteraction,
  type Role,
} from "discord.js";
import { Command } from "../../types/discord";
import { logger } from "../../utils/logger";
import { auditReason } from "../../utils/safeText";
import { formatDurationLong } from "../../utils/duration";
import { buildDurationSuggestions, handleReasonAutocomplete } from "../../utils/moderationPresets";
import { memberTopRolePosition } from "../../permissions/hierarchy";
import { sendGuildLog } from "../../services/logging";
import { addModerationCase } from "../../services/moderationCases";
import { modLogRow } from "../../services/modLogLinks";
import { clearTempRole, findTempRole, listTempRoles, scheduleTempRoleRemoval } from "../../services/tempRole";
import {
  TEMP_ROLE_MAX_SECONDS,
  TEMP_ROLE_MIN_SECONDS,
  TEMP_ROLE_PRESETS,
  parseTempRoleDuration,
  planTempRoleAdd,
  tempRoleBlock,
  tempRoleListLine,
} from "../../services/tempRoleLogic";

const LIST_LIMIT = 20;

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("temprole")
    .setDescription("Give a member a role that Aegis takes away after a set time.")
    .addSubcommand(sub => sub.setName("add").setDescription("Give a role for a limited time")
      .addUserOption(o => o.setName("user").setDescription("The member").setRequired(true))
      .addRoleOption(o => o.setName("role").setDescription("The role to give").setRequired(true))
      .addStringOption(o => o.setName("duration").setDescription("How long, e.g. 2h, 7d, 2 weeks (up to a year)").setAutocomplete(true).setMaxLength(64).setRequired(true))
      .addStringOption(o => o.setName("reason").setDescription("Reason (suggestions as you type)").setAutocomplete(true).setMaxLength(512)))
    .addSubcommand(sub => sub.setName("remove").setDescription("Take a temporary role off now and cancel its timer")
      .addUserOption(o => o.setName("user").setDescription("The member").setRequired(true))
      .addRoleOption(o => o.setName("role").setDescription("The role to take off").setRequired(true)))
    .addSubcommand(sub => sub.setName("list").setDescription("Show temporary roles that are still running")
      .addUserOption(o => o.setName("user").setDescription("Only this member's temporary roles")))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageRoles],
  botPermissions: [PermissionFlagsBits.ManageRoles],

  autocomplete: async (interaction: AutocompleteInteraction) => {
    const focused = interaction.options.getFocused(true);
    if (focused.name === "duration") {
      await interaction.respond(buildDurationSuggestions(String(focused.value ?? ""), TEMP_ROLE_PRESETS, { minSeconds: TEMP_ROLE_MIN_SECONDS, maxSeconds: TEMP_ROLE_MAX_SECONDS }));
      return;
    }
    await handleReasonAutocomplete(interaction);
  },

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    if (sub === "list") await runList(interaction);
    else if (sub === "add") await runAdd(interaction);
    else await runRemove(interaction);
  },
};

/** The hierarchy checks shared by add and remove; null when the role may be used. */
async function roleCheck(interaction: ChatInputCommandInteraction, role: Role): Promise<string | null> {
  const guild = interaction.guild!;
  const me = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
  return tempRoleBlock({
    role: { id: role.id, position: role.position, managed: role.managed },
    guildId: guild.id,
    isOwner: guild.ownerId === interaction.user.id,
    actorTopPosition: await memberTopRolePosition(guild, interaction.user.id),
    botTopPosition: me?.roles.highest.position ?? 0,
  });
}

async function runAdd(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild!;
  const user = interaction.options.getUser("user", true);
  const role = interaction.options.getRole("role", true) as Role;
  const reason = interaction.options.getString("reason")?.trim() || "No reason provided.";
  const parsed = parseTempRoleDuration(interaction.options.getString("duration", true));
  if (!parsed.ok) return interaction.reply({ content: parsed.error, flags: MessageFlags.Ephemeral });

  const block = await roleCheck(interaction, role);
  if (block) return interaction.reply({ content: block, flags: MessageFlags.Ephemeral });

  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return interaction.reply({ content: "❌ That user isn't in this server.", flags: MessageFlags.Ephemeral });

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const now = Date.now();
  const expiresAt = now + parsed.seconds * 1000;
  const pending = await findTempRole(guild.id, user.id, role.id);
  const plan = planTempRoleAdd({ memberHasRole: member.roles.cache.has(role.id), pendingExpiryMs: pending ? pending.executeAt.getTime() : null, newExpiryMs: expiresAt });

  if (plan.kind === "already-permanent") {
    return interaction.editReply(`ℹ️ ${user.tag} already has ${role} without a timer, so I left it alone. Take it off first if you want it to be temporary.`);
  }
  if (plan.kind === "already-longer") {
    return interaction.editReply(`ℹ️ ${user.tag} already has ${role} until <t:${Math.floor(plan.currentExpiryMs / 1000)}:f>, which is later. Use \`/temprole remove\` first to shorten it.`);
  }

  if (plan.kind === "add") {
    try {
      await member.roles.add(role, auditReason(`Temporary role for ${formatDurationLong(parsed.seconds)}: ${reason} | By ${interaction.user.tag}`));
    } catch (err) {
      logger.warn(`temprole: could not add ${role.id} to ${user.id} in ${guild.id}`, err);
      return interaction.editReply("❌ I couldn't give that role. Check my Manage Roles permission and role position.");
    }
  }

  const durationLabel = formatDurationLong(parsed.seconds);
  const caseId = await addModerationCase({
    guildId: guild.id,
    userId: user.id,
    moderatorId: interaction.user.id,
    action: "temprole",
    reason,
    details: `Role: ${role.name} (${role.id}) | ${plan.kind === "extend" ? "Extended to" : "Length"}: ${durationLabel}`,
  });

  // Replace any earlier timer for this role so only one removal is pending.
  await clearTempRole(guild.id, user.id, role.id).catch(err => logger.warn(`temprole: could not clear old timer for ${user.id}`, err));
  let scheduled = true;
  try {
    await scheduleTempRoleRemoval(interaction.client, {
      guildId: guild.id,
      channelId: interaction.channelId,
      userId: user.id,
      executeAt: new Date(expiresAt),
      payload: { roleId: role.id, moderatorId: interaction.user.id, moderatorTag: interaction.user.tag, reason, durationSeconds: parsed.seconds, caseId, setAt: now },
    });
  } catch (err) {
    scheduled = false;
    logger.error(`temprole: could not schedule removal of ${role.id} from ${user.id} in ${guild.id}`, err);
  }

  const ends = `<t:${Math.floor(expiresAt / 1000)}:R>`;
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(plan.kind === "extend" ? "🏷️ Temporary Role Extended" : "🏷️ Temporary Role Given")
    .addFields(
      { name: "👤 Member", value: `${user.tag} (<@${user.id}>)`, inline: false },
      { name: "🎭 Role", value: `${role}`, inline: true },
      { name: "⏳ Length", value: scheduled ? `${durationLabel}, ends ${ends}` : `${durationLabel}. ⚠️ The removal timer could not be saved; take the role off by hand.`, inline: true },
      { name: "📝 Reason", value: reason, inline: false },
    )
    .setFooter(caseId ? { text: `Case ID: ${caseId}` } : null)
    .setTimestamp();
  await interaction.editReply({ embeds: [embed] });

  await sendGuildLog(interaction.client, guild.id, {
    title: plan.kind === "extend" ? "🏷️ Temporary Role Extended" : "🏷️ Temporary Role Given",
    color: 0x5865F2,
    description: `**User:** ${user.tag} (<@${user.id}>)\n**Role:** ${role}\n**Length:** ${durationLabel} (ends ${ends})\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`,
  }, "modActions", caseId ? [modLogRow(guild.id, user.id, caseId)] : undefined);
}

async function runRemove(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild!;
  const user = interaction.options.getUser("user", true);
  const role = interaction.options.getRole("role", true) as Role;

  const block = await roleCheck(interaction, role);
  if (block) return interaction.reply({ content: block, flags: MessageFlags.Ephemeral });

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const cleared = await clearTempRole(guild.id, user.id, role.id);
  const member = await guild.members.fetch(user.id).catch(() => null);
  const hadRole = Boolean(member?.roles.cache.has(role.id));
  if (!cleared && !hadRole) return interaction.editReply(`ℹ️ ${user.tag} doesn't have ${role} and has no timer for it.`);
  if (!cleared) return interaction.editReply(`ℹ️ ${user.tag} has ${role}, but not as a temporary role. Remove it with Discord's role menu if you meant to.`);

  if (member && hadRole) {
    try {
      await member.roles.remove(role, auditReason(`Temporary role removed early | By ${interaction.user.tag}`));
    } catch (err) {
      logger.warn(`temprole: could not remove ${role.id} from ${user.id} in ${guild.id}`, err);
      return interaction.editReply("❌ I cancelled the timer but couldn't take the role off. Check my role position and remove it by hand.");
    }
  }

  await interaction.editReply(`✅ Took ${role} off ${user.tag}${hadRole ? "" : " (they no longer had it)"} and cancelled its timer.`);
  await sendGuildLog(interaction.client, guild.id, {
    title: "🏷️ Temporary Role Removed",
    color: 0x57F287,
    description: `**User:** ${user.tag} (<@${user.id}>)\n**Role:** ${role}\n**Removed early by:** ${interaction.user.tag}`,
  }, "modActions");
}

async function runList(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild!;
  const user = interaction.options.getUser("user");
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const entries = await listTempRoles(guild.id, user?.id);
  if (!entries.length) return interaction.editReply(user ? `ℹ️ ${user.tag} has no temporary roles running.` : "ℹ️ No temporary roles are running in this server.");

  const lines = entries.slice(0, LIST_LIMIT).map(e => tempRoleListLine({ userId: e.userId, roleId: e.payload.roleId, expiresAtMs: e.executeAt.getTime(), reason: e.payload.reason }, !user));
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(user ? `🏷️ Temporary roles for ${user.tag}` : "🏷️ Temporary roles")
    .setDescription(lines.join("\n"))
    .setFooter({ text: entries.length > LIST_LIMIT ? `Showing the ${LIST_LIMIT} ending soonest of ${entries.length}` : `${entries.length} running` });
  await interaction.editReply({ embeds: [embed] });
}

export default command;
