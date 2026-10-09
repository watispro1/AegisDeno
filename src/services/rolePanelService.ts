import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Guild,
  GuildMember,
  TextChannel,
} from "discord.js";
import { RolePanelModel } from "../database/mongo";
import { logger } from "../utils/logger";
import { sendGuildLog } from "./logging";

export interface RolePanelOption {
  roleId: string;
  label: string;
  emoji?: string | null;
  style?: number;
}

export interface RolePanel {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  title: string;
  description: string;
  roles: RolePanelOption[];
  createdAt: Date;
}

export async function createRolePanel(
  guild: Guild,
  channel: TextChannel,
  title: string,
  description: string,
  roles: RolePanelOption[]
): Promise<RolePanel | null> {
  try {
    const panelId = `panel-${Math.random().toString(36).substring(2, 8)}`;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(0x9B59B6)
      .setDescription(description)
      .setFooter({ text: "Click a button below to toggle your roles." });

    const row = new ActionRowBuilder<ButtonBuilder>();

    for (const item of roles.slice(0, 5)) { // Max 5 buttons per row
      const btn = new ButtonBuilder()
        .setCustomId(`rolepanel_${panelId}_${item.roleId}`)
        .setLabel(item.label)
        .setStyle(item.style || ButtonStyle.Primary);

      if (item.emoji) {
        btn.setEmoji(item.emoji);
      }
      row.addComponents(btn);
    }

    const message = await channel.send({ embeds: [embed], components: [row] });

    const doc = await RolePanelModel.create({
      id: panelId,
      guildId: guild.id,
      channelId: channel.id,
      messageId: message.id,
      title,
      description,
      roles,
    });

    await sendGuildLog(guild.client, guild.id, {
      title: "🎭 Role Panel Created",
      color: 0x9B59B6,
      description: `Role panel **${title}** created in <#${channel.id}>.`,
    });

    return doc.toObject() as RolePanel;
  } catch (err) {
    logger.error("Failed to create role panel:", err);
    return null;
  }
}

export async function toggleRoleFromPanel(
  guild: Guild,
  member: GuildMember,
  roleId: string
): Promise<{ added: boolean; roleName: string }> {
  const role = guild.roles.cache.get(roleId);
  if (!role) {
    throw new Error("Role no longer exists.");
  }

  if (member.roles.cache.has(roleId)) {
    await member.roles.remove(role, "Role panel toggle");
    return { added: false, roleName: role.name };
  } else {
    await member.roles.add(role, "Role panel toggle");
    return { added: true, roleName: role.name };
  }
}

export async function getRolePanels(guildId: string): Promise<RolePanel[]> {
  try {
    const docs = await RolePanelModel.find({ guildId }).sort({ createdAt: -1 });
    return docs.map(d => d.toObject() as RolePanel);
  } catch {
    return [];
  }
}

export async function deleteRolePanel(guild: Guild, id: string): Promise<boolean> {
  try {
    const doc = await RolePanelModel.findOne({ guildId: guild.id, id });
    if (!doc) return false;

    if (doc.channelId && doc.messageId) {
      const channel = (guild.channels.cache.get(doc.channelId) || (await guild.channels.fetch(doc.channelId).catch(() => null))) as TextChannel | null;
      if (channel) {
        const msg = await channel.messages.fetch(doc.messageId).catch(() => null);
        if (msg) await msg.delete().catch(() => null);
      }
    }

    const res = await RolePanelModel.deleteOne({ guildId: guild.id, id });
    return res.deletedCount > 0;
  } catch {
    return false;
  }
}
