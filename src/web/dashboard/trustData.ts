/** Trust Score data for the dashboard (production): overview, member card and settings. */
import type { Client } from "discord.js";
import { updateGuildConfig } from "../../services/configuration";
import { clearTrustCache, getMemberTrust, getTrustConfig, scoreGuildMembers, subjectFromMember, TRUST_OVERVIEW_MAX } from "../../services/trustService";
import { isLowTrust, trustDistribution } from "../../services/trustEngine";
import type { TrustDashboard, TrustOverview } from "./extras";

const SNOWFLAKE = /^\d{17,20}$/;
const OVERVIEW_TTL_MS = 5 * 60_000;
const overviews = new Map<string, { at: number; value: TrustOverview }>();

export function mongoTrustDashboard(client: Client): TrustDashboard {
  return {
    async overview(guildId) {
      const config = await getTrustConfig(guildId);
      const hit = overviews.get(guildId);
      if (hit && Date.now() - hit.at < OVERVIEW_TTL_MS && hit.value.config.preset === config.preset && hit.value.config.lowThreshold === config.lowThreshold) {
        return { ...hit.value, config };
      }
      const guild = client.guilds.cache.get(guildId);
      const rows = guild ? await scoreGuildMembers(guild, config) : [];
      const scores = rows.map(r => r.result.score);
      const value: TrustOverview = {
        config,
        scored: rows.length,
        truncated: Boolean(guild && guild.members.cache.filter(m => !m.user.bot).size > TRUST_OVERVIEW_MAX),
        distribution: trustDistribution(scores),
        average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        lowCount: scores.filter(s => isLowTrust(s, config)).length,
        lowest: rows.sort((a, b) => a.result.score - b.result.score).slice(0, 15)
          .map(r => ({ userId: r.userId, name: r.name, avatarUrl: r.avatarUrl, score: r.result.score, bandLabel: r.result.bandLabel })),
      };
      overviews.set(guildId, { at: Date.now(), value });
      if (overviews.size > 500) { const k = overviews.keys().next().value; if (k !== undefined) overviews.delete(k); }
      return value;
    },
    async member(guildId, userId) {
      const guild = client.guilds.cache.get(guildId);
      if (!guild || !SNOWFLAKE.test(userId)) return null;
      const member = guild.members.cache.get(userId) ?? await guild.members.fetch(userId).catch(() => null);
      if (!member || member.user.bot) return null;
      const config = await getTrustConfig(guildId);
      return getMemberTrust(subjectFromMember(member), { preset: config.preset });
    },
    async saveConfig(guildId, config) {
      await updateGuildConfig(guildId, { trust: config });
      clearTrustCache(guildId);
      overviews.delete(guildId);
    },
  };
}
