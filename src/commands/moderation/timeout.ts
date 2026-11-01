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
import { addModerationCase, revokeModerationCase } from "../../services/moderationCases";
import { combineReason, handleReasonAutocomplete } from "../../utils/moderationPresets";
import { UNDO_WINDOW_MS, buildUndoButton, canPressUndo, isUndoWindowOpen } from "../../services/moderationUndo";
import { caseLinkButton, modLogRow } from "../../services/modLogLinks";
import { ModerationCaseModel } from "../../database/mongo";
import { buildDurationSuggestions } from "../../utils/moderationPresets";
import { formatDurationLong, parseFriendlyDuration } from "../../utils/duration";
import { auditReason, truncate } from "../../utils/safeText";
import type { AutocompleteInteraction } from "discord.js";

/** Discord's longest timeout: 28 days. */
export const MAX_TIMEOUT_SECONDS = 28 * 86_400;

/**
 * The timeout length from `/timeout`: the `custom_duration` text when given
 * (e.g. "90m", "1d 12h", "2 weeks"), otherwise the `duration` choice. One of
 * the two is required; the result is 1 minute to 28 days.
 */
export function resolveTimeoutSeconds(choice: number | null, custom: string | null): { ok: true; seconds: number } | { ok: false; error: string } {
  const text = custom?.trim() ?? "";
  if (text) {
    const seconds = parseFriendlyDuration(text);
    if (seconds === null) return { ok: false, error: "❌ I couldn't read that duration. Try `90m`, `2h`, `1d 12h` or `2 weeks`." };
    if (seconds < 60 || seconds > MAX_TIMEOUT_SECONDS) return { ok: false, error: "❌ A timeout must last between 1 minute and 28 days (Discord's limit)." };
    return { ok: true, seconds };
  }
  if (choice === null || !Number.isInteger(choice) || choice <= 0) {
    return { ok: false, error: "❌ Pick a `duration`, or type one in `custom_duration` (e.g. `90m`, `1d 12h`)." };
  }
  return { ok: true, seconds: Math.min(choice, MAX_TIMEOUT_SECONDS) };
}

const CUSTOM_DURATION_PRESETS = [
  { name: "15 minutes", value: "15m" },
  { name: "2 hours", value: "2h" },
  { name: "1 day 12 hours", value: "1d 12h" },
  { name: "2 weeks", value: "2w" },
  { name: "28 days (maximum)", value: "28d" },
] as const;

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
        .setDescription("Timeout duration (or type any length in custom_duration)")
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
      opt.setName("silent").setDescription("Skip DM notification to the member (default: false)").setRequired(false)
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
      return interaction.reply({ content: "❌ I cannot timeout this member — check my role hierarchy.", flags: MessageFlags.Ephemeral });
    }

    const hierarchyOk = await isRoleHierarchyValid(
      interaction.client, guildId, interaction.user.id, target.id
    );
    if (!hierarchyOk) {
      return interaction.reply({ content: "❌ You cannot timeout this member — they have a higher or equal role.", flags: MessageFlags.Ephemeral });
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

    const prompt = await interaction.reply({
      embeds: [confirmEmbed],
      components: [confirmRow],
      flags: MessageFlags.Ephemeral,
      fetchReply: true,
    });

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
            ...(proof ? [{ name: "📎 Proof", value: `[${proof.name}](${proof.url})`, inline: false }] : []),
          )
          .setFooter(caseId ? { text: `Case ID: ${caseId}` } : null)
          .setTimestamp();

        // Offer quick-action buttons after applying
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
          description: `**User:** ${target.user.tag} (<@${target.user.id}>)\n**Duration:** ${durationLabel}\n**Until:** <t:${Math.floor(until.getTime() / 1000)}:R>\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`,
        }, "modActions", [modLogRow(guildId, target.id, caseId)]);

        // Handle post-timeout quick actions
        const actionCollector = resultMsg.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: UNDO_WINDOW_MS,
        });

        actionCollector.on("collect", async (bi) => {
          if (!canPressUndo("timeout", bi.memberPermissions)) {
            await bi.reply({ content: "❌ Only moderators can use these buttons.", flags: MessageFlags.Ephemeral });
            return;
          }
          const hierarchyOk = await isRoleHierarchyValid(
            interaction.client,
            guildId,
            bi.user.id,
            target.id,
          );
          if (!hierarchyOk) {
            await bi.reply({
              content: "❌ You cannot change this timeout because the member has an equal or higher role.",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          if (bi.customId === `timeout_undo_${target.id}`) {
            if (!isUndoWindowOpen(appliedAt, Date.now())) {
              await bi.reply({ content: "⏱️ The 5-minute undo window has passed. Use `/removetimeout` instead.", flags: MessageFlags.Ephemeral });
              return;
            }
            await bi.deferUpdate();
            const refreshedMember = await interaction.guild!.members.fetch(target.id).catch(() => null);
            if (!refreshedMember) {
              await bi.followUp({ content: "❌ Member no longer found in the server.", flags: MessageFlags.Ephemeral });
              return;
            }
            try {
              await refreshedMember.timeout(null, auditReason(`Timeout undone by ${bi.user.tag}`));
            } catch (undoErr) {
              logger.warn(`Undo timeout failed for ${target.id} in ${guildId}`, undoErr);
              await bi.followUp({ content: "❌ Could not lift the timeout. Check my permissions.", flags: MessageFlags.Ephemeral });
              return;
            }
            const revoked = caseId ? await revokeModerationCase(guildId, caseId, bi.user.id) : false;
            await sendGuildLog(interaction.client, guildId, {
              title: "↩️ Timeout Undone",
              color: 0x57F287,
              description: `**User:** ${target.user.tag} (<@${target.user.id}>)\n**Undone by:** ${bi.user.tag}${caseId ? `\n**Case:** \`${caseId}\`${revoked ? " (marked revoked)" : ""}` : ""}`,
            }, "modActions", caseId ? [modLogRow(guildId, target.id, caseId)] : undefined);
            actionCollector.stop("undone");
            await bi.editReply({
              embeds: [resultEmbed.setColor(0x57F287).setTitle("↩️ Timeout Undone")],
              components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buildUndoButton(`timeout_undo_${target.id}`, "done"))],
            });
          } else if (bi.customId === `timeout_extend_${target.id}`) {
            await bi.deferUpdate();
            const refreshedMember = await interaction.guild!.members.fetch(target.id).catch(() => null);
            if (!refreshedMember) {
              await bi.followUp({ content: "❌ Member no longer found in the server.", flags: MessageFlags.Ephemeral });
              return;
            }
            const currentEnd = (refreshedMember.communicationDisabledUntil && refreshedMember.communicationDisabledUntil > new Date())
              ? refreshedMember.communicationDisabledUntil.getTime()
              : Date.now();
            const maxAllowed = Date.now() + 28 * 86400_000;
            const newExpiryMs = Math.min(currentEnd + 3600_000, maxAllowed);
            const durationMs = Math.max(newExpiryMs - Date.now(), 60_000);
            const newUntil = new Date(newExpiryMs);

            const extended = await refreshedMember.timeout(durationMs, auditReason(`Timeout extended +1h by ${bi.user.tag}`)).then(() => true).catch(() => false);
            if (!extended) {
              // Don't record or log an extension that did not happen.
              await bi.followUp({ content: "❌ Could not extend the timeout. Check my permissions and role position.", flags: MessageFlags.Ephemeral });
              return;
            }
            const extendCaseId = await addModerationCase({
              guildId,
              userId: target.id,
              moderatorId: bi.user.id,
              action: "timeout",
              reason: `Timeout extended by +1h via quick action by ${bi.user.tag}`,
              details: `Extended until ${newUntil.toISOString()}`,
            });
            await sendGuildLog(interaction.client, guildId, {
              title: "⏱️ Timeout Extended (+1h)",
              color: 0xFEE75C,
              description: `**User:** ${target.user.tag} (<@${target.user.id}>)\n**Extended by:** ${bi.user.tag}\n**New Expiry:** <t:${Math.floor(newUntil.getTime() / 1000)}:R>`,
            }, "modActions", [modLogRow(guildId, target.id, extendCaseId)]);
            await bi.followUp({
              content: `⏩ Timeout extended. New expiry: <t:${Math.floor(newUntil.getTime() / 1000)}:R>`,
              flags: MessageFlags.Ephemeral,
            });
          } else if (bi.customId === `timeout_cases_${target.id}`) {
            const cases = await ModerationCaseModel.find({ guildId, userId: target.id })
              .sort({ createdAt: -1 })
              .limit(5)
              .lean();
            if (cases.length === 0) {
              await bi.reply({ content: `✅ <@${target.id}> has no prior moderation cases recorded.`, flags: MessageFlags.Ephemeral });
            } else {
              const lines = cases.map((c, idx) =>
                `**${idx + 1}.** \`${c.action.toUpperCase()}\`${c.revoked ? " *(revoked)*" : ""} — ${truncate(String(c.reason ?? ""), 250)} (<t:${Math.floor(new Date(c.createdAt).getTime() / 1000)}:R>)`
              );
              await bi.reply({
                content: `📜 **Recent Moderation Cases for <@${target.id}> (${cases.length}):**\n${lines.join("\n")}`,
                flags: MessageFlags.Ephemeral,
              });
            }
          }
        });

        actionCollector.on("end", async (_c, endReason) => {
          if (endReason === "undone") return;
          await interaction.editReply({ components: [] }).catch(() => null);
        });
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
