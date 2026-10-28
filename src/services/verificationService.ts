import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Guild,
  GuildMember,
  TextChannel,
} from "discord.js";
import { VerificationModel } from "../database/mongo";
import { logger } from "../utils/logger";
import { sendGuildLog } from "./logging";
import { createTask, deleteTasksForCreatorInGuild, type ScheduledTask } from "./scheduler";
import { CaptchaStore, decodeVerifyKick, encodeVerifyKick, normalizeKickMinutes } from "./verificationLogic";

/** Issued math captchas, keyed by guild + user. Answers never leave the process. */
export const captchaStore = new CaptchaStore();

export interface VerificationConfig {
  guildId: string;
  enabled: boolean;
  verifiedRoleId: string;
  type: "button" | "captcha";
  channelId: string | null;
  messageId: string | null;
  kickUnverifiedMinutes: number;
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
    kickUnverifiedMinutes: normalizeKickMinutes((doc as any).kickUnverifiedMinutes ?? 0),
  };
}

/** Change the unverified auto-kick delay without re-posting the panel. Returns false if not set up. */
export async function setKickUnverifiedMinutes(guildId: string, minutes: number): Promise<boolean> {
  const res = await VerificationModel.updateOne(
    { guildId },
    { $set: { kickUnverifiedMinutes: normalizeKickMinutes(minutes) } },
  );
  return res.matchedCount > 0;
}

/**
 * On join: if verification is on with an auto-kick delay, persist a `verify_kick` task
 * so the check survives restarts. The task re-checks state before kicking.
 */
export async function scheduleUnverifiedKick(client: Client, member: GuildMember): Promise<void> {
  if (member.user.bot) return;
  const config = await getVerificationConfig(member.guild.id);
  if (!config?.enabled || config.kickUnverifiedMinutes <= 0) return;

  const at = new Date(Date.now() + config.kickUnverifiedMinutes * 60_000);
  const task = await createTask(
    member.guild.id,
    config.channelId ?? member.guild.id,
    member.id,
    "verify_kick",
    encodeVerifyKick({ userId: member.id }),
    at,
  );
  const { scheduleTask } = await import("./schedulerRunner");
  scheduleTask(client, task);
}

/** Drop a member's pending auto-kick (after they verify or leave). */
export async function clearUnverifiedKick(guildId: string, userId: string): Promise<void> {
  const ids = await deleteTasksForCreatorInGuild(guildId, userId, "verify_kick");
  if (!ids.length) return;
  const { cancelTask } = await import("./schedulerRunner");
  for (const id of ids) cancelTask(id);
}

/** Scheduler handler for `verify_kick`. Kicks only if verification is still on and the member is unverified. */
export async function runVerifyKick(client: Client, task: ScheduledTask): Promise<void> {
  const payload = decodeVerifyKick(task.payload);
  if (!payload) return;

  const config = await getVerificationConfig(task.guildId);
  if (!config?.enabled || config.kickUnverifiedMinutes <= 0) return;

  const guild = client.guilds.cache.get(task.guildId) ?? await client.guilds.fetch(task.guildId).catch(() => null);
  if (!guild) return;
  const member = await guild.members.fetch(payload.userId).catch(() => null);
  if (!member || member.roles.cache.has(config.verifiedRoleId)) return;
  if (!member.kickable) {
    logger.warn(`Verification auto-kick: cannot kick ${member.id} in ${guild.id} (role order or permissions).`);
    return;
  }

  await member.kick(`Unverified after ${config.kickUnverifiedMinutes} minutes`);
  await sendGuildLog(client, guild.id, {
    title: "👢 Member Kicked (Verification Timeout)",
    color: 0xE74C3C,
    description: `${member.user.tag} (<@${member.id}>) was kicked for failing to verify within ${config.kickUnverifiedMinutes} minutes.`,
  }, "modActions");
}

export async function setupVerification(
  guild: Guild,
  channel: TextChannel,
  verifiedRoleId: string,
  type: "button" | "captcha" = "button",
  title = "🛡️ Server Verification Required",
  description = "Click the button below to verify your account and gain access to the rest of the server.",
  kickUnverifiedMinutes = 0
): Promise<VerificationConfig | null> {
  kickUnverifiedMinutes = normalizeKickMinutes(kickUnverifiedMinutes);
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
          kickUnverifiedMinutes,
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
      kickUnverifiedMinutes: (config as any).kickUnverifiedMinutes ?? 0,
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

    const role = guild.roles.cache.get(config.verifiedRoleId) ?? await guild.roles.fetch(config.verifiedRoleId).catch(() => null);
    if (!role) {
      return { success: false, message: "Configured verified role no longer exists." };
    }

    await member.roles.add(role, "Completed server verification");
    await clearUnverifiedKick(guild.id, member.id).catch(() => null);

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
