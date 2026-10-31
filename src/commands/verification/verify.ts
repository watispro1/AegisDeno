import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
  MessageFlags,
} from "discord.js";
import { scopedModalId } from "../../utils/modal";
import { hiddenChannelMessage, isObfuscatedChannel } from "../../utils/channels";
import { memberTopRolePosition, roleAboveActor } from "../../permissions/hierarchy";
import type { Command } from "../../types/discord";
import { setupVerification, getVerificationConfig, setKickUnverifiedMinutes } from "../../services/verificationService";
import { MAX_KICK_UNVERIFIED_MINUTES } from "../../services/verificationLogic";
import { VerificationModel } from "../../database/mongo";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Server anti-raid and member verification settings.")
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName("setup")
        .setDescription("Open a form to customize and post a verification panel.")
        .addChannelOption(opt => opt.setName("channel").setDescription("Target channel").addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addRoleOption(opt => opt.setName("verified_role").setDescription("Role granted upon verification").setRequired(true))
        .addStringOption(opt =>
          opt
            .setName("type")
            .setDescription("Verification challenge type")
            .setRequired(false)
            .addChoices(
              { name: "One-Click Button", value: "button" },
              { name: "CAPTCHA Verification", value: "captcha" }
            )
        )
        .addIntegerOption(opt =>
          opt
            .setName("kick_unverified_minutes")
            .setDescription("Kick members who have not verified after this many minutes (0 = off, default)")
            .setMinValue(0)
            .setMaxValue(MAX_KICK_UNVERIFIED_MINUTES)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("autokick")
        .setDescription("Kick members who stay unverified for too long (0 turns it off).")
        .addIntegerOption(opt =>
          opt
            .setName("minutes")
            .setDescription("Minutes after joining before an unverified member is kicked (0 = off)")
            .setMinValue(0)
            .setMaxValue(MAX_KICK_UNVERIFIED_MINUTES)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("user")
        .setDescription("Manually verify a server member.")
        .addUserOption(opt => opt.setName("target").setDescription("Member to verify").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("batch")
        .setDescription("Manually verify multiple users in bulk (up to 50).")
    )
    .addSubcommand(sub =>
      sub
        .setName("info")
        .setDescription("Display an interactive dashboard of current verification settings.")
    )
    .addSubcommand(sub =>
      sub
        .setName("disable")
        .setDescription("Disable the verification system.")
    ),

  category: "verification",
  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageGuild],

  async execute(interaction) {
    if (!interaction.guild) return;
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    // ── SETUP via modal ──────────────────────────────────────────────────────────
    if (subcommand === "setup") {
      const channel = interaction.options.getChannel("channel", true) as TextChannel;
      const role = interaction.options.getRole("verified_role", true);
      const type = (interaction.options.getString("type") || "button") as "button" | "captcha";
      const kickOption = interaction.options.getInteger("kick_unverified_minutes");

      // Never post to a channel Aegis cannot see.
      if (isObfuscatedChannel(channel) || isObfuscatedChannel(interaction.guild.channels.cache.get(channel.id))) {
        return interaction.reply({ content: `❌ ${hiddenChannelMessage(channel.id)}`, flags: MessageFlags.Ephemeral });
      }
      // Everyone who verifies gets this role, the invoker included, so it must
      // be below the invoker's own highest role.
      const tooHigh = roleAboveActor({
        ownerId: interaction.guild.ownerId,
        actorId: interaction.user.id,
        actorTopPosition: await memberTopRolePosition(interaction.guild, interaction.user.id),
        roles: [role],
      });
      if (tooHigh) {
        return interaction.reply({
          content: `❌ You can't use <@&${tooHigh.id}> as the verified role: it is equal to or above your highest role.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(scopedModalId("verify_setup_modal", interaction.id))
        .setTitle("Verification Panel Details");

      const titleInput = new TextInputBuilder()
        .setCustomId("verify_title")
        .setLabel("Panel Title")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setRequired(false)
        .setPlaceholder("e.g. Member Verification");

      const descInput = new TextInputBuilder()
        .setCustomId("verify_desc")
        .setLabel("Panel Description")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(2000)
        .setRequired(false)
        .setPlaceholder("e.g. Click the button below to gain access to the server.");

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
      );

      await interaction.showModal(modal);

      const modalResponse = await interaction.awaitModalSubmit({
        time: 300_000,
        filter: (m) => m.user.id === interaction.user.id && m.customId === scopedModalId("verify_setup_modal", interaction.id),
      }).catch(() => null);

      if (!modalResponse) return;
      await modalResponse.deferReply({ flags: MessageFlags.Ephemeral });

      const title = modalResponse.fields.getTextInputValue("verify_title") || undefined;
      const description = modalResponse.fields.getTextInputValue("verify_desc") || undefined;

      // Keep the current auto-kick setting when re-running setup without the option.
      const kickMinutes = kickOption ?? (await getVerificationConfig(guildId))?.kickUnverifiedMinutes ?? 0;
      const result = await setupVerification(interaction.guild, channel, role.id, type, title, description, kickMinutes);

      if (result) {
        await modalResponse.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x57F287)
              .setTitle("✅ Verification Configured")
              .setDescription(`The verification panel has been posted in <#${channel.id}>.`)
              .addFields(
                { name: "🛡️ Role", value: `<@&${role.id}>`, inline: true },
                { name: "⚙️ Type", value: type.toUpperCase(), inline: true },
                { name: "👢 Auto-kick", value: result.kickUnverifiedMinutes > 0 ? `After ${result.kickUnverifiedMinutes} min` : "Off", inline: true },
              )
              .setTimestamp(),
          ],
        });
      } else {
        await modalResponse.editReply("❌ Failed to set up verification panel. Please check my permissions in that channel.");
      }
      return;
    }

    // ── INFO dashboard ───────────────────────────────────────────────────────────
    if (subcommand === "info") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const config = await getVerificationConfig(guildId);
      
      const buildEmbed = (cfg: typeof config) => {
        const embed = new EmbedBuilder()
          .setTitle("🛡️ Verification System Dashboard")
          .setTimestamp();

        if (!cfg || !cfg.enabled) {
          embed.setColor(0xED4245);
          embed.setDescription("The verification system is currently **disabled**.\nUse `/verify setup` to enable it.");
          return embed;
        }

        embed.setColor(0x3498DB);
        embed.addFields(
          { name: "🟢 Status",        value: "**Enabled**", inline: true },
          { name: "⚙️ Mode",         value: `\`${cfg.type.toUpperCase()}\``, inline: true },
          { name: "🛡️ Verified Role", value: `<@&${cfg.verifiedRoleId}>`, inline: true },
          { name: "📌 Channel",       value: cfg.channelId ? `<#${cfg.channelId}>` : "Not set", inline: true },
          { name: "📨 Message ID",    value: cfg.messageId ? `\`${cfg.messageId}\`` : "Not set", inline: true },
          { name: "👢 Auto-kick",     value: cfg.kickUnverifiedMinutes > 0 ? `Unverified after ${cfg.kickUnverifiedMinutes} min` : "Off", inline: true },
        );
        return embed;
      };

      const embed = buildEmbed(config);
      
      // Quick action buttons if enabled
      const components: ActionRowBuilder<ButtonBuilder>[] = [];
      if (config && config.enabled) {
        components.push(
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId("verify_disable_quick")
              .setLabel("Disable Verification")
              .setStyle(ButtonStyle.Danger)
              .setEmoji("🔴")
          )
        );
      }

      const sent = await interaction.editReply({ embeds: [embed], components });

      if (config && config.enabled) {
        const collector = sent.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 60_000,
          filter: (i) => i.user.id === interaction.user.id,
          max: 1,
        });

        collector.on("collect", async (i) => {
          if (i.customId === "verify_disable_quick") {
            await i.deferUpdate();
            await VerificationModel.updateOne({ guildId }, { $set: { enabled: false } });
            
            const updatedConfig = await getVerificationConfig(guildId);
            await i.editReply({ embeds: [buildEmbed(updatedConfig)], components: [] });
            await i.followUp({ content: "🔴 Verification system has been disabled.", flags: MessageFlags.Ephemeral });
          }
        });
      }
      return;
    }

    // ── MANUAL USER VERIFY ───────────────────────────────────────────────────────
    if (subcommand === "user") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.reply({ content: "❌ You need `Manage Roles` to verify members manually.", flags: MessageFlags.Ephemeral });
      }

      const config = await getVerificationConfig(guildId);
      if (!config || !config.enabled || !config.verifiedRoleId) {
        return interaction.reply({ content: "❌ Verification is not enabled or configured.", flags: MessageFlags.Ephemeral });
      }

      const targetUser = interaction.options.getUser("target", true);
      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      
      if (!targetMember) {
        return interaction.reply({ content: "❌ Member not found in the server.", flags: MessageFlags.Ephemeral });
      }

      if (targetMember.roles.cache.has(config.verifiedRoleId)) {
        return interaction.reply({ content: "⚠️ That member is already verified.", flags: MessageFlags.Ephemeral });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        await targetMember.roles.add(config.verifiedRoleId, `Manually verified by ${interaction.user.tag}`);
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x57F287)
              .setTitle("✅ Manual Verification")
              .setDescription(`Manually verified <@${targetMember.id}> and assigned the <@&${config.verifiedRoleId}> role.`)
              .setTimestamp(),
          ],
        });
      } catch (e) {
        await interaction.editReply("❌ Failed to assign the verified role. Check my role hierarchy permissions.");
      }
      return;
    }

    // ── BATCH VERIFY ─────────────────────────────────────────────────────────────
    if (subcommand === "batch") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.reply({ content: "❌ You need `Manage Roles` to verify members manually.", flags: MessageFlags.Ephemeral });
      }

      const config = await getVerificationConfig(guildId);
      if (!config || !config.enabled || !config.verifiedRoleId) {
        return interaction.reply({ content: "❌ Verification is not enabled or configured.", flags: MessageFlags.Ephemeral });
      }

      const modal = new ModalBuilder()
        .setCustomId(scopedModalId("verify_batch_modal", interaction.id))
        .setTitle("Batch Verify Members");

      const idsInput = new TextInputBuilder()
        .setCustomId("batch_ids")
        .setLabel("Discord User IDs (comma or space separated)")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder("e.g. 123456789012345678, 987654321098765432");

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(idsInput));
      await interaction.showModal(modal);

      const modalResponse = await interaction.awaitModalSubmit({
        time: 300_000,
        filter: (m) => m.user.id === interaction.user.id && m.customId === scopedModalId("verify_batch_modal", interaction.id),
      }).catch(() => null);

      if (!modalResponse) return;
      await modalResponse.deferReply({ flags: MessageFlags.Ephemeral });

      const rawIds = modalResponse.fields.getTextInputValue("batch_ids");
      const ids = [...new Set(rawIds.match(/\d{17,20}/g) || [])].slice(0, 50); // limit 50

      if (ids.length === 0) {
        await modalResponse.editReply("❌ No valid Discord IDs found in the input.");
        return;
      }

      let success = 0;
      let failed = 0;
      let already = 0;

      for (const id of ids) {
        try {
          const member = await interaction.guild!.members.fetch(id).catch(() => null);
          if (!member) {
            failed++;
            continue;
          }
          if (member.roles.cache.has(config.verifiedRoleId)) {
            already++;
            continue;
          }
          await member.roles.add(config.verifiedRoleId, `Batch verified by ${interaction.user.tag}`);
          success++;
        } catch (e) {
          failed++;
        }
      }

      const resultEmbed = new EmbedBuilder()
        .setColor(success > 0 ? 0x57F287 : 0xED4245)
        .setTitle("✅ Batch Verification Complete")
        .addFields(
          { name: "Total Processed", value: `${ids.length}`, inline: true },
          { name: "Successfully Verified", value: `✅ ${success}`, inline: true },
          { name: "Already Verified", value: `⚠️ ${already}`, inline: true },
          { name: "Failed / Not Found", value: `❌ ${failed}`, inline: true },
        )
        .setTimestamp();

      await modalResponse.editReply({ embeds: [resultEmbed] });
      return;
    }

    // ── AUTO-KICK ────────────────────────────────────────────────────────────────
    if (subcommand === "autokick") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) {
        return interaction.reply({ content: "❌ You need `Kick Members` to change the unverified auto-kick.", flags: MessageFlags.Ephemeral });
      }
      const minutes = interaction.options.getInteger("minutes", true);
      const ok = await setKickUnverifiedMinutes(guildId, minutes);
      if (!ok) {
        return interaction.reply({ content: "❌ Verification is not set up yet. Run `/verify setup` first.", flags: MessageFlags.Ephemeral });
      }
      return interaction.reply({
        content: minutes > 0
          ? `✅ Members who join from now on will be kicked if they have not verified within **${minutes}** minute(s). Make sure my role is above theirs and I have Kick Members.`
          : "✅ Unverified auto-kick is now **off**. Pending kicks are skipped.",
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── DISABLE ──────────────────────────────────────────────────────────────────
    if (subcommand === "disable") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await VerificationModel.updateOne({ guildId }, { $set: { enabled: false } });
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("🔴 Verification Disabled")
            .setDescription("The verification system has been disabled.")
            .setTimestamp(),
        ],
      });
      return;
    }
  },
};

export default command;
