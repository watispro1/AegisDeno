/**
 * Right-click (Apps menu) commands: User Info and Avatar on a member,
 * Report Message on a message. They run through executeContextMenu, so they get
 * the same guild-only, permission, cooldown and error-ID handling as slash commands.
 */
import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  InteractionContextType,
  MessageFlags,
  type EmbedData,
  type Message,
  type MessageContextMenuCommandInteraction,
  type RESTPostAPIContextMenuApplicationCommandsJSONBody,
  type UserContextMenuCommandInteraction,
} from "discord.js";
import type { ContextMenu } from "../types/discord";
import { showUserInfo } from "./general/userinfo";
import { showAvatar } from "./general/avatar";
import { sendGuildLog } from "../services/logging";
import { truncate } from "../utils/safeText";

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

/** What the reporter is told, privately. */
export function reportReply(outcome: "sent" | "no-log" | "own"): string {
  if (outcome === "own") return "❌ You can't report your own message.";
  if (outcome === "sent") return "✅ Thanks — the message was reported to this server's moderators. The author isn't told who reported it.";
  return "⚠️ This server has no log channel set up, so the report couldn't be delivered. Please contact a moderator directly. (Admins: set one with `/logging` or on the dashboard.)";
}

const reportMessage: ContextMenu = {
  data: new ContextMenuCommandBuilder().setName("Report Message").setType(ApplicationCommandType.Message),
  description: "Right-click a message → Apps → Report Message: privately flags it to the moderators' log.",
  guildOnly: true,
  cooldownMs: 30_000,
  async execute(raw) {
    const interaction = raw as MessageContextMenuCommandInteraction;
    const message = interaction.targetMessage;
    if (message.author.id === interaction.user.id) {
      await interaction.reply({ content: reportReply("own"), flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const sent = await sendGuildLog(interaction.client, interaction.guildId!, reportLogEmbed(message, interaction.user));
    await interaction.editReply({ content: reportReply(sent ? "sent" : "no-log") });
  },
};

export const contextMenus = new Map<string, ContextMenu>(
  [userInfo, avatar, reportMessage].map((menu) => [menu.data.name, menu]),
);

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
