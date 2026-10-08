import { updateGuildConfig } from "./configuration";
import { updateAutomodConfig } from "./automod";
import { logger } from "../utils/logger";

export type PresetType = "casual" | "community" | "gaming" | "strict";

export interface PresetDetails {
  name: string;
  description: string;
  automod: {
    words: { enabled: boolean; action: "delete" | "warn" | "timeout" };
    links: { enabled: boolean; action: "delete" | "warn" | "timeout" };
    mentions: { enabled: boolean; threshold: number; action: "delete" | "warn" | "timeout" };
    spam: { enabled: boolean; maxMessages: number; windowSeconds: number; action: "delete" | "warn" | "timeout" };
  };
  escalation: {
    enabled: boolean;
    thresholds: Array<{ atWarnings: number; action: "timeout" | "kick" | "ban"; durationMinutes?: number }>;
  };
}

export const PRESETS: Record<PresetType, PresetDetails> = {
  casual: {
    name: "Casual Server",
    description: "Lightweight protection suitable for small friendly server environments.",
    automod: {
      words: { enabled: false, action: "delete" },
      links: { enabled: false, action: "delete" },
      mentions: { enabled: true, threshold: 7, action: "timeout" },
      spam: { enabled: true, maxMessages: 8, windowSeconds: 5, action: "timeout" },
    },
    escalation: {
      enabled: true,
      thresholds: [
        { atWarnings: 3, action: "timeout", durationMinutes: 30 },
        { atWarnings: 5, action: "kick" },
      ],
    },
  },
  community: {
    name: "Standard Community",
    description: "Balanced moderation configuration for active public Discord communities.",
    automod: {
      words: { enabled: true, action: "delete" },
      links: { enabled: false, action: "delete" },
      mentions: { enabled: true, threshold: 5, action: "timeout" },
      spam: { enabled: true, maxMessages: 5, windowSeconds: 5, action: "timeout" },
    },
    escalation: {
      enabled: true,
      thresholds: [
        { atWarnings: 3, action: "timeout", durationMinutes: 60 },
        { atWarnings: 5, action: "kick" },
        { atWarnings: 7, action: "ban" },
      ],
    },
  },
  gaming: {
    name: "Gaming Hub",
    description: "Anti-spam and link protection tailored for gaming clans & hubs.",
    automod: {
      words: { enabled: true, action: "delete" },
      links: { enabled: true, action: "delete" },
      mentions: { enabled: true, threshold: 4, action: "timeout" },
      spam: { enabled: true, maxMessages: 4, windowSeconds: 4, action: "timeout" },
    },
    escalation: {
      enabled: true,
      thresholds: [
        { atWarnings: 2, action: "timeout", durationMinutes: 120 },
        { atWarnings: 4, action: "ban" },
      ],
    },
  },
  strict: {
    name: "Strict Security",
    description: "Maximum security setting for high-risk public servers or announcement hubs.",
    automod: {
      words: { enabled: true, action: "delete" },
      links: { enabled: true, action: "delete" },
      mentions: { enabled: true, threshold: 3, action: "timeout" },
      spam: { enabled: true, maxMessages: 3, windowSeconds: 3, action: "timeout" },
    },
    escalation: {
      enabled: true,
      thresholds: [
        { atWarnings: 2, action: "timeout", durationMinutes: 360 },
        { atWarnings: 3, action: "kick" },
        { atWarnings: 4, action: "ban" },
      ],
    },
  },
};

export async function applyPreset(guildId: string, type: PresetType): Promise<PresetDetails> {
  const preset = PRESETS[type];
  if (!preset) {
    throw new Error(`Unknown preset type: ${type}`);
  }

  try {
    // 1. Update Guild Config escalation
    await updateGuildConfig(guildId, {
      escalation: preset.escalation,
    });

    // 2. Update Automod rules
    await updateAutomodConfig(guildId, {
      words: { ...preset.automod.words, list: ["nigger", "faggot", "retard"] },
      links: preset.automod.links,
      mentions: preset.automod.mentions,
      spam: preset.automod.spam,
    });

    return preset;
  } catch (err) {
    logger.error(`Failed to apply preset ${type} for guild ${guildId}:`, err);
    throw err;
  }
}
