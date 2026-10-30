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
import { createTask, deleteTask, getTasksForChannel } from "../../services/scheduler";
import { scheduleTask, cancelTask } from "../../services/schedulerRunner";
import { encodeChannelUnlock } from "../../services/timedActions";
import { LOCK_MESSAGE_MAX, buildLockNoticeText, shouldPostLockNotice } from "../../services/lockNotice";
import { isObfuscatedChannel, hiddenChannelMessage } from "../../utils/channels";

type LockableChannel = Extract<GuildBasedChannel, { permissionOverwrites: unknown }>;

/**
 * A channel Aegis may lock. Obfuscated channels (Aegis lacks View Channel) are
 * never lockable: their overwrites are a placeholder, and editing them would
 * clobber the channel's real permissions.
 */
export function isLockable(ch: GuildBasedChannel | null | undefined): ch is LockableChannel {
  return Boolean(ch && !isObfuscatedChannel(ch) && !ch.isThread() && ch.type !== ChannelType.GuildCategory && "permissionOverwrites" in ch);
}

/** Channels inside a category that a lock applies to. */
function categoryChildren(guild: Guild, categoryId: string): LockableChannel[] {
  return [...guild.channels.cache.values()]
    .filter((ch): ch is LockableChannel => ch.parentId === categoryId && isLockable(ch))
    .sort((a, b) => ("position" in a && "position" in b ? a.position - b.position : 0));
}

/**
 * Lock or unlock one channel, replace any pending auto-unlock, and (when
 * locking with a duration) persist a new one on the scheduler.
 * Returns the auto-unlock markup, "None", or a warning string.
 */
async function applyLock(
  client: Client,
  guild: Guild,
  channel: LockableChannel,
  isLocking: boolean,
  durationMinutes: number,
  moderator: { id: string; tag: string },
): Promise<string> {
  await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: isLocking ? false : null });
  await clearPendingUnlocks(guild.id, channel.id);

  if (!isLocking || durationMinutes <= 0) return "None";
  const unlockAt = new Date(Date.now() + durationMinutes * 60_000);
  try {
    // Persisted so a restart or deploy can't leave the channel locked forever.
    const task = await createTask(
      guild.id,
      channel.id,
      moderator.id,
      "channel_unlock",
      encodeChannelUnlock({ moderatorTag: moderator.tag, durationMinutes }),
      unlockAt,
    );
    scheduleTask(client, task);
    return `<t:${Math.floor(unlockAt.getTime() / 1000)}:R>`;
  } catch (err) {
    logger.error(`Failed to schedule auto-unlock for channel ${channel.id} in guild ${guild.id}`, err);
    return "⚠️ Could not be scheduled — use /lock unlock";
  }
}

async function postLockNotice(channel: LockableChannel, text: string, moderatorTag: string): Promise<void> {
  if (!("send" in channel) || typeof channel.send !== "function") return;
  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle("🔒 This channel has been locked")
        .setDescription(text)
        .setFooter({ text: `Locked by ${moderatorTag}` })
        .setTimestamp(),
    ],
  }).catch(() => null);
}

/** Cancel and remove every pending persisted auto-unlock for a channel. */
async function clearPendingUnlocks(guildId: string, channelId: string): Promise<void> {
  const pending = await getTasksForChannel(guildId, channelId, "channel_unlock");
  for (const task of pending) {
    cancelTask(task.id!);
    await deleteTask(guildId, task.id!);
  }
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
          for (const [, ch] of channelCollection) {
            // Skip channels hidden from Aegis: their overwrites are not real.
            if (ch && !isObfuscatedChannel(ch) && ch.isTextBased() && !ch.isThread?.() && "permissionOverwrites" in ch) {
              await (ch as TextChannel).permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }).catch(() => null);
              locked++;
            }
          }

          const resultEmbed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("🔒 Server Lockdown Active")
            .setDescription(`**${locked}** channel(s) have been locked. Members cannot send messages until the lockdown is lifted.`)
            .addFields(
              { name: "📝 Reason",     value: reason, inline: false },
              { name: "🛡️ Moderator", value: interaction.user.tag, inline: true },
              { name: "📌 Channels",   value: `${locked} locked`, inline: true },
            )
            .setFooter({ text: "Use /lock unlock to restore individual channels." })
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

    // Category lock / unlock
    const category = sub === "category" || sub === "unlock" ? interaction.options.getChannel("category") : null;
    if (category) {
      if (category.type !== ChannelType.GuildCategory) {
        return interaction.reply({ content: "❌ Please pick a category.", flags: MessageFlags.Ephemeral });
      }
      const isLocking = sub === "category";
      const durationMinutes = isLocking ? (interaction.options.getInteger("duration_minutes") ?? 0) : 0;
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
      const durationMinutes = isLocking ? (interaction.options.getInteger("duration_minutes") ?? 0) : 0;
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
