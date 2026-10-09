import { logger } from "../../utils/logger";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  GuildMember,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
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
  { name: "3 days",      value: 259200 },
  { name: "1 week",      value: 604800 },
];

function formatDuration(seconds: number): string {
  if (seconds < 60)     return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  if (seconds < 3600)   return `${seconds / 60} minute${seconds / 60 !== 1 ? "s" : ""}`;
  if (seconds < 86400)  return `${seconds / 3600} hour${seconds / 3600 !== 1 ? "s" : ""}`;
  if (seconds < 604800) return `${seconds / 86400} day${seconds / 86400 !== 1 ? "s" : ""}`;
  return `${seconds / 604800} week${seconds / 604800 !== 1 ? "s" : ""}`;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Temporarily mute a member with an interactive confirmation.")
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
      opt.setName("silent").setDescription("Skip DM notification to the member (default: false)").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  botPermissions:  [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const target      = interaction.options.getMember("user") as GuildMember | null;
    const durationSec = interaction.options.getInteger("duration", true);
    const durationMs  = durationSec * 1000;
    const reason      = interaction.options.getString("reason") ?? "No reason provided.";
    const silent      = interaction.options.getBoolean("silent") ?? false;
    const guildId     = interaction.guildId!;

    if (!target || typeof target === "string") {
      return interaction.reply({ content: "❌ Member not found in this server.", ephemeral: true });
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

    const until = new Date(Date.now() + durationMs);
    const durationLabel = formatDuration(durationSec);
    const alreadyTimedOut = target.communicationDisabledUntil && target.communicationDisabledUntil > new Date();

    const confirmEmbed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle("⚠️ Timeout Confirmation")
      .setThumbnail(target.user.displayAvatarURL())
      .setDescription(
        `You are about to **timeout** ${target.user.tag} for **${durationLabel}**.\n\n` +
        (alreadyTimedOut ? `> ⚠️ This member is already timed out — this will **extend or replace** the existing timeout.\n\n` : "") +
        `They will be unable to send messages, join voice channels, or add reactions until the timeout expires.`
      )
      .addFields(
        { name: "👤 Member",     value: `${target.user.tag} (<@${target.user.id}>)`, inline: false },
        { name: "⏳ Duration",   value: `**${durationLabel}** (expires <t:${Math.floor(until.getTime() / 1000)}:R>)`, inline: false },
        { name: "📝 Reason",     value: reason, inline: false },
        { name: "🔕 Silent",     value: silent ? "Yes" : "No", inline: true },
        { name: "🛡️ Moderator", value: interaction.user.tag, inline: true },
      )
      .setFooter({ text: "This confirmation expires in 30 seconds." })
      .setTimestamp();

    const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("timeout_confirm")
        .setLabel("Apply Timeout")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("⏱️"),
      new ButtonBuilder()
        .setCustomId("timeout_cancel")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("✖️"),
    );

    const prompt = await interaction.reply({
      embeds: [confirmEmbed],
      components: [confirmRow],
      ephemeral: true,
      fetchReply: true,
    });

    const collector = prompt.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 30_000,
      filter: (i) => i.user.id === interaction.user.id,
      max: 1,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "timeout_cancel") {
        await i.update({ content: "❌ Timeout cancelled.", embeds: [], components: [] });
        return;
      }

      await i.deferUpdate();
      try {
        await target.timeout(durationMs, `${reason} | By ${interaction.user.tag}`);

        await addModerationCase({
          guildId,
          userId: target.id,
          moderatorId: interaction.user.id,
          action: "timeout",
          reason,
          details: `Duration: ${durationLabel} | Until ${until.toISOString()}`,
        });

        if (!silent) {
          const dmEmbed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle(`⏱️ You have been timed out in **${interaction.guild!.name}**`)
            .addFields(
              { name: "📝 Reason",  value: reason, inline: false },
              { name: "⏳ Duration", value: durationLabel, inline: true },
              { name: "🔓 Expires", value: `<t:${Math.floor(until.getTime() / 1000)}:R>`, inline: true },
            )
            .setFooter({ text: "Please review the server rules to avoid further moderation action." })
            .setTimestamp();
          target.user.send({ embeds: [dmEmbed] }).catch(() => null);
        }

        const resultEmbed = new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle("⏱️ Member Timed Out")
          .setThumbnail(target.user.displayAvatarURL())
          .addFields(
            { name: "👤 Member",     value: `${target.user.tag} (<@${target.user.id}>)`, inline: false },
            { name: "⏳ Duration",   value: `**${durationLabel}** (expires <t:${Math.floor(until.getTime() / 1000)}:R>)`, inline: false },
            { name: "📝 Reason",     value: reason, inline: false },
            { name: "🛡️ Moderator", value: interaction.user.tag, inline: true },
            { name: "🔕 DM Sent",   value: !silent ? "✅ Yes" : "❌ No (silent)", inline: true },
          )
          .setTimestamp();

        // Offer quick-action buttons after applying
        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`timeout_remove_${target.id}`)
            .setLabel("Remove Timeout")
            .setStyle(ButtonStyle.Success)
            .setEmoji("🔓"),
          new ButtonBuilder()
            .setCustomId(`timeout_extend_${target.id}`)
            .setLabel("Extend (+1h)")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("⏩"),
        );

        const resultMsg = await i.editReply({ content: null, embeds: [resultEmbed], components: [actionRow] });

        await sendGuildLog(interaction.client, guildId, {
          title: "⏱️ Member Timed Out",
          color: 0xFEE75C,
          description: `**User:** ${target.user.tag} (<@${target.user.id}>)\n**Duration:** ${durationLabel}\n**Until:** <t:${Math.floor(until.getTime() / 1000)}:R>\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`,
        });

        // Handle post-timeout quick actions
        const actionCollector = resultMsg.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 60_000,
          filter: (bi) => bi.memberPermissions?.has(PermissionFlagsBits.ModerateMembers) === true,
        });

        actionCollector.on("collect", async (bi) => {
          if (bi.customId === `timeout_remove_${target.id}`) {
            await bi.deferUpdate();
            const refreshedMember = await interaction.guild!.members.fetch(target.id).catch(() => null);
            if (!refreshedMember) {
              await bi.followUp({ content: "❌ Member no longer found in the server.", ephemeral: true });
              return;
            }
            await refreshedMember.timeout(null, `Timeout removed by ${bi.user.tag}`).catch(() => null);
            await addModerationCase({
              guildId,
              userId: target.id,
              moderatorId: bi.user.id,
              action: "untimeout",
              reason: `Timeout removed via quick action by ${bi.user.tag}`,
            });
            await sendGuildLog(interaction.client, guildId, {
              title: "🔓 Timeout Removed",
              color: 0x57F287,
              description: `**User:** ${target.user.tag} (<@${target.user.id}>)\n**Removed by:** ${bi.user.tag}`,
            });
            actionCollector.stop();
            await bi.editReply({
              embeds: [resultEmbed.setColor(0x57F287).setTitle("🔓 Timeout Removed")],
              components: [],
            });
          } else if (bi.customId === `timeout_extend_${target.id}`) {
            await bi.deferUpdate();
            const extensionMs = 3600 * 1000;
            const newUntil = new Date(Date.now() + extensionMs);
            const refreshedMember = await interaction.guild!.members.fetch(target.id).catch(() => null);
            if (!refreshedMember) {
              await bi.followUp({ content: "❌ Member no longer found in the server.", ephemeral: true });
              return;
            }
            await refreshedMember.timeout(extensionMs, `Timeout extended +1h by ${bi.user.tag}`).catch(() => null);
            await bi.followUp({
              content: `⏩ Timeout extended. New expiry: <t:${Math.floor(newUntil.getTime() / 1000)}:R>`,
              ephemeral: true,
            });
          }
        });

        actionCollector.on("end", async () => {
          await interaction.editReply({ components: [] }).catch(() => null);
        });
      } catch (err) {
        logger.error(`Failed to timeout user ${target.user.id} in guild ${guildId}`, err);
        await i.editReply({ content: "❌ Failed to timeout the member. Check my permissions.", embeds: [], components: [] });
      }
    });

    collector.on("end", async (_, stopReason) => {
      if (stopReason === "time") {
        await interaction.editReply({ content: "⏰ Timeout confirmation timed out.", embeds: [], components: [] }).catch(() => null);
      }
    });
  },
};

export default command;
