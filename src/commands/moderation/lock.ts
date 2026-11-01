import { logger } from "../../utils/logger";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
  PermissionOverwriteOptions,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  ChannelType,
  type Client,
  type Guild,
  type GuildBasedChannel,
} from "discord.js";
import { Command } from "../../types/discord";
import { sendGuildLog } from "../../services/logging";
import { getTasksForChannel } from "../../services/scheduler";
import { applyLock, categoryChildren, isLockable, lockDurationMinutes, postLockNotice, type LockableChannel } from "../../services/channelLock";
import { LOCK_MESSAGE_MAX, buildLockNoticeText, shouldPostLockNotice } from "../../services/lockNotice";
import { isObfuscatedChannel, hiddenChannelMessage } from "../../utils/channels";

export { isLockable, lockDurationMinutes, MAX_LOCK_MINUTES } from "../../services/channelLock";

/**
 * Whether /lock server should lock this channel: visible to Aegis, a text-capable
 * non-thread channel, public (@everyone can view it) and not already locked.
 */
export function serverLockTarget(ch: GuildBasedChannel, guild: Guild): boolean {
  if (isObfuscatedChannel(ch) || !ch.isTextBased() || ch.isThread() || !("permissionOverwrites" in ch)) return false;
  const everyone = guild.roles.everyone;
  const view = ch.permissionsFor(everyone)?.has(PermissionFlagsBits.ViewChannel) ?? false;
  if (!view) return false;
  return !ch.permissionOverwrites.cache.get(everyone.id)?.deny.has(PermissionFlagsBits.SendMessages);
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Lock or unlock channels to control @everyone message permissions.")
    .addSubcommand(sub =>
      sub
        .setName("channel")
        .setDescription("Lock a channel to prevent @everyone from sending messages.")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Channel to lock (defaults to current channel)").setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName("reason").setDescription("Reason for locking").setMaxLength(512).setRequired(false)
        )
        .addIntegerOption(opt =>
          opt
            .setName("duration_minutes")
            .setDescription("Auto-unlock after this many minutes (0 = no auto-unlock)")
            .setRequired(false)
            .setMinValue(0)
            .setMaxValue(1440)
        )
        .addStringOption(opt =>
          opt
            .setName("duration")
            .setDescription("Auto-unlock after e.g. 90m, 6h or 2d (up to 7 days); instead of duration_minutes")
            .setMaxLength(32)
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName("message").setDescription("Custom message to post in the locked channel").setMaxLength(LOCK_MESSAGE_MAX).setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("category")
        .setDescription("Lock every channel in a category.")
        .addChannelOption(opt =>
          opt.setName("category").setDescription("Category to lock").addChannelTypes(ChannelType.GuildCategory).setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName("reason").setDescription("Reason for locking").setMaxLength(512).setRequired(false)
        )
        .addIntegerOption(opt =>
          opt
            .setName("duration_minutes")
            .setDescription("Auto-unlock after this many minutes (0 = no auto-unlock)")
            .setRequired(false)
            .setMinValue(0)
            .setMaxValue(1440)
        )
        .addStringOption(opt =>
          opt
            .setName("duration")
            .setDescription("Auto-unlock after e.g. 90m, 6h or 2d (up to 7 days); instead of duration_minutes")
            .setMaxLength(32)
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName("message").setDescription("Custom message to post in each locked channel").setMaxLength(LOCK_MESSAGE_MAX).setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("unlock")
        .setDescription("Unlock a previously locked channel.")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Channel to unlock (defaults to current channel)").setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName("reason").setDescription("Reason for unlocking").setMaxLength(512).setRequired(false)
        )
        .addChannelOption(opt =>
          opt.setName("category").setDescription("Unlock every channel in this category instead").addChannelTypes(ChannelType.GuildCategory).setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("server")
        .setDescription("Emergency: lock ALL text channels (requires Administrator).")
        .addStringOption(opt =>
          opt.setName("reason").setDescription("Reason for server lockdown").setMaxLength(512).setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("status")
        .setDescription("Check the current lock status of a channel.")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Channel to check (defaults to current)").setRequired(false)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageChannels],
  botPermissions: [PermissionFlagsBits.ManageChannels],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const reason = interaction.options.getString("reason") ?? "No reason provided.";
    const guildId = interaction.guildId!;
    const guild = interaction.guild!;

    // Status subcommand — check if channel is locked
    if (sub === "status") {
      const targetChannel = (interaction.options.getChannel("channel") ?? interaction.channel) as TextChannel | null;
      if (targetChannel && (isObfuscatedChannel(targetChannel) || isObfuscatedChannel(guild.channels.cache.get(targetChannel.id)))) {
        return interaction.reply({ content: `❌ ${hiddenChannelMessage(targetChannel.id)}`, flags: MessageFlags.Ephemeral });
      }
      if (!targetChannel || !("permissionOverwrites" in targetChannel)) {
        return interaction.reply({ content: "❌ Invalid channel.", flags: MessageFlags.Ephemeral });
      }
      if (targetChannel.isThread?.()) {
        return interaction.reply({ content: "❌ Target is a thread channel — check the parent text channel status instead.", flags: MessageFlags.Ephemeral });
      }

      const overwrite = targetChannel.permissionOverwrites.cache.get(guild.roles.everyone.id);
      const isLocked = overwrite?.deny.has(PermissionFlagsBits.SendMessages) ?? false;
      const pendingUnlocks = await getTasksForChannel(guildId, targetChannel.id, "channel_unlock").catch(() => []);
      const hasPendingUnlock = pendingUnlocks.length > 0;

      const embed = new EmbedBuilder()
        .setColor(isLocked ? 0xED4245 : 0x57F287)
        .setTitle(isLocked ? "🔒 Channel is Locked" : "🔓 Channel is Open")
        .addFields(
          { name: "📌 Channel",         value: `<#${targetChannel.id}>`, inline: true },
          { name: "📊 Status",           value: isLocked ? "🔒 Locked — @everyone cannot send" : "🔓 Open — @everyone can send", inline: true },
          { name: "⏰ Auto-Unlock Pending", value: hasPendingUnlock ? "Yes" : "No", inline: true },
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Server lockdown
    if (sub === "server") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: "❌ Server lockdown requires **Administrator** permission.", flags: MessageFlags.Ephemeral });
      }

      // Confirmation for destructive server-wide action
      const warningEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle("🚨 Emergency Server Lockdown")
        .setDescription(
          "⚠️ This will **lock every text channel** in the server, preventing all members from sending messages.\n\n" +
          "This is intended for emergencies (raids, spam attacks, etc.). Use `/lock unlock` to restore individual channels."
        )
        .addFields(
          { name: "📝 Reason",     value: reason, inline: false },
          { name: "🛡️ Moderator", value: interaction.user.tag, inline: true },
        )
        .setFooter({ text: "This prompt expires in 20 seconds." })
        .setTimestamp();

      const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("lockdown_confirm")
          .setLabel("Activate Lockdown")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("🔒"),
        new ButtonBuilder()
          .setCustomId("lockdown_cancel")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("✖️"),
      );

      const prompt = await interaction.reply({
        embeds: [warningEmbed],
        components: [confirmRow],
        flags: MessageFlags.Ephemeral,
        fetchReply: true,
      });

      const confirmCollector = prompt.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 20_000,
        filter: (i) => i.user.id === interaction.user.id,
        max: 1,
      });

      confirmCollector.on("collect", async (i) => {
        if (i.customId === "lockdown_cancel") {
          await i.update({ content: "❌ Lockdown cancelled.", embeds: [], components: [] });
          return;
        }

        await i.deferUpdate();
        try {
          const allChannels = await guild.channels.fetch().catch(() => null);
          const channelCollection = allChannels ?? guild.channels.cache;

          let locked = 0;
          let failed = 0;
          for (const [, ch] of channelCollection) {
            // Skip channels hidden from Aegis (their overwrites are not real), private
            // channels @everyone can't see anyway, and ones already locked.
            if (!ch || !serverLockTarget(ch, guild)) continue;
            const ok = await (ch as TextChannel).permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }).then(() => true).catch(() => false);
            if (ok) locked++; else failed++;
          }

          const resultEmbed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("🔒 Server Lockdown Active")
            .setDescription(`**${locked}** channel(s) have been locked. Members cannot send messages until the lockdown is lifted.${failed ? `\n⚠️ ${failed} channel(s) could not be locked (check Aegis's Manage Channels and Manage Roles there).` : ""}`)
            .addFields(
              { name: "📝 Reason",     value: reason, inline: false },
              { name: "🛡️ Moderator", value: interaction.user.tag, inline: true },
              { name: "📌 Channels",   value: `${locked} locked`, inline: true },
            )
            .setFooter({ text: "Use /lock unlock per channel, or next time /incident start, which restores everything on its own." })
            .setTimestamp();

          await i.editReply({ content: null, embeds: [resultEmbed], components: [] });
          await sendGuildLog(interaction.client, guildId, {
            title: "🚨 Server Lockdown Activated",
            color: 0xED4245,
            description: `**Channels Locked:** ${locked}\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`,
          });
        } catch (err) {
          logger.error(`Failed to lockdown server in guild ${guildId}`, err);
          await i.editReply({ content: "❌ Failed to activate lockdown.", embeds: [], components: [] });
        }
      });

      confirmCollector.on("end", async (_, stopReason) => {
        if (stopReason === "time") {
          await interaction.editReply({ content: "⏰ Lockdown confirmation timed out.", embeds: [], components: [] }).catch(() => null);
        }
      });

      return;
    }

    const customMessage = interaction.options.getString("message");
    const moderator = { id: interaction.user.id, tag: interaction.user.tag };

    // Auto-unlock length: the friendly "duration" text or the older duration_minutes (not both).
    const lockLength = sub === "channel" || sub === "category"
      ? lockDurationMinutes(interaction.options.getInteger("duration_minutes"), interaction.options.getString("duration"))
      : { minutes: 0 };
    if ("error" in lockLength) {
      return interaction.reply({ content: `❌ ${lockLength.error}`, flags: MessageFlags.Ephemeral });
    }

    // Category lock / unlock
    const category = sub === "category" || sub === "unlock" ? interaction.options.getChannel("category") : null;
    if (category) {
      if (category.type !== ChannelType.GuildCategory) {
        return interaction.reply({ content: "❌ Please pick a category.", flags: MessageFlags.Ephemeral });
      }
      const isLocking = sub === "category";
      const durationMinutes = isLocking ? lockLength.minutes : 0;
      await interaction.deferReply();

      const children = categoryChildren(guild, category.id);
      if (children.length === 0) {
        await interaction.editReply(`⚠️ <#${category.id}> has no channels I can ${isLocking ? "lock" : "unlock"}.`);
        return;
      }

      let done = 0;
      const failed: string[] = [];
      let autoUnlockText = "None";
      for (const ch of children) {
        try {
          const result = await applyLock(interaction.client, guild, ch, isLocking, durationMinutes, moderator);
          if (result !== "None") autoUnlockText = result;
          done++;
          if (isLocking && ch.isTextBased()) {
            await postLockNotice(ch, buildLockNoticeText({ reason, customMessage, autoUnlockText: durationMinutes > 0 ? result : null }), moderator.tag);
          }
        } catch (err) {
          logger.warn(`Failed to ${isLocking ? "lock" : "unlock"} ${ch.id} in category ${category.id}`, err);
          failed.push(`<#${ch.id}>`);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(isLocking ? 0xED4245 : 0x57F287)
        .setTitle(isLocking ? "🔒 Category Locked" : "🔓 Category Unlocked")
        .addFields(
          { name: "📁 Category",   value: `<#${category.id}>`, inline: true },
          { name: "📌 Channels",   value: `${done} of ${children.length}`, inline: true },
          { name: "🛡️ Moderator", value: interaction.user.tag, inline: true },
          { name: "📝 Reason",     value: reason, inline: false },
          ...(isLocking ? [{ name: "⏰ Auto-Unlock", value: autoUnlockText, inline: true }] : []),
          ...(failed.length ? [{ name: "⚠️ Failed", value: failed.join(", ").slice(0, 1000), inline: false }] : []),
        )
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      await sendGuildLog(interaction.client, guildId, {
        title: isLocking ? "🔒 Category Locked" : "🔓 Category Unlocked",
        color: isLocking ? 0xED4245 : 0x57F287,
        description: `**Category:** <#${category.id}> (${done}/${children.length} channels)\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}${isLocking && durationMinutes > 0 ? `\n**Auto-Unlock:** ${autoUnlockText}` : ""}`,
      });
      return;
    }

    // Single channel lock / unlock
    await interaction.deferReply();

    try {
      const picked = interaction.options.getChannel("channel");
      const targetChannel = (picked ? guild.channels.cache.get(picked.id) ?? null : interaction.channel) as GuildBasedChannel | null;
      if (targetChannel?.isThread()) {
        await interaction.editReply("❌ Threads inherit permissions from their parent channel. Please lock the parent channel instead.");
        return;
      }
      if (isObfuscatedChannel(targetChannel)) {
        await interaction.editReply(`❌ ${hiddenChannelMessage(targetChannel!.id)}`);
        return;
      }
      if (!isLockable(targetChannel)) {
        await interaction.editReply("❌ Invalid channel — please select a text channel.");
        return;
      }

      const isLocking = sub === "channel";
      const durationMinutes = isLocking ? lockLength.minutes : 0;
      const autoUnlockText = await applyLock(interaction.client, guild, targetChannel, isLocking, durationMinutes, moderator);

      const embed = new EmbedBuilder()
        .setColor(isLocking ? 0xED4245 : 0x57F287)
        .setTitle(isLocking ? "🔒 Channel Locked" : "🔓 Channel Unlocked")
        .addFields(
          { name: "📌 Channel",      value: `<#${targetChannel.id}>`, inline: true },
          { name: "📝 Reason",       value: reason, inline: false },
          { name: "🛡️ Moderator",   value: interaction.user.tag, inline: true },
          ...(isLocking ? [{ name: "⏰ Auto-Unlock", value: autoUnlockText, inline: true }] : []),
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      await sendGuildLog(interaction.client, guildId, {
        title: isLocking ? "🔒 Channel Locked" : "🔓 Channel Unlocked",
        color: isLocking ? 0xED4245 : 0x57F287,
        description: `**Channel:** <#${targetChannel.id}>\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}${isLocking && durationMinutes > 0 ? `\n**Auto-Unlock:** ${autoUnlockText}` : ""}`,
      });

      if (isLocking && targetChannel.isTextBased() && shouldPostLockNotice(targetChannel.id, interaction.channelId, Boolean(customMessage?.trim()))) {
        await postLockNotice(
          targetChannel,
          buildLockNoticeText({ reason, customMessage, autoUnlockText: durationMinutes > 0 ? autoUnlockText : null }),
          moderator.tag,
        );
      }
    } catch (err) {
      logger.error(`Failed to ${sub} channel in guild ${guildId}`, err);
      await interaction.editReply("❌ Failed to modify channel permissions. Check my permissions.");
    }
  },
};

export default command;
