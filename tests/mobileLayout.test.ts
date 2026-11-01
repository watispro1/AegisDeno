import { test } from "node:test";
import assert from "node:assert/strict";
import { layout } from "../src/web/layout";
import { styles } from "../src/web/theme";
import { renderCases, type GuildContext } from "../src/web/dashboard/views";
import type { CaseRecord } from "../src/web/dashboard/data";
import type { SiteConfig } from "../src/web/pages";

const cfg: SiteConfig = { inviteUrl: "https://discord.com/oauth2/authorize?client_id=1", supportUrl: "", version: "0.0.0", contactEmail: "", assetVersion: "t" };

test("pages use a viewport that reaches under notches, without disabling zoom", () => {
  const html = layout({ title: "t", description: "d", path: "/", body: "", inviteUrl: "#", supportUrl: "", version: "0" });
  const meta = html.match(/<meta name="viewport" content="([^"]+)">/);
  assert.ok(meta, "viewport meta");
  assert.ok(meta[1].includes("width=device-width"));
  assert.ok(meta[1].includes("viewport-fit=cover"));
  assert.ok(!/user-scalable=no|maximum-scale=1\b/.test(meta[1]), "zoom must stay allowed");
});

test("case table cells carry data-label so the phone layout can label each line", () => {
  const viewer = { userId: "900000000000000001", username: "aj", globalName: null, csrf: "x" };
  const ctx: GuildContext = { guild: { id: "800000000000000001", name: "G", memberCount: 1 }, viewer, nameOf: () => null };
  const record: CaseRecord = {
    id: "65a1b2c3d4e5f60718293a4b", kind: "case", userId: "500000000000000001", moderatorId: viewer.userId,
    action: "ban", reason: "Spam", details: null, proofUrl: null, revoked: false, revokedBy: null, revokedAt: null,
    createdAt: new Date("2026-10-01T12:00:00Z"),
  } as CaseRecord;
  const html = renderCases(cfg, ctx, { type: null, userId: null, moderatorId: null, page: 1 }, { items: [record], total: 1 }, 25);
  for (const label of ["When", "Action", "Member", "Moderator", "Reason"]) {
    assert.ok(html.includes(`<td data-label="${label}">`), label);
  }
});

test("stylesheet keeps the phone fixes", () => {
  // Opened /commands cards must not widen the page.
  assert.ok(/\.cmd-body \{[^}]*grid-template-columns: minmax\(0, 1fr\)/.test(styles));
  // 16px form text on small and touch screens stops iOS zooming on focus.
  assert.ok(/@media \(max-width: 860px\), \(pointer: coarse\) \{[^}]*\.field textarea[^}]*font-size: 16px/.test(styles));
  assert.ok(styles.includes("env(safe-area-inset-left)"));
  assert.ok(styles.includes("content: attr(data-label)"));
});

test("v1.2.0 pages keep the phone layout: labelled table cells and wrap-safe pickers", async () => {
  const { renderActivity, renderAppeals } = await import("../src/web/dashboard/views");
  const viewer = { userId: "900000000000000001", username: "aj", globalName: null, csrf: "x" };
  const ctx: GuildContext = { guild: { id: "800000000000000001", name: "G", memberCount: 1 }, viewer, nameOf: () => null };
  const appeals = renderAppeals(cfg, ctx, { status: "pending", page: 1 }, {
    items: [{ code: "AGS-K7X2", guildId: "g", userId: "500000000000000001", moderatorId: viewer.userId, banReason: "x", appealText: null, status: "pending", reviewedBy: null, reviewNote: null, reviewedAt: null, createdAt: new Date(0) }],
    total: 1,
  }, 25);
  for (const label of ["Filed", "Code", "Member", "Banned by", "Statement"]) assert.ok(appeals.includes(`<td data-label="${label}">`), label);
  const activity = renderActivity(cfg, ctx, 1, { items: [{ guildId: "g", userId: "u", username: "aj", action: "case.revoke", target: null, summary: "", createdAt: new Date(0) }], total: 1 }, 50);
  for (const label of ["When", "Who", "What", "Details"]) assert.ok(activity.includes(`<td data-label="${label}">`), label);
  assert.ok(/\.check\.pick \{[^}]*overflow-wrap: anywhere/.test(styles));
  assert.ok(/@media \(max-width: 640px\) \{[^@]*\.panel-item \{ grid-template-columns: minmax\(0, 1fr\); \}/.test(styles));
});
