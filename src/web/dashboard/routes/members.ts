/** Member lookup with quick actions (/:guildId/members[/:userId]) and global search (/:guildId/search). */
import type { Router } from "express";
import { isSnowflake } from "../permissions";
import { ACTION_PERMISSION, memberActionRefusal, type SearchHit } from "../extras";
import { parseMemberAction, searchQuery } from "../extrasValidation";
import { renderMember, renderMemberSearch, renderSearch } from "../views/members";
import { MODULE_NAV } from "../views/layout";
import type { FormBody } from "../validation";
import { type GuildLocals, type RouteKit } from "./context";

export function registerMemberRoutes(router: Router, k: RouteKit): void {
  const { deps, extras, send, fail, actorOf, logAudit, noticeParam, missingPermission, guildGet, guildPost } = k;
  const locals = (res: { locals: Record<string, unknown> }) => (res.locals.dash as GuildLocals).ctx;

  router.get("/:guildId/members", ...guildGet, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const q = searchQuery(req.query as Record<string, unknown>);
      // A bare user ID goes straight to their page (people who left included).
      if (isSnowflake(q)) return res.redirect(302, `/dashboard/${ctx.guild.id}/members/${q}`);
      const members = q ? await extras.searchMembers(ctx.guild.id, q, 25) : [];
      send(res, renderMemberSearch(deps.site, ctx, { q, members, noticeCode: noticeParam(req) }));
    } catch (err) { next(err); }
  });

  router.get("/:guildId/members/:userId", ...guildGet, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const userId = String(req.params.userId);
      if (!isSnowflake(userId)) return fail(res, 404, "Member not found", "That is not a user ID.", ctx.viewer);
      const [member, records] = await Promise.all([extras.member(ctx.guild.id, userId), extras.memberRecords(ctx.guild.id, userId)]);
      if (!member) return fail(res, 404, "Member not found", "Discord has no user with that ID.", ctx.viewer);
      send(res, renderMember(deps.site, ctx, { member, records, noticeCode: noticeParam(req) }));
    } catch (err) { next(err); }
  });

  router.post("/:guildId/members/:userId/action", ...guildPost, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const userId = String(req.params.userId);
      if (!isSnowflake(userId)) return fail(res, 404, "Member not found", "That is not a user ID.", ctx.viewer);
      const body = (req.body ?? {}) as FormBody;
      const member = await extras.member(ctx.guild.id, userId);
      if (!member) return fail(res, 404, "Member not found", "Discord has no user with that ID.", ctx.viewer);
      const again = async (status: number, errors: Record<string, string>) =>
        send(res, renderMember(deps.site, ctx, { member, records: await extras.memberRecords(ctx.guild.id, userId), noticeCode: null, errors, values: { action: String(body.action ?? ""), reason: String(body.reason ?? ""), minutes: String(body.minutes ?? "") } }), status);
      const parsed = parseMemberAction(body);
      if (!parsed.ok) return again(400, parsed.errors);
      const input = parsed.value;
      // The same permission the slash command needs, checked live.
      const missing = await missingPermission(ctx, ACTION_PERMISSION[input.action]);
      if (missing) return again(403, { action: `This needs ${missing} in this server, the same as the slash command. Nothing was done.` });
      const refusal = memberActionRefusal({ action: input.action, viewerId: ctx.viewer.userId, ownerId: ctx.roleLimit?.ownerId ?? null, viewerTop: ctx.roleLimit?.topPosition ?? null, member });
      if (refusal) return again(403, { action: `${refusal} Nothing was done.` });
      const result = await extras.memberAction(ctx.guild.id, userId, input, actorOf(ctx));
      await logAudit(ctx, `member.${input.action}`, userId, `${input.action}${input.action === "timeout" ? ` ${input.minutes}m` : ""}: ${input.reason.slice(0, 120)}${result.ok ? (result.caseId ? ` (case ${result.caseId})` : "") : " [refused by Discord]"}`);
      res.redirect(303, `/dashboard/${ctx.guild.id}/members/${userId}?notice=${result.ok ? "member-done" : "member-failed"}`);
    } catch (err) { next(err); }
  });

  router.get("/:guildId/search", ...guildGet, async (req, res, next) => {
    try {
      const ctx = locals(res);
      const q = searchQuery(req.query as Record<string, unknown>);
      const base = `/dashboard/${ctx.guild.id}`;
      const hits: SearchHit[] = [];
      if (q) {
        const needle = q.toLowerCase();
        for (const group of MODULE_NAV) for (const item of group.items) {
          if (item.label.toLowerCase().includes(needle)) hits.push({ kind: "page", label: item.label, detail: group.group, href: `${base}${item.href}` });
        }
        const [members, cases] = await Promise.all([
          extras.searchMembers(ctx.guild.id, q, 8).catch(() => []),
          extras.searchCases(ctx.guild.id, q).catch(() => []),
        ]);
        for (const m of members) hits.push({ kind: "member", label: m.name, detail: m.id, href: `${base}/members/${m.id}` });
        if (isSnowflake(q) && !members.some(m => m.id === q)) hits.push({ kind: "member", label: `Member ${q}`, detail: "open by ID (also works for people who left)", href: `${base}/members/${q}` });
        for (const c of cases) hits.push({ kind: "case", label: `${c.action} · ${c.reason.slice(0, 80) || "no reason"}`, detail: `${c.createdAt.toISOString().slice(0, 10)} · member ${c.userId}${c.revoked ? " · revoked" : ""}`, href: `${base}/cases/${c.id}` });
      }
      send(res, renderSearch(deps.site, ctx, { q, hits }));
    } catch (err) { next(err); }
  });
}
