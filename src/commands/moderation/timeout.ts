import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, GuildMember } from "discord.js";
import { Command } from "../../types/discord";
import { sendGuildLog } from "../../services/logging";

const DURATION_CHOICES = [
  { name: "60 seconds",  value: 60 },
  { name: "5 minutes",   value: 300 },
  { name: "10 minutes",  value: 600 },
  { name: "30 minutes",  value: 1800 },
  { name: "1 hour",      value: 3600 },
  { name: "6 hours",     value: 21600 },
  { name: "12 hours",    value: 43200 },
  { name: "1 day",       value: 86400 },
  { name: "1 week",      value: 604800 },
];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Temporarily timeout a member.")
    .addUserOption(opt =>
      opt.setName("user").setDescription("The member to timeout").setRequired(true)
    )
    .addIntegerOption(opt =>
      opt
        .setName("duration")
        .setDescription("Timeout duration")
        .setRequired(true)
        .addChoices(...DURATION_CHOICES)
    )
    .addStringOption(opt =>
      opt.setName("reason").setDescription("Reason for the timeout").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  botPermissions:  [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const target     = interaction.options.getMember("user") as GuildMember | null;
    const durationMs = (interaction.options.getInteger("duration", true)) * 1000;
    const reason     = interaction.options.getString("reason") ?? "No reason provided.";
    const guildId    = interaction.guildId!;

    if (!target || typeof target === "string") {
      return interaction.reply({ content: "❌ Member not found.", ephemeral: true });
    }
    if (!target.moderatable) {
      return interaction.reply({ content: "❌ I cannot timeout this member.", ephemeral: true });
    }

    await interaction.deferReply();
    try {
      await target.timeout(durationMs, `${reason} | By ${interaction.user.tag}`);
      const until = new Date(Date.now() + durationMs);

      const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle("⏱️ Member Timed Out")
        .setThumbnail(target.user.displayAvatarURL())
        .addFields(
          { name: "User",      value: `${target.user.tag} (<@${target.user.id}>)` },
          { name: "Duration",  value: `Until <t:${Math.floor(until.getTime() / 1000)}:R>` },
          { name: "Reason",    value: reason },
          { name: "Moderator", value: interaction.user.tag, inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      await sendGuildLog(interaction.client, guildId, {
        title: "⏱️ Member Timed Out",
        color: 0xFEE75C,
        description: `**User:** ${target.user.tag}\n**Until:** <t:${Math.floor(until.getTime() / 1000)}:R>\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`,
      });
    } catch {
      await interaction.editReply("❌ Failed to timeout the member.");
    }
  },
};
