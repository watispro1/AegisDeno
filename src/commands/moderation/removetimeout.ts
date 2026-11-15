import { auditReason } from "../../utils/safeText";
import { logger } from "../../utils/logger";
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember, MessageFlags, EmbedBuilder } from "discord.js";
import type { AutocompleteInteraction } from "discord.js";
import { Command } from "../../types/discord";
import { sendGuildLog } from "../../services/logging";
import { isRoleHierarchyValid } from "../../permissions/hierarchy";
import { hierarchyRefusalText } from "../../permissions/hierarchyExplain";
import { addModerationCase } from "../../services/moderationCases";
import { caseActionsRow, modLogRow } from "../../services/modLogLinks";
import { softFail } from "../../utils/softFail";
import { dmOutcome, dmSentLabel, dmSentText } from "../../services/dmNotice";
import { UNTIMEOUT_REASON_PRESETS, presetSuggestions } from "./lib/presets";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("removetimeout")
    .setDescription("Lift a member's timeout early so they can talk again.")
    .addUserOption(opt =>
      opt.setName("user").setDescription("The timed-out member").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("reason").setDescription("Why the timeout is lifted (suggestions as you type)").setMaxLength(512).setAutocomplete(true).setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName("notify").setDescription("DM the member that they can talk again (default: no)").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  botPermissions:  [PermissionFlagsBits.ModerateMembers],

  autocomplete: async (interaction: AutocompleteInteraction) => {
    const focused = interaction.options.getFocused(true);
    await interaction.respond(focused.name === "reason" ? presetSuggestions(String(focused.value ?? ""), UNTIMEOUT_REASON_PRESETS) : []);
  },

  execute: async (interaction: ChatInputCommandInteraction) => {
    let target = interaction.options.getMember("user") as GuildMember | null;
    if (!target) {
      const user = interaction.options.getUser("user");
      if (user && interaction.guild) {
        target = await interaction.guild.members.fetch(user.id).catch(() => null);
      }
    }
    const guildId = interaction.guildId!;
    const reason = interaction.options.getString("reason")?.trim() || "Timeout removed by moderator.";
    const notify = interaction.options.getBoolean("notify") ?? false;

    if (!target) {
      return interaction.reply({ content: "❌ That member isn't in this server, so there is no timeout to remove.", flags: MessageFlags.Ephemeral });
    }
    // Cheapest and most common miss first: nothing to remove.
    if (!target.isCommunicationDisabled()) {
      return interaction.reply({ content: `ℹ️ **${target.user.tag}** is not timed out right now.`, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    }
    const hierarchyOk = await isRoleHierarchyValid(
      interaction.client, guildId, interaction.user.id, target.id
    );
    if (!hierarchyOk) {
      return interaction.reply({
        content: await hierarchyRefusalText(interaction.guild!, "you", interaction.user.id, target.id, "remove the timeout from", target.user.tag),
        flags: MessageFlags.Ephemeral,
      });
    }
    // Discord refuses to edit a member above Aegis's highest role: say so up front.
    if (!target.moderatable) {
      return interaction.reply({
        content: await hierarchyRefusalText(interaction.guild!, "bot", interaction.client.user.id, target.id, "remove the timeout from", target.user.tag),
        flags: MessageFlags.Ephemeral,
      });
    }

    const wasUntil = target.communicationDisabledUntil;
    await interaction.deferReply();
    try {
      await target.timeout(null, auditReason(`${reason} | Timeout removed by ${interaction.user.tag}`));
      const caseId = await addModerationCase({
        guildId,
        userId: target.id,
        moderatorId: interaction.user.id,
        action: "untimeout",
        reason,
        details: wasUntil ? `Was due to end ${wasUntil.toISOString()}` : undefined,
      });

      let delivered = false;
      if (notify) {
        delivered = (await target.user.send({
          embeds: [new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle(`🔓 Your timeout in **${interaction.guild!.name}** was lifted`)
            .setDescription("You can send messages and join voice again.")
            .addFields({ name: "📝 Reason", value: reason })
            .setTimestamp()],
        }).catch(softFail(`Untimeout notice DM to ${target.id}`, "debug"))) !== null;
      }
      const dm = dmOutcome(!notify, delivered);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle("🔓 Timeout Removed")
        .setThumbnail(target.user.displayAvatarURL())
        .addFields(
          { name: "👤 Member", value: `${target.user.tag} (<@${target.id}>)`, inline: false },
          { name: "📝 Reason", value: reason, inline: false },
          ...(wasUntil ? [{ name: "⏳ Was due to end", value: `<t:${Math.floor(wasUntil.getTime() / 1000)}:R>`, inline: true }] : []),
          { name: "🛡️ Moderator", value: interaction.user.tag, inline: true },
          { name: "🔕 DM Sent", value: dmSentLabel(dm), inline: true },
        )
        .setFooter(caseId ? { text: `Case ID: ${caseId}` } : null)
        .setTimestamp();
      await interaction.editReply({
        embeds: [embed],
        components: caseId ? [caseActionsRow(guildId, target.id, caseId)] : [],
        allowedMentions: { parse: [] },
      });
      await sendGuildLog(interaction.client, guildId, {
        title: "✅ Timeout Removed",
        color: 0x57F287,
        description: `**User:** ${target.user.tag} (<@${target.user.id}>)\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}\n**DM Sent:** ${dmSentText(dm)}`,
      }, "modActions", caseId ? [modLogRow(guildId, target.id, caseId)] : undefined);
    } catch (err) {
      logger.error(`Failed to remove timeout from user ${target.user.id} in guild ${guildId}`, err);
      await interaction.editReply("❌ Failed to remove the timeout. Check that I still have **Timeout Members** and that my role is above theirs.");
    }
  },
};
