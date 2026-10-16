import type { KnubPlugin, KnubPluginDefinition } from "./types";

export function definePlugin<TConfig = any>(
  definition: KnubPluginDefinition<TConfig>,
): KnubPlugin<TConfig> {
  return {
    name: definition.name,
    description: definition.description,
    version: definition.version ?? "1.0.0",
    defaultConfig: definition.defaultConfig ?? ({} as TConfig),
    commands: definition.commands ?? [],
    events: definition.events ?? [],
    customIdHandlers: definition.customIdHandlers ?? [],
    onLoad: definition.onLoad,
    onUnload: definition.onUnload,
    onGuildLoaded: definition.onGuildLoaded,
  };
}
