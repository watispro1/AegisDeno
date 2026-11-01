import { mongoModmailDashboard } from "./modmailData";
import { mongoTrustDashboard } from "./trustData";
/**
 * Production DashboardExtras: Discord through the live client, records through
 * the same Mongo models and services the slash commands use.
 */
import { PermissionFlagsBits, type Client, type Guild, type GuildMember, type User } from "discord.js";
import { AutomodHitModel, ModerationCaseModel, StaffNoteModel, WarningModel } from "../../database/mongo";
import { addModerationCase } from "../../services/moderationCases";
import { addWarning } from "../../services/warnings";
import { sendGuildLog } from "../../services/logging";
import { updateGuildConfig } from "../../services/configuration";
import { updateAutomodConfig } from "../../services/automod";
import { memberFlowSeries } from "../../services/memberFlow";
import { incidentService } from "../../services/incidentDiscord";
import { logger } from "../../utils/logger";
import { escapeRegex } from "../../utils/mongoSafe";
import { dayKeys, densify } from "./moduleData";
import { toRecord, type CaseRecord } from "./data";
import type { DashboardExtras, MemberProfile } from "./extras";

const PROJECT = { _id: 1, userId: 1, moderatorId: 1, action: 1, reason: 1, details: 1, proofUrl: 1, revoked: 1, revokedBy: 1, revokedAt: 1, createdAt: 1 };
const SNOWFLAKE = /^\d{17,20}$/;

function avatar(user: User | null | undefined): string | null {
  try { return user ? user.displayAvatarURL({ size: 128, extension: "png" }) : null; } catch { return null; }
}

function profile(g: Guild, user: User, member: GuildMember | null): MemberProfile {
  const me = g.members.me;
  return {
    id: user.id,
    username: user.username,
    globalName: user.globalName ?? null,
    avatarUrl: avatar(member?.user ?? user),
    bot: user.bot === true,
    inServer: Boolean(member),
    owner: g.ownerId === user.id,
    joinedAt: member?.joinedAt ?? null,
    createdAt: user.createdAt ?? null,
    timeoutUntil: member?.communicationDisabledUntil ?? null,
    topRolePosition: member?.roles.highest.position ?? 0,
    roles: member ? [...member.roles.cache.values()].filter(r => r.id !== g.id).sort((a, b) => b.position - a.position).slice(0, 12).map(r => ({ id: r.id, name: r.name })) : [],
    botCan: member
      ? { timeout: member.moderatable, kick: member.kickable, ban: member.bannable }
      : { timeout: false, kick: false, ban: Boolean(me?.permissions.has(PermissionFlagsBits.BanMembers)) },
  };
}

export function mongoDashboardExtras(client: Client): DashboardExtras {
  const guild = (id: string) => client.guilds.cache.get(id) ?? null;
  const fetchMember = async (g: Guild, id: string) => g.members.cache.get(id) ?? await g.members.fetch(id).catch(() => null);

  return {
    async member(guildId, userId) {
      const g = guild(guildId);
      if (!g || !SNOWFLAKE.test(userId)) return null;
      const member = await fetchMember(g, userId);
      const user = member?.user ?? await client.users.fetch(userId).catch(() => null);
      return user ? profile(g, user, member) : null;
    },

    async memberRecords(guildId, userId) {
      const [cases, warnings, notes] = await Promise.all([
        ModerationCaseModel.find({ guildId, userId }).sort({ createdAt: -1 }).limit(25).select(PROJECT).lean(),
        WarningModel.find({ guildId, userId }).sort({ createdAt: -1 }).limit(25).select(PROJECT).lean(),
        StaffNoteModel.find({ guildId, userId }).sort({ createdAt: -1 }).limit(20).lean(),
      ]);
      return {
        cases: cases.map(d => toRecord(d as Record<string, unknown>, "case")),
        warnings: warnings.map(d => toRecord(d as Record<string, unknown>, "warning")),
        notes: notes.map(n => ({ id: String(n._id), moderatorId: String(n.moderatorId), note: String(n.note ?? ""), createdAt: new Date(n.createdAt ?? 0) })),
      };
    },

    async memberAction(guildId, userId, input, actor) {
      const g = guild(guildId);
      if (!g) return { ok: false, error: "Aegis is not in that server." };
      const member = await fetchMember(g, userId);
      const reason = `${input.reason} (dashboard, by ${actor.username})`.slice(0, 512);
      let caseId: string | null = null;
      try {
        switch (input.action) {
          case "warn": {
            const w = await addWarning(guildId, userId, actor.userId, input.reason);
            caseId = String((w as { _id?: unknown; id?: unknown })._id ?? (w as { id?: unknown }).id ?? "") || null;
            break;
          }
          case "timeout":
            if (!member) return { ok: false, error: "They are not in the server." };
            await member.timeout(input.minutes * 60_000, reason);
            caseId = await addModerationCase({ guildId, userId, moderatorId: actor.userId, action: "timeout", reason: input.reason, details: `Duration: ${input.minutes}m (dashboard)` });
            break;
          case "untimeout":
            if (!member) return { ok: false, error: "They are not in the server." };
            await member.timeout(null, reason);
            caseId = await addModerationCase({ guildId, userId, moderatorId: actor.userId, action: "untimeout", reason: input.reason, details: "Dashboard" });
            break;
          case "kick":
            if (!member) return { ok: false, error: "They are not in the server." };
            await member.kick(reason);
            caseId = await addModerationCase({ guildId, userId, moderatorId: actor.userId, action: "kick", reason: input.reason, details: "Dashboard" });
            break;
          case "ban":
            await g.members.ban(userId, { reason, deleteMessageSeconds: 0 });
            caseId = await addModerationCase({ guildId, userId, moderatorId: actor.userId, action: "ban", reason: input.reason, details: "Dashboard" });
            break;
        }
      } catch (err) {
        logger.warn(`Dashboard ${input.action} failed in ${guildId}: ${(err as Error)?.message ?? err}`);
        return { ok: false, error: "Discord refused the action. Check Aegis's permissions and role position." };
      }
      await sendGuildLog(client, guildId, {
        title: `🛡️ ${input.action === "untimeout" ? "Timeout removed" : input.action[0].toUpperCase() + input.action.slice(1)} (dashboard)`,
        color: input.action === "ban" ? 0xed4245 : input.action === "kick" ? 0xe67e22 : 0xfee75c,
        description: `**Member:** <@${userId}> (${userId})\n**Moderator:** <@${actor.userId}>\n**Reason:** ${input.reason.replace(/[@<>]/g, "")}${input.action === "timeout" ? `\n**Duration:** ${input.minutes}m` : ""}${caseId ? `\n**Case:** \`${caseId}\`` : ""}`,
      }, "modActions");
      return { ok: true, caseId };
    },

    async searchMembers(guildId, query, limit) {
      const g = guild(guildId);
      if (!g || !query) return [];
      if (SNOWFLAKE.test(query)) {
        const m = await fetchMember(g, query);
        return m ? [{ id: m.id, name: m.displayName, avatarUrl: avatar(m.user) }] : [];
      }
      const found = await g.members.search({ query: query.slice(0, 32), limit }).catch(() => null);
      return found ? [...found.values()].map(m => ({ id: m.id, name: `${m.displayName} (${m.user.username})`, avatarUrl: avatar(m.user) })) : [];
    },

    searchCases: (guildId, q) => searchCases(guildId, q),

    async analytics(guildId, days) {
      const now = Date.now();
      const keys = dayKeys(now, days);
      const since = new Date(`${keys[0]}T00:00:00Z`);
      const perDay = (Model: typeof ModerationCaseModel, field = "createdAt", match: Record<string, unknown> = {}) => Model.aggregate<{ _id: string; n: number }>([
        { $match: { guildId, [field]: { $gte: since }, ...match } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: `$${field}` } }, n: { $sum: 1 } } },
      ]);
      const groupBy = (Model: typeof ModerationCaseModel, key: string, field = "createdAt") => Model.aggregate<{ _id: string; n: number }>([
        { $match: { guildId, [field]: { $gte: since } } },
        { $group: { _id: `$${key}`, n: { $sum: 1 } } },
        { $sort: { n: -1 } }, { $limit: 10 },
      ]);
      const [flow, cases, warns, automod, byType, warnCount, byMod, warnByMod, byRule] = await Promise.all([
        memberFlowSeries(guildId, days, now).catch(() => []),
        perDay(ModerationCaseModel), perDay(WarningModel as unknown as typeof ModerationCaseModel),
        perDay(AutomodHitModel as unknown as typeof ModerationCaseModel, "triggeredAt"),
        groupBy(ModerationCaseModel, "action"),
        WarningModel.countDocuments({ guildId, createdAt: { $gte: since } }),
        groupBy(ModerationCaseModel, "moderatorId"), groupBy(WarningModel as unknown as typeof ModerationCaseModel, "moderatorId"),
        groupBy(AutomodHitModel as unknown as typeof ModerationCaseModel, "rule", "triggeredAt"),
      ]);
      const flowByDay = new Map(flow.map(f => [f.day, f]));
      const mods = new Map<string, number>();
      for (const r of [...byMod, ...warnByMod]) mods.set(String(r._id), (mods.get(String(r._id)) ?? 0) + r.n);
      const types: Array<[string, number]> = byType.map(r => [String(r._id), r.n]);
      if (warnCount) types.push(["warn", warnCount]);
      return {
        days: keys,
        joins: keys.map(k => flowByDay.get(k)?.joins ?? 0),
        leaves: keys.map(k => flowByDay.get(k)?.leaves ?? 0),
        cases: densify([...cases, ...warns], keys),
        automod: densify(automod, keys),
        casesByType: types.sort((a, b) => b[1] - a[1]),
        casesByModerator: [...mods.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
        automodByRule: byRule.map(r => [String(r._id), r.n] as [string, number]),
      };
    },

    incidents: {
      active: (guildId) => incidentService(client).getActive(guildId),
      list: (guildId, limit) => incidentService(client).list(guildId, limit),
      get: (guildId, id) => incidentService(client).get(guildId, id),
      start: (guildId, options, reason, actor) => incidentService(client).start(guildId, { options, reason, trigger: "dashboard", actor: { id: actor.userId, tag: actor.username } }),
      end: (guildId, reason, actor) => incidentService(client).end(guildId, { actor: { id: actor.userId, tag: actor.username }, reason }),
    },

    trust: mongoTrustDashboard(client),
    modmail: mongoModmailDashboard(),

    async saveIncidentConfig(guildId, config) { await updateGuildConfig(guildId, { incident: config }); },
    async saveModuleSwitches(guildId, switches) { await updateGuildConfig(guildId, { modules: switches }); },
    async applySettingsImport(guildId, update, automod) {
      await updateGuildConfig(guildId, update);
      if (automod) await updateAutomodConfig(guildId, automod);
    },
  };
}

/** Case lookup for global search: a full case ID, or recent cases whose reason matches. */
export async function searchCases(guildId: string, q: string): Promise<CaseRecord[]> {
  if (/^[0-9a-f]{24}$/i.test(q)) {
    const [c, w] = await Promise.all([
      ModerationCaseModel.findOne({ guildId, _id: q }).select(PROJECT).lean(),
      WarningModel.findOne({ guildId, _id: q }).select(PROJECT).lean(),
    ]);
    return [c && toRecord(c as Record<string, unknown>, "case"), w && toRecord(w as Record<string, unknown>, "warning")].filter((x): x is CaseRecord => Boolean(x));
  }
  const filter = SNOWFLAKE.test(q) ? { guildId, userId: q } : { guildId, reason: { $regex: escapeRegex(q.slice(0, 64)), $options: "i" } };
  const [c, w] = await Promise.all([
    ModerationCaseModel.find(filter).sort({ createdAt: -1 }).limit(10).select(PROJECT).lean(),
    WarningModel.find(filter).sort({ createdAt: -1 }).limit(10).select(PROJECT).lean(),
  ]);
  return [...c.map(d => toRecord(d as Record<string, unknown>, "case")), ...w.map(d => toRecord(d as Record<string, unknown>, "warning"))]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 15);
}
