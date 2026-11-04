/**
 * QoL pass: /case search, /config overview, /remindme edit and the help and
 * features copy that describes them; the dashboard's case date filter and CSV export.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { commands, loadCommands } from "../src/commands/loader";
import { CASE_SEARCH_ACTIONS, caseSearchLine, caseSearchMatch, parseWhen } from "../src/commands/shared/caseSearch";
import { moduleLines, renderModuleLines, type OverviewInput } from "../src/commands/shared/configOverview";
import { caseDateRange, isoDay, parseCaseFilter } from "../src/web/dashboard/validation";
import { CASE_CSV_COLUMNS, casesToCsv, csvCell } from "../src/web/dashboard/casesCsv";
import { casesQuery } from "../src/web/dashboard/views/cases";
import { CURATED_EXAMPLES } from "../src/web/commandExamples";
import { FEATURE_CATEGORIES } from "../src/web/pages/featuresData";
import { normalizeGuildConfig } from "../src/services/guildConfigNormalize";
import type { CaseRecord } from "../src/web/dashboard/data";

before(async () => { await loadCommands(); });

type Json = { name: string; options?: Array<{ name: string; type: number; options?: Array<{ name: string; required?: boolean; choices?: Array<{ value: string }> }> }> };
const sub = (cmd: string, name: string) => (commands.get(cmd)!.data.toJSON() as Json).options!.find(o => o.name === name);

test("/case search, /config overview and /remindme edit are registered subcommands with the right options", () => {
  const search = sub("case", "search");
  assert.ok(search, "/case search");
  assert.deepEqual(search!.options!.map(o => o.name), ["user", "moderator", "action", "reason", "since", "until"]);
  assert.ok(search!.options!.every(o => !o.required), "every filter is optional");
  assert.deepEqual(search!.options!.find(o => o.name === "action")!.choices!.map(c => c.value), [...CASE_SEARCH_ACTIONS]);
  assert.ok(sub("config", "overview"), "/config overview");
  const edit = sub("remindme", "edit");
  assert.deepEqual(edit!.options!.map(o => [o.name, o.required === true]), [["id", true], ["reminder", false], ["duration", false], ["repeat", false]]);
});

test("the commands page and the features page mention the new subcommands", () => {
  assert.ok(CURATED_EXAMPLES.case.some(e => e.startsWith("/case search")));
  assert.ok(CURATED_EXAMPLES.config.includes("/config overview"));
  assert.ok(CURATED_EXAMPLES.remindme.some(e => e.startsWith("/remindme edit")));
  const listed = FEATURE_CATEGORIES.flatMap(c => c.cards.flatMap(card => card.commands ?? []));
  for (const c of ["case search", "config overview", "remindme edit"]) assert.ok(listed.includes(c), c);
});

test("parseWhen: lengths of time count back from now; UTC days give their start, or their end for until", () => {
  const now = Date.UTC(2026, 10, 3, 12);
  assert.equal(parseWhen("7d", now)!.getTime(), now - 7 * 86_400_000);
  assert.equal(parseWhen("2 weeks", now)!.getTime(), now - 14 * 86_400_000);
  assert.equal(parseWhen("2026-10-01", now)!.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(parseWhen("2026-10-31", now, true)!.toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal(parseWhen("2026-02-30", now), null, "not a real day");
  assert.equal(parseWhen("soon", now), null);
  assert.equal(parseWhen(null, now), null);
});

test("caseSearchMatch: scoped to the guild, reason text escaped (never a raw regex or operator), date range bounds", () => {
  const since = new Date(0), until = new Date(1000);
  const m = caseSearchMatch("800000000000000001", { userId: "1", moderatorId: "2", action: "ban", reason: "a.b $ne (x)", since, until });
  assert.equal(m.guildId, "800000000000000001");
  assert.deepEqual(m.reason, { $regex: "a\\.b \\$ne \\(x\\)", $options: "i" });
  assert.deepEqual(m.createdAt, { $gte: since, $lt: until });
  assert.deepEqual(caseSearchMatch("g", { userId: null, moderatorId: null, action: null, reason: null, since: null, until: null }), { guildId: "g" });
  const line = caseSearchLine({ _id: "65a1b2c3d4e5f60718293a4b", userId: "5", moderatorId: "6", action: "ban", reason: "x".repeat(200), revoked: true, createdAt: new Date(0) });
  assert.match(line, /^`BAN` <@5> by <@6> <t:0:R> \(revoked\)\n/);
  assert.match(line, /…/);
  assert.match(line, /`65a1b2c3d4e5f60718293a4b`$/);
});

function overviewInput(over: Partial<OverviewInput> = {}): OverviewInput {
  const guild = normalizeGuildConfig("800000000000000001", {
    loggingEnabled: true, loggingChannelId: "700000000000000001", welcomeEnabled: true, welcomeChannelId: null,
    escalation: { enabled: true, thresholds: [] }, modules: { tickets: true, giveaways: false, scheduled: true, appeals: true },
  } as never);
  const rule = { enabled: false, action: "delete" as const };
  return {
    guild,
    automod: { words: { ...rule, enabled: true, list: [] }, links: rule, mentions: { ...rule, threshold: 5 }, spam: { ...rule, maxMessages: 5, windowSeconds: 5 }, caps: { ...rule, threshold: 80 } },
    starboard: null, verification: null, ticketLogChannelId: null, ...over,
  };
}

test("/config overview: each module is on, off, or flagged when it is on but missing what it needs", () => {
  const lines = moduleLines(overviewInput());
  const byName = new Map(lines.map(l => [l.name, l]));
  assert.equal(byName.get("Logging")!.state, "on");
  assert.equal(byName.get("Logging")!.detail, "<#700000000000000001>");
  assert.equal(byName.get("Welcome")!.state, "attention", "on with no channel");
  assert.equal(byName.get("Escalation")!.state, "attention", "on with no steps");
  assert.equal(byName.get("Automod")!.detail, "1 of 5 rules on");
  assert.equal(byName.get("Giveaways")!.state, "off");
  assert.equal(byName.get("Verification")!.state, "off");
  const text = renderModuleLines(lines);
  assert.match(text, /⚠️ \*\*Welcome\*\*: On, but no channel is set · set up with `\/welcome`/);
  assert.match(text, /✅ \*\*Logging\*\*/);
  assert.ok(text.length < 4000);
  const verified = moduleLines(overviewInput({ verification: { enabled: true, verifiedRoleId: "600000000000000001" } }));
  assert.equal(verified.find(l => l.name === "Verification")!.detail, "Gives <@&600000000000000001>");
});

test("case filter: from/to are real UTC days, swapped when reversed, and absent from the default shape", () => {
  assert.deepEqual(parseCaseFilter({}), { type: null, userId: null, moderatorId: null, query: null, page: 1 });
  assert.deepEqual(parseCaseFilter({ from: "2026-10-31", to: "2026-10-01" }).from, "2026-10-01");
  const f = parseCaseFilter({ from: "2026-10-01", to: "2026-10-31" });
  assert.equal(f.to, "2026-10-31");
  assert.equal(parseCaseFilter({ from: "2026-13-01" }).from, undefined);
  assert.equal(parseCaseFilter({ from: { $gt: "" } }).from, undefined, "an object is never a day");
  assert.equal(isoDay("2026-02-29"), null);
  assert.deepEqual(caseDateRange(f), { $gte: new Date("2026-10-01T00:00:00Z"), $lt: new Date("2026-11-01T00:00:00Z") });
  assert.equal(caseDateRange({}), null);
  assert.equal(casesQuery(f, 1), "?from=2026-10-01&to=2026-10-31");
});

test("cases CSV: header, every field quoted, quotes doubled, formulas neutralised, UTF-8 BOM and CRLF", () => {
  const record = {
    id: "65a1b2c3d4e5f60718293a4b", kind: "case", userId: "500000000000000001", moderatorId: "900000000000000001",
    action: "ban", reason: '=HYPERLINK("http://x") "quoted"', details: "+1 line\nnext", proofUrl: null,
    revoked: true, revokedBy: "900000000000000001", revokedAt: new Date("2026-11-01T10:00:00Z"), createdAt: new Date("2026-10-31T09:30:00Z"),
  } as CaseRecord;
  const csv = casesToCsv([record]);
  assert.ok(csv.startsWith("\uFEFF"));
  const [header, row] = csv.slice(1).split("\r\n");
  assert.equal(header, CASE_CSV_COLUMNS.join(","));
  assert.match(row, /^"65a1b2c3d4e5f60718293a4b","case","ban","500000000000000001","900000000000000001",/);
  assert.ok(row.includes(`"'=HYPERLINK(""http://x"") ""quoted"""`), "formula prefixed and quotes doubled");
  assert.ok(row.includes(`"'+1 line\nnext"`));
  assert.ok(row.endsWith(`"yes","900000000000000001","2026-11-01T10:00:00.000Z","2026-10-31T09:30:00.000Z"`));
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell("-5"), `"'-5"`);
  assert.equal(csvCell("@here"), `"'@here"`);
  assert.equal(csvCell("plain"), '"plain"');
  assert.ok(csv.endsWith("\r\n"));
});
