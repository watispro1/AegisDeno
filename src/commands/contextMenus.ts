/**
 * Right-click (Apps menu) commands: User Info and Avatar on a member,
 * Report Message and Remind Me About This on a message. They run through executeContextMenu, so they get
 * the same guild-only, permission, cooldown and error-ID handling as slash commands.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  InteractionContextType,
  MessageFlags,
  type EmbedData,
  type ContextMenuCommandInteraction,
  type Message,
  type MessageContextMenuCommandInteraction,
  type RESTPostAPIContextMenuApplicationCommandsJSONBody,
  type UserContextMenuCommandInteraction,
} from "discord.js";
import type { ContextMenu } from "../types/discord";
import { executeContextMenu } from "./executor";
import { logger } from "../utils/logger";
import { showUserInfo } from "./general/userinfo";
import { showAvatar } from "./general/avatar";
import { sendGuildLog } from "../services/logging";
import { truncate } from "../utils/safeText";
import { remindAboutMessage } from "./general/remindme/message";
import { memberPageUrl } from "../config/links";

const userInfo: ContextMenu = {
  data: new ContextMenuCommandBuilder().setName("User Info").setType(ApplicationCommandType.User),
  description: "Right-click a member → Apps → User Info: their profile (mods also see cases and trust).",
  guildOnly: true,
  execute: (interaction) => showUserInfo(interaction as UserContextMenuCommandInteraction, (interaction as UserContextMenuCommandInteraction).targetUser),
};

const avatar: ContextMenu = {
  data: new ContextMenuCommandBuilder().setName("Avatar").setType(ApplicationCommandType.User),
  description: "Right-click a member → Apps → Avatar: avatar, server avatar and banner.",
  guildOnly: true,
  execute: (interaction) => showAvatar(interaction as UserContextMenuCommandInteraction, (interaction as UserContextMenuCommandInteraction).targetUser, "main", true),
};

/** The log entry for a reported message. Pure, so it can be tested without Discord. */
export function reportLogEmbed(
  message: Pick<Message, "id" | "content" | "url" | "channelId" | "createdTimestamp"> & { author: { id: string; tag: string }; attachments: { size: number } },
  reporter: { id: string; tag: string },
): Omit<EmbedData, "timestamp"> {
  const content = message.content?.trim() ? truncate(message.content, 1000) : "*(no text content)*";
  return {
    title: "🚩 Message reported",
    color: 0xf59e0b,
    description: `${content}\n\n[Jump to message](${message.url})`,
    fields: [
      { name: "Author", value: `<@${message.author.id}> (${message.author.tag} · \`${message.author.id}\`)`, inline: true },
      { name: "Reported by", value: `<@${reporter.id}> (${reporter.tag})`, inline: true },
      { name: "Channel", value: `<#${message.channelId}>`, inline: true },
      { name: "Sent", value: `<t:${Math.floor(message.createdTimestamp / 1000)}:R>`, inline: true },
      ...(message.attachments.size ? [{ name: "Attachments", value: String(message.attachments.size), inline: true }] : []),
    ],
    footer: { text: `Message ID ${message.id}` },
  };
}

/** Link buttons on the report: the message itself and the author's dashboard page. Pure. */
export function reportLinks(guildId: string, message: { url: string; author: { id: string } }): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Jump to message").setURL(message.url),
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Author on dashboard").setURL(memberPageUrl(guildId, message.author.id)),
  );
}

/** Why a message can't be reported, or null. Aegis's own and Discord system messages aren't member content. Pure. */
export function reportBlock(message: { author: { id: string }; system?: boolean | null }, reporterId: string, botId: string | null | undefined): "own" | "bot-self" | "system" | null {
  if (message.author.id === reporterId) return "own";
  if (botId && message.author.id === botId) return "bot-self";
  if (message.system) return "system";
  return null;
}

/** What the reporter is told, privately. */
export function reportReply(outcome: "sent" | "no-log" | "own" | "bot-self" | "system"): string {
  if (outcome === "own") return "❌ You can't report your own message.";
  if (outcome === "bot-self") return "❌ That's an Aegis message. If something's wrong with it, tell a moderator directly.";
  if (outcome === "system") return "❌ Discord system messages (joins, boosts, pins) can't be reported.";
  if (outcome === "sent") return "✅ Thanks — the message was reported to this server's moderators. The author isn't told who reported it.";
  return "⚠️ This server has no log channel set up (or logging is off or unreachable), so the report couldn't be delivered. Please contact a moderator directly. (Admins: check `/logging status` or `/diagnostics`.)";
}

const reportMessage: ContextMenu = {
  data: new ContextMenuCommandBuilder().setName("Report Message").setType(ApplicationCommandType.Message),
  description: "Right-click a message → Apps → Report Message: privately flags it to the moderators' log.",
  guildOnly: true,
  cooldownMs: 30_000,
  async execute(raw) {
    const interaction = raw as MessageContextMenuCommandInteraction;
    const message = interaction.targetMessage;
    const blocked = reportBlock(message, interaction.user.id, interaction.client.user?.id);
    if (blocked) {
      await interaction.reply({ content: reportReply(blocked), flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const sent = await sendGuildLog(interaction.client, interaction.guildId!, reportLogEmbed(message, interaction.user), undefined, [reportLinks(interaction.guildId!, message)]);
    await interaction.editReply({ content: reportReply(sent ? "sent" : "no-log") });
  },
};

const remindMe: ContextMenu = {
  data: new ContextMenuCommandBuilder().setName("Remind Me About This").setType(ApplicationCommandType.Message),
  description: "Right-click a message → Apps → Remind Me About This: pick when, and Aegis DMs you a link back to it.",
  guildOnly: true,
  cooldownMs: 5_000,
  execute: (interaction) => remindAboutMessage(interaction as MessageContextMenuCommandInteraction),
};

export const contextMenus = new Map<string, ContextMenu>(
  [userInfo, avatar, reportMessage, remindMe].map((menu) => [menu.data.name, menu]),
);

/** Runs the context menu the interaction names (from client.ts's interactionCreate). */
export async function dispatchContextMenu(interaction: ContextMenuCommandInteraction): Promise<void> {
  const menu = contextMenus.get(interaction.commandName);
  if (menu) await executeContextMenu(menu, interaction);
  else logger.warn(`Unknown context menu: ${interaction.commandName}`);
}

/** Registration payloads for the context menus (server-only). */
export function contextMenuRegistrationData(): RESTPostAPIContextMenuApplicationCommandsJSONBody[] {
  return Array.from(contextMenus.values(), (menu) => {
    const data = menu.data.toJSON() as RESTPostAPIContextMenuApplicationCommandsJSONBody;
    if (menu.guildOnly) {
      data.contexts ??= [InteractionContextType.Guild];
      data.dm_permission = false;
    }
    return data;
  });
}
