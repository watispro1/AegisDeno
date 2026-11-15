import { guardCollect } from "../../utils/collectorGuard";
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
import { isBotHierarchyValid, isRoleHierarchyValid } from "../../permissions/hierarchy";
import { hierarchyRefusalText } from "../../permissions/hierarchyExplain";
import { sendGuildLog } from "../../services/logging";
import { addModerationCase, revokeModerationCase } from "../../services/moderationCases";
import { combineReason, handleReasonAutocomplete } from "../../utils/moderationPresets";
import { UNDO_WINDOW_MS, buildUndoButton, canPressUndo, isUndoWindowOpen } from "../../services/moderationUndo";
import { caseLinkButton, modLogRow } from "../../services/modLogLinks";
import { BanAppealModel } from "../../database/mongo";
import { buildDurationSuggestions } from "../../utils/moderationPresets";
import { formatDurationLong } from "../../utils/duration";
import { auditReason } from "../../utils/safeText";
import { TEMP_BAN_MAX_SECONDS, TEMP_BAN_MIN_SECONDS, tempBanMarker } from "../../services/timedActions";
import { randomBytes } from "node:crypto";
import { clearTimedUnbans, scheduleTimedUnban } from "../../services/tempBan";
import type { AutocompleteInteraction } from "discord.js";
import { parseBanDuration, TEMP_BAN_PRESETS } from "./ban/logic";
import { appealFieldText, banNoticeEmbed, issueAppealCode, sendBanNotice } from "./ban/notices";
import { replyEphemeralPrompt } from "./lib/prompt";
import { dmOutcome, dmSentLabel } from "../../services/dmNotice";
export { parseBanDuration } from "./ban/logic";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member or any user by ID, permanently or for a set time, after a confirmation.")
    .addUserOption(opt =>
      opt.setName("user").setDescription("The member (or user ID) to ban; they don't need to be in the server").setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName("preset")
        .setDescription("Common ban reason preset (combined with reason if you give both)")
        .setRequired(false)
        .addChoices(
          { name: "🚨 Severe Harassment / Hate Speech", value: "Severe Harassment / Hate Speech" },
          { name: "🤖 Compromised Account / Raid Bot", value: "Compromised Account / Raid Bot" },
          { name: "🔞 Malicious, Illegal, or NSFW Content", value: "Malicious, Illegal, or NSFW Content" },
          { name: "💣 Mass Spam / Malicious Links", value: "Mass Spam / Malicious Links" },
          { name: "🛑 Multiple Prior Infractions / Rule Evasion", value: "Multiple Prior Infractions / Rule Evasion" },
        )
    )
    .addStringOption(opt =>
      opt.setName("reason").setDescription("Reason: pick a preset or type your own").setAutocomplete(true).setMaxLength(512).setRequired(false)
    )
    .addIntegerOption(opt =>
      opt
        .setName("delete_messages")
        .setDescription("Delete messages from this many days (0–7)")
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName("silent").setDescription("Send the user no DMs (no ban notice, no appeal code)").setRequired(false)
    )
    .addAttachmentOption(opt =>
      opt.setName("proof").setDescription("Optional screenshot or proof, stored with the case").setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName("duration").setDescription("Temporary ban length, e.g. 12h, 7d, 2 weeks (empty = permanent)").setAutocomplete(true).setMaxLength(64).setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.BanMembers],
  botPermissions: [PermissionFlagsBits.BanMembers],

  autocomplete: async (interaction: AutocompleteInteraction) => {
    const focused = interaction.options.getFocused(true);
    if (focused.name === "duration") {
      await interaction.respond(buildDurationSuggestions(String(focused.value ?? ""), TEMP_BAN_PRESETS, { minSeconds: TEMP_BAN_MIN_SECONDS, maxSeconds: TEMP_BAN_MAX_SECONDS }));
      return;
    }
    await handleReasonAutocomplete(interaction);
  },

  execute: async (interaction: ChatInputCommandInteraction) => {
    const target       = interaction.options.getUser("user", true);
    const preset       = interaction.options.getString("preset");
    const customReason = interaction.options.getString("reason");
    const deleteDays   = interaction.options.getInteger("delete_messages") ?? 0;
    const silent       = interaction.options.getBoolean("silent") ?? false;
    const proof        = interaction.options.getAttachment("proof");
    const guildId      = interaction.guildId!;

    const reason = combineReason(preset, customReason) ?? "No reason provided.";
    const parsedDuration = parseBanDuration(interaction.options.getString("duration"));
    if (!parsedDuration.ok) {
      return interaction.reply({ content: parsedDuration.error, flags: MessageFlags.Ephemeral });
    }
    const durationSeconds = parsedDuration.seconds;
    const durationLabel = durationSeconds ? formatDurationLong(durationSeconds) : "Permanent";

    if (target.id === interaction.user.id) {
      return interaction.reply({ content: "❌ You cannot ban yourself.", flags: MessageFlags.Ephemeral });
    }
    if (target.id === interaction.client.user?.id) {
      return interaction.reply({ content: "❌ You cannot ban me.", flags: MessageFlags.Ephemeral });
    }
    if (target.id === interaction.guild?.ownerId) {
      return interaction.reply({ content: "❌ You cannot ban the server owner.", flags: MessageFlags.Ephemeral });
    }

    const existingBan = await interaction.guild!.bans.fetch(target.id).catch(() => null);
    if (existingBan) {
      return interaction.reply({
        content: `ℹ️ ${target.tag} is already banned${existingBan.reason ? ` (reason: ${existingBan.reason.slice(0, 200)})` : ""}. Use \`/unban\` first if you want to change the ban.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const member = await interaction.guild!.members.fetch(target.id).catch(() => null);
    if (member) {
      const [hierarchyOk, botHierarchyOk] = await Promise.all([
        isRoleHierarchyValid(interaction.client, guildId, interaction.user.id, target.id),
        isBotHierarchyValid(interaction.client, guildId, target.id),
      ]);
      if (!hierarchyOk) {
        return interaction.reply({ content: await hierarchyRefusalText(interaction.guild!, "you", interaction.user.id, target.id, "ban", target.tag), flags: MessageFlags.Ephemeral });
      }
      if (!botHierarchyOk) {
        return interaction.reply({ content: await hierarchyRefusalText(interaction.guild!, "bot", interaction.client.user.id, target.id, "ban", target.tag), flags: MessageFlags.Ephemeral });
      }
    }

    const accountCreated = `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`;
    const joinedServer = member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "Not in server";

    const confirmEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle("⚠️ Ban Confirmation Required")
      .setThumbnail(target.displayAvatarURL())
      .setDescription(durationSeconds
        ? `You are about to **ban ${target.tag} for ${durationLabel}**. Aegis lifts the ban automatically when it runs out.`
        : `You are about to **permanently ban** ${target.tag} from this server.\n\nThis action will be logged and cannot be undone without manually unbanning.`)
      .addFields(
        { name: "👤 User",           value: `${target.tag} (<@${target.id}>)`, inline: false },
        { name: "📝 Reason",         value: reason, inline: false },
        { name: "📅 Account Age",    value: accountCreated, inline: true },
        { name: "📥 Joined Server",  value: joinedServer, inline: true },
        { name: "⏳ Length",         value: durationSeconds ? `${durationLabel} (until <t:${Math.floor((Date.now() + durationSeconds * 1000) / 1000)}:f>)` : "Permanent", inline: true },
        { name: "🗑️ Msg Deletion",   value: `${deleteDays} day(s)`, inline: true },
        { name: "🔕 Silent",         value: silent ? "Yes — no DMs at all" : "No", inline: true },
        ...(proof ? [{ name: "📎 Proof", value: `[${proof.name}](${proof.url})`, inline: false }] : []),
      )
      .setFooter({ text: "This confirmation expires in 30 seconds." })
      .setTimestamp();

    const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("ban_confirm")
        .setLabel("Confirm Ban")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🔨"),
      new ButtonBuilder()
        .setCustomId("ban_cancel")
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

    collector.on("collect", (i) => guardCollect("ban", i, async () => {
      if (i.customId === "ban_cancel") {
        await i.update({ content: "❌ Ban cancelled.", embeds: [], components: [] }).catch(() => null);
        return;
      }

      await i.deferUpdate().catch(() => null);

      try {
        const guild = interaction.guild!;

        // Another moderator may have banned them while this prompt was open:
        // banning again would add a second case and a second appeal code.
        if (await guild.bans.fetch(target.id).catch(() => null)) {
          await i.editReply({ content: `ℹ️ ${target.tag} was banned by someone else while you were confirming. Nothing more was done.`, embeds: [], components: [] }).catch(() => null);
          return;
        }

        // Roles can change during the 30-second confirmation: check again.
        const current = await guild.members.fetch(target.id).catch(() => null);
        if (current) {
          const [stillOk, botStillOk] = await Promise.all([
            isRoleHierarchyValid(interaction.client, guildId, interaction.user.id, target.id),
            isBotHierarchyValid(interaction.client, guildId, target.id),
          ]);
          if (!stillOk || !botStillOk) {
            await i.editReply({ content: `❌ ${stillOk ? "I" : "You"} can no longer ban this member: their roles changed while you were confirming. Nothing was done.`, embeds: [], components: [] }).catch(() => null);
            return;
          }
        }

        // DM the user before banning (so message can still be delivered)
        let noticeDelivered = false;
        if (!silent && member) {
          const temp = durationSeconds ? { label: durationLabel, endsAtMs: Date.now() + durationSeconds * 1000 } : null;
          noticeDelivered = await sendBanNotice(target, banNoticeEmbed(guild.name, reason, temp));
        }

        // A temporary ban carries a marker at the start of its reason (kept by
        // the 512-character trim), so the timed unban only lifts this ban.
        const banRef = durationSeconds ? randomBytes(4).toString("hex") : null;
        await guild.members.ban(target.id, {
          // Discord rejects audit-log reasons over 512 characters.
          reason: auditReason(`${banRef ? `${tempBanMarker(banRef)} ${durationLabel}: ` : ""}${reason} | Banned by ${interaction.user.tag}`),
          deleteMessageSeconds: deleteDays * 86400,
        });
        // This ban replaces any earlier temporary one.
        await clearTimedUnbans(guildId, target.id).catch(err => logger.warn(`Could not clear old timed unban for ${target.id}`, err));

        const bannedAt = Date.now();
        const caseId = await addModerationCase({
          guildId,
          userId: target.id,
          moderatorId: interaction.user.id,
          action: "ban",
          reason,
          details: `Deleted messages: ${deleteDays} day(s)${durationSeconds ? ` | Temporary: ${durationLabel}` : ""}`,
          proofUrl: proof?.url ?? null,
          targetTag: target.tag,
          modTag: interaction.user.tag,
          durationMs: durationSeconds ? durationSeconds * 1000 : undefined,
        });

        let unbanScheduled = false;
        if (durationSeconds) {
          try {
            await scheduleTimedUnban(interaction.client, {
              guildId,
              channelId: interaction.channelId,
              userId: target.id,
              executeAt: new Date(bannedAt + durationSeconds * 1000),
              payload: { moderatorId: interaction.user.id, moderatorTag: interaction.user.tag, caseId, durationSeconds, banRef },
            });
            unbanScheduled = true;
          } catch (scheduleErr) {
            logger.error(`Could not schedule the automatic unban for ${target.id} in ${guildId}`, scheduleErr);
          }
        }

        // Auto-generate the ban appeal record and DM the user their appeal code
        // (`silent` means no DMs at all; the code is still shown to the moderator).
        const { appealCode, appealDelivered } = await issueAppealCode({ guild, target, moderatorId: interaction.user.id, reason, silent });

        const resultEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle("🔨 Member Banned")
          .setThumbnail(target.displayAvatarURL())
          .addFields(
            { name: "👤 User",          value: `${target.tag} (<@${target.id}>)`, inline: false },
            { name: "📝 Reason",        value: reason, inline: false },
            { name: "🛡️ Moderator",    value: interaction.user.tag, inline: true },
            { name: "🗑️ Msg Deletion",  value: `${deleteDays} day(s)`, inline: true },
            { name: "🔕 DM Sent",       value: !silent && !member ? "❌ No (not in the server)" : dmSentLabel(dmOutcome(silent, noticeDelivered)), inline: true },
            { name: "⏳ Length",        value: durationSeconds ? (unbanScheduled ? `${durationLabel} — unbans <t:${Math.floor((bannedAt + durationSeconds * 1000) / 1000)}:R>` : `${durationLabel} — ⚠️ the automatic unban could not be scheduled; unban by hand`) : "Permanent", inline: true },
            ...(appealCode ? [{ name: "📋 Appeal Code", value: appealFieldText(appealCode, silent, appealDelivered), inline: false }] : []),
            ...(proof ? [{ name: "📎 Proof", value: `[${proof.name}](${proof.url})`, inline: false }] : []),
          )
          .setFooter(caseId ? { text: `Case ID: ${caseId}` } : null)
          .setTimestamp();

        const postBanRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          buildUndoButton(`ban_undo_${target.id}`),
          ...(caseId ? [caseLinkButton(guildId, caseId)] : []),
        );

        const banMsg = await i.editReply({ content: null, embeds: [resultEmbed], components: [postBanRow] }).catch(() => null);

        await sendGuildLog(interaction.client, guildId, {
          title: "🔨 Member Banned",
          color: 0xED4245,
          description: `**User:** ${target.tag} (<@${target.id}>)\n**Reason:** ${reason}\n**Length:** ${durationLabel}\n**Moderator:** ${interaction.user.tag}\n**Msg Deletion:** ${deleteDays}d${proof ? `\n**Proof:** ${proof.url}` : ""}`,
        }, "modActions", caseId ? [modLogRow(guildId, target.id, caseId)] : undefined);

        if (banMsg) {
          const postCollector = banMsg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: UNDO_WINDOW_MS,
          });

          postCollector.on("collect", (bi) => guardCollect("ban-undo", bi, async () => {
            if (bi.customId !== `ban_undo_${target.id}`) return;
            if (!canPressUndo("ban", bi.memberPermissions)) {
              await bi.reply({ content: "❌ You need `Ban Members` to undo a ban.", flags: MessageFlags.Ephemeral });
              return;
            }
            if (!isUndoWindowOpen(bannedAt, Date.now())) {
              await bi.reply({ content: "⏱️ The 5-minute undo window has passed. Use `/unban` instead.", flags: MessageFlags.Ephemeral });
              return;
            }
            await bi.deferUpdate();
            try {
              await guild.members.unban(target.id, auditReason(`Ban undone by ${bi.user.tag}`));
              await clearTimedUnbans(guildId, target.id).catch(() => 0);
            } catch (undoErr) {
              logger.warn(`Undo ban failed for ${target.id} in ${guildId}`, undoErr);
              await bi.followUp({ content: "❌ Could not lift the ban. It may already have been removed.", flags: MessageFlags.Ephemeral });
              return;
            }
            const revoked = caseId ? await revokeModerationCase(guildId, caseId, bi.user.id) : false;
            if (appealCode) {
              await BanAppealModel.updateOne(
                { appealCode, guildId, status: "pending" },
                { $set: { status: "expired", reviewedBy: bi.user.id, reviewNote: "Ban undone by staff", reviewedAt: new Date() } },
              ).catch(() => null);
            }
            await sendGuildLog(interaction.client, guildId, {
              title: "↩️ Ban Undone",
              color: 0x57F287,
              description: `**User:** ${target.tag} (<@${target.id}>)\n**Undone by:** ${bi.user.tag}${caseId ? `\n**Case:** \`${caseId}\`${revoked ? " (marked revoked)" : ""}` : ""}`,
            }, "modActions", caseId ? [modLogRow(guildId, target.id, caseId)] : undefined);
            postCollector.stop("undone");
            await bi.editReply({
              embeds: [resultEmbed.setColor(0x57F287).setTitle("↩️ Ban Undone")],
              components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buildUndoButton(`ban_undo_${target.id}`, "done"))],
            }).catch(() => null);
          }));

          postCollector.on("end", async (_c, endReason) => {
            if (endReason === "undone") return;
            await i.editReply({ components: [] }).catch(() => null);
          });
        }
      } catch (err) {
        logger.error(`Failed to ban user ${target.id} in guild ${guildId}`, err);
        await i.editReply({ content: "❌ Failed to ban the user. Check my permissions and role hierarchy.", embeds: [], components: [] }).catch(() => null);
      }
    }));

    collector.on("end", async (_, reason) => {
      if (reason === "time") {
        await interaction.editReply({ content: "⏰ Ban confirmation timed out.", embeds: [], components: [] }).catch(() => null);
      }
    });
  },
};

export default command;
