import type {
  Client,
  ChatInputCommandInteraction,
  Guild,
} from "discord.js";
import type { Command } from "../types/discord";
import type {
  KnubPlugin,
  PluginContext,
  CommandContext,
  CommandFilter,
  CommandPostHook,
  ComponentInteraction,
} from "./types";
import {
  guildOnlyFilter,
  userPermissionsFilter,
  botPermissionsFilter,
  cooldownFilter,
  cooldownUpdateHook,
  telemetryHook,
} from "./filters";
import { PluginConfigModel } from "../database/mongo";
import { logger } from "../utils/logger";

async function replyError(
  interaction: ChatInputCommandInteraction,
  content: string,
): Promise<void> {
  const payload = { content, ephemeral: true };

  if (interaction.replied) {
    await interaction.followUp(payload).catch(() => undefined);
  } else if (interaction.deferred) {
    await interaction.editReply(payload).catch(() => undefined);
  } else {
    await interaction.reply(payload).catch(() => undefined);
  }
}

export class KnubManager {
  private client: Client | null = null;
  private plugins = new Map<string, KnubPlugin<any>>();
  private preFilters: CommandFilter[] = [];
  private postHooks: CommandPostHook[] = [];
  private eventCleanups: Array<() => void> = [];

  // In-memory TTL caches (30-second window) to avoid redundant MongoDB queries
  private pluginEnabledCache = new Map<string, { enabled: boolean; expiresAt: number }>();
  private guildConfigCache = new Map<string, { config: any; expiresAt: number }>();

  constructor() {
    // Default Knub Pre-Filter pipeline
    this.addPreFilter(guildOnlyFilter);
    this.addPreFilter(userPermissionsFilter);
    this.addPreFilter(botPermissionsFilter);
    this.addPreFilter(cooldownFilter);

    // Default Knub Post-Hook pipeline
    this.addPostHook(cooldownUpdateHook);
    this.addPostHook(telemetryHook);
  }

  public registerPlugin(plugin: KnubPlugin<any>): void {
    if (this.plugins.has(plugin.name)) {
      return;
    }

    // Verify declared plugin dependencies
    if (plugin.dependencies?.length) {
      for (const dep of plugin.dependencies) {
        if (!this.plugins.has(dep)) {
          logger.warn(
            `[Knub] Plugin "${plugin.name}" declares dependency on "${dep}", which is not yet registered.`,
          );
        }
      }
    }

    this.plugins.set(plugin.name, plugin);
    logger.debug(`[Knub] Registered plugin: ${plugin.name} v${plugin.version}`);
  }

  public getPlugin<T = any>(name: string): KnubPlugin<T> | undefined {
    return this.plugins.get(name) as KnubPlugin<T> | undefined;
  }

  public getAllPlugins(): KnubPlugin<any>[] {
    return Array.from(this.plugins.values());
  }

  public addPreFilter(filter: CommandFilter): void {
    this.preFilters.push(filter);
  }

  public addPostHook(hook: CommandPostHook): void {
    this.postHooks.push(hook);
  }

  public async initialize(client: Client): Promise<void> {
    this.client = client;

    for (const plugin of this.plugins.values()) {
      const ctx = this.createContext(plugin);

      // Register plugin-level event listeners
      if (plugin.events?.length) {
        for (const item of plugin.events) {
          const handler = async (...args: any[]) => {
            try {
              await item.listener(ctx, ...args);
            } catch (err) {
              logger.error(
                `[Knub] Event error in plugin "${plugin.name}" for event "${item.event}":`,
                err,
              );
            }
          };

          client.on(item.event as any, handler);
          this.eventCleanups.push(() => client.off(item.event as any, handler));
        }
      }

      // Execute plugin onLoad hook
      if (plugin.onLoad) {
        try {
          await plugin.onLoad(ctx);
          logger.info(`[Knub] Initialized plugin "${plugin.name}"`);
        } catch (err) {
          logger.error(`[Knub] Failed to initialize plugin "${plugin.name}":`, err);
        }
      }
    }

    // Dispatch onGuildLoaded for all guilds currently cached in memory
    if (client.guilds.cache.size > 0) {
      for (const guild of client.guilds.cache.values()) {
        await this.handleGuildCreate(guild);
      }
    }
  }

  /** Called when the bot joins a server or during initial startup synchronization. */
  public async handleGuildCreate(guild: Guild): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.onGuildLoaded) {
        try {
          const isEnabled = await this.isPluginEnabledForGuild(guild.id, plugin.name);
          if (isEnabled) {
            const config = await this.getGuildPluginConfig(guild.id, plugin.name);
            await plugin.onGuildLoaded(guild.id, config);
          }
        } catch (err) {
          logger.warn(
            `[Knub] Error in onGuildLoaded for plugin "${plugin.name}" in guild "${guild.id}":`,
            err,
          );
        }
      }
    }
  }

  public async unloadAll(): Promise<void> {
    for (const cleanup of this.eventCleanups) {
      cleanup();
    }
    this.eventCleanups = [];
    this.pluginEnabledCache.clear();
    this.guildConfigCache.clear();

    for (const plugin of this.plugins.values()) {
      if (plugin.onUnload && this.client) {
        try {
          await plugin.onUnload(this.createContext(plugin));
        } catch (err) {
          logger.warn(`[Knub] Error during unload of plugin "${plugin.name}":`, err);
        }
      }
    }
  }

  public async isPluginEnabledForGuild(guildId: string, pluginName: string): Promise<boolean> {
    const cacheKey = `${guildId}:${pluginName}`;
    const cached = this.pluginEnabledCache.get(cacheKey);
    const now = Date.now();
    if (cached && now < cached.expiresAt) {
      return cached.enabled;
    }

    try {
      const doc = await PluginConfigModel.findOne({ guildId, pluginName }).lean() as any;
      const enabled = doc ? (doc.enabled ?? true) : true;
      this.pluginEnabledCache.set(cacheKey, { enabled, expiresAt: now + 30_000 });
      return enabled;
    } catch {
      return true;
    }
  }

  public async setPluginEnabledForGuild(
    guildId: string,
    pluginName: string,
    enabled: boolean,
  ): Promise<void> {
    const cacheKey = `${guildId}:${pluginName}`;
    this.pluginEnabledCache.set(cacheKey, { enabled, expiresAt: Date.now() + 30_000 });

    await PluginConfigModel.updateOne(
      { guildId, pluginName },
      { $set: { enabled, updatedAt: new Date() } },
      { upsert: true },
    );
  }

  public async getGuildPluginConfig<T>(guildId: string, pluginName: string): Promise<T> {
    const cacheKey = `${guildId}:${pluginName}`;
    const cached = this.guildConfigCache.get(cacheKey);
    const now = Date.now();
    if (cached && now < cached.expiresAt) {
      return cached.config as T;
    }

    const plugin = this.getPlugin(pluginName);
    const defaults = (plugin?.defaultConfig ?? {}) as T;

    try {
      const doc = await PluginConfigModel.findOne({ guildId, pluginName }).lean() as any;
      const merged = (!doc || !doc.config) ? defaults : { ...defaults, ...doc.config };
      this.guildConfigCache.set(cacheKey, { config: merged, expiresAt: now + 30_000 });
      return merged;
    } catch {
      return defaults;
    }
  }

  public async setGuildPluginConfig<T = any>(
    guildId: string,
    pluginName: string,
    config: Partial<T>,
  ): Promise<void> {
    const current = await this.getGuildPluginConfig<T>(guildId, pluginName);
    const updated = { ...current, ...config };
    const cacheKey = `${guildId}:${pluginName}`;
    this.guildConfigCache.set(cacheKey, { config: updated, expiresAt: Date.now() + 30_000 });

    await PluginConfigModel.updateOne(
      { guildId, pluginName },
      { $set: { config: updated, updatedAt: new Date() } },
      { upsert: true },
    );
  }

  public findPluginForCommand(command: Command): KnubPlugin<any> | undefined {
    // 1. By direct array inclusion
    for (const plugin of this.plugins.values()) {
      if (plugin.commands?.some((c) => c.data.name === command.data.name)) {
        return plugin;
      }
    }

    // 2. By category match
    if (command.category) {
      return this.plugins.get(command.category);
    }

    return undefined;
  }

  public async executeCommandPipeline(
    command: Command,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const plugin = this.findPluginForCommand(command);

    // Guild-level plugin enable/disable check
    if (interaction.guildId && plugin) {
      const isEnabled = await this.isPluginEnabledForGuild(interaction.guildId, plugin.name);
      if (!isEnabled) {
        await replyError(
          interaction,
          `❌ The **${plugin.name}** plugin is disabled in this server by administrators.`,
        );
        return;
      }
    }

    const context: CommandContext = {
      interaction,
      command,
      plugin,
      client: this.client ?? interaction.client,
      guildId: interaction.guildId ?? undefined,
      userId: interaction.user.id,
      startedAt: Date.now(),
      metadata: new Map(),
    };

    // Execute Pre-filters
    for (const filter of this.preFilters) {
      try {
        const result = await filter.execute(context);
        if (result === false) {
          return;
        }
        if (typeof result === "object" && result !== null && !result.ok) {
          if (result.error) {
            await replyError(interaction, result.error);
          }
          return;
        }
      } catch (filterErr) {
        logger.error(`[Knub] Pre-filter "${filter.name}" threw an exception:`, filterErr);
        await replyError(
          interaction,
          "❌ A system error occurred while verifying command requirements.",
        );
        return;
      }
    }

    logger.debug(
      `[Knub] Command: /${interaction.commandName} by ${interaction.user.tag} ` +
        `in guild ${interaction.guildId ?? "DM"}` +
        (plugin ? ` (Plugin: ${plugin.name})` : ""),
    );

    let executionSuccess = false;
    let executionError: unknown = null;

    try {
      await command.execute(interaction);
      executionSuccess = true;
    } catch (err) {
      executionError = err;
      logger.error(
        `[Knub] Unhandled error in /${interaction.commandName} by ${interaction.user.tag}:`,
        err,
      );
      await replyError(
        interaction,
        "❌ An unexpected error occurred while running this command. Please try again.",
      );
    } finally {
      // Execute Post-hooks
      for (const hook of this.postHooks) {
        try {
          await hook.execute(context, {
            success: executionSuccess,
            error: executionError,
          });
        } catch (hookErr) {
          logger.warn(`[Knub] Post-hook "${hook.name}" failed:`, hookErr);
        }
      }
    }
  }

  public async dispatchComponent(interaction: ComponentInteraction): Promise<boolean> {
    const customId = (interaction as any).customId as string;
    if (!customId) return false;

    for (const plugin of this.plugins.values()) {
      if (!plugin.customIdHandlers?.length) continue;

      for (const { pattern, handler } of plugin.customIdHandlers) {
        let match: RegExpMatchArray | null = null;
        let matched = false;

        if (typeof pattern === "string") {
          matched = customId.startsWith(pattern);
        } else {
          match = customId.match(pattern);
          matched = Boolean(match);
        }

        if (matched) {
          // Respect per-guild plugin enable/disable for interactive components,
          // matching the behaviour already applied to slash commands.
          if (interaction.guildId && !(await this.isPluginEnabledForGuild(interaction.guildId, plugin.name))) {
            await interaction
              .reply({ content: `❌ The **${plugin.name}** plugin is disabled in this server by administrators.`, ephemeral: true })
              .catch(() => null);
            return true;
          }

          const ctx = this.createContext(plugin);
          try {
            await handler(interaction, match, ctx);
            return true;
          } catch (err) {
            logger.error(
              `[Knub] Component handler error in plugin "${plugin.name}" for customId "${customId}":`,
              err,
            );
            if (!interaction.replied && !interaction.deferred) {
              await interaction
                .reply({
                  content: "❌ An error occurred while processing this action. Please try again.",
                  ephemeral: true,
                })
                .catch(() => null);
            } else if (interaction.deferred && !interaction.replied) {
              await interaction
                .editReply({
                  content: "❌ An error occurred while processing this action. Please try again.",
                })
                .catch(() => null);
            }
            return true;
          }
        }
      }
    }

    return false;
  }

  private createContext<TConfig = any>(plugin: KnubPlugin<TConfig>): PluginContext<TConfig> {
    return {
      client: this.client!,
      plugin,
      config: plugin.defaultConfig,
      getPlugin: <P = any>(name: string) => this.getPlugin<P>(name),
      getGuildConfig: (guildId: string) => this.getGuildPluginConfig<TConfig>(guildId, plugin.name),
      setGuildConfig: (guildId: string, config: Partial<TConfig>) =>
        this.setGuildPluginConfig<TConfig>(guildId, plugin.name, config),
      logger,
    };
  }
}

export const knubManager = new KnubManager();
