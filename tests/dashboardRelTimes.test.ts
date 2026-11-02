/**
 * Older dashboard pages (cases, member, warnings/notes, appeals, tickets,
 * analytics, incidents, trust, audit log) show relative times with the exact
 * UTC time on hover, and copy buttons next to IDs. Rendering only; no network.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { renderActivity, renderAppeal, renderAppeals, renderCase, renderCases, type GuildContext } from "../src/web/dashboard/views";
import { renderMember } from "../src/web/dashboard/views/members";
import { renderAnalytics } from "../src/web/dashboard/views/insights";
import { renderIncidentReport } from "../src/web/dashboard/views/incident";
import { dashboardScript } from "../src/web/dashboard/client";
import type { CaseRecord } from "../src/web/dashboard/data";
import type { SiteConfig } from "../src/web/pages";

const cfg: SiteConfig = { inviteUrl: "#", supportUrl: "", version: "0.0.0", contactEmail: "", assetVersion: "t" };
const viewer = { userId: "900000000000000001", username: "aj", globalName: null, csrf: "x" };
const GUILD = "800000000000000001";
const MEMBER = "500000000000000001";
const ctx: GuildContext = { guild: { id: GUILD, name: "G", memberCount: 1 }, viewer, nameOf: () => null };
const AGO = new Date(Date.now() - 3 * 86_400_000 - 60_000);

const REL = /<time datetime="[^"]+" title="\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC" data-rel>3 days ago<\/time>/;
const copy = (id: string) => new RegExp(`class="btn sm ghost copy-id" type="button" data-copy="${id}"`);

const record = {
  id: "65a1b2c3d4e5f60718293a4b", kind: "case", userId: MEMBER, moderatorId: viewer.userId,
  action: "ban", reason: "Spam", details: null, proofUrl: null, revoked: true, revokedBy: viewer.userId, revokedAt: AGO,
  createdAt: AGO,
} as CaseRecord;

test("cases list and case page: relative times and copy buttons for case and user IDs", () => {
  const list = renderCases(cfg, ctx, { type: null, userId: null, moderatorId: null, page: 1 }, { items: [record], total: 1 }, 25);
  assert.match(list, REL);
  assert.match(list, copy(record.id));
  assert.match(list, copy(MEMBER));
  const page = renderCase(cfg, ctx, record);
  assert.match(page, REL);
  assert.match(page, copy(record.id));
  assert.match(page, copy(MEMBER));
  assert.match(page, copy(viewer.userId));
  assert.doesNotMatch(page, /\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC<\/dd>/, "dates are not shown as bare UTC text any more");
});

test("member page: joined/created/timeout, cases, warnings and notes use relative times; IDs copy", () => {
  const html = renderMember(cfg, ctx, {
    member: {
      id: MEMBER, username: "m", globalName: null, avatarUrl: null, bot: false, inServer: true, owner: false,
      joinedAt: AGO, createdAt: AGO, timeoutUntil: new Date(Date.now() + 2 * 3_600_000 + 60_000), topRolePosition: 0, roles: [],
      botCan: { timeout: true, kick: true, ban: true },
    },
    records: { cases: [record], warnings: [{ ...record, id: "65a1b2c3d4e5f60718293a4c", kind: "warning" } as CaseRecord], notes: [{ id: "n1", moderatorId: viewer.userId, note: "watch", createdAt: AGO }] },
    noticeCode: null,
  });
  assert.equal((html.match(/data-rel>3 days ago</g) ?? []).length, 5, "joined, created, case, warning, note");
  assert.match(html, /Until <time [^>]+data-rel>in 2 hours<\/time>/);
  for (const id of [MEMBER, record.id, "65a1b2c3d4e5f60718293a4c", "n1"]) assert.match(html, copy(id), id);
});

test("appeals list and detail, and the audit log: relative times and copy buttons", () => {
  const appeal = { code: "AGS-K7X2", guildId: GUILD, userId: MEMBER, moderatorId: viewer.userId, banReason: "x", appealText: null, status: "denied", reviewedBy: viewer.userId, reviewNote: null, reviewedAt: AGO, createdAt: AGO };
  const list = renderAppeals(cfg, ctx, { status: "all", page: 1 }, { items: [appeal], total: 1 }, 25);
  assert.match(list, REL);
  assert.match(list, copy("AGS-K7X2"));
  assert.match(list, copy(MEMBER));
  const detail = renderAppeal(cfg, ctx, appeal);
  assert.equal((detail.match(/data-rel>3 days ago</g) ?? []).length, 2, "filed and reviewed");
  assert.match(detail, copy("AGS-K7X2"));
  const audit = renderActivity(cfg, ctx, 1, { items: [{ guildId: GUILD, userId: viewer.userId, username: "aj", action: "case.revoke", target: record.id, summary: "", createdAt: AGO }], total: 1 }, 50);
  assert.match(audit, REL);
  assert.match(audit, copy(viewer.userId));
  assert.match(audit, copy(record.id));
});

test("incident report and analytics: relative times and copy buttons", () => {
  const rec = {
    id: "inc123", guildId: GUILD, status: "ended", trigger: "manual", reason: "raid", startedBy: { id: viewer.userId, tag: "aj" },
    startedAt: AGO, endsAt: AGO, endedAt: AGO, endedBy: null, endReason: null, options: {}, changes: [], invitesPaused: false,
    timeline: [], counts: { joins: 0, gated: 0, cases: 0, deleted: 0 }, caseIds: [record.id], endingSince: null,
  };
  const report = renderIncidentReport(cfg, ctx, rec as never);
  assert.equal((report.match(/data-rel>3 days ago</g) ?? []).length, 2, "started and ended");
  assert.match(report, copy("inc123"));
  assert.match(report, copy(record.id));
  const analytics = renderAnalytics(cfg, ctx, { days: 7, data: { days: ["2026-11-01"], joins: [0], leaves: [0], cases: [1], automod: [0], casesByType: [["ban", 1]], casesByModerator: [[viewer.userId, 1]], automodByRule: [] } });
  assert.match(analytics, copy(viewer.userId));
});

test("overview tickets, trust and incident pages use the shared helpers (source check)", () => {
  const read = (f: string) => fs.readFileSync(`src/web/dashboard/views/${f}`, "utf8");
  assert.match(read("overview.ts"), /copyId\(String\(t\.id\), "Copy ticket ID"\)\} opened by \$\{personId\(ctx, t\.userId\)\}, \$\{relTime\(t\.createdAt\)\}/);
  assert.match(read("trust.ts"), /copyId\(m\.userId, "Copy user ID"\)/);
  assert.match(read("incident.ts"), /Started \$\{relTime\(new Date\(a\.startedAt\)\)\}/);
  for (const f of ["cases.ts", "members.ts", "appeals.ts", "activity.ts"]) assert.doesNotMatch(read(f), /fmtDate\(/, f);
});

test("dashboard.js keeps relative times current from the datetime attribute, CSP-clean", () => {
  for (const s of ["time[data-rel][datetime]", "setInterval(refreshRel, 60000)", "' ago'", "'just now'"]) assert.ok(dashboardScript.includes(s), s);
  assert.doesNotMatch(dashboardScript, /\beval\(|new Function|innerHTML\s*=/);
});
