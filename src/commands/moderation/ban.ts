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
import { sendGuildLog } from "../../services/logging";
import { addModerationCase, revokeModerationCase } from "../../services/moderationCases";
import { combineReason, handleReasonAutocomplete } from "../../utils/moderationPresets";
import { UNDO_WINDOW_MS, buildUndoButton, canPressUndo, isUndoWindowOpen } from "../../services/moderationUndo";
import { BanAppealModel } from "../../database/mongo";
import { generateAppealCode } from "./appeal";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member from the server with confirmation prompt.")
    .addUserOption(opt =>
      opt.setName("user").setDescription("The member to ban").setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName("preset")
        .setDescription("Common ban reason preset")
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
      opt.setName("silent").setDescription("Skip DM notification to the banned user").setRequired(false)
    )
    .addAttachmentOption(opt =>
      opt.setName("proof").setDescription("Optional screenshot or proof, stored with the case").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.BanMembers],
  botPermissions: [PermissionFlagsBits.BanMembers],

  autocomplete: handleReasonAutocomplete,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const target       = interaction.options.getUser("user", true);
    const preset       = interaction.options.getString("preset");
    const customReason = interaction.options.getString("reason");
    const deleteDays   = interaction.options.getInteger("delete_messages") ?? 0;
    const silent       = interaction.options.getBoolean("silent") ?? false;
    const proof        = interaction.options.getAttachment("proof");
    const guildId      = interaction.guildId!;

    if (!preset && !customReason) {
      return interaction.reply({
        content: "❌ Please provide either a `preset` or a custom `reason` (or both).",
        flags: MessageFlags.Ephemeral,
      });
    }

    const reason = combineReason(preset, customReason) ?? "No reason provided.";

    if (target.id === interaction.user.id) {
      return interaction.reply({ content: "❌ You cannot ban yourself.", flags: MessageFlags.Ephemeral });
    }
    if (target.id === interaction.client.user?.id) {
      return interaction.reply({ content: "❌ You cannot ban me.", flags: MessageFlags.Ephemeral });
    }
    if (target.id === interaction.guild?.ownerId) {
      return interaction.reply({ content: "❌ You cannot ban the server owner.", flags: MessageFlags.Ephemeral });
    }

    const member = await interaction.guild!.members.fetch(target.id).catch(() => null);
    if (member) {
      const [hierarchyOk, botHierarchyOk] = await Promise.all([
        isRoleHierarchyValid(interaction.client, guildId, interaction.user.id, target.id),
        isBotHierarchyValid(interaction.client, guildId, target.id),
      ]);
      if (!hierarchyOk) {
        return interaction.reply({ content: "❌ You cannot ban this user — they have a higher or equal role.", flags: MessageFlags.Ephemeral });
      }
      if (!botHierarchyOk) {
        return interaction.reply({ content: "❌ I cannot ban this user — they are above my highest role.", flags: MessageFlags.Ephemeral });
      }
    }

    // Confirmation prompt with member metadata
    const accountCreated = `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`;
    const joinedServer = member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "Not in server";

    const confirmEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle("⚠️ Ban Confirmation Required")
      .setThumbnail(target.displayAvatarURL())
      .setDescription(`You are about to **permanently ban** ${target.tag} from this server.\n\nThis action will be logged and cannot be undone without manually unbanning.`)
      .addFields(
        { name: "👤 User",           value: `${target.tag} (<@${target.id}>)`, inline: false },
        { name: "📝 Reason",         value: reason, inline: false },
        { name: "📅 Account Age",    value: accountCreated, inline: true },
        { name: "📥 Joined Server",  value: joinedServer, inline: true },
        { name: "🗑️ Msg Deletion",   value: `${deleteDays} day(s)`, inline: true },
        { name: "🔕 Silent",         value: silent ? "Yes" : "No", inline: true },
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

    collector.on("collect", async (i) => {
      if (i.customId === "ban_cancel") {
        await i.update({ content: "❌ Ban cancelled.", embeds: [], components: [] }).catch(() => null);
        return;
      }

      await i.deferUpdate().catch(() => null);

      try {
        const guild = interaction.guild!;

        // DM the user before banning (so message can still be delivered)
        if (!silent && member) {
          const dmEmbed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle(`🔨 You have been banned from **${guild.name}**`)
            .addFields({ name: "📝 Reason", value: reason })
            .setFooter({ text: "If you believe this was a mistake, please contact server staff." })
            .setTimestamp();
          await target.send({ embeds: [dmEmbed] }).catch(() => null);
        }

        await guild.members.ban(target.id, {
          reason: `${reason} | Banned by ${interaction.user.tag}`,
          deleteMessageSeconds: deleteDays * 86400,
        });

        const bannedAt = Date.now();
        const caseId = await addModerationCase({
          guildId,
          userId: target.id,
          moderatorId: interaction.user.id,
          action: "ban",
          reason,
          details: `Deleted messages: ${deleteDays} day(s)`,
          proofUrl: proof?.url ?? null,
        });

        // Auto-generate ban appeal record & DM the user their appeal code
        let appealCode = "";
        try {
          appealCode = generateAppealCode();
          await BanAppealModel.create({
            appealCode,
            guildId,
            userId: target.id,
            moderatorId: interaction.user.id,
            banReason: reason,
          });

          const appealEmbed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle("📋 You Have Been Banned — Appeal Information")
            .setDescription(
              `You were banned from **${guild.name}**.\n\n` +
              `If you believe this was a mistake, you may submit a ban appeal.\n` +
              `**Your appeal code is: \`${appealCode}\`**\n\n` +
              `To submit your appeal:\n` +
              `1. Join a server where **Aegis** is present\n` +
              `2. Use the command: \`/appeal submit code:${appealCode}\`\n` +
              `3. Staff will review your appeal and DM you the decision.`
            )
            .addFields(
              { name: "📝 Ban Reason",   value: reason, inline: false },
              { name: "🆔 Appeal Code",  value: `\`${appealCode}\``, inline: true },
              { name: "📅 Banned On",    value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
            )
            .setFooter({ text: `Aegis Ban Appeal System • ${guild.name}` })
            .setTimestamp();
          await target.send({ embeds: [appealEmbed] }).catch(() => null);
        } catch (appealErr) {
          logger.warn(`Failed to create/send appeal for ban of ${target.id} in ${guildId}:`, appealErr);
        }

        const resultEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle("🔨 Member Banned")
          .setThumbnail(target.displayAvatarURL())
          .addFields(
            { name: "👤 User",          value: `${target.tag} (<@${target.id}>)`, inline: false },
            { name: "📝 Reason",        value: reason, inline: false },
            { name: "🛡️ Moderator",    value: interaction.user.tag, inline: true },
            { name: "🗑️ Msg Deletion",  value: `${deleteDays} day(s)`, inline: true },
            { name: "🔕 DM Sent",       value: (!silent && member) ? "✅ Yes" : "❌ No / Silent", inline: true },
            ...(appealCode ? [{ name: "📋 Appeal Code", value: `\`${appealCode}\` — DM sent with instructions`, inline: false }] : []),
            ...(proof ? [{ name: "📎 Proof", value: `[${proof.name}](${proof.url})`, inline: false }] : []),
          )
          .setFooter(caseId ? { text: `Case ID: ${caseId}` } : null)
          .setTimestamp();

        const postBanRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          buildUndoButton(`ban_undo_${target.id}`),
        );

        const banMsg = await i.editReply({ content: null, embeds: [resultEmbed], components: [postBanRow] }).catch(() => null);

        await sendGuildLog(interaction.client, guildId, {
          title: "🔨 Member Banned",
          color: 0xED4245,
          description: `**User:** ${target.tag} (<@${target.id}>)\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}\n**Msg Deletion:** ${deleteDays}d${proof ? `\n**Proof:** ${proof.url}` : ""}`,
        });

        if (banMsg) {
          const postCollector = banMsg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: UNDO_WINDOW_MS,
          });

          postCollector.on("collect", async (bi) => {
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
              await guild.members.unban(target.id, `Ban undone by ${bi.user.tag}`);
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
            });
            postCollector.stop("undone");
            await bi.editReply({
              embeds: [resultEmbed.setColor(0x57F287).setTitle("↩️ Ban Undone")],
              components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buildUndoButton(`ban_undo_${target.id}`, "done"))],
            }).catch(() => null);
          });

          postCollector.on("end", async (_c, endReason) => {
            if (endReason === "undone") return;
            await i.editReply({ components: [] }).catch(() => null);
          });
        }
      } catch (err) {
        logger.error(`Failed to ban user ${target.id} in guild ${guildId}`, err);
        await i.editReply({ content: "❌ Failed to ban the user. Check my permissions and role hierarchy.", embeds: [], components: [] }).catch(() => null);
      }
    });

    collector.on("end", async (_, reason) => {
      if (reason === "time") {
        await interaction.editReply({ content: "⏰ Ban confirmation timed out.", embeds: [], components: [] }).catch(() => null);
      }
    });
  },
};

export default command;
