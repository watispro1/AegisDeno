import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { getModerationCases } from "../../services/moderationCases";
import { Command } from "../../types/discord";

const ACTION_LABELS: Record<string, string> = {
  warn: "Warning",
  kick: "Kick",
  ban: "Ban",
  timeout: "Timeout",
  untimeout: "Timeout Removed",
  unban: "Unban",
  clearwarnings: "Warnings Cleared",
};

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("modhistory")
    .setDescription("View the recent moderation cases for a user.")
    .addUserOption((option) =>
      option.setName("user").setDescription("The user whose cases to view").setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const target = interaction.options.getUser("user", true);
    const cases = await getModerationCases(interaction.guildId!, target.id);
    const embed = new EmbedBuilder()
      .setColor(cases.length ? 0x5865f2 : 0x57f287)
      .setTitle(`Moderation History: ${target.tag}`)
      .setThumbnail(target.displayAvatarURL())
      .setDescription(cases.length ? `Showing ${cases.length} most recent case(s).` : "No moderation cases found.")
      .setTimestamp();

    for (const entry of cases) {
      const timestamp = Math.floor(new Date(entry.createdAt).getTime() / 1000);
      const reason = entry.reason.slice(0, 350);
      const details = entry.details ? `\n${entry.details.slice(0, 100)}` : "";
      embed.addFields({
        name: `#${entry._id.slice(-8).toUpperCase()} · ${ACTION_LABELS[entry.action] ?? entry.action} · <t:${timestamp}:f>`,
        value: `**Reason:** ${reason}${details}\n**Moderator:** <@${entry.moderatorId}>`,
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};