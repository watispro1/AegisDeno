/**
 * General and community command upgrade: backward-compatible options, input
 * checks with friendly errors, /help navigation, list helpers, /remindme
 * controls, and the bugs fixed along the way.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ChannelType, OverwriteType, PermissionFlagsBits } from "discord.js";
import { commands, loadCommands } from "../src/commands/loader";
import { executeCommand } from "../src/commands/executor";
import { checkLink, checkReactionEmoji, colorChoices, embedTextProblem, expandNewlines, parseHexColor } from "../src/commands/shared/inputChecks";
import { HELP_NAV_IDS, helpCategoryPages, helpPageOrder, stepHelpPage, usageExample } from "../src/commands/shared/helpNav";
import { notYoursMessage, ownsComponent } from "../src/commands/shared/componentOwner";
import { PUSH_BACK_MINUTES, pushBackPlan, reminderControlIds, reminderControlRow, reminderJumpUrl } from "../src/commands/general/remindme/controls";
import { channelTreeLines, stickerLine } from "../src/commands/shared/serverLists";
import { applyIgnoreChange, clippedMentions, ignoreChangeMessage, starboardListLine, starEmojiChoices } from "../src/commands/shared/starboardSettings";
import { suggestionListFilter, suggestionListLine } from "../src/commands/shared/suggestionList";
import { EMBED_PLACEHOLDER, applyDraftModal, draftFromInput, draftPostProblem } from "../src/commands/shared/embedDraft";
import { pollOptionsProblem } from "../src/commands/community/poll";
import { GIVEAWAY_BOUNDS, GIVEAWAY_DURATION_PRESETS, giveawayListLine } from "../src/commands/community/giveaway";
import { timeframeFromButton, timeframeLabel } from "../src/commands/community/activitysummary";
import { dashboardButtonNeedsStaff } from "../src/commands/general/dashboard";
import { overwriteLine } from "../src/commands/general/channelinfo";
import { aboutView } from "../src/commands/general/about";
import { expiredAvatarRow } from "../src/commands/general/avatar";
import { parseFriendlyDuration } from "../src/utils/duration";

before(async () => { await loadCommands(); });

/** Every option and subcommand these commands had on main (8625c11): name, type, and "!" when required. */
const BASELINE: Record<string, string[]> = {"about": [], "avatar": ["user:6", "server:5", "banner:5", "private:5"], "channelinfo": ["channel:7"], "dashboard": [], "help": ["command:3"], "ping": [], "remindme": ["set/", "set reminder:3!", "set duration:3!", "set channel_reminder:5", "set repeat:3", "edit/", "edit id:3!", "edit reminder:3", "edit duration:3", "edit repeat:3", "list/", "cancel/", "cancel id:3!"], "roleinfo": ["role:8!", "ephemeral:5"], "serverinfo": ["ephemeral:5"], "userinfo": ["user:6", "private:5"], "activitysummary": ["timeframe:4"], "announce": ["channel:7!", "message:3!", "title:3", "color:3", "ping:3", "image_url:3", "thumbnail_url:3", "suppress_author:5", "crosspost:5"], "embed": ["builder/", "builder channel:7!", "builder title:3!", "builder description:3", "builder color:3", "builder url:3", "builder footer:3", "builder image:3", "builder thumbnail:3", "builder author:3", "quick/", "quick channel:7!", "quick title:3!", "quick description:3!", "quick color:3", "quick footer:3"], "giveaway": ["start/", "start prize:3!", "start duration:3!", "start channel:7", "start winners:4", "start required_role:8", "start description:3", "start booster_multiplier:4", "start min_account_age:4", "start min_server_days:4", "start bonus_role:8", "start bonus_entries:4", "end/", "end message_id:3!", "cancel/", "cancel message_id:3!", "reroll/", "reroll message_id:3!", "reroll winners:4", "list/"], "poll": ["question:3!", "option1:3!", "option2:3!", "duration:3", "option3:3", "option4:3", "option5:3", "option6:3", "option7:3", "option8:3", "option9:3", "option10:3", "anonymous:5", "multiselect:5", "image_url:3"], "starboard": ["setup/", "setup channel:7!", "threshold/", "threshold count:4!", "emoji/", "emoji emoji:3!", "selfstar/", "selfstar allowed:5!", "ignore/", "ignore action:3!", "ignore channel:7", "ignore role:8", "list/", "list limit:4", "top/", "top period:3", "top user:6", "top share:5", "config/", "toggle/", "toggle enabled:5!"], "suggest": ["submit/", "setup/", "setup channel:7!", "approve/", "approve id:3!", "approve reason:3", "deny/", "deny id:3!", "deny reason:3", "consider/", "consider id:3!", "consider reason:3", "info/", "info id:3!"]};

type Opt = { name: string; type: number; required?: boolean; autocomplete?: boolean; options?: Opt[] };
function surface(opts: Opt[] | undefined, prefix = ""): string[] {
  const out: string[] = [];
  for (const o of opts ?? []) {
    if (o.type === 1 || o.type === 2) {
      out.push(`${prefix}${o.name}/`);
      out.push(...surface(o.options, `${prefix}${o.name} `));
    } else out.push(`${prefix}${o.name}:${o.type}${o.required ? "!" : ""}`);
  }
  return out;
}

test("backward compatible: every command, subcommand and option from before is still there, same type, no new required options", () => {
  for (const [name, before] of Object.entries(BASELINE)) {
    const cmd = commands.get(name);
    assert.ok(cmd, `/${name} still registered`);
    const now = surface((cmd.data.toJSON() as { options?: Opt[] }).options);
    for (const entry of before) assert.ok(now.includes(entry), `/${name}: ${entry} kept`);
    const newRequired = now.filter(e => e.endsWith("!") && !before.includes(e));
    assert.deepEqual(newRequired, [], `/${name} adds no required options`);
  }
});

test("every name and description fits Discord's limits (1–100 characters), so registration can't fail", () => {
  type Described = { name: string; description: string; options?: Described[]; choices?: Array<{ name: string }> };
  const walk = (o: Described, where: string) => {
    assert.ok(o.description.length >= 1 && o.description.length <= 100, `${where}: description is ${o.description.length} characters`);
    for (const c of o.choices ?? []) assert.ok(c.name.length <= 100, `${where} choice ${c.name}`);
    for (const child of o.options ?? []) walk(child, `${where} ${child.name}`);
  };
  for (const name of Object.keys(BASELINE)) walk(commands.get(name)!.data.toJSON() as Described, `/${name}`);
});

test("new options are optional additions: /about view+private, /ping private, /channelinfo private, /suggest list, autocomplete on colour, emoji and duration", () => {
  const opts = (n: string) => surface((commands.get(n)!.data.toJSON() as { options?: Opt[] }).options);
  assert.ok(opts("about").includes("view:3") && opts("about").includes("private:5"));
  assert.ok(opts("ping").includes("private:5"));
  assert.ok(opts("channelinfo").includes("private:5"));
  assert.ok(opts("suggest").includes("list/") && opts("suggest").includes("list status:3"));
  const find = (n: string, sub: string, opt: string) => ((commands.get(n)!.data.toJSON() as { options: Opt[] }).options.find(o => o.name === sub)?.options ?? []).find(o => o.name === opt);
  assert.equal(find("embed", "builder", "color")?.autocomplete, true);
  assert.equal(find("embed", "quick", "color")?.autocomplete, true);
  assert.equal(find("starboard", "emoji", "emoji")?.autocomplete, true);
  assert.equal(find("giveaway", "start", "duration")?.autocomplete, true);
  assert.equal(typeof commands.get("embed")!.autocomplete, "function");
  assert.equal(typeof commands.get("starboard")!.autocomplete, "function");
});

test("/activitysummary declares Moderate Members so /help hides it from members", () => {
  assert.deepEqual(commands.get("activitysummary")!.userPermissions, [PermissionFlagsBits.ModerateMembers]);
  assert.equal(timeframeFromButton("act_tf_30"), 30);
  assert.equal(timeframeFromButton("act_tf_2"), null);
  assert.equal(timeframeLabel(1), "last 24 hours");
  assert.equal(timeframeLabel(7), "last 7 days");
});

test("parseHexColor: #rrggbb, rrggbb, 0x, #rgb and preset names; bad input gets a friendly error", () => {
  assert.deepEqual(parseHexColor("#5865F2"), { ok: true, value: 0x5865f2 });
  assert.deepEqual(parseHexColor("5865f2"), { ok: true, value: 0x5865f2 });
  assert.deepEqual(parseHexColor("0xff0000"), { ok: true, value: 0xff0000 });
  assert.deepEqual(parseHexColor("#fff"), { ok: true, value: 0xffffff }, "short hex used to read as 0x000fff");
  assert.deepEqual(parseHexColor("gold"), { ok: true, value: 0xffd700 });
  assert.deepEqual(parseHexColor(""), { ok: true, value: 0x5865f2 });
  for (const bad of ["#zzzzzz", "1234567", "red-ish", "#12"]) {
    const r = parseHexColor(bad);
    assert.equal(r.ok, false, bad);
    if (!r.ok) assert.match(r.error, /isn't a colour/);
  }
  const choices = colorChoices("#abc");
  assert.equal(choices[0].value, "#AABBCC");
  assert.ok(colorChoices("").length > 5 && colorChoices("").length <= 25);
  assert.ok(colorChoices("gre").some(c => c.name.startsWith("Green")));
});

test("checkLink: http(s) links only, with a real host and no spaces", () => {
  assert.deepEqual(checkLink("", "image link"), { ok: true, value: null });
  assert.equal(checkLink("https://cdn.example.com/a.png", "image link").ok, true);
  assert.equal(checkLink("http://example.com/x", "image link").ok, true);
  for (const bad of ["example.com/a.png", "javascript:alert(1)", "ftp://x.com/a", "https://a b.com", "https://localhost/a", `https://a.com/${"x".repeat(2100)}`]) {
    const r = checkLink(bad, "image link");
    assert.equal(r.ok, false, bad);
    if (!r.ok) assert.match(r.error, /image link/);
  }
});

test("embedTextProblem catches each Discord limit and the 6000 total", () => {
  assert.equal(embedTextProblem({ title: "t", description: "d" }), null);
  assert.match(embedTextProblem({ title: "x".repeat(257) })!, /title/);
  assert.match(embedTextProblem({ footer: "x".repeat(2049) })!, /footer/);
  assert.match(embedTextProblem({ title: "x".repeat(256), description: "d".repeat(4096), footer: "f".repeat(2000) })!, /6000/);
  assert.equal(expandNewlines("a\\nb"), "a\nb");
});

test("checkReactionEmoji: one Unicode or custom emoji; words and several emoji are refused", () => {
  for (const ok of ["⭐", "❤️", "👍🏽", "🇺🇸", "👨‍👩‍👧", "<:star:123456789012345678>", "<a:spin:123456789012345678>", "1️⃣"]) assert.equal(checkReactionEmoji(ok).ok, true, ok);
  for (const bad of ["star", ":star:", "⭐⭐", "", "<:x:12>", "hi ⭐"]) assert.equal(checkReactionEmoji(bad).ok, false, bad);
  const choices = starEmojiChoices("", [{ id: "123456789012345678", name: "blob", animated: false }]);
  assert.equal(choices[0].value, "⭐");
  assert.ok(choices.some(c => c.value === "<:blob:123456789012345678>"));
  assert.deepEqual(starEmojiChoices("blo", [{ id: "123456789012345678", name: "blob", animated: true }]).map(c => c.value), ["<a:blob:123456789012345678>"]);
  assert.equal(starEmojiChoices("🔥", [])[0].value, "🔥");
});

test("/starboard ignore says what changed and what already was; mention lists fit a field", () => {
  const cur = { ignoredChannels: ["1"], ignoredRoles: [] as string[] };
  const add = applyIgnoreChange(cur, "add", { channelId: "1", roleId: "2" });
  assert.deepEqual(add.ignoredChannels, ["1"]);
  assert.deepEqual(add.ignoredRoles, ["2"]);
  assert.match(ignoreChangeMessage("add", add), /Added <@&2>/);
  assert.match(ignoreChangeMessage("add", add), /<#1> was already ignored/);
  const rem = applyIgnoreChange(cur, "remove", { roleId: "9" });
  assert.deepEqual(rem.changed, []);
  assert.match(ignoreChangeMessage("remove", rem), /not on the ignore list/);
  assert.equal(clippedMentions([]), "None");
  const many = Array.from({ length: 80 }, (_, i) => `<#1000000000000000${String(i).padStart(2, "0")}>`);
  const text = clippedMentions(many);
  assert.ok(text.length <= 1024);
  assert.match(text, /and \d+ more$/);
  const line = starboardListLine({ starCount: 5, sourceChannelId: "11", sourceMessageId: "12", starboardChannelId: "13", starboardMessageId: "14", authorId: "15", createdAt: new Date(0) }, 0, "10", "⭐");
  assert.match(line, /\/channels\/10\/11\/12/);
  assert.match(line, /\/channels\/10\/13\/14/);
});

test("/help hub: page order, wrap-around stepping, long categories split into pages, usage examples fill required options", () => {
  const order = helpPageOrder(["general", "moderation"], "apps");
  assert.deepEqual(order, ["all", "general", "moderation", "apps"]);
  assert.equal(stepHelpPage(order, "all", -1), "apps");
  assert.equal(stepHelpPage(order, "apps", 1), "all");
  assert.equal(stepHelpPage(order, "nonexistent", 1), "general");
  const pages = helpCategoryPages(Array.from({ length: 60 }, (_, i) => `**/cmd${i}** — ${"d".repeat(150)}`));
  assert.ok(pages.length > 1);
  for (const p of pages) assert.ok(p.length <= 4096);
  assert.equal(usageExample("warn", [{ name: "user", type: 6, required: true }, { name: "reason", type: 3 }]), "/warn user:<user>");
  assert.equal(usageExample("remindme", [{ name: "set", type: 1, options: [{ name: "reminder", type: 3, required: true }, { name: "duration", type: 3, required: true }] }]), "/remindme set reminder:<reminder> duration:<duration>");
});

let helpUser = 0;
test("/help: ◀ ▶ buttons and Home move between categories; the menu marks the page on screen", async () => {
  const handlers: Record<string, (...a: any[]) => unknown> = {};
  const replies: any[] = [];
  const interaction: any = {
    commandName: "help",
    user: { id: String(810000000000000000n + BigInt(++helpUser)), tag: "m#0" },
    guildId: "700000000000000001",
    guild: { members: { me: { permissions: { has: () => true } } } },
    inGuild: () => true,
    memberPermissions: { bitfield: PermissionFlagsBits.Administrator, has: () => true },
    options: { getString: () => null },
    replied: false, deferred: false,
    reply: async (p: any) => { replies.push(p); return { createMessageComponentCollector: () => ({ on: (ev: string, fn: any) => { handlers[ev] = fn; } }) }; },
    editReply: async () => ({}), followUp: async () => ({}),
  };
  await executeCommand(commands.get("help")!, interaction);
  assert.equal(replies.length, 1);
  const rowIds = (p: any) => p.components.flatMap((r: any) => r.toJSON().components.map((c: any) => c.custom_id).filter(Boolean));
  assert.ok(rowIds(replies[0]).includes(HELP_NAV_IDS.next));
  const press = async (customId: string, values?: string[]) => {
    const updates: any[] = [];
    await handlers.collect({ customId, values, user: interaction.user, update: async (p: any) => { updates.push(p); }, replied: false, deferred: false });
    return updates[0];
  };
  const next = await press(HELP_NAV_IDS.next);
  assert.match(next.embeds[0].toJSON().title, /General Commands/);
  const menu = next.components[0].toJSON().components[0];
  assert.equal(menu.options.find((o: any) => o.default)?.value, "general");
  const back = await press(HELP_NAV_IDS.prev);
  assert.match(back.embeds[0].toJSON().title, /Command Hub/);
  const wrap = await press(HELP_NAV_IDS.prev);
  assert.match(wrap.embeds[0].toJSON().title, /Apps/);
  const home = await press(HELP_NAV_IDS.home);
  assert.match(home.embeds[0].toJSON().title, /Command Hub/);
  const picked = await press("help_category_select", ["moderation"]);
  assert.match(picked.embeds[0].toJSON().title, /Moderation/);
});

test("component owner: other people get a private note instead of 'This interaction failed'", async () => {
  const replies: any[] = [];
  const press = (id: string) => ({ user: { id }, reply: async (p: any) => { replies.push(p); } });
  assert.equal(await ownsComponent(press("1"), "1", "ping"), true);
  assert.equal(replies.length, 0);
  assert.equal(await ownsComponent(press("2"), "1", "ping"), false);
  assert.equal(replies[0].content, notYoursMessage("ping"));
  assert.equal(replies[0].flags, 64);
});

test("/remindme: jump link to where it was set, push-back plan within bounds, control row", () => {
  assert.equal(reminderJumpUrl("123456789012345678", "223456789012345678", "323456789012345678"), "https://discord.com/channels/123456789012345678/223456789012345678/323456789012345678");
  assert.equal(reminderJumpUrl(null, "223456789012345678", "323456789012345678"), "https://discord.com/channels/@me/223456789012345678/323456789012345678");
  assert.equal(reminderJumpUrl("1", "2", null), undefined);
  assert.equal(reminderJumpUrl("123456789012345678", "x", "y"), undefined);
  const now = 1_000_000_000_000;
  const p = pushBackPlan(now + 60_000, now, PUSH_BACK_MINUTES);
  assert.ok(p.ok && p.at.getTime() === now + 60_000 + PUSH_BACK_MINUTES * 60_000);
  const late = pushBackPlan(now - 5_000, now, 60);
  assert.ok(late.ok && late.at.getTime() === now + 3_600_000, "a reminder already due is pushed from now");
  assert.equal(pushBackPlan(now + 365 * 86_400_000, now, 60).ok, false);
  const ids = reminderControlIds("abc");
  const row = reminderControlRow("abc", "https://discord.com/channels/1/2/3").toJSON();
  assert.deepEqual(row.components.map((c: any) => c.custom_id ?? c.url), [ids.later, ids.cancel, "https://discord.com/channels/1/2/3"]);
  assert.equal(reminderControlRow("abc", undefined).toJSON().components.length, 2);
});

test("/serverinfo channel tree groups channels under categories, voice after text, threads left out", () => {
  const ch = (id: string, name: string, type: ChannelType, parentId: string | null, position: number) => ({ id, name, type, parentId, position });
  const lines = channelTreeLines([
    ch("c1", "Info", ChannelType.GuildCategory, null, 0),
    ch("v1", "Lounge", ChannelType.GuildVoice, "c1", 0),
    ch("t1", "rules", ChannelType.GuildText, "c1", 1),
    ch("t0", "loose", ChannelType.GuildText, null, 0),
    ch("th", "thread", ChannelType.PublicThread, "t1", 0),
  ]);
  assert.deepEqual(lines, ["#️⃣ <#t0>", "📁 **Info** (2)", "\u2003#️⃣ <#t1>", "\u2003🔊 <#v1>"]);
  assert.match(stickerLine({ name: "wave", tags: "wave", description: "hi there" }), /wave.*:wave:\n-# hi there/);
});

test("/suggest list: open means pending or under consideration; lines carry votes, status and a jump link", () => {
  assert.deepEqual(suggestionListFilter("g", null), { guildId: "g", status: { $in: ["pending", "considered"] } });
  assert.deepEqual(suggestionListFilter("g", "all"), { guildId: "g" });
  assert.deepEqual(suggestionListFilter("g", "approved"), { guildId: "g", status: "approved" });
  assert.deepEqual(suggestionListFilter("g", "$where"), { guildId: "g", status: { $in: ["pending", "considered"] } }, "unknown values fall back, never reach the query");
  const line = suggestionListLine({ id: "s1", authorId: "5", content: "**Add a channel**\n\nbecause", status: "approved", upvotes: ["1", "2"], downvotes: [], channelId: "7", messageId: "8", createdAt: new Date(0) }, "g");
  assert.match(line, /^\*\*Add a channel\*\*/);
  assert.match(line, /👍 2 👎 0/);
  assert.match(line, /channels\/g\/7\/8/);
});

test("/poll: whitespace-only options no longer make a one-option poll; duplicates are named", () => {
  assert.deepEqual(pollOptionsProblem(["Yes", "  ", null]), { ok: false, error: "A poll needs at least two options with some text in them." });
  const dup = pollOptionsProblem(["Yes", "yes "]);
  assert.equal(dup.ok, false);
  if (!dup.ok) assert.match(dup.error, /listed twice/);
  assert.deepEqual(pollOptionsProblem([" A ", "B", "", "C"]), { ok: true, options: ["A", "B", "C"] });
});

test("/giveaway: duration presets are inside the 10s–30d bounds; list lines link to the giveaway", () => {
  for (const p of GIVEAWAY_DURATION_PRESETS) {
    const s = parseFriendlyDuration(p.value)!;
    assert.ok(s >= GIVEAWAY_BOUNDS.minSeconds && s <= GIVEAWAY_BOUNDS.maxSeconds, p.value);
  }
  const line = giveawayListLine({ prize: "Nitro", winnerCount: 1, entrants: ["a"], endsAt: new Date(0), channelId: "2", messageId: "3", bonusRoleId: "4", bonusEntries: 3 }, "1", 0);
  assert.match(line, /1 winner · 1 entry · <@&4> 3×/);
  assert.match(line, /channels\/1\/2\/3/);
});

test("/embed drafts: friendly errors for colour and links; the placeholder description can't be posted", () => {
  assert.equal(draftFromInput({ title: "t", color: "nope" }).ok, false);
  assert.equal(draftFromInput({ title: "t", image: "not a link" }).ok, false);
  assert.equal(draftFromInput({ title: "   " }).ok, false);
  const ok = draftFromInput({ title: "t", description: "a\\nb", color: "#fff" });
  assert.ok(ok.ok);
  if (!ok.ok) return;
  assert.equal(ok.draft.description, "a\nb");
  assert.equal(ok.draft.color, 0xffffff);
  const blank = draftFromInput({ title: "t" });
  assert.ok(blank.ok && blank.draft.description === EMBED_PLACEHOLDER);
  if (blank.ok) assert.match(draftPostProblem(blank.draft)!, /description first/);
  const fields = (v: Record<string, string>) => ({ fields: { getTextInputValue: (id: string) => v[id] ?? "" } }) as never;
  const meta = applyDraftModal("meta", fields({ embed_title_input: "New", embed_url_input: "bad", embed_color_input: "" }), ok.draft);
  assert.equal(meta.ok, false, "a bad title link is refused and the draft kept");
  const meta2 = applyDraftModal("meta", fields({ embed_title_input: "New", embed_url_input: "", embed_color_input: "" }), ok.draft);
  assert.ok(meta2.ok && meta2.draft.title === "New" && meta2.draft.color === 0xffffff, "a cleared colour keeps the current one");
  const media = applyDraftModal("media", fields({ embed_author_input: "Me", embed_image_input: "https://x.com/a.png", embed_thumb_input: "", embed_footer_input: "f" }), blank.ok ? blank.draft : ok.draft);
  assert.ok(media.ok && media.draft.description === EMBED_PLACEHOLDER && media.draft.author === "Me");
});

test("/dashboard staff buttons, /channelinfo overwrite lines, /about views, /avatar expired row", () => {
  for (const id of ["dash_automod", "dash_escalation", "dash_verify", "dash_warnings"]) assert.equal(dashboardButtonNeedsStaff(id), true, id);
  for (const id of ["dash_refresh", "dash_tickets", "dash_roles", "dash_health"]) assert.equal(dashboardButtonNeedsStaff(id), false, id);
  const line = overwriteLine({ id: "5", type: OverwriteType.Role, allow: PermissionFlagsBits.SendMessages, deny: PermissionFlagsBits.ViewChannel }, "1");
  assert.equal(line, "**<@&5>**\n✅ Send Messages\n❌ View Channel");
  assert.match(overwriteLine({ id: "1", type: OverwriteType.Role, allow: 0n, deny: 0n }, "1"), /@everyone\*\*\nNo changes/);
  assert.match(overwriteLine({ id: "9", type: OverwriteType.Member, allow: 0n, deny: PermissionFlagsBits.SendMessages }, "1"), /<@9>/);
  assert.equal(aboutView("database"), "database");
  assert.equal(aboutView("bogus"), "overview");
  assert.equal((expiredAvatarRow("https://cdn.discordapp.com/a.png").toJSON().components[0] as { url?: string }).url, "https://cdn.discordapp.com/a.png");
});

test("upgraded files stay under 400 lines", () => {
  const dirs = ["src/commands/general", "src/commands/general/remindme", "src/commands/general/dashboard", "src/commands/community", "src/commands/shared"];
  for (const dir of dirs) {
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".ts"))) {
      const lines = fs.readFileSync(path.join(dir, f), "utf8").split("\n").length;
      assert.ok(lines < 400, `${dir}/${f} has ${lines} lines`);
    }
  }
});
