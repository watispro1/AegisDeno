import { definePlugin } from "../definePlugin";

export interface ModerationPluginConfig {
  maxWarnsBeforeEscalation: number;
  dmOnPunishment: boolean;
  defaultBanDeleteDays: number;
}

export const ModerationPlugin = definePlugin<ModerationPluginConfig>({
  name: "moderation",
  description: "Comprehensive server moderation, disciplinary actions, notes, and case logs",
  version: "1.0.0",
  defaultConfig: {
    maxWarnsBeforeEscalation: 3,
    dmOnPunishment: true,
    defaultBanDeleteDays: 1,
  },
  onLoad(ctx) {
    ctx.logger.info("[Knub Plugin] Moderation plugin loaded.");
  },
});
