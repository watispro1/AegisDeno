import { knubManager } from "../KnubManager";
import { ModerationPlugin } from "./moderation.plugin";
import { CommunityPlugin } from "./community.plugin";
import { TicketsPlugin } from "./tickets.plugin";
import { RolesPlugin } from "./roles.plugin";
import { VerificationPlugin } from "./verification.plugin";
import { AutomodPlugin } from "./automod.plugin";
import { GeneralPlugin, ConfigPlugin, AutoresponderPlugin } from "./utility.plugin";

export * from "./moderation.plugin";
export * from "./community.plugin";
export * from "./tickets.plugin";
export * from "./roles.plugin";
export * from "./verification.plugin";
export * from "./automod.plugin";
export * from "./utility.plugin";

export function registerDefaultPlugins(): void {
  knubManager.registerPlugin(ModerationPlugin);
  knubManager.registerPlugin(CommunityPlugin);
  knubManager.registerPlugin(TicketsPlugin);
  knubManager.registerPlugin(RolesPlugin);
  knubManager.registerPlugin(VerificationPlugin);
  knubManager.registerPlugin(AutomodPlugin);
  knubManager.registerPlugin(GeneralPlugin);
  knubManager.registerPlugin(ConfigPlugin);
  knubManager.registerPlugin(AutoresponderPlugin);
}
