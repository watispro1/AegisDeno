import { logger } from "../../utils/logger";
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, MessageFlags } from "discord.js";
import { Command } from "../../types/discord";
import { clearWarningsForUser, getWarningsForUser } from "../../services/warnings";
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

    const inServer = Boolean(await interaction.guild?.members.fetch(target.id).catch(() => null));
    const outranksTarget = inServer
      ? await isRoleHierarchyValid(interaction.client, guildId, interaction.user.id, target.id)
      : false;
    const blocked = clearWarningsBlock({ actorId: interaction.user.id, targetId: target.id, targetInServer: inServer, outranksTarget });
    if (blocked) {
      return interaction.reply({ content: blocked, flags: MessageFlags.Ephemeral });
    }

    try {
      const currentWarnings = await getWarningsForUser(guildId, target.id);
      if (currentWarnings.length === 0) {
        await interaction.reply({ content: `✅ **${target.tag}** has no active warnings to clear.`, flags: MessageFlags.Ephemeral });
        return;
      }

      const answer = await requestConfirmation(interaction, {
        content:
          `Clear **${currentWarnings.length}** warning(s) for **${target.tag}** (<@${target.id}>)?\n` +
          "They are deleted for good and stop counting toward escalation and the trust score. A case is logged.",
        confirmLabel: `Clear ${currentWarnings.length} warning(s)`,
      });
      if (answer !== "confirmed") return;

      await clearWarningsForUser(guildId, target.id);
      await addModerationCase({
        guildId,
        userId: target.id,
        moderatorId: interaction.user.id,
        action: "clearwarnings",
        reason: "Warnings cleared by moderator.",
        details: `Cleared ${currentWarnings.length} warning(s).`,
      });

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle("✅ Warnings Cleared")
        .addFields(
          { name: "User",      value: `${target.tag} (<@${target.id}>)` },
          { name: "Cleared",   value: `${currentWarnings.length} warning(s)` },
          { name: "Moderator", value: interaction.user.tag, inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ content: "", embeds: [embed] });
      await sendGuildLog(interaction.client, guildId, {
        title: "✅ Warnings Cleared",
        color: 0x57F287,
        description: `**User:** ${target.tag} (<@${target.id}>)\n**Cleared:** ${currentWarnings.length} warning(s)\n**Moderator:** ${interaction.user.tag}`,
      });
    } catch (err) {
      logger.error(`Failed to clear warnings for user ${target.id} in guild ${guildId}`, err);
      const failure = { content: "❌ Something went wrong while clearing warnings. Check `/warnings` before trying again.", embeds: [], components: [] };
      if (interaction.replied || interaction.deferred) await interaction.editReply(failure).catch(() => null);
      else await interaction.reply({ ...failure, flags: MessageFlags.Ephemeral }).catch(() => null);
    }
  },
};
