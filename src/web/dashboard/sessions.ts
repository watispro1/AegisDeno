/**
 * Dashboard session storage. Production uses Mongo (DashboardSessionModel);
 * tests use the in-memory store. Callers pass the raw session ID; both stores
 * key on its SHA-256 so the raw ID is never persisted.
 */
import { DashboardSessionModel } from "../../database/mongo";
import type { OAuthGuild } from "./permissions";
import { hashSessionId } from "./security";

export interface SessionData {
  userId: string;
  username: string;
  globalName: string | null;
  accessToken: string;
  tokenExpiresAt: Date;
  guilds: OAuthGuild[];
  guildsFetchedAt: Date;
  createdAt: Date;
  expiresAt: Date;
}

export interface SessionStore {
  create(sessionId: string, data: SessionData): Promise<void>;
  /** Returns null for unknown or expired sessions. */
  get(sessionId: string, nowMs?: number): Promise<SessionData | null>;
  updateGuilds(sessionId: string, guilds: OAuthGuild[], fetchedAt: Date): Promise<void>;
  destroy(sessionId: string): Promise<void>;
}

function cleanGuilds(value: unknown): OAuthGuild[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((g) => {
    if (!g || typeof g !== "object") return [];
    const o = g as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.name !== "string") return [];
    return [{
      id: o.id,
      name: o.name,
      icon: typeof o.icon === "string" ? o.icon : null,
      owner: o.owner === true,
      permissions: typeof o.permissions === "string" ? o.permissions : "0",
    }];
  });
}

export function mongoSessionStore(): SessionStore {
  return {
    async create(sessionId, data) {
      await DashboardSessionModel.create({ sidHash: hashSessionId(sessionId), ...data });
    },

    async get(sessionId, nowMs = Date.now()) {
      const doc = await DashboardSessionModel.findOne({ sidHash: hashSessionId(sessionId) }).lean();
      if (!doc) return null;
      const expiresAt = new Date(doc.expiresAt);
      // The TTL monitor runs about once a minute, so check expiry here too.
      if (expiresAt.getTime() <= nowMs) return null;
      return {
        userId: doc.userId,
        username: doc.username,
        globalName: doc.globalName ?? null,
        accessToken: doc.accessToken,
        tokenExpiresAt: new Date(doc.tokenExpiresAt),
        guilds: cleanGuilds(doc.guilds),
        guildsFetchedAt: new Date(doc.guildsFetchedAt ?? doc.createdAt),
        createdAt: new Date(doc.createdAt),
        expiresAt,
      };
    },

    async updateGuilds(sessionId, guilds, fetchedAt) {
      await DashboardSessionModel.updateOne(
        { sidHash: hashSessionId(sessionId) },
        { $set: { guilds, guildsFetchedAt: fetchedAt } },
      );
    },

    async destroy(sessionId) {
      await DashboardSessionModel.deleteOne({ sidHash: hashSessionId(sessionId) });
    },
  };
}

export function memorySessionStore(): SessionStore & { size(): number } {
  const map = new Map<string, SessionData>();
  return {
    async create(sessionId, data) {
      map.set(hashSessionId(sessionId), { ...data, guilds: cleanGuilds(data.guilds) });
    },
    async get(sessionId, nowMs = Date.now()) {
      const found = map.get(hashSessionId(sessionId));
      if (!found || found.expiresAt.getTime() <= nowMs) return null;
      return { ...found };
    },
    async updateGuilds(sessionId, guilds, fetchedAt) {
      const key = hashSessionId(sessionId);
      const found = map.get(key);
      if (found) map.set(key, { ...found, guilds: cleanGuilds(guilds), guildsFetchedAt: fetchedAt });
    },
    async destroy(sessionId) {
      map.delete(hashSessionId(sessionId));
    },
    size: () => map.size,
  };
}
