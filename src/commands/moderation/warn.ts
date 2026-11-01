import { auditReason } from "../../utils/safeText";
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
  MessageFlags,
} from "discord.js";
import { Command } from "../../types/discord";
import { addWarning, getWarningsForUser, revokeWarning } from "../../services/warnings";
import { isRoleHierarchyValid } from "../../permissions/hierarchy";
import { sendGuildLog } from "../../services/logging";
import { checkEscalation } from "../../services/escalation";
import { combineReason, handleReasonAutocomplete } from "../../utils/moderationPresets";
import { UNDO_WINDOW_MS, buildUndoButton, canPressUndo, isUndoWindowOpen } from "../../services/moderationUndo";
import { caseLinkButton, modLogRow } from "../../services/modLogLinks";

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
      opt
        .setName("preset")
        .setDescription("Quick rule violation preset")
        .setRequired(false)
        .addChoices(
          { name: "📢 Spamming or text flooding", value: "Spamming or text flooding" },
          { name: "🤬 Harassment or toxic behavior", value: "Harassment or toxic behavior" },
          { name: "🔞 Inappropriate / NSFW content", value: "Inappropriate or NSFW content" },
          { name: "🔗 Unauthorized advertising or promo links", value: "Unauthorized advertising or promo links" },
          { name: "🛑 Disrespecting staff or rule evasion", value: "Disrespecting staff or rule evasion" },
        )
    )
    .addStringOption(opt =>
      opt.setName("reason").setDescription("Reason: pick a preset or type your own").setAutocomplete(true).setRequired(false).setMaxLength(512)
    )
    .addAttachmentOption(opt =>
      opt.setName("proof").setDescription("Optional screenshot or proof attachment").setRequired(false)
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

  autocomplete: handleReasonAutocomplete,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const target       = interaction.options.getUser("user", true);
    const preset       = interaction.options.getString("preset");
    const customReason = interaction.options.getString("reason");
    const severity     = interaction.options.getString("severity") ?? "low";
    const silent       = interaction.options.getBoolean("silent") ?? false;
    const proof        = interaction.options.getAttachment("proof");
    const guildId      = interaction.guildId!;

    const reason = combineReason(preset, customReason) ?? "No reason provided.";

    if (target.id === interaction.user.id) {
      return interaction.reply({ content: "❌ You cannot warn yourself.", flags: MessageFlags.Ephemeral });
    }
    if (target.bot) {
      return interaction.reply({ content: "❌ You cannot warn a bot.", flags: MessageFlags.Ephemeral });
    }
    if (target.id === interaction.guild?.ownerId) {
      return interaction.reply({ content: "❌ You cannot warn the server owner.", flags: MessageFlags.Ephemeral });
    }

    const hierarchyOk = await isRoleHierarchyValid(
      interaction.client, guildId, interaction.user.id, target.id
    );
    if (!hierarchyOk) {
      return interaction.reply({
        content: "❌ You cannot warn this user — they have a higher or equal role.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();
    try {
      const warning = await addWarning(guildId, target.id, interaction.user.id, reason, proof?.url ?? null);
      const warnId = String(warning._id);
      const issuedAt = Date.now();
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
          ...(proof ? [{ name: "📎 Proof", value: `[${proof.name}](${proof.url})`, inline: false }] : []),
        )
        .setFooter({ text: `Warning ID: ${warnId}` })
        .setTimestamp();

      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`warn_hist_${target.id}`)
          .setLabel("Warning History")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("📜"),
        buildUndoButton(`warn_undo_${warnId}`),
        new ButtonBuilder()
          .setCustomId(`warn_timeout_${target.id}`)
          .setLabel("Timeout (10m)")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("⚡"),
        caseLinkButton(guildId, warnId),
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
        time: UNDO_WINDOW_MS,
      });

      collector.on("collect", async (i) => {
        if (!canPressUndo("warn", i.memberPermissions)) {
          await i.reply({ content: "❌ Only moderators can use these buttons.", flags: MessageFlags.Ephemeral });
          return;
        }
        if (i.customId.startsWith("warn_hist_")) {
          const userWarns = await getWarningsForUser(guildId, target.id);
          if (userWarns.length === 0) {
            await i.reply({ content: `✅ <@${target.id}> has zero warnings on record.`, flags: MessageFlags.Ephemeral });
          } else {
            const historyText = userWarns
              .slice(0, 10)
              .map((w, idx) => `**${idx + 1}.** \`${w.reason}\` — Mod: <@${w.moderatorId}> (<t:${Math.floor(new Date(w.createdAt).getTime() / 1000)}:R>)`)
              .join("\n");
            await i.reply({ content: `📜 **Warning History for <@${target.id}> (${userWarns.length}):**\n${historyText}`, flags: MessageFlags.Ephemeral });
          }
        } else if (i.customId.startsWith("warn_undo_")) {
          if (!isUndoWindowOpen(issuedAt, Date.now())) {
            await i.reply({ content: "⏱️ The 5-minute undo window has passed. Use `/clearwarnings` or `/infractions` instead.", flags: MessageFlags.Ephemeral });
            return;
          }
          const hierarchyOk = await isRoleHierarchyValid(interaction.client, guildId, i.user.id, target.id);
          if (!hierarchyOk) {
            await i.reply({ content: "❌ You cannot modify warnings for this user due to role hierarchy.", flags: MessageFlags.Ephemeral });
            return;
          }
          const revoked = await revokeWarning(guildId, warnId, i.user.id);
          if (revoked) {
            await i.reply({ content: `↩️ Warning \`${warnId}\` was revoked by <@${i.user.id}>. It no longer counts toward totals or escalation.` });
            buttons.components[1] = buildUndoButton(`warn_undo_${warnId}`, "done");
            embed.setTitle(`↩️ Warning Revoked — ${sev.label} Severity`).setColor(0x95A5A6);
            await interaction.editReply({ embeds: [embed], components: [buttons] }).catch(() => null);
            await sendGuildLog(interaction.client, guildId, {
              title: "↩️ Warning Revoked",
              color: 0x95A5A6,
              description: `**User:** ${target.tag} (<@${target.id}>)\n**Warning ID:** \`${warnId}\`\n**Original reason:** ${reason}\n**Revoked by:** ${i.user.tag}`,
            }, "modActions", [modLogRow(guildId, target.id, warnId)]);
          } else {
            await i.reply({ content: "❌ Could not find that warning — it may have already been revoked.", flags: MessageFlags.Ephemeral });
          }
        } else if (i.customId.startsWith("warn_timeout_")) {
          const hierarchyOk = await isRoleHierarchyValid(interaction.client, guildId, i.user.id, target.id);
          if (!hierarchyOk) {
            await i.reply({ content: "❌ You cannot timeout this user due to role hierarchy.", flags: MessageFlags.Ephemeral });
            return;
          }
          const member = await interaction.guild?.members.fetch(target.id).catch(() => null);
          if (!member || !member.moderatable) {
            await i.reply({ content: "❌ Cannot timeout member — they may have left or have higher roles than the bot.", flags: MessageFlags.Ephemeral });
            return;
          }
          await member.timeout(10 * 60 * 1000, auditReason(`Quick escalation from warn: ${reason} (by ${i.user.tag})`));
          buttons.components[2].setDisabled(true).setLabel("Timed Out (10m)");
          await interaction.editReply({ embeds: [embed], components: [buttons] }).catch(() => null);
          await i.reply({ content: `⚡ **<@${target.id}>** has been placed in a **10-minute timeout** by <@${i.user.id}>.` });
        }
      });

      collector.on("end", async () => {
        await interaction.editReply({ components: [] }).catch(() => null);
      });

      await sendGuildLog(interaction.client, guildId, {
        title: `${sev.emoji} Warning Issued — ${sev.label}`,
        color: sev.color,
        description: `**User:** ${target.tag} (<@${target.id}>)\n**Reason:** ${reason}\n**Severity:** ${sev.label}\n**Moderator:** ${interaction.user.tag}\n**Total Warnings:** ${totalWarnings}${proof ? `\n**Proof:** ${proof.url}` : ""}`,
      }, "modActions", [modLogRow(guildId, target.id, warnId)]);

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
