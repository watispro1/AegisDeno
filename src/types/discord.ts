import {
  ChatInputCommandInteraction,
  Client,
  Collection,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  PermissionResolvable,
  Message,
  GuildMember,
} from "discord.js";

// The main client type used across the bot
export type BotClient = Client;

// Removed BotInteraction

// Command structure
export interface Command {
  data: any;
  /** Optional permission required for the user to run this command */
  userPermissions?: PermissionResolvable[];
  /** Optional permission required for the bot to run this command */
  botPermissions?: PermissionResolvable[];
  /** Whether command is restricted to guild context only */
  guildOnly?: boolean;
  execute(interaction: ChatInputCommandInteraction): Promise<any>;
}

// Legacy name alias so existing commands don't need mass-rename
export type { ChatInputCommandInteraction as Interaction };
export type { Message };
export type { GuildMember as Member };
export type { Client as Bot };
