import { test } from "node:test";
import assert from "node:assert/strict";
import { Attachment, Collection, Embed, type Message } from "discord.js";
import {
  DEFAULT_MEDIA_SAFETY, MEDIA_SCAN_FLAGS, attachmentFlagReasons, attachmentIsFlagged, channelIsNsfw, embedFlagReasons,
  embedIsFlagged, guardModeFor, hiddenMediaLine, mediaFlagReasons, mediaSafetySummary, normalizeMediaSafety, reasonsText,
  summarizeFlaggedMedia,
} from "../src/services/mediaSafety";
import {
  HIDDEN_MEDIA_FIELD, guardStarboardMedia, guardTranscriptAttachment, guardedRelayLine, hiddenMediaFieldValue,
  repostShowsMedia, stripEmbedMedia,
} from "../src/services/mediaSafetyRepost";
import { attachmentLines, relayBody } from "../src/services/modmailLogic";
import { renderTranscriptHtml } from "../src/services/ticketTranscript";
import { normalizeGuildConfig, guildConfigSetPaths } from "../src/services/guildConfigNormalize";

const EXPLICIT = 1 << 4;
const GORE = 1 << 6;
const SELF_HARM = 1 << 7;
const SPOILER = 1 << 3;
const INVENTORY = 1 << 5;

test("flag bits match Discord's documented values", () => {
  assert.deepEqual(MEDIA_SCAN_FLAGS, { explicit: 16, gore: 64, self_harm: 128 });
});

test("mediaFlagReasons reads raw bitfields and ignores spoiler and inventory bits", () => {
  assert.deepEqual(mediaFlagReasons(0), []);
  assert.deepEqual(mediaFlagReasons(null), []);
  assert.deepEqual(mediaFlagReasons(undefined), []);
  assert.deepEqual(mediaFlagReasons(SPOILER | INVENTORY), []);
  assert.deepEqual(mediaFlagReasons(EXPLICIT), ["explicit"]);
  assert.deepEqual(mediaFlagReasons(SELF_HARM | GORE | EXPLICIT | SPOILER), ["explicit", "gore", "self_harm"]);
  assert.deepEqual(mediaFlagReasons(BigInt(GORE)), ["gore"]);
  assert.deepEqual(mediaFlagReasons(Number.NaN), []);
});

test("discord.js keeps the unnamed bits on Attachment.flags and Embed.data", () => {
  const att = new Attachment({ id: "1", filename: "a.png", url: "https://cdn.discordapp.com/a.png", proxy_url: "", size: 1, flags: SPOILER | GORE } as never);
  assert.deepEqual(attachmentFlagReasons(att), ["gore"]);
  assert.ok(attachmentIsFlagged(att));
  const clean = new Attachment({ id: "2", filename: "b.png", url: "https://cdn.discordapp.com/b.png", proxy_url: "", size: 1 } as never);
  assert.equal(attachmentIsFlagged(clean), false);
  const embed = new Embed({ image: { url: "https://x/y.png" }, flags: EXPLICIT | INVENTORY } as never);
  assert.deepEqual(embedFlagReasons(embed), ["explicit"]);
  assert.ok(embedIsFlagged({ flags: SELF_HARM }), "raw API embed");
  assert.equal(embedIsFlagged(new Embed({ title: "t" })), false);
});

test("summarizeFlaggedMedia merges reasons and indexes the flagged items", () => {
  const atts = new Collection<string, { flags: { bitfield: number } }>([
    ["1", { flags: { bitfield: 0 } }], ["2", { flags: { bitfield: GORE } }],
  ]);
  const s = summarizeFlaggedMedia({ attachments: atts, embeds: [{ data: { flags: EXPLICIT } }, { data: {} }] });
  assert.deepEqual(s, { flagged: true, reasons: ["explicit", "gore"], attachments: [1], embeds: [0] });
  assert.equal(summarizeFlaggedMedia({ attachments: [], embeds: [] }).flagged, false);
});

test("labels and placeholder wording", () => {
  assert.equal(reasonsText(["explicit"]), "explicit");
  assert.equal(reasonsText(["self_harm", "explicit"]), "explicit and self-harm");
  assert.equal(reasonsText(["explicit", "gore", "self_harm"]), "explicit, gore and self-harm");
  assert.equal(hiddenMediaLine(["explicit"]), "Image hidden: flagged by Discord as explicit");
  assert.equal(hiddenMediaLine(["gore"], "a[b].png"), "a_b_.png hidden: flagged by Discord as gore");
});

test("setting: on with placeholder by default, normalised on read, saved whole", () => {
  assert.deepEqual(normalizeMediaSafety(undefined), DEFAULT_MEDIA_SAFETY);
  assert.deepEqual(normalizeMediaSafety({ enabled: false, mode: "spoiler" }), { enabled: false, mode: "spoiler" });
  assert.deepEqual(normalizeMediaSafety({ enabled: "no", mode: "blur", $where: 1 }), { enabled: true, mode: "placeholder" });
  assert.deepEqual(normalizeGuildConfig("1", {} as never).mediaSafety, { enabled: true, mode: "placeholder" }, "existing docs get the default");
  assert.deepEqual(guildConfigSetPaths({ mediaSafety: { enabled: false, mode: "spoiler" } }), { mediaSafety: { enabled: false, mode: "spoiler" } });
  assert.match(mediaSafetySummary({ enabled: false, mode: "placeholder" }), /^Off/);
  assert.match(mediaSafetySummary({ enabled: true, mode: "spoiler" }), /spoilered link/);
});

test("guard applies outside age-restricted channels only; a thread uses its parent", () => {
  assert.equal(guardModeFor(undefined, false), "placeholder");
  assert.equal(guardModeFor({ enabled: true, mode: "spoiler" }, false), "spoiler");
  assert.equal(guardModeFor({ enabled: true, mode: "placeholder" }, true), null);
  assert.equal(guardModeFor({ enabled: false, mode: "placeholder" }, false), null);
  assert.equal(channelIsNsfw({ nsfw: true, isThread: () => false }), true);
  assert.equal(channelIsNsfw({ nsfw: false }), false);
  assert.equal(channelIsNsfw({ isThread: () => true, parent: { nsfw: true } }), true);
  assert.equal(channelIsNsfw({ isThread: () => true, nsfw: true, parent: { nsfw: false } }), false);
  assert.equal(channelIsNsfw(null), false, "DMs and unknown channels are not age-restricted");
});

const IMG = "https://cdn.discordapp.com/attachments/1/2/bad.png?ex=1";
const OK_IMG = "https://cdn.discordapp.com/attachments/1/3/ok.png";

test("guardStarboardMedia: flagged media leaves, unflagged stays, no mode passes everything", () => {
  const atts = [
    { url: IMG, name: "bad.png", contentType: "image/png", reasons: ["explicit"] as const },
    { url: OK_IMG, name: "ok.png", contentType: "image/png" },
  ];
  const embeds = [{ title: "Link", imageUrl: "https://e/x.png", reasons: ["gore"] as const }];
  const p = guardStarboardMedia(atts.map(a => ({ ...a, reasons: a.reasons ? [...a.reasons] : undefined })), embeds.map(e => ({ ...e, reasons: [...e.reasons] })), "placeholder");
  assert.deepEqual(p.attachments.map(a => a.url), [OK_IMG]);
  assert.equal(p.embeds[0].imageUrl, null);
  assert.equal(p.embeds[0].title, "Link", "text kept");
  assert.deepEqual(p.notes, ["bad.png hidden: flagged by Discord as explicit", "Image hidden: flagged by Discord as gore"]);
  assert.ok(!p.notes.join().includes("https://"), "placeholder mode carries no link");
  const s = guardStarboardMedia([{ url: IMG, name: "bad.png", reasons: ["explicit"] }], [], "spoiler");
  assert.equal(s.notes[0], `||[bad.png](${IMG})|| (flagged by Discord as explicit)`);
  const off = guardStarboardMedia([{ url: IMG, name: "bad.png", reasons: ["explicit"] }], [{ imageUrl: "https://e/x.png", reasons: ["gore"] }], null);
  assert.equal(off.attachments.length, 1);
  assert.equal(off.embeds[0].imageUrl, "https://e/x.png");
  assert.ok(!("reasons" in off.attachments[0]));
  assert.ok(hiddenMediaFieldValue(Array.from({ length: 40 }, () => "x".repeat(60))).length <= 1024);
});

function fakeMessage(attachments: Attachment[], embeds: Embed[] = []): Message {
  return {
    id: "900000000000000001",
    channelId: "800000000000000001",
    url: "https://discord.com/channels/1/2/3",
    content: "look",
    createdAt: new Date(0),
    author: { id: "5", tag: "member#0001", displayAvatarURL: () => "https://cdn.discordapp.com/avatar.png" },
    channel: { name: "general" },
    attachments: new Collection(attachments.map(a => [a.id, a])),
    embeds,
  } as unknown as Message;
}

const att = (id: string, url: string, flags = 0) =>
  new Attachment({ id, filename: url.split("/").pop()!.split("?")[0], url, proxy_url: "", size: 10, content_type: "image/png", flags } as never);

test("starboard post: flagged image hidden in a normal channel, shown in an age-restricted one", async () => {
  const { buildStarboardEmbed } = await import("../src/services/starboard");
  const msg = fakeMessage([att("1", IMG, EXPLICIT), att("2", OK_IMG)]);
  const guarded = buildStarboardEmbed(msg, 3, "⭐", "placeholder").embeds[0].toJSON();
  assert.equal(guarded.image?.url, OK_IMG, "the unflagged image is the one shown");
  const hidden = guarded.fields?.find(f => f.name === HIDDEN_MEDIA_FIELD);
  assert.equal(hidden?.value, "bad.png hidden: flagged by Discord as explicit");
  assert.ok(!JSON.stringify(guarded).includes("bad.png?ex"), "no link to the flagged file anywhere");
  const nsfw = buildStarboardEmbed(msg, 3, "⭐", null).embeds[0].toJSON();
  assert.equal(nsfw.image?.url, IMG, "age-restricted starboard reposts as today");
  assert.equal(nsfw.fields?.some(f => f.name === HIDDEN_MEDIA_FIELD) ?? false, false);
  const clean = buildStarboardEmbed(fakeMessage([att("2", OK_IMG)]), 3, "⭐", "placeholder").embeds[0].toJSON();
  assert.equal(clean.image?.url, OK_IMG);
  assert.equal(clean.fields, undefined, "unflagged media unchanged");
  const spoiler = buildStarboardEmbed(msg, 3, "⭐", "spoiler").embeds[0].toJSON();
  assert.match(spoiler.fields!.find(f => f.name === HIDDEN_MEDIA_FIELD)!.value, /^\|\|\[bad\.png\]/);
  assert.notEqual(spoiler.image?.url, IMG);
});

test("starboard post: a flagged link-preview embed loses its image", async () => {
  const { buildStarboardEmbed } = await import("../src/services/starboard");
  const msg = fakeMessage([], [new Embed({ title: "Page", image: { url: "https://e/x.png" }, flags: SELF_HARM } as never)]);
  const json = buildStarboardEmbed(msg, 3, "⭐", "placeholder").embeds[0].toJSON();
  assert.equal(json.image, undefined);
  assert.match(json.fields![0].value, /self-harm/);
});

test("repostShowsMedia ignores query strings, the description and the hidden-media field", () => {
  assert.ok(repostShowsMedia([{ image: { url: IMG.replace("ex=1", "ex=2") } }], [IMG]));
  assert.ok(repostShowsMedia([{ fields: [{ name: "📎 Attachments", value: `[bad.png](${IMG})` }] }], [IMG]));
  assert.equal(repostShowsMedia([{ description: IMG }], [IMG]), false, "message text never renders as media");
  assert.equal(repostShowsMedia([{ fields: [{ name: HIDDEN_MEDIA_FIELD, value: `||[bad.png](${IMG})||` }] }], [IMG]), false);
  assert.equal(repostShowsMedia([{ image: { url: OK_IMG } }], []), false);
  const stripped = stripEmbedMedia({ image: { url: IMG }, thumbnail: { url: IMG }, fields: [] }, ["explicit"]);
  assert.equal(stripped.image, undefined);
  assert.equal(stripped.thumbnail, undefined);
  assert.equal(stripped.fields?.[0].name, HIDDEN_MEDIA_FIELD);
  assert.equal(stripEmbedMedia(stripped, ["explicit"]).fields?.length, 1, "never added twice");
});

function fakePost(embeds: Embed[], editFails = false) {
  const calls: { edits: unknown[]; deleted: boolean } = { edits: [], deleted: false };
  const post = {
    id: "990000000000000001",
    attachments: new Collection(),
    embeds,
    edit: async (payload: unknown) => { if (editFails) throw new Error("Missing Access"); calls.edits.push(payload); },
    delete: async () => { calls.deleted = true; },
  } as unknown as Message;
  return { post, calls };
}

test("late flag: the starboard post is rebuilt without the image, or deleted if the edit fails", async () => {
  const { buildStarboardEmbed } = await import("../src/services/starboard");
  const { cleanStarboardRepost } = await import("../src/services/starboardMediaGuard");
  const before = fakeMessage([att("1", IMG)]);
  const posted = buildStarboardEmbed(before, 3, "⭐", "placeholder").embeds.map(e => new Embed(e.toJSON()));
  assert.equal(posted[0].image?.url, IMG, "not flagged when first posted");
  const flaggedNow = fakeMessage([att("1", IMG.replace("ex=1", "ex=9"), EXPLICIT)]);
  const { post, calls } = fakePost(posted);
  assert.equal(await cleanStarboardRepost(flaggedNow, post, 3, "⭐", "placeholder"), "edited");
  const edited = (calls.edits[0] as { embeds: { toJSON(): { image?: unknown; fields?: { name: string }[] } }[] }).embeds[0].toJSON();
  assert.equal(edited.image, undefined);
  assert.ok(edited.fields?.some(f => f.name === HIDDEN_MEDIA_FIELD));

  const cleaned = fakePost(buildStarboardEmbed(flaggedNow, 3, "⭐", "placeholder").embeds.map(e => new Embed(e.toJSON())));
  assert.equal(await cleanStarboardRepost(flaggedNow, cleaned.post, 3, "⭐", "placeholder"), "unchanged", "already clean: no edit");

  const failing = fakePost(posted, true);
  assert.equal(await cleanStarboardRepost(flaggedNow, failing.post, 3, "⭐", "placeholder"), "deleted");
  assert.ok(failing.calls.deleted);
});

test("own post flagged by Discord: the image comes off and the rest stays", async () => {
  const { cleanFlaggedOwnPost } = await import("../src/services/starboardMediaGuard");
  const { post, calls } = fakePost([new Embed({ description: "hi", image: { url: IMG }, flags: GORE } as never)]);
  assert.equal(await cleanFlaggedOwnPost(post), "edited");
  const sent = (calls.edits[0] as { embeds: { description?: string; image?: unknown; fields?: { name: string }[] }[] }).embeds[0];
  assert.equal(sent.description, "hi");
  assert.equal(sent.image, undefined);
  assert.equal(sent.fields?.[0].name, HIDDEN_MEDIA_FIELD);
  const clean = fakePost([new Embed({ image: { url: OK_IMG } })]);
  assert.equal(await cleanFlaggedOwnPost(clean.post), "unchanged");
});

test("ModMail: flagged attachments are not linked unless the mode allows a spoiler", () => {
  const atts = [
    { name: "bad.png", url: IMG, size: 10, reasons: ["explicit" as const] },
    { name: "ok.png", url: OK_IMG, size: 10 },
  ];
  assert.deepEqual(attachmentLines(atts, 1000, "placeholder"), [
    "📎 bad.png hidden: flagged by Discord as explicit",
    `📎 [ok.png](${OK_IMG})`,
  ]);
  assert.equal(attachmentLines(atts, 1000, "spoiler")[0], `📎 ||[bad.png](${IMG})|| (flagged by Discord as explicit)`);
  assert.equal(attachmentLines(atts, 1000, null)[0], `📎 [bad.png](${IMG})`, "age-restricted staff channel: as today");
  assert.equal(attachmentLines([{ ...atts[0], url: "https://evil.example/x.png" }], 1000, "spoiler")[0], "📎 bad.png (not relayed: unexpected link)", "the link check still runs first");
  assert.equal(relayBody("hello", atts, "placeholder"), `hello\n📎 bad.png hidden: flagged by Discord as explicit\n📎 [ok.png](${OK_IMG})`);
  assert.equal(guardedRelayLine({ name: "x", url: IMG, size: 1 }, "placeholder"), null, "unflagged: relayed as usual");
});

test("ticket transcripts: placeholder mode drops the link, spoiler mode marks it", () => {
  const p = guardTranscriptAttachment({ name: "bad.png", url: IMG, reasons: ["gore"] }, "placeholder");
  assert.deepEqual(p, { name: "bad.png hidden: flagged by Discord as gore", url: "" });
  assert.deepEqual(guardTranscriptAttachment({ name: "bad.png", url: IMG, reasons: ["gore"] }, "spoiler"), { name: "bad.png (flagged by Discord as gore)", url: IMG });
  assert.deepEqual(guardTranscriptAttachment({ name: "ok.png", url: OK_IMG, reasons: [] }, "placeholder"), { name: "ok.png", url: OK_IMG });
  const html = renderTranscriptHtml(
    { guildName: "G", channelName: "ticket-1", ticketId: "T", openerId: "1", generatedAt: 0 },
    [{ authorTag: "a", authorId: "1", bot: false, timestamp: 0, content: "", attachments: [p], embedCount: 0 }],
  );
  assert.ok(html.includes("bad.png hidden: flagged by Discord as gore"));
  assert.ok(!html.includes("bad.png?ex"), "no link to the flagged file");
});
