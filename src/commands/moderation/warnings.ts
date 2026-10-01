import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { Command } from "../../types/discord";
import { getWarningsForUser } from "../../services/warnings";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("View warnings for a user.")
    .addUserOption(opt =>
      opt.setName("user").setDescription("The user whose warnings to view").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const target  = interaction.options.getUser("user", true);
    const guildId = interaction.guildId!;

    const warnings = await getWarningsForUser(guildId, target.id);

    const embed = new EmbedBuilder()
      .setColor(warnings.length > 0 ? 0xFEE75C : 0x5865F2)
      .setTitle(`Warnings for ${target.tag}`)
      .setThumbnail(target.displayAvatarURL())
      .setDescription(`**Total Warnings:** ${warnings.length}`)
      .setTimestamp();

    if (warnings.length > 0) {
      const fields = warnings.slice(-5).map((w, i) => ({
        name: `Warning ${warnings.length - 4 + i > 0 ? warnings.length - 4 + i : i + 1} • <t:${Math.floor(new Date(w.createdAt).getTime() / 1000)}:f>`,
        value: `**Reason:** ${w.reason.slice(0, 900)}\n**Moderator:** <@${w.moderatorId}>`,
      }));
      embed.addFields(fields.reverse()); // Show newest first
    }

    await interaction.reply({ embeds: [embed] });
  },
};
