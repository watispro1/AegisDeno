import { logger } from "../../utils/logger";
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
  PermissionOverwriteOptions,
} from "discord.js";
import { Command } from "../../types/discord";
import { sendGuildLog } from "../../services/logging";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Lock or unlock a channel to prevent or allow @everyone from sending messages.")
    .addSubcommand(sub =>
      sub
        .setName("channel")
        .setDescription("Lock a specific channel (or the current one).")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("Channel to lock (defaults to current channel)").setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName("reason").setDescription("Reason for locking").setMaxLength(512).setRequired(false)
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
        .setDescription("Lock ALL text channels in this server (emergency lockdown).")
        .addStringOption(opt =>
          opt.setName("reason").setDescription("Reason for server lockdown").setMaxLength(512).setRequired(false)
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

    await interaction.deferReply();

    try {
      if (sub === "server") {
        // Emergency server lockdown
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          await interaction.editReply("❌ Server lockdown requires **Administrator** permission.");
          return;
        }

        const textChannels = guild.channels.cache.filter(
          c => c.isTextBased() && "permissionOverwrites" in c
        ) as Map<string, TextChannel>;

        let locked = 0;
        for (const [, ch] of textChannels) {
          await ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }).catch(() => null);
          locked++;
        }

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle("🔒 Server Lockdown Activated")
          .setDescription(`**${locked}** channels have been locked.\n\nAll members can no longer send messages until the lockdown is lifted.`)
          .addFields(
            { name: "📝 Reason", value: reason, inline: false },
            { name: "🛡️ Moderator", value: interaction.user.tag, inline: true },
          )
          .setFooter({ text: "Use /lock unlock to restore channels individually." })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        await sendGuildLog(interaction.client, guildId, {
          title: "🔒 Server Lockdown Activated",
          color: 0xED4245,
          description: `**Channels Locked:** ${locked}\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`,
        });
        return;
      }

      // Single channel lock/unlock
      const targetChannel = (interaction.options.getChannel("channel") ?? interaction.channel) as TextChannel | null;
      if (!targetChannel || !("permissionOverwrites" in targetChannel)) {
        await interaction.editReply("❌ Invalid channel — please select a text channel.");
        return;
      }

      const isLocking = sub === "channel";
      const overwrite: PermissionOverwriteOptions = { SendMessages: isLocking ? false : null };
      await targetChannel.permissionOverwrites.edit(guild.roles.everyone, overwrite);

      const embed = new EmbedBuilder()
        .setColor(isLocking ? 0xED4245 : 0x57F287)
        .setTitle(isLocking ? "🔒 Channel Locked" : "🔓 Channel Unlocked")
        .addFields(
          { name: "📌 Channel",   value: `<#${targetChannel.id}>`, inline: true },
          { name: "📝 Reason",    value: reason, inline: false },
          { name: "🛡️ Moderator", value: interaction.user.tag, inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      await sendGuildLog(interaction.client, guildId, {
        title: isLocking ? "🔒 Channel Locked" : "🔓 Channel Unlocked",
        color: isLocking ? 0xED4245 : 0x57F287,
        description: `**Channel:** <#${targetChannel.id}>\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`,
      });
    } catch (err) {
      logger.error(`Failed to ${sub} channel in guild ${guildId}`, err);
      await interaction.editReply("❌ Failed to modify channel permissions. Check my permissions.");
    }
  },
};

export default command;
