import { logger } from "../../utils/logger";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { Command } from "../../types/discord";
import { addWarning, getWarningsForUser, removeWarning } from "../../services/warnings";
import { isRoleHierarchyValid } from "../../permissions/hierarchy";
import { sendGuildLog } from "../../services/logging";
import { checkEscalation } from "../../services/escalation";

const SEVERITY_CONFIG: Record<string, { color: number; label: string; emoji: string }> = {
  low:    { color: 0xFEE75C, label: "Low",    emoji: "🟡" },
  medium: { color: 0xFFA500, label: "Medium",  emoji: "🟠" },
  high:   { color: 0xED4245, label: "High",    emoji: "🔴" },
};

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Issue a formal warning to a member.")
    .addUserOption(opt =>
      opt.setName("user").setDescription("The member to warn").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("reason").setDescription("Reason for the warning").setRequired(true).setMaxLength(512)
    )
    .addStringOption(opt =>
      opt
        .setName("severity")
        .setDescription("Warning severity level (default: low)")
        .setRequired(false)
        .addChoices(
          { name: "🟡 Low — Minor infraction", value: "low" },
          { name: "🟠 Medium — Repeat or moderate offense", value: "medium" },
          { name: "🔴 High — Serious rule violation", value: "high" },
        )
    )
    .addBooleanOption(opt =>
      opt.setName("silent").setDescription("Send warning silently without DM-ing the user (default: false)").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const target   = interaction.options.getUser("user", true);
    const reason   = interaction.options.getString("reason", true);
    const severity = interaction.options.getString("severity") ?? "low";
    const silent   = interaction.options.getBoolean("silent") ?? false;
    const guildId  = interaction.guildId!;

    if (target.id === interaction.user.id) {
      return interaction.reply({ content: "❌ You cannot warn yourself.", ephemeral: true });
    }
    if (target.bot) {
      return interaction.reply({ content: "❌ You cannot warn a bot.", ephemeral: true });
    }
    if (target.id === interaction.guild?.ownerId) {
      return interaction.reply({ content: "❌ You cannot warn the server owner.", ephemeral: true });
    }

    const hierarchyOk = await isRoleHierarchyValid(
      interaction.client, guildId, interaction.user.id, target.id
    );
    if (!hierarchyOk) {
      return interaction.reply({
        content: "❌ You cannot warn this user — they have a higher or equal role.",
        ephemeral: true,
      });
    }

    await interaction.deferReply();
    try {
      const warning = await addWarning(guildId, target.id, interaction.user.id, reason);
      const warnings = await getWarningsForUser(guildId, target.id);
      const totalWarnings = warnings.length;
      const sev = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.low;

      const embed = new EmbedBuilder()
        .setColor(sev.color)
        .setTitle(`${sev.emoji} Warning Issued — ${sev.label} Severity`)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: "👤 User",           value: `${target.tag} (<@${target.id}>)`, inline: false },
          { name: "📝 Reason",         value: reason, inline: false },
          { name: "⚖️ Severity",       value: `${sev.emoji} ${sev.label}`, inline: true },
          { name: "🛡️ Moderator",     value: `${interaction.user.tag}`, inline: true },
          { name: "📊 Total Warnings", value: `**${totalWarnings}** warning(s) on record`, inline: true },
        )
        .setFooter({ text: `Warning ID: ${String((warning as any)._id)}` })
        .setTimestamp();

      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`warn_hist_${target.id}`)
          .setLabel("Warning History")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("📜"),
        new ButtonBuilder()
          .setCustomId(`warn_undo_${String((warning as any)._id)}`)
          .setLabel("Undo This Warn")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("↩️"),
      );

      const sent = await interaction.editReply({ embeds: [embed], components: [buttons] });

      // DM the warned user (unless silent mode)
      if (!silent) {
        const dmEmbed = new EmbedBuilder()
          .setColor(sev.color)
          .setTitle(`${sev.emoji} You received a warning in **${interaction.guild!.name}**`)
          .addFields(
            { name: "📝 Reason",   value: reason, inline: false },
            { name: "⚖️ Severity", value: `${sev.emoji} ${sev.label}`, inline: true },
            { name: "📊 Total Warnings", value: `${totalWarnings}`, inline: true },
          )
          .setFooter({ text: "Please review the server rules to avoid further action." })
          .setTimestamp();
        target.send({ embeds: [dmEmbed] }).catch(() => null); // ignore if DMs are closed
      }

      const collector = sent.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60_000,
        filter: (i) => i.memberPermissions?.has(PermissionFlagsBits.ModerateMembers) === true,
      });

      collector.on("collect", async (i) => {
        if (i.customId.startsWith("warn_hist_")) {
          const userWarns = await getWarningsForUser(guildId, target.id);
          if (userWarns.length === 0) {
            await i.reply({ content: `✅ <@${target.id}> has zero warnings on record.`, ephemeral: true });
          } else {
            const historyText = userWarns
              .slice(0, 10)
              .map((w, idx) => `**${idx + 1}.** \`${w.reason}\` — Mod: <@${w.moderatorId}> (<t:${Math.floor(new Date(w.createdAt).getTime() / 1000)}:R>)`)
              .join("\n");
            await i.reply({ content: `📜 **Warning History for <@${target.id}> (${userWarns.length}):**\n${historyText}`, ephemeral: true });
          }
        } else if (i.customId.startsWith("warn_undo_")) {
          const warnId = i.customId.replace("warn_undo_", "");
          const removed = await removeWarning(warnId);
          if (removed) {
            await i.reply({ content: `↩️ Warning \`${warnId}\` has been removed. Undone by <@${i.user.id}>.`, ephemeral: false });
            // Disable the undo button after use
            buttons.components[1].setDisabled(true).setLabel("Warn Undone");
            await interaction.editReply({ embeds: [embed], components: [buttons] }).catch(() => null);
          } else {
            await i.reply({ content: "❌ Could not find that warning — it may have already been removed.", ephemeral: true });
          }
        }
      });

      collector.on("end", async () => {
        await interaction.editReply({ components: [] }).catch(() => null);
      });

      await sendGuildLog(interaction.client, guildId, {
        title: `${sev.emoji} Warning Issued — ${sev.label}`,
        color: sev.color,
        description: `**User:** ${target.tag} (<@${target.id}>)\n**Reason:** ${reason}\n**Severity:** ${sev.label}\n**Moderator:** ${interaction.user.tag}\n**Total Warnings:** ${totalWarnings}`,
      });

      // Check escalation thresholds
      const esc = await checkEscalation(interaction.client, guildId, target.id, interaction.user.id);
      if (esc.triggered) {
        await interaction.followUp({
          content: `⚡ **Auto-escalation triggered** — reached **${esc.atWarnings}** warnings → **${esc.action}** applied automatically.`,
        });
      }
    } catch (err) {
      logger.error(`Failed to issue warning for user ${target.id} in guild ${guildId}`, err);
      await interaction.editReply("❌ Failed to issue the warning. Please try again.");
    }
  },
};

export default command;
