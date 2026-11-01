/** Staff digest page data. Memory version for tests, Discord/Mongo version for production. */
import type { Client } from "discord.js";
import { normalizeDigestConfig, type DigestConfig, type DigestEmbedData } from "../../services/digestLogic";

export interface DigestDashboard {
  config(guildId: string): Promise<DigestConfig>;
  preview(guildId: string): Promise<DigestEmbedData | null>;
  /** Saves and reschedules; returns the next run, or null when off. */
  saveConfig(guildId: string, config: DigestConfig): Promise<Date | null>;
}

export function memoryDigestDashboard(seed: { config?: Partial<DigestConfig>; preview?: DigestEmbedData | null } = {}): DigestDashboard & { saved: DigestConfig[] } {
  const saved: DigestConfig[] = [];
  return {
    saved,
    config: async () => saved.at(-1) ?? normalizeDigestConfig(seed.config ?? {}),
    preview: async () => seed.preview ?? null,
    saveConfig: async (_g, c) => { saved.push(c); return c.enabled ? new Date(Date.now() + 86_400_000) : null; },
  };
}

export function liveDigestDashboard(client: Client): DigestDashboard {
  const svc = () => require("../../services/digestService") as typeof import("../../services/digestService");
  const cfg = () => require("../../services/configuration") as typeof import("../../services/configuration");
  return {
    config: async (guildId) => normalizeDigestConfig((await cfg().getGuildConfig(guildId)).digest),
    preview: (guildId) => svc().previewDigest(client, guildId),
    async saveConfig(guildId, config) {
      await cfg().updateGuildConfig(guildId, { digest: config });
      return svc().ensureDigestTask(client, guildId, config);
    },
  };
}
