import { logger } from "../../utils/logger";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  GuildMember,
} from "discord.js";
import { Command } from "../../types/discord";
import { sendGuildLog } from "../../services/logging";
import { isRoleHierarchyValid } from "../../permissions/hierarchy";
import { addModerationCase } from "../../services/moderationCases";

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

function formatDuration(seconds: number): string {
  if (seconds < 60)   return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  if (seconds < 3600) return `${seconds / 60} minute${seconds / 60 !== 1 ? "s" : ""}`;
  if (seconds < 86400) return `${seconds / 3600} hour${seconds / 3600 !== 1 ? "s" : ""}`;
  if (seconds < 604800) return `${seconds / 86400} day${seconds / 86400 !== 1 ? "s" : ""}`;
  return `${seconds / 604800} week${seconds / 604800 !== 1 ? "s" : ""}`;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Temporarily timeout a member with optional DM notification.")
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
      opt.setName("reason").setDescription("Reason for the timeout").setMaxLength(512).setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName("silent").setDescription("Skip DM notification to the member").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  botPermissions:  [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const target     = interaction.options.getMember("user") as GuildMember | null;
    const durationSec = interaction.options.getInteger("duration", true);
    const durationMs  = durationSec * 1000;
    const reason      = interaction.options.getString("reason") ?? "No reason provided.";
    const silent      = interaction.options.getBoolean("silent") ?? false;
    const guildId     = interaction.guildId!;

    if (!target || typeof target === "string") {
      return interaction.reply({ content: "❌ Member not found.", ephemeral: true });
    }
    if (target.id === interaction.user.id) {
      return interaction.reply({ content: "❌ You cannot timeout yourself.", ephemeral: true });
    }
    if (target.id === interaction.client.user?.id) {
      return interaction.reply({ content: "❌ You cannot timeout me.", ephemeral: true });
    }
    if (target.id === interaction.guild?.ownerId) {
      return interaction.reply({ content: "❌ You cannot timeout the server owner.", ephemeral: true });
    }
    if (!target.moderatable) {
      return interaction.reply({ content: "❌ I cannot timeout this member — check my role hierarchy.", ephemeral: true });
    }

    const hierarchyOk = await isRoleHierarchyValid(
      interaction.client, guildId, interaction.user.id, target.id
    );
    if (!hierarchyOk) {
      return interaction.reply({ content: "❌ You cannot timeout this member — they have a higher or equal role.", ephemeral: true });
    }

    await interaction.deferReply();
    try {
      await target.timeout(durationMs, `${reason} | By ${interaction.user.tag}`);
      const until = new Date(Date.now() + durationMs);
      const durationLabel = formatDuration(durationSec);

      await addModerationCase({
        guildId,
        userId: target.id,
        moderatorId: interaction.user.id,
        action: "timeout",
        reason,
        details: `Duration: ${durationLabel} | Until ${until.toISOString()}`,
      });

      const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle("⏱️ Member Timed Out")
        .setThumbnail(target.user.displayAvatarURL())
        .addFields(
          { name: "👤 User",      value: `${target.user.tag} (<@${target.user.id}>)`, inline: false },
          { name: "⏳ Duration",  value: `**${durationLabel}** (expires <t:${Math.floor(until.getTime() / 1000)}:R>)`, inline: false },
          { name: "📝 Reason",   value: reason, inline: false },
          { name: "🛡️ Moderator", value: interaction.user.tag, inline: true },
          { name: "🔕 Silent",   value: silent ? "Yes" : "No", inline: true },
        )
        .setTimestamp();

      // DM the timed-out user
      if (!silent) {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle(`⏱️ You have been timed out in **${interaction.guild!.name}**`)
          .addFields(
            { name: "📝 Reason",    value: reason, inline: false },
            { name: "⏳ Duration",  value: durationLabel, inline: true },
            { name: "🔓 Expires",   value: `<t:${Math.floor(until.getTime() / 1000)}:R>`, inline: true },
          )
          .setFooter({ text: "Please review the server rules to avoid further moderation action." })
          .setTimestamp();
        target.user.send({ embeds: [dmEmbed] }).catch(() => null);
      }

      await interaction.editReply({ embeds: [embed] });
      await sendGuildLog(interaction.client, guildId, {
        title: "⏱️ Member Timed Out",
        color: 0xFEE75C,
        description: `**User:** ${target.user.tag}\n**Duration:** ${durationLabel}\n**Until:** <t:${Math.floor(until.getTime() / 1000)}:R>\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`,
      });
    } catch (err) {
      logger.error(`Failed to timeout user ${target.user.id} in guild ${guildId}`, err);
      await interaction.editReply("❌ Failed to timeout the member. Check my permissions.");
    }
  },
};

export default command;
