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
} from "discord.js";
import { Command } from "../../types/discord";
import { sendGuildLog } from "../../services/logging";

// Track timed unlocks in memory (per channel)
const timedUnlocks = new Map<string, ReturnType<typeof setTimeout>>();

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
      if (!targetChannel || !("permissionOverwrites" in targetChannel)) {
        return interaction.reply({ content: "❌ Invalid channel.", ephemeral: true });
      }

      const overwrite = targetChannel.permissionOverwrites.cache.get(guild.roles.everyone.id);
      const isLocked = overwrite?.deny.has(PermissionFlagsBits.SendMessages) ?? false;
      const hasPendingUnlock = timedUnlocks.has(targetChannel.id);

      const embed = new EmbedBuilder()
        .setColor(isLocked ? 0xED4245 : 0x57F287)
        .setTitle(isLocked ? "🔒 Channel is Locked" : "🔓 Channel is Open")
        .addFields(
          { name: "📌 Channel",         value: `<#${targetChannel.id}>`, inline: true },
          { name: "📊 Status",           value: isLocked ? "🔒 Locked — @everyone cannot send" : "🔓 Open — @everyone can send", inline: true },
          { name: "⏰ Auto-Unlock Pending", value: hasPendingUnlock ? "Yes" : "No", inline: true },
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Server lockdown
    if (sub === "server") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: "❌ Server lockdown requires **Administrator** permission.", ephemeral: true });
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
        ephemeral: true,
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
          const textChannels = guild.channels.cache.filter(
            c => c.isTextBased() && "permissionOverwrites" in c
          ) as Map<string, TextChannel>;

          let locked = 0;
          for (const [, ch] of textChannels) {
            await ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }).catch(() => null);
            locked++;
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

    // Single channel lock / unlock
    await interaction.deferReply();

    try {
      const targetChannel = (interaction.options.getChannel("channel") ?? interaction.channel) as TextChannel | null;
      if (!targetChannel || !("permissionOverwrites" in targetChannel)) {
        await interaction.editReply("❌ Invalid channel — please select a text channel.");
        return;
      }

      const isLocking = sub === "channel";
      const durationMinutes = isLocking ? (interaction.options.getInteger("duration_minutes") ?? 0) : 0;

      const overwrite: PermissionOverwriteOptions = { SendMessages: isLocking ? false : null };
      await targetChannel.permissionOverwrites.edit(guild.roles.everyone, overwrite);

      // Cancel any existing timed unlock for this channel
      const existingTimer = timedUnlocks.get(targetChannel.id);
      if (existingTimer) {
        clearTimeout(existingTimer);
        timedUnlocks.delete(targetChannel.id);
      }

      let autoUnlockText = "None";
      if (isLocking && durationMinutes > 0) {
        const unlockAt = new Date(Date.now() + durationMinutes * 60_000);
        autoUnlockText = `<t:${Math.floor(unlockAt.getTime() / 1000)}:R>`;

        const timer = setTimeout(async () => {
          timedUnlocks.delete(targetChannel.id);
          await targetChannel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null }).catch(() => null);
          await sendGuildLog(interaction.client, guildId, {
            title: "🔓 Auto-Unlock",
            color: 0x57F287,
            description: `**Channel:** <#${targetChannel.id}> was automatically unlocked after ${durationMinutes} minute(s).\n**Original Moderator:** ${interaction.user.tag}`,
          });
          // Send a public message in the unlocked channel
          await targetChannel.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle("🔓 Channel Unlocked")
                .setDescription(`This channel has been automatically unlocked after a ${durationMinutes}-minute lockdown.`)
                .setTimestamp(),
            ],
          }).catch(() => null);
        }, durationMinutes * 60_000);

        timedUnlocks.set(targetChannel.id, timer);
      }

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

      // If locking publicly, send a notice in the locked channel (unless it's the current channel)
      if (isLocking && targetChannel.id !== interaction.channelId) {
        await targetChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xED4245)
              .setTitle("🔒 This channel has been locked")
              .setDescription(`**Reason:** ${reason}${durationMinutes > 0 ? `\n**Auto-unlock:** ${autoUnlockText}` : ""}`)
              .setFooter({ text: `Locked by ${interaction.user.tag}` })
              .setTimestamp(),
          ],
        }).catch(() => null);
      }
    } catch (err) {
      logger.error(`Failed to ${sub} channel in guild ${guildId}`, err);
      await interaction.editReply("❌ Failed to modify channel permissions. Check my permissions.");
    }
  },
};

export default command;
