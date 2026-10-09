import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Guild,
  GuildMember,
  TextChannel,
} from "discord.js";
import { VerificationModel } from "../database/mongo";
import { logger } from "../utils/logger";
import { sendGuildLog } from "./logging";

export interface VerificationConfig {
  guildId: string;
  enabled: boolean;
  verifiedRoleId: string;
  type: "button" | "captcha";
  channelId: string | null;
  messageId: string | null;
}

export async function getVerificationConfig(guildId: string): Promise<VerificationConfig | null> {
  const doc = await VerificationModel.findOne({ guildId });
  if (!doc) return null;
  return {
    guildId: doc.guildId,
    enabled: doc.enabled,
    verifiedRoleId: doc.verifiedRoleId,
    type: doc.type as "button" | "captcha",
    channelId: doc.channelId ?? null,
    messageId: doc.messageId ?? null,
  };
}

export async function setupVerification(
  guild: Guild,
  channel: TextChannel,
  verifiedRoleId: string,
  type: "button" | "captcha" = "button",
  title = "🛡️ Server Verification Required",
  description = "Click the button below to verify your account and gain access to the rest of the server."
): Promise<VerificationConfig | null> {
  try {
    // Purge previous verification panel messages in this channel to prevent duplicates
    const fetchedMsgs = await channel.messages.fetch({ limit: 50 }).catch(() => null);
    if (fetchedMsgs) {
      const oldPanels = fetchedMsgs.filter(
        (m) =>
          m.author.id === guild.client.user?.id &&
          m.components.some((row: any) => row.components?.some((c: any) => c.customId === "verify_start"))
      );
      for (const [, msg] of oldPanels) {
        await msg.delete().catch(() => null);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(0x2ECC71)
      .setDescription(description)
      .setFooter({ text: "Aegis Anti-Raid & Verification System" });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("verify_start")
        .setLabel(type === "captcha" ? "Verify with CAPTCHA" : "Verify Account")
        .setStyle(ButtonStyle.Success)
        .setEmoji("✅")
    );

    const msg = await channel.send({ embeds: [embed], components: [row] });

    const config = await VerificationModel.findOneAndUpdate(
      { guildId: guild.id },
      {
        $set: {
          enabled: true,
          verifiedRoleId,
          type,
          channelId: channel.id,
          messageId: msg.id,
        },
      },
      { upsert: true, new: true }
    );

    await sendGuildLog(guild.client, guild.id, {
      title: "🛡️ Verification System Configured",
      color: 0x2ECC71,
      description: `Verification panel posted in <#${channel.id}>.\n**Verified Role:** <@&${verifiedRoleId}>\n**Type:** ${type}`,
    });

    return {
      guildId: config.guildId,
      enabled: config.enabled,
      verifiedRoleId: config.verifiedRoleId,
      type: config.type as "button" | "captcha",
      channelId: config.channelId ?? null,
      messageId: config.messageId ?? null,
    };
  } catch (err) {
    logger.error("Failed to setup verification:", err);
    return null;
  }
}

export async function processVerification(
  guild: Guild,
  member: GuildMember
): Promise<{ success: boolean; message: string }> {
  try {
    const config = await getVerificationConfig(guild.id);
    if (!config || !config.enabled) {
      return { success: false, message: "Verification system is not enabled on this server." };
    }

    if (member.roles.cache.has(config.verifiedRoleId)) {
      return { success: true, message: "You are already verified!" };
    }

    const role = guild.roles.cache.get(config.verifiedRoleId);
    if (!role) {
      return { success: false, message: "Configured verified role no longer exists." };
    }

    await member.roles.add(role, "Completed server verification");

    await sendGuildLog(guild.client, guild.id, {
      title: "✅ Member Verified",
      color: 0x2ECC71,
      description: `${member.user.tag} (<@${member.user.id}>) completed server verification.`,
    });

    return { success: true, message: `Verification successful! You have been granted the **${role.name}** role.` };
  } catch (err) {
    logger.error("Failed to process verification:", err);
    return { success: false, message: "An error occurred while granting the verified role." };
  }
}
