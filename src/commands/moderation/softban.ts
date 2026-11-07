import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from "discord.js";
import { Command } from "../../types/discord";
import { guardCollect } from "../../utils/collectorGuard";
import { logger } from "../../utils/logger";
import { softFail } from "../../utils/softFail";
import { handleReasonAutocomplete } from "../../utils/moderationPresets";
import { isBotHierarchyValid, isRoleHierarchyValid } from "../../permissions/hierarchy";
import { sendGuildLog } from "../../services/logging";
import { addModerationCase } from "../../services/moderationCases";
import { caseActionsRow, modLogRow } from "../../services/modLogLinks";
import { dmOutcome, dmSentLabel, dmSentText } from "../../services/dmNotice";
import { SOFTBAN_DEFAULT_DAYS, SOFTBAN_MAX_DAYS, SOFTBAN_MIN_DAYS, softbanBanReason, softbanBlock, softbanDeleteSeconds, softbanRecheckBlock, softbanUnbanReason, lookupBanStatus } from "./softban/logic";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("softban")
    .setDescription("Ban and immediately unban a member to clear their recent messages.")
    .addUserOption(opt => opt.setName("user").setDescription("The member to softban").setRequired(true))
    .addStringOption(opt =>
      opt.setName("reason").setDescription("Reason (suggestions as you type)").setAutocomplete(true).setMaxLength(512).setRequired(false)
    )
    .addIntegerOption(opt =>
      opt.setName("delete_messages").setDescription(`Delete messages from this many days (${SOFTBAN_MIN_DAYS}-${SOFTBAN_MAX_DAYS}, default ${SOFTBAN_DEFAULT_DAYS})`)
        .setMinValue(SOFTBAN_MIN_DAYS).setMaxValue(SOFTBAN_MAX_DAYS).setRequired(false)
    )
    .addBooleanOption(opt => opt.setName("silent").setDescription("Don't DM the member (default: false)").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.BanMembers],
  botPermissions: [PermissionFlagsBits.BanMembers],

  autocomplete: handleReasonAutocomplete,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guild = interaction.guild!;
    const guildId = guild.id;
    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason")?.trim() || "No reason provided.";
    const silent = interaction.options.getBoolean("silent") ?? false;
    const deleteSeconds = softbanDeleteSeconds(interaction.options.getInteger("delete_messages"));
    const deleteDays = deleteSeconds / 86_400;

    const banStatus = await lookupBanStatus(() => guild.bans.fetch({ user: target.id, force: true }));
    const blocked = softbanBlock({
      targetId: target.id,
      actorId: interaction.user.id,
      botId: interaction.client.user?.id ?? null,
      ownerId: guild.ownerId,
      banStatus,
    });
    if (blocked) return interaction.reply({ content: blocked, flags: MessageFlags.Ephemeral });

    const checkHierarchy = async (): Promise<string | null> => {
      const member = await guild.members.fetch(target.id).catch(() => null);
      if (!member) return null;
      const [modOk, botOk] = await Promise.all([
        isRoleHierarchyValid(interaction.client, guildId, interaction.user.id, target.id),
        isBotHierarchyValid(interaction.client, guildId, target.id),
      ]);
      if (!modOk) return "❌ You cannot softban this member: they have a higher or equal role.";
      if (!botOk) return "❌ I cannot softban this member: they are above my highest role.";
      return null;
    };
    const hierarchyError = await checkHierarchy();
    if (hierarchyError) return interaction.reply({ content: hierarchyError, flags: MessageFlags.Ephemeral });

    const confirmEmbed = new EmbedBuilder()
      .setColor(0xE67E22)
      .setTitle("⚠️ Softban Confirmation")
      .setThumbnail(target.displayAvatarURL())
      .setDescription(`You are about to **softban** ${target.tag}: ban, then unban straight away. Their messages from the last ${deleteDays} day(s) are deleted and they can rejoin with an invite.`)
      .addFields(
        { name: "👤 User", value: `${target.tag} (<@${target.id}>)`, inline: false },
        { name: "📝 Reason", value: reason, inline: false },
        { name: "🗑️ Msg Deletion", value: `${deleteDays} day(s)`, inline: true },
        { name: "🔕 Silent", value: silent ? "Yes, no DM" : "No", inline: true },
      )
      .setFooter({ text: "This confirmation expires in 30 seconds." })
      .setTimestamp();

    const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("softban_confirm").setLabel("Confirm Softban").setStyle(ButtonStyle.Danger).setEmoji("🧹"),
      new ButtonBuilder().setCustomId("softban_cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary).setEmoji("✖️"),
    );

    const prompt = await interaction.reply({ embeds: [confirmEmbed], components: [confirmRow], flags: MessageFlags.Ephemeral, fetchReply: true });
    const collector = prompt.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 30_000,
      filter: (i) => i.user.id === interaction.user.id,
      max: 1,
    });

    collector.on("collect", (i) => guardCollect("softban", i, async () => {
      if (i.customId === "softban_cancel") {
        await i.update({ content: "❌ Softban cancelled.", embeds: [], components: [] }).catch(() => null);
        return;
      }
      await i.deferUpdate().catch(() => null);

      // Roles or bans can change during the confirmation: check again.
      const recheck = softbanRecheckBlock(await lookupBanStatus(() => guild.bans.fetch({ user: target.id, force: true })));
      const stillBlocked = recheck ?? await checkHierarchy();
      if (stillBlocked) {
        await i.editReply({ content: stillBlocked, embeds: [], components: [] }).catch(() => null);
        return;
      }

      const member = await guild.members.fetch(target.id).catch(() => null);
      let delivered = false;
      if (!silent && member) {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xE67E22)
          .setTitle(`🧹 You have been softbanned from **${guild.name}**`)
          .setDescription("Your recent messages were removed. You are not banned and can rejoin with an invite link.")
          .addFields({ name: "📝 Reason", value: reason })
          .setFooter({ text: "If you believe this was a mistake, please contact server staff." })
          .setTimestamp();
        delivered = (await target.send({ embeds: [dmEmbed] }).catch(softFail(`Softban notice DM to ${target.id}`, "debug"))) !== null;
      }
      const dm = dmOutcome(silent, delivered);

      try {
        await guild.members.ban(target.id, { reason: softbanBanReason(reason, interaction.user.tag), deleteMessageSeconds: deleteSeconds });
      } catch (err) {
        logger.error(`Softban: could not ban ${target.id} in ${guildId}`, err);
        await i.editReply({ content: "❌ Failed to softban the user. Check my permissions and role hierarchy.", embeds: [], components: [] }).catch(() => null);
        return;
      }

      // The unban half matters most: try twice before telling staff to do it by hand.
      let unbanned = false;
      for (let attempt = 0; attempt < 2 && !unbanned; attempt++) {
        unbanned = await guild.members.unban(target.id, softbanUnbanReason(interaction.user.tag)).then(() => true, (err) => {
          logger.warn(`Softban: unban attempt ${attempt + 1} failed for ${target.id} in ${guildId}`, err);
          return false;
        });
      }

      const caseId = await addModerationCase({
        guildId,
        userId: target.id,
        moderatorId: interaction.user.id,
        action: "softban",
        reason,
        details: `Deleted messages: ${deleteDays} day(s)${unbanned ? "" : " | Unban failed, still banned"}`,
      });

      const unbanNote = unbanned ? "Lifted, they can rejoin" : "⚠️ Could not lift the ban. Run `/unban` for them.";
      const resultEmbed = new EmbedBuilder()
        .setColor(unbanned ? 0xE67E22 : 0xED4245)
        .setTitle("🧹 Member Softbanned")
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: "👤 User", value: `${target.tag} (<@${target.id}>)`, inline: false },
          { name: "📝 Reason", value: reason, inline: false },
          { name: "🛡️ Moderator", value: interaction.user.tag, inline: true },
          { name: "🗑️ Msg Deletion", value: `${deleteDays} day(s)`, inline: true },
          { name: "🔕 DM Sent", value: !silent && !member ? "❌ No (not in the server)" : dmSentLabel(dm), inline: true },
          { name: "🔓 Ban", value: unbanNote, inline: false },
        )
        .setFooter(caseId ? { text: `Case ID: ${caseId}` } : null)
        .setTimestamp();

      await i.editReply({ content: null, embeds: [resultEmbed], components: caseId ? [caseActionsRow(guildId, target.id, caseId)] : [] }).catch(() => null);

      await sendGuildLog(interaction.client, guildId, {
        title: "🧹 Member Softbanned",
        color: unbanned ? 0xE67E22 : 0xED4245,
        description: `**User:** ${target.tag} (<@${target.id}>)\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}\n**Msg Deletion:** ${deleteDays}d\n**DM Sent:** ${member ? dmSentText(dm) : "No (not in the server)"}${unbanned ? "" : "\n**Warning:** the ban could not be lifted; they are still banned."}`,
      }, "modActions", caseId ? [modLogRow(guildId, target.id, caseId)] : undefined);
    }));

    collector.on("end", async (_, endReason) => {
      if (endReason === "time") {
        await interaction.editReply({ content: "⏰ Softban confirmation timed out.", embeds: [], components: [] }).catch(() => null);
      }
    });
  },
};

export default command;
