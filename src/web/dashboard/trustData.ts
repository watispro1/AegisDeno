/**
 * Trust Score data for the dashboard (production): overview, the paged member
 * list, the member card and settings. Members come from Discord's member list
 * (GET /guilds/:id/members, ordered by user ID) in pages, so large servers are
 * not limited to the members the bot happens to have cached.
 */
import type { Client, Guild, GuildMember } from "discord.js";
import { updateGuildConfig } from "../../services/configuration";
import { clearTrustCache, getMemberTrust, getTrustConfig, scoreMembers, subjectFromMember, type ScoredMember } from "../../services/trustService";
import { isLowTrust, trustDistribution, type TrustConfig } from "../../services/trustEngine";
import type { TrustDashboard, TrustMemberPage, TrustOverview } from "./extras";
import { queueGuildSweep } from "../../services/lowTrustSync";

const SNOWFLAKE = /^\d{17,20}$/;
const OVERVIEW_TTL_MS = 5 * 60_000;
const PAGE_TTL_MS = 60_000;
/** Most members the overview scores; Discord's list is read 1,000 at a time. */
export const TRUST_SCAN_MAX = 10_000;
const LIST_BATCH = 1_000;
const overviews = new Map<string, { at: number; value: TrustOverview }>();
/** Short-lived page cache, with the in-flight request shared so reloads don't refetch. */
const pages = new Map<string, { at: number; value: Promise<TrustMemberPage> }>();

function remember<V>(map: Map<string, V>, key: string, value: V, max: number): void {
  map.set(key, value);
  if (map.size > max) { const oldest = map.keys().next().value; if (oldest !== undefined) map.delete(oldest); }
}

/** One page of Discord's member list. Falls back to the cache, in ID order, when the request fails. */
export async function listMemberPage(guild: Guild, after: string | null, limit: number): Promise<GuildMember[]> {
  try {
    const page = await guild.members.list({ limit, after: after ?? "0", cache: false });
    return [...page.values()];
  } catch {
    const cached = [...guild.members.cache.values()].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
    const start = after ? cached.findIndex(m => BigInt(m.id) > BigInt(after)) : 0;
    return start < 0 ? [] : cached.slice(start, start + limit);
  }
}

/** Scores up to TRUST_SCAN_MAX members, reading the member list only when the cache is incomplete. */
async function scanGuild(guild: Guild, config: TrustConfig): Promise<{ rows: ScoredMember[]; truncated: boolean }> {
  const cached = [...guild.members.cache.values()].filter(m => !m.user.bot);
  if (guild.members.cache.size >= guild.memberCount) {
    const rows: ScoredMember[] = [];
    for (let i = 0; i < Math.min(cached.length, TRUST_SCAN_MAX); i += LIST_BATCH) {
      rows.push(...await scoreMembers(guild, cached.slice(i, Math.min(i + LIST_BATCH, TRUST_SCAN_MAX)), config));
    }
    return { rows, truncated: cached.length > TRUST_SCAN_MAX };
  }
  const rows: ScoredMember[] = [];
  let after: string | null = null;
  let seen = 0;
  while (seen < TRUST_SCAN_MAX) {
    const batch = await listMemberPage(guild, after, LIST_BATCH);
    if (!batch.length) return { rows, truncated: false };
    seen += batch.length;
    rows.push(...await scoreMembers(guild, batch, config));
    if (batch.length < LIST_BATCH) return { rows, truncated: false };
    after = batch[batch.length - 1].id;
  }
  return { rows, truncated: guild.memberCount > seen };
}

export function mongoTrustDashboard(client: Client): TrustDashboard {
  return {
    async overview(guildId) {
      const config = await getTrustConfig(guildId);
      const hit = overviews.get(guildId);
      if (hit && Date.now() - hit.at < OVERVIEW_TTL_MS && hit.value.config.preset === config.preset && hit.value.config.lowThreshold === config.lowThreshold) {
        return { ...hit.value, config };
      }
      const guild = client.guilds.cache.get(guildId);
      const { rows, truncated } = guild ? await scanGuild(guild, config) : { rows: [], truncated: false };
      const scores = rows.map(r => r.result.score);
      const value: TrustOverview = {
        config,
        scored: rows.length,
        truncated,
        distribution: trustDistribution(scores),
        average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        lowCount: scores.filter(s => isLowTrust(s, config)).length,
        lowest: rows.sort((a, b) => a.result.score - b.result.score).slice(0, 15)
          .map(r => ({ userId: r.userId, name: r.name, avatarUrl: r.avatarUrl, score: r.result.score, bandLabel: r.result.bandLabel })),
      };
      remember(overviews, guildId, { at: Date.now(), value }, 500);
      return value;
    },
    async members(guildId, q) {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return { rows: [], next: null, scanned: 0 };
      const config = await getTrustConfig(guildId);
      const key = `${guildId}:${q.after ?? "0"}:${q.per}:${config.preset}:${config.lowThreshold}`;
      const hit = pages.get(key);
      const load = hit && Date.now() - hit.at < PAGE_TTL_MS ? hit.value : (async (): Promise<TrustMemberPage> => {
        const batch = await listMemberPage(guild, q.after, q.per);
        const scored = await scoreMembers(guild, batch, config);
        const byId = new Map(scored.map(r => [r.userId, r]));
        const rows = batch.flatMap(m => {
          const r = byId.get(m.id);
          return r ? [{ userId: m.id, name: r.name, score: r.result.score, bandLabel: r.result.bandLabel, low: isLowTrust(r.result.score, config) }] : [];
        });
        return { rows, next: batch.length === q.per ? batch[batch.length - 1].id : null, scanned: batch.length };
      })();
      if (load !== hit?.value) {
        remember(pages, key, { at: Date.now(), value: load }, 200);
        load.catch(() => pages.delete(key));
      }
      const page = await load;
      return q.lowOnly ? { ...page, rows: page.rows.filter(r => r.low) } : page;
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
      for (const key of pages.keys()) if (key.startsWith(`${guildId}:`)) pages.delete(key);
      queueGuildSweep(guildId);
    },
  };
}
