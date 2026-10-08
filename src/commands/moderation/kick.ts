import { logger } from "../../utils/logger";
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, GuildMember } from "discord.js";
import { Command } from "../../types/discord";
import { sendGuildLog } from "../../services/logging";
import { isRoleHierarchyValid } from "../../permissions/hierarchy";
import { addModerationCase } from "../../services/moderationCases";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from the server.")
    .addUserOption(opt =>
      opt.setName("user").setDescription("The member to kick").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("reason").setDescription("Reason for the kick").setMaxLength(512).setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.KickMembers],
  botPermissions:  [PermissionFlagsBits.KickMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const target  = interaction.options.getMember("user") as GuildMember | null;
    const reason  = interaction.options.getString("reason") ?? "No reason provided.";
    const guildId = interaction.guildId!;

    if (!target || typeof target === "string") {
      return interaction.reply({ content: "❌ User not found in this server.", ephemeral: true });
    }
    if (target.id === interaction.user.id) {
      return interaction.reply({ content: "❌ You cannot kick yourself.", ephemeral: true });
    }
    if (target.id === interaction.client.user?.id) {
      return interaction.reply({ content: "❌ You cannot kick me.", ephemeral: true });
    }
    if (target.id === interaction.guild?.ownerId) {
      return interaction.reply({ content: "❌ You cannot kick the server owner.", ephemeral: true });
    }
    if (!target.kickable) {
      return interaction.reply({ content: "❌ I cannot kick this member.", ephemeral: true });
    }

    const hierarchyOk = await isRoleHierarchyValid(
      interaction.client, guildId, interaction.user.id, target.id
    );
    if (!hierarchyOk) {
      return interaction.reply({ content: "❌ You cannot kick this member — they have a higher or equal role.", ephemeral: true });
    }

    await interaction.deferReply();
    try {
      await target.kick(`${reason} | Kicked by ${interaction.user.tag}`);
      await addModerationCase({
        guildId,
        userId: target.id,
        moderatorId: interaction.user.id,
        action: "kick",
        reason,
      });

      const embed = new EmbedBuilder()
        .setColor(0xE67E22)
        .setTitle("👢 Member Kicked")
        .setThumbnail(target.user.displayAvatarURL())
        .addFields(
          { name: "User",      value: `${target.user.tag} (<@${target.user.id}>)` },
          { name: "Reason",    value: reason },
          { name: "Moderator", value: interaction.user.tag, inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      await sendGuildLog(interaction.client, guildId, {
        title: "👢 Member Kicked",
        color: 0xE67E22,
        description: `**User:** ${target.user.tag}\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`,
      });
    } catch (err) {
      logger.error(`Failed to kick user ${target.user.id} in guild ${guildId}`, err);
      await interaction.editReply("❌ Failed to kick the member.");
    }
  },
};

export default command;
