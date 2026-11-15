import { guardCollect } from "../../utils/collectorGuard";
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
  MessageFlags,
} from "discord.js";
import { Command } from "../../types/discord";
import { sendGuildLog } from "../../services/logging";
import { isRoleHierarchyValid } from "../../permissions/hierarchy";
import { hierarchyRefusalText } from "../../permissions/hierarchyExplain";
import { addModerationCase } from "../../services/moderationCases";
import { combineReason, handleReasonAutocomplete } from "../../utils/moderationPresets";
import { buildUndoButton } from "../../services/moderationUndo";
import { caseLinkButton, modLogRow } from "../../services/modLogLinks";
import { buildDurationSuggestions } from "../../utils/moderationPresets";
import { formatDurationLong } from "../../utils/duration";
import { auditReason } from "../../utils/safeText";
import type { AutocompleteInteraction } from "discord.js";
import { CUSTOM_DURATION_PRESETS, DURATION_CHOICES, MAX_TIMEOUT_SECONDS, formatDuration, resolveTimeoutSeconds } from "./timeout/logic";
import { softFail } from "../../utils/softFail";
import { dmOutcome, dmSentLabel } from "../../services/dmNotice";
import { attachTimeoutActions } from "./timeout/actions";
import { replyEphemeralPrompt } from "./lib/prompt";
export { MAX_TIMEOUT_SECONDS, resolveTimeoutSeconds, extendedTimeout } from "./timeout/logic";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Temporarily stop a member from chatting, reacting or joining voice (up to 28 days).")
    .addUserOption(opt =>
      opt.setName("user").setDescription("The member to timeout").setRequired(true)
    )
    .addIntegerOption(opt =>
      opt
        .setName("duration")
        .setDescription("Timeout length preset (or type any length in custom_duration)")
        .setRequired(false)
        .addChoices(...DURATION_CHOICES)
    )
    .addStringOption(opt =>
      opt
        .setName("preset")
        .setDescription("Common infraction reason preset")
        .setRequired(false)
        .addChoices(
          { name: "📢 Excessive Spamming / Chat Flooding", value: "Excessive Spamming / Chat Flooding" },
          { name: "🤬 Harassment, Hate Speech, or Toxicity", value: "Harassment, Hate Speech, or Toxicity" },
          { name: "🔞 Inappropriate / NSFW Behavior", value: "Inappropriate or NSFW Behavior" },
          { name: "🛑 Argumentative / Refusing Staff Direction", value: "Argumentative / Refusing Staff Direction" },
          { name: "🔗 Self-Promotion / Suspicious Links", value: "Unauthorized Self-Promotion" },
        )
    )
    .addStringOption(opt =>
      opt.setName("reason").setDescription("Reason: pick a preset or type your own").setAutocomplete(true).setMaxLength(512).setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName("silent").setDescription("Don't DM the member about the timeout (default: they get a DM)").setRequired(false)
    )
    .addAttachmentOption(opt =>
      opt.setName("proof").setDescription("Optional screenshot or proof, stored with the case").setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName("custom_duration").setDescription("Any length up to 28 days, e.g. 90m, 1d 12h, 2 weeks (overrides duration)").setAutocomplete(true).setMaxLength(64).setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  botPermissions:  [PermissionFlagsBits.ModerateMembers],

  autocomplete: async (interaction: AutocompleteInteraction) => {
    const focused = interaction.options.getFocused(true);
    if (focused.name === "custom_duration") {
      await interaction.respond(buildDurationSuggestions(String(focused.value ?? ""), CUSTOM_DURATION_PRESETS, { minSeconds: 60, maxSeconds: MAX_TIMEOUT_SECONDS }));
      return;
    }
    await handleReasonAutocomplete(interaction);
  },

  execute: async (interaction: ChatInputCommandInteraction) => {
    let target = interaction.options.getMember("user") as GuildMember | null;
    if (!target) {
      const user = interaction.options.getUser("user");
      if (user && interaction.guild) {
        target = await interaction.guild.members.fetch(user.id).catch(() => null);
      }
    }
    const resolved     = resolveTimeoutSeconds(interaction.options.getInteger("duration"), interaction.options.getString("custom_duration"));
    if (!resolved.ok) {
      return interaction.reply({ content: resolved.error, flags: MessageFlags.Ephemeral });
    }
    const durationSec  = resolved.seconds;
    const durationMs   = durationSec * 1000;
    const preset       = interaction.options.getString("preset");
    const customReason = interaction.options.getString("reason");
    const reason       = combineReason(preset, customReason) ?? "No reason provided.";
    const proof        = interaction.options.getAttachment("proof");
    const silent       = interaction.options.getBoolean("silent") ?? false;
    const guildId      = interaction.guildId!;

    if (!target || typeof target === "string") {
      return interaction.reply({ content: "❌ Member not found in this server.", flags: MessageFlags.Ephemeral });
    }
    if (target.id === interaction.user.id) {
      return interaction.reply({ content: "❌ You cannot timeout yourself.", flags: MessageFlags.Ephemeral });
    }
    if (target.id === interaction.client.user?.id) {
      return interaction.reply({ content: "❌ You cannot timeout me.", flags: MessageFlags.Ephemeral });
    }
    if (target.id === interaction.guild?.ownerId) {
      return interaction.reply({ content: "❌ You cannot timeout the server owner.", flags: MessageFlags.Ephemeral });
    }
    if (!target.moderatable) {
      return interaction.reply({ content: await hierarchyRefusalText(interaction.guild!, "bot", interaction.client.user.id, target.id, "time out", target.user.tag), flags: MessageFlags.Ephemeral });
    }

    const hierarchyOk = await isRoleHierarchyValid(
      interaction.client, guildId, interaction.user.id, target.id
    );
    if (!hierarchyOk) {
      return interaction.reply({ content: await hierarchyRefusalText(interaction.guild!, "you", interaction.user.id, target.id, "time out", target.user.tag), flags: MessageFlags.Ephemeral });
    }

    let until = new Date(Date.now() + durationMs);
    const durationLabel = DURATION_CHOICES.some(c => c.value === durationSec) ? formatDuration(durationSec) : formatDurationLong(durationSec);
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
        ...(proof ? [{ name: "📎 Proof", value: `[${proof.name}](${proof.url})`, inline: false }] : []),
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

    const prompt = await replyEphemeralPrompt(interaction, { embeds: [confirmEmbed], components: [confirmRow] });

    const collector = prompt.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 30_000,
      filter: (i) => i.user.id === interaction.user.id,
      max: 1,
    });

    collector.on("collect", (i) => guardCollect("timeout", i, async () => {
      if (i.customId === "timeout_cancel") {
        await i.update({ content: "❌ Timeout cancelled.", embeds: [], components: [] });
        return;
      }

      await i.deferUpdate();
      try {
        // Roles can change during the 30-second confirmation: check again.
        const stillOk = await isRoleHierarchyValid(interaction.client, guildId, interaction.user.id, target.id);
        const fresh = await interaction.guild!.members.fetch(target.id).catch(() => null);
        if (!stillOk || !fresh || !fresh.moderatable) {
          await i.editReply({ content: !fresh ? "❌ That member left the server while you were confirming. Nothing was done." : "❌ The member's roles changed while you were confirming, and they can no longer be timed out. Nothing was done.", embeds: [], components: [] });
          return;
        }
        await fresh.timeout(durationMs, auditReason(`${reason} | By ${interaction.user.tag}`));
        // The timeout runs from now, not from when the command was typed.
        until = new Date(Date.now() + durationMs);

        const appliedAt = Date.now();
        const caseId = await addModerationCase({
          guildId,
          userId: target.id,
          moderatorId: interaction.user.id,
          action: "timeout",
          reason,
          details: `Duration: ${durationLabel} | Until ${until.toISOString()}`,
          proofUrl: proof?.url ?? null,
          targetTag: target.user.tag,
          modTag: interaction.user.tag,
          durationMs,
        });

        let delivered = false;
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
          delivered = (await target.user.send({ embeds: [dmEmbed] }).catch(softFail(`Timeout notice DM to ${target.id}`, "debug"))) !== null;
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
            { name: "🔕 DM Sent",   value: dmSentLabel(dmOutcome(silent, delivered)), inline: true },
            ...(proof ? [{ name: "📎 Proof", value: `[${proof.name}](${proof.url})`, inline: false }] : []),
          )
          .setFooter(caseId ? { text: `Case ID: ${caseId}` } : null)
          .setTimestamp();

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          buildUndoButton(`timeout_undo_${target.id}`),
          new ButtonBuilder()
            .setCustomId(`timeout_extend_${target.id}`)
            .setLabel("Extend (+1h)")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("⏩"),
          new ButtonBuilder()
            .setCustomId(`timeout_cases_${target.id}`)
            .setLabel("Case History")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("📜"),
          ...(caseId ? [caseLinkButton(guildId, caseId)] : []),
        );

        const resultMsg = await i.editReply({ content: null, embeds: [resultEmbed], components: [actionRow] });

        await sendGuildLog(interaction.client, guildId, {
          title: "⏱️ Member Timed Out",
          color: 0xFEE75C,
          description: `**User:** ${target.user.tag} (<@${target.user.id}>)\n**Duration:** ${durationLabel}\n**Until:** <t:${Math.floor(until.getTime() / 1000)}:R>\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}${proof ? `\n**Proof:** ${proof.url}` : ""}`,
        }, "modActions", [modLogRow(guildId, target.id, caseId)]);

        attachTimeoutActions({ interaction, resultMsg, target, guildId, caseId, appliedAt, resultEmbed });
      } catch (err) {
        logger.error(`Failed to timeout user ${target.user.id} in guild ${guildId}`, err);
        await i.editReply({ content: "❌ Failed to timeout the member. Check my permissions.", embeds: [], components: [] });
      }
    }));

    collector.on("end", async (_, stopReason) => {
      if (stopReason === "time") {
        await interaction.editReply({ content: "⏰ Timeout confirmation timed out.", embeds: [], components: [] }).catch(() => null);
      }
    });
  },
};

export default command;
