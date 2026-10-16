import type {
  Client,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  AnySelectMenuInteraction,
} from "discord.js";
import type { Command } from "../types/discord";
import type { logger } from "../utils/logger";

export type ComponentInteraction =
  | ButtonInteraction
  | ModalSubmitInteraction
  | AnySelectMenuInteraction;

export interface PluginContext<TConfig = any> {
  client: Client;
  plugin: KnubPlugin<TConfig>;
  config: TConfig;
  getPlugin<T = any>(name: string): KnubPlugin<T> | undefined;
  getGuildConfig(guildId: string): Promise<TConfig>;
  logger: typeof logger;
}

export interface PluginEventListener<TEvent extends string = string> {
  event: TEvent;
  listener: (ctx: PluginContext<any>, ...args: any[]) => Promise<void> | void;
}

export interface PluginCustomIdHandler {
  pattern: string | RegExp;
  handler: (
    interaction: ComponentInteraction,
    match: RegExpMatchArray | null,
    ctx: PluginContext<any>,
  ) => Promise<void> | void;
}

export interface KnubPluginDefinition<TConfig = any> {
  name: string;
  description: string;
  version?: string;
  defaultConfig?: TConfig;
  commands?: Command[];
  events?: PluginEventListener[];
  customIdHandlers?: PluginCustomIdHandler[];
  onLoad?: (ctx: PluginContext<TConfig>) => Promise<void> | void;
  onUnload?: (ctx: PluginContext<TConfig>) => Promise<void> | void;
  onGuildLoaded?: (guildId: string, guildConfig: TConfig) => Promise<void> | void;
}

export interface KnubPlugin<TConfig = any> extends Required<Omit<KnubPluginDefinition<TConfig>, "onLoad" | "onUnload" | "onGuildLoaded">> {
  onLoad?: (ctx: PluginContext<TConfig>) => Promise<void> | void;
  onUnload?: (ctx: PluginContext<TConfig>) => Promise<void> | void;
  onGuildLoaded?: (guildId: string, guildConfig: TConfig) => Promise<void> | void;
}

export interface CommandContext {
  interaction: ChatInputCommandInteraction;
  command: Command;
  plugin?: KnubPlugin<any>;
  client: Client;
  guildId?: string;
  userId: string;
  startedAt: number;
  metadata: Map<string, any>;
}

export interface CommandFilterResult {
  ok: boolean;
  error?: string;
}

export interface CommandFilter {
  name: string;
  execute: (ctx: CommandContext) => Promise<CommandFilterResult | boolean | void>;
}

export interface CommandPostHook {
  name: string;
  execute: (
    ctx: CommandContext,
    result: { success: boolean; error?: unknown },
  ) => Promise<void> | void;
}
