import { definePlugin } from "../definePlugin";

export interface AutomodPluginConfig {
  maxMentionsThreshold: number;
  capsThresholdPercent: number;
  spamWindowSeconds: number;
}

export const AutomodPlugin = definePlugin<AutomodPluginConfig>({
  name: "automod",
  description: "Automated content moderation: word filter, anti-invite, mention limits, caps, and spam",
  version: "1.0.0",
  defaultConfig: {
    maxMentionsThreshold: 5,
    capsThresholdPercent: 80,
    spamWindowSeconds: 5,
  },
});
