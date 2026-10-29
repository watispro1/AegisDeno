import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Guild,
  GuildMember,
  StringSelectMenuBuilder,
  TextChannel,
} from "discord.js";
import { RolePanelModel } from "../database/mongo";
import { logger } from "../utils/logger";
import { sendGuildLog } from "./logging";
import {
  meetsPanelRequirement,
  normalizePanelMode,
  normalizePanelStyle,
  planRoleChanges,
  rolePanelSelectCustomId,
  type RolePanelMode,
  type RolePanelStyle,
} from "./rolePanelLogic";

export interface RolePanelOptions {
  /** "button" (default) or "dropdown" (select menu). */
  style?: RolePanelStyle;
  /** "multi" (default) toggles each role; "exclusive" lets a member hold only one panel role. */
  mode?: RolePanelMode;
  /** Members must hold this role to use the panel. */
  requiredRoleId?: string | null;
}

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
  panelStyle?: RolePanelStyle;
  mode?: RolePanelMode;
  requiredRoleId?: string | null;
  createdAt: Date;
}

export async function createRolePanel(
  guild: Guild,
  channel: TextChannel,
  title: string,
  description: string,
  roles: RolePanelOption[],
  options: RolePanelOptions = {},
): Promise<RolePanel | null> {
  try {
    const panelId = `panel-${crypto.randomUUID()}`;
    const panelStyle = normalizePanelStyle(options.style);
    const mode = normalizePanelMode(options.mode);
    const requiredRoleId = options.requiredRoleId ?? null;
    const shown = roles.slice(0, panelStyle === "dropdown" ? 25 : 5); // 5 buttons per row; 25 select options

    const footer = [
      panelStyle === "dropdown"
        ? (mode === "exclusive" ? "Pick one role from the menu. Picking it again removes it." : "Pick roles from the menu to toggle them.")
        : (mode === "exclusive" ? "Click a button to take that role; you can hold only one." : "Click a button below to toggle your roles."),
    ].join(" ");

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(0x9B59B6)
      .setDescription(requiredRoleId ? `${description}\n\n🔒 Requires <@&${requiredRoleId}>.` : description)
      .setFooter({ text: footer });

    let components: ActionRowBuilder<ButtonBuilder>[] | ActionRowBuilder<StringSelectMenuBuilder>[];
    if (panelStyle === "dropdown") {
      const menu = new StringSelectMenuBuilder()
        .setCustomId(rolePanelSelectCustomId(panelId))
        .setPlaceholder(mode === "exclusive" ? "Choose a role…" : "Choose roles…")
        .setMinValues(1)
        .setMaxValues(mode === "exclusive" ? 1 : shown.length)
        .addOptions(
          shown.map(item => ({
            label: item.label.slice(0, 100),
            value: item.roleId,
            ...(item.emoji ? { emoji: item.emoji } : {}),
          })),
        );
      components = [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)];
    } else {
      const row = new ActionRowBuilder<ButtonBuilder>();
      for (const item of shown) {
        const btn = new ButtonBuilder()
          .setCustomId(`rolepanel_${panelId}_${item.roleId}`)
          .setLabel(item.label)
          .setStyle(item.style || ButtonStyle.Primary);

        if (item.emoji) {
          btn.setEmoji(item.emoji);
        }
        row.addComponents(btn);
      }
      components = [row];
    }

    const message = await channel.send({ embeds: [embed], components });

    const doc = await RolePanelModel.create({
      id: panelId,
      guildId: guild.id,
      channelId: channel.id,
      messageId: message.id,
      title,
      description,
      roles: shown,
      panelStyle,
      mode,
      requiredRoleId,
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

export interface PanelChangeResult {
  added: string[];
  removed: string[];
}

/**
 * Apply a member's pick on a panel (button click or dropdown selection), honouring the
 * panel's mode and required role. Throws with a user-facing message when it cannot.
 */
export async function applyRolePanelPick(
  guild: Guild,
  member: GuildMember,
  panelId: string,
  messageId: string,
  pickedRoleIds: readonly string[],
): Promise<PanelChangeResult> {
  const panel = await RolePanelModel.findOne({ id: panelId, guildId: guild.id, messageId }).lean();
  if (!panel) throw new Error("This role panel is no longer active.");

  const held = [...member.roles.cache.keys()];
  if (!meetsPanelRequirement(held, panel.requiredRoleId)) {
    throw new Error(`You need the <@&${panel.requiredRoleId}> role to use this panel.`);
  }

  const panelRoleIds = panel.roles.map(r => r.roleId);
  const plan = planRoleChanges(held, panelRoleIds, pickedRoleIds, normalizePanelMode(panel.mode));
  if (plan.add.length === 0 && plan.remove.length === 0) {
    throw new Error("That role is not part of this panel.");
  }

  const resolve = async (roleId: string) => {
    const role = guild.roles.cache.get(roleId) ?? await guild.roles.fetch(roleId).catch(() => null);
    if (!role) throw new Error("Role no longer exists.");
    if (role.managed || !role.editable) {
      throw new Error("I cannot manage that role. Check my role position and permissions.");
    }
    return role;
  };

  const toAdd = await Promise.all(plan.add.map(resolve));
  const toRemove = await Promise.all(plan.remove.map(resolve));

  if (toRemove.length) await member.roles.remove(toRemove, "Role panel");
  if (toAdd.length) await member.roles.add(toAdd, "Role panel");

  return { added: toAdd.map(r => r.name), removed: toRemove.map(r => r.name) };
}

/** Button-panel toggle kept for callers of the original API. */
export async function toggleRoleFromPanel(
  guild: Guild,
  member: GuildMember,
  roleId: string,
  panelId: string,
  messageId: string,
): Promise<{ added: boolean; roleName: string }> {
  const res = await applyRolePanelPick(guild, member, panelId, messageId, [roleId]);
  const added = res.added.length > 0;
  return { added, roleName: added ? res.added[0] : res.removed[0] };
}

/** One-line summary of a panel change for the ephemeral reply. */
export function describePanelChange(res: PanelChangeResult): string {
  const parts: string[] = [];
  if (res.added.length) parts.push(`✅ Granted ${res.added.map(n => `**${n}**`).join(", ")}.`);
  if (res.removed.length) parts.push(`🗑️ Removed ${res.removed.map(n => `**${n}**`).join(", ")}.`);
  return parts.join(" ") || "No changes.";
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

/**
 * Post a saved role panel again, in `channel` (which may be its current one).
 * The new message is created first, then the old panel and its message are
 * removed, so a failed send leaves the existing panel working. Used by the web
 * dashboard; the panel's roles, style, mode and requirement are unchanged.
 */
export async function repostRolePanel(guild: Guild, id: string, channel: TextChannel): Promise<RolePanel | null> {
  const doc = await RolePanelModel.findOne({ guildId: guild.id, id }).lean().catch(() => null);
  if (!doc) return null;
  const roles: RolePanelOption[] = (doc.roles ?? []).map((r: any) => ({
    roleId: String(r.roleId),
    label: String(r.label),
    emoji: r.emoji ?? null,
    style: typeof r.style === "number" ? r.style : undefined,
  }));
  const created = await createRolePanel(guild, channel, doc.title, doc.description, roles, {
    style: normalizePanelStyle(doc.panelStyle),
    mode: normalizePanelMode(doc.mode),
    requiredRoleId: doc.requiredRoleId ?? null,
  });
  if (!created) return null;
  await deleteRolePanel(guild, id);
  return created;
}
