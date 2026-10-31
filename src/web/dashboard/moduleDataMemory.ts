/**
 * In-memory ModuleData for tests, the site preview and a dashboard mounted
 * without a bot client. It records every write in `calls` so tests can assert
 * what reached the data layer.
 */
import type { EmbedSpec } from "../../services/embedSpec";
import type { PanelResult } from "./data";
import { MAX_AUTORESPONDERS, type AutoResponderRow, type AutomationRow, type GiveawayRow, type ModuleConfigPatch, type ModuleData, type SuggestionRow, type WatchView } from "./moduleData";

export interface MemoryModuleData extends ModuleData {
  responders: AutoResponderRow[];
  automations: AutomationRow[];
  giveaways: GiveawayRow[];
  suggestions: SuggestionRow[];
  watches: Map<string, WatchView[]>;
  posts: Array<{ channelId: string; content: string | null; embed: EmbedSpec }>;
  calls: string[];
  /** Channels postEmbed/createAutomation treat as present; empty means any. */
  channels: Set<string>;
  config: ModuleConfigPatch;
}

export function memoryModuleData(seed: Partial<Pick<MemoryModuleData, "responders" | "automations" | "giveaways" | "suggestions">> = {}): MemoryModuleData {
  const m: MemoryModuleData = {
    responders: seed.responders ?? [],
    automations: seed.automations ?? [],
    giveaways: seed.giveaways ?? [],
    suggestions: seed.suggestions ?? [],
    watches: new Map(),
    posts: [],
    calls: [],
    channels: new Set(),
    config: {},
    async saveModuleConfig(_g, patch) {
      Object.assign(m.config, patch);
      m.calls.push(`config:${Object.keys(patch).join(",")}`);
    },
    async overviewExtras() {
      return {
        casesPerDay: Array.from({ length: 30 }, (_, i) => (i * 7) % 5),
        activeGiveaways: m.giveaways.filter(g => !g.ended).length,
        automodHits7: 0,
        openSuggestions: m.suggestions.filter(s => s.status === "pending" || s.status === "considered").length,
        autoresponders: m.responders.length,
        scheduled: m.automations.length,
      };
    },
    async listAutoResponders() { return m.responders; },
    async addAutoResponder(_g, input, actor) {
      if (m.responders.length >= MAX_AUTORESPONDERS) return { ok: false, error: "Too many autoresponders." };
      if (m.responders.some(r => r.trigger === input.trigger.toLowerCase() && r.matchType === input.matchType)) {
        return { ok: false, error: "An autoresponder with that trigger and match type already exists." };
      }
      const id = `ar-${m.responders.length + 1}`;
      m.responders.push({ id, trigger: input.trigger.toLowerCase(), response: input.response, matchType: input.matchType, enabled: true, createdBy: actor.userId, createdAt: new Date() });
      m.calls.push(`ar.add:${id}`);
      return { ok: true, detail: id };
    },
    async setAutoResponderEnabled(_g, id, enabled) {
      const r = m.responders.find(x => x.id === id);
      if (!r) return false;
      r.enabled = enabled;
      m.calls.push(`ar.${enabled ? "on" : "off"}:${id}`);
      return true;
    },
    async removeAutoResponder(_g, id) {
      const before = m.responders.length;
      m.responders = m.responders.filter(r => r.id !== id);
      m.calls.push(`ar.remove:${id}`);
      return m.responders.length < before;
    },
    async listAutomations() { return m.automations; },
    async createAutomation(_g, input, actor): Promise<PanelResult> {
      if (m.channels.size && !m.channels.has(input.channelId)) return "channel-missing";
      const id = `task${m.automations.length + 1}`;
      m.automations.push({ id, channelId: input.channelId, creatorId: actor.userId, type: "scheduled", payload: input.message, executeAt: new Date(Date.now() + input.delayMs), intervalMs: input.intervalMs });
      m.calls.push(`task.create:${id}`);
      return "posted";
    },
    async cancelAutomation(_g, id) {
      const before = m.automations.length;
      m.automations = m.automations.filter(t => t.id !== id);
      m.calls.push(`task.cancel:${id}`);
      return m.automations.length < before;
    },
    async listGiveaways() { return m.giveaways; },
    async endGiveaway(_g, messageId) {
      const g = m.giveaways.find(x => x.messageId === messageId && !x.ended);
      if (!g) return { ok: false, error: "No active giveaway found with that message ID." };
      g.ended = true;
      m.calls.push(`gw.end:${messageId}`);
      return { ok: true, detail: "1" };
    },
    async rerollGiveaway(_g, messageId) {
      const g = m.giveaways.find(x => x.messageId === messageId && x.ended);
      if (!g) return { ok: false, error: "No completed giveaway found with that message ID." };
      m.calls.push(`gw.reroll:${messageId}`);
      return { ok: true, detail: "1" };
    },
    async listSuggestions(_g, filter, page, perPage) {
      const match = m.suggestions.filter(s =>
        filter === "all" ? true : filter === "open" ? s.status === "pending" || s.status === "considered" : s.status === filter);
      return { items: match.slice((page - 1) * perPage, page * perPage), total: match.length };
    },
    async reviewSuggestion(_g, id, action, note, actor) {
      const s = m.suggestions.find(x => x.id === id);
      if (!s) return { ok: false, error: "Suggestion not found. Double-check the ID." };
      if (s.status !== "pending" && s.status !== "considered") return { ok: false, error: `This suggestion is already **${s.status}** and has been finalized.` };
      s.status = action === "approve" ? "approved" : action === "deny" ? "rejected" : "considered";
      s.reviewedBy = actor.userId;
      s.reviewReason = note;
      m.calls.push(`sg.${action}:${id}`);
      return { ok: true };
    },
    async listWatches(_g, moderatorId) { return m.watches.get(moderatorId) ?? []; },
    async removeWatch(_g, targetId, moderatorId) {
      const list = m.watches.get(moderatorId) ?? [];
      const next = list.filter(w => w.targetId !== targetId);
      m.watches.set(moderatorId, next);
      m.calls.push(`watch.remove:${targetId}`);
      return next.length < list.length;
    },
    async postEmbed(_g, channelId, content, embed) {
      if (m.channels.size && !m.channels.has(channelId)) return "channel-missing";
      m.posts.push({ channelId, content, embed });
      m.calls.push(`post:${channelId}`);
      return "posted";
    },
  };
  return m;
}
