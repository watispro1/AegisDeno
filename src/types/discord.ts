import type {
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  InteractionResponse,
  Message,
  PermissionResolvable,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandGroupBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

export type BotClient = Client;

export type CommandData =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder
  | SlashCommandSubcommandGroupBuilder;

export interface Command {
  data: CommandData;
  /** Command group used for organization and generated help output. */
  category?: string;
  /** Discord permissions required from the invoking member. */
  userPermissions?: PermissionResolvable[];
  /** Discord permissions required from the bot member. */
  botPermissions?: PermissionResolvable[];
  /** Whether the command may only be invoked inside a guild. */
  guildOnly?: boolean;
  /** Execute the command interaction. */
  execute(interaction: ChatInputCommandInteraction): Promise<void | InteractionResponse<boolean>>;
}

// Compatibility aliases retained for existing modules.
export type { ChatInputCommandInteraction as Interaction };
export type { Message };
export type { GuildMember as Member };
export type { Client as Bot };
