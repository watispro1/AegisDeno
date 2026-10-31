import { logger } from "../../utils/logger";
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, MessageFlags } from "discord.js";
import { Command } from "../../types/discord";
import {
  countWarningRecords,
  deleteWarningsByIds,
  describeWarningRecords,
  getWarningRecordsForUser,
  type WarningRecordCounts,
} from "../../services/warnings";
import { sendGuildLog } from "../../services/logging";
import { isRoleHierarchyValid } from "../../permissions/hierarchy";
import { addModerationCase } from "../../services/moderationCases";
import { requestConfirmation } from "../../utils/confirmation";

/**
 * Who may clear whose warnings. Members still in the server go through the
 * normal role check; a member who left has no roles, so their record can be
 * cleared by any moderator. Nobody clears their own.
 */
export function clearWarningsBlock(input: { actorId: string; targetId: string; targetInServer: boolean; outranksTarget: boolean }): string | null {
  if (input.actorId === input.targetId) return "❌ You can't clear your own warnings. Ask another moderator.";
  if (input.targetInServer && !input.outranksTarget) {
    return "❌ You can't clear warnings for this member: their highest role is equal to or above yours.";
  }
  return null;
}

/**
 * Plain-text summary of what was cleared, for the case, the reply and the log.
 * When fewer records were deleted than were shown (another moderator removed
 * some meanwhile), it says so rather than over-reporting.
 */
export function clearedSummary(counts: WarningRecordCounts, deleted: number): string {
  const shown = describeWarningRecords(counts, false);
  return deleted >= counts.total ? shown : `${shown}; ${deleted} of ${counts.total} were still there to delete`;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("clearwarnings")
    .setDescription("Clear all warnings for a user.")
    .addUserOption(opt =>
      opt.setName("user").setDescription("The user whose warnings to clear").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const target  = interaction.options.getUser("user", true);
    const guildId = interaction.guildId!;

    // The member, hierarchy and warning lookups can take longer than Discord's
    // 3-second window, so acknowledge first. The reply is ephemeral, and the
    // confirmation prompt edits it.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const inServer = Boolean(await interaction.guild?.members.fetch(target.id).catch(() => null));
      const outranksTarget = inServer
        ? await isRoleHierarchyValid(interaction.client, guildId, interaction.user.id, target.id)
        : false;
      const blocked = clearWarningsBlock({ actorId: interaction.user.id, targetId: target.id, targetInServer: inServer, outranksTarget });
      if (blocked) {
        await interaction.editReply({ content: blocked });
        return;
      }

      // Everything that will be deleted, revoked records included, so the
      // prompt, the case and the deletion all describe the same set.
      const records = await getWarningRecordsForUser(guildId, target.id);
      const counts = countWarningRecords(records);
      if (counts.total === 0) {
        await interaction.editReply({ content: `✅ **${target.tag}** has no warnings to clear.` });
        return;
      }

      const answer = await requestConfirmation(interaction, {
        content:
          `Clear ${describeWarningRecords(counts)} for **${target.tag}** (<@${target.id}>)?\n` +
          "They are deleted for good and stop counting toward escalation and the trust score. A case is logged.",
        confirmLabel: `Clear ${counts.total} ${counts.revoked === 0 ? "warning(s)" : "record(s)"}`,
      });
      if (answer !== "confirmed") return;

      // Delete exactly the records shown, so a warning issued while the prompt
      // was open is not removed unseen.
      const deleted = await deleteWarningsByIds(guildId, target.id, records.map(r => String(r._id)));
      const summary = clearedSummary(counts, deleted);
      await addModerationCase({
        guildId,
        userId: target.id,
        moderatorId: interaction.user.id,
        action: "clearwarnings",
        reason: "Warnings cleared by moderator.",
        details: `Cleared ${summary}.`,
      });

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle("✅ Warnings Cleared")
        .addFields(
          { name: "User",      value: `${target.tag} (<@${target.id}>)` },
          { name: "Cleared",   value: summary },
          { name: "Moderator", value: interaction.user.tag, inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ content: "", embeds: [embed] });
      await sendGuildLog(interaction.client, guildId, {
        title: "✅ Warnings Cleared",
        color: 0x57F287,
        description: `**User:** ${target.tag} (<@${target.id}>)\n**Cleared:** ${summary}\n**Moderator:** ${interaction.user.tag}`,
      });
    } catch (err) {
      logger.error(`Failed to clear warnings for user ${target.id} in guild ${guildId}`, err);
      const failure = { content: "❌ Something went wrong while clearing warnings. Check `/warnings` before trying again.", embeds: [], components: [] };
      if (interaction.replied || interaction.deferred) await interaction.editReply(failure).catch(() => null);
      else await interaction.reply({ ...failure, flags: MessageFlags.Ephemeral }).catch(() => null);
    }
  },
};
