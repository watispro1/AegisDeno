/**
 * ModMail, the Discord side: DMs in, threads out, staff replies back.
 * Rules (rate limits, routing, formatting) live in modmailLogic.ts.
 */
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, PermissionFlagsBits, StringSelectMenuBuilder,
  type Client, type Guild, type Message, type ThreadChannel, type User,
} from "discord.js";
import { ModmailThreadModel, isDuplicateKey } from "../database/modmailModels";
import { getGuildConfig } from "./configuration";
import { sendGuildLog } from "./logging";
import { buildEmbedFromSpec } from "./embedSpec";
import {
  DEFAULT_CLOSE, DEFAULT_GREETING, MODMAIL_CLOSE_BUTTON, MODMAIL_MAX_TRANSCRIPT, MODMAIL_PICK_ID, MODMAIL_REPLY_BUTTON,
  RELAY_MENTIONS, SlidingLimiter, isBlocked, isModmailStaff, stripRelayPrefix, modmailReady, openingMentions, relayBody, routeDm, staffSignature,
  threadName, transcriptExpiry, type ModmailConfig, type RelayAttachment, type TranscriptLine,
} from "./modmailLogic";
import { isObfuscatedChannel } from "../utils/channels";
import { TtlCache } from "../utils/ttlCache";
import { siteUrl } from "../config/links";
import { logger } from "../utils/logger";

/** 5 DMs per 10 s per member, and 3 new tickets per hour. */
const dmLimiter = new SlidingLimiter(5, 10_000);
const openLimiter = new SlidingLimiter(3, 3_600_000);
/** A DM waiting for the member to pick a server, keyed by user (5 minutes). */
const pending = new TtlCache<{ content: string; attachments: RelayAttachment[] }>(5 * 60_000, 5_000);
/** threadId → ticket owner, so prefix relays don't hit Mongo for every thread message. */
const threadOwners = new TtlCache<{ guildId: string; userId: string } | null>(60_000, 10_000);

export interface TicketDoc { _id: unknown; guildId: string; userId: string; threadId: string; status: string; createdAt: Date; lines?: TranscriptLine[] }

function attachmentsOf(message: Pick<Message, "attachments">): RelayAttachment[] {
  return [...message.attachments.values()].map(a => ({ name: a.name ?? "file", url: a.url, size: a.size }));
}

async function pushLine(ticketId: unknown, line: TranscriptLine): Promise<void> {
  await ModmailThreadModel.updateOne({ _id: ticketId }, { $push: { lines: { $each: [line], $slice: -MODMAIL_MAX_TRANSCRIPT } } });
}

export async function ticketForThread(threadId: string): Promise<TicketDoc | null> {
  return (await ModmailThreadModel.findOne({ threadId, status: "open" }).select("-lines").lean()) as TicketDoc | null;
}

/** Cached owner lookup for a thread (null when it is not an open ModMail thread). */
export async function threadOwner(threadId: string): Promise<{ guildId: string; userId: string } | null> {
  return threadOwners.getOrLoad(threadId, async () => {
    const t = await ticketForThread(threadId);
    return t ? { guildId: t.guildId, userId: t.userId } : null;
  });
}

function staffButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`${MODMAIL_REPLY_BUTTON}:n`).setLabel("Reply").setStyle(ButtonStyle.Primary).setEmoji("✉️"),
    new ButtonBuilder().setCustomId(`${MODMAIL_REPLY_BUTTON}:a`).setLabel("Reply anonymously").setStyle(ButtonStyle.Secondary).setEmoji("🕶️"),
    new ButtonBuilder().setCustomId(MODMAIL_CLOSE_BUTTON).setLabel("Close").setStyle(ButtonStyle.Danger).setEmoji("🔒"),
  );
}

function templateValues(guild: Guild, user: User) {
  return { user: `<@${user.id}>`, username: user.username, server: guild.name, memberCount: guild.memberCount };
}

async function eligibleGuilds(client: Client, user: User): Promise<string[]> {
  const out: string[] = [];
  for (const guild of client.guilds.cache.values()) {
    const cfg = (await getGuildConfig(guild.id)).modmail;
    if (!cfg || !modmailReady(cfg) || isBlocked(cfg, user.id)) continue;
    const member = guild.members.cache.get(user.id) ?? await guild.members.fetch(user.id).catch(() => null);
    if (member) out.push(guild.id);
    if (out.length >= 25) break;
  }
  return out;
}

export type OpenResult = { ok: true; ticket: TicketDoc; thread: ThreadChannel } | { ok: false; error: string };

/** Open a ticket. The unique index makes a second concurrent open fail cleanly. */
export async function openTicket(client: Client, guild: Guild, user: User, cfg: ModmailConfig): Promise<OpenResult> {
  if (!modmailReady(cfg)) return { ok: false, error: "ModMail is not set up in that server." };
  const parent = await guild.channels.fetch(cfg.channelId!).catch(() => null);
  if (!parent || isObfuscatedChannel(parent)) return { ok: false, error: "That server's ModMail channel is missing or hidden from Aegis. Please tell a moderator." };
  if (parent.type !== ChannelType.GuildText && parent.type !== ChannelType.GuildForum) return { ok: false, error: "That server's ModMail channel is not a text or forum channel." };

  let ticket: TicketDoc;
  try {
    ticket = (await ModmailThreadModel.create({ guildId: guild.id, userId: user.id, userTag: user.tag.slice(0, 64), threadId: "pending" })).toObject() as TicketDoc;
  } catch (err) {
    if (isDuplicateKey(err)) return { ok: false, error: "You already have an open conversation with that server." };
    throw err;
  }

  const member = await guild.members.fetch(user.id).catch(() => null);
  const intro = new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({ name: `New ModMail · ${user.tag}`, iconURL: user.displayAvatarURL() })
    .setDescription(`<@${user.id}> (\`${user.id}\`)`)
    .addFields(
      { name: "Account created", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: "Joined", value: member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "Unknown", inline: true },
    )
    .setFooter({ text: `Reply with the buttons, /modmail reply${cfg.relayPrefix ? `, or start a message with ${cfg.relayPrefix}` : ""}` })
    .setTimestamp();
  const content = cfg.pingStaff && cfg.staffRoleId ? `<@&${cfg.staffRoleId}>` : undefined;
  const first = { content, embeds: [intro], components: [staffButtons()], allowedMentions: openingMentions(cfg) };

  let thread: ThreadChannel;
  try {
    if (parent.type === ChannelType.GuildForum) {
      thread = await parent.threads.create({ name: threadName(user.username, user.id), message: first, reason: `ModMail from ${user.id}` });
    } else {
      thread = await parent.threads.create({ name: threadName(user.username, user.id), type: ChannelType.PrivateThread, invitable: false, autoArchiveDuration: 10080, reason: `ModMail from ${user.id}` });
      await thread.send(first);
    }
  } catch (err) {
    await ModmailThreadModel.deleteOne({ _id: ticket._id }).catch(() => null);
    logger.warn(`ModMail: could not create a thread in ${guild.id}:`, err);
    return { ok: false, error: "Aegis couldn't open a thread in that server (it may be missing Create Private Threads or Send Messages in Threads). Please tell a moderator." };
  }
  await ModmailThreadModel.updateOne({ _id: ticket._id }, { $set: { threadId: thread.id } });
  ticket.threadId = thread.id;
  threadOwners.delete(thread.id);

  const greeting = buildEmbedFromSpec(cfg.greeting ?? DEFAULT_GREETING, templateValues(guild, user));
  await user.send({ embeds: [greeting], allowedMentions: RELAY_MENTIONS }).catch(() => null);
  return { ok: true, ticket, thread };
}

async function relayFromMember(client: Client, ticket: TicketDoc, user: User, content: string, atts: RelayAttachment[]): Promise<boolean> {
  const thread = await client.channels.fetch(ticket.threadId).catch(() => null);
  if (!thread?.isThread()) return false;
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
    .setDescription(relayBody(content, atts))
    .setFooter({ text: "Member" })
    .setTimestamp();
  await thread.send({ embeds: [embed], allowedMentions: RELAY_MENTIONS });
  await pushLine(ticket._id, { authorId: user.id, authorTag: user.tag.slice(0, 64), fromStaff: false, anonymous: false, content: relayBody(content, atts), at: new Date() });
  return true;
}

/** Entry point for every DM the bot receives. */
export async function handleModmailDM(client: Client, message: Message): Promise<void> {
  const user = message.author;
  if (user.bot || message.guildId) return;
  if (!dmLimiter.take(user.id)) {
    await message.react("⏳").catch(() => null);
    return;
  }
  const content = message.content ?? "";
  const attachments = attachmentsOf(message);
  if (!content.trim() && !attachments.length) return;

  const open = (await ModmailThreadModel.find({ userId: user.id, status: "open" }).select("-lines").lean()) as TicketDoc[];
  const openHere = open.filter(t => client.guilds.cache.has(t.guildId));
  const route = routeDm(openHere.map(t => t.guildId), openHere.length ? [] : await eligibleGuilds(client, user));

  if (route.kind === "none") {
    await message.reply({ content: "Hi! I couldn't find a server we share that takes ModMail. To reach a server's staff, ask them to turn on ModMail.", allowedMentions: RELAY_MENTIONS }).catch(() => null);
    return;
  }
  if (route.kind === "relay") {
    const t = openHere.find(x => x.guildId === route.guildId)!;
    const ok = await relayFromMember(client, t, user, content, attachments);
    await message.react(ok ? "✅" : "⚠️").catch(() => null);
    return;
  }
  if (route.kind === "pick") {
    pending.set(user.id, { content, attachments });
    const menu = new StringSelectMenuBuilder().setCustomId(`${MODMAIL_PICK_ID}:${route.reason}`).setPlaceholder("Choose a server")
      .addOptions(route.guildIds.map(id => ({ label: (client.guilds.cache.get(id)?.name ?? id).slice(0, 100), value: id })));
    await message.reply({
      content: route.reason === "open" ? "You have conversations open with several servers. Which one is this for?" : "Which server's staff do you want to message?",
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
      allowedMentions: RELAY_MENTIONS,
    }).catch(() => null);
    return;
  }
  await deliverToGuild(client, route.guildId, user, content, attachments).then(r => message.react(r.ok ? "✅" : "⚠️").catch(() => null)).catch(err => logger.warn("ModMail DM failed:", err));
}

/** Relay into the member's open ticket in a guild, opening one if needed. */
export async function deliverToGuild(client: Client, guildId: string, user: User, content: string, atts: RelayAttachment[]): Promise<{ ok: boolean; error?: string }> {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { ok: false, error: "Aegis is no longer in that server." };
  const cfg = (await getGuildConfig(guildId)).modmail;
  if (!cfg || !modmailReady(cfg) || isBlocked(cfg, user.id)) return { ok: false, error: "That server isn't taking ModMail from you right now." };
  let ticket = (await ModmailThreadModel.findOne({ guildId, userId: user.id, status: "open" }).select("-lines").lean()) as TicketDoc | null;
  if (!ticket) {
    if (!openLimiter.take(user.id)) return { ok: false, error: "You've opened several conversations recently. Please wait a while before opening another." };
    const opened = await openTicket(client, guild, user, cfg);
    if (!opened.ok) return opened;
    ticket = opened.ticket;
  }
  const ok = await relayFromMember(client, ticket, user, content, atts);
  return ok ? { ok } : { ok, error: "The staff thread is gone. A moderator can close the old conversation." };
}

/** The pending DM for a picker, removed once used. */
export function takePending(userId: string): { content: string; attachments: RelayAttachment[] } | null {
  const p = pending.get(userId) ?? null;
  pending.delete(userId);
  return p;
}

export type ReplyResult = { ok: true } | { ok: false; error: string };

/** Staff → member. Only commands, modals and prefixed messages call this, never every thread message. */
export async function staffReply(client: Client, o: {
  guild: Guild; threadId: string; staff: User; content: string; anonymous: boolean; attachments?: RelayAttachment[];
}): Promise<ReplyResult> {
  const ticket = await ticketForThread(o.threadId);
  if (!ticket || ticket.guildId !== o.guild.id) return { ok: false, error: "This isn't an open ModMail thread. Run it inside the ticket's thread." };
  const user = await client.users.fetch(ticket.userId).catch(() => null);
  if (!user) return { ok: false, error: "Discord couldn't find that member any more." };
  const body = relayBody(o.content, o.attachments ?? []);
  const signature = staffSignature({ anonymous: o.anonymous, staffTag: o.staff.tag, guildName: o.guild.name });
  const dm = new EmbedBuilder().setColor(0x5865f2).setAuthor({ name: signature.slice(0, 256) }).setDescription(body).setTimestamp();
  const sent = await user.send({ embeds: [dm], allowedMentions: RELAY_MENTIONS }).catch(() => null);
  if (!sent) return { ok: false, error: "The member's DMs are closed or they blocked Aegis, so the reply wasn't delivered." };
  const thread = await client.channels.fetch(o.threadId).catch(() => null);
  if (thread?.isThread()) {
    const echo = new EmbedBuilder().setColor(0x5865f2).setAuthor({ name: `${o.staff.tag}${o.anonymous ? " (anonymous)" : ""} → member`, iconURL: o.staff.displayAvatarURL() }).setDescription(body).setTimestamp();
    await thread.send({ embeds: [echo], allowedMentions: RELAY_MENTIONS }).catch(() => null);
  }
  await pushLine(ticket._id, { authorId: o.staff.id, authorTag: o.staff.tag.slice(0, 64), fromStaff: true, anonymous: o.anonymous, content: body, at: new Date() });
  return { ok: true };
}

/** Close a ticket once (atomic status flip), tell the member, archive the thread, log a summary. */
export async function closeTicket(client: Client, o: { guild: Guild; threadId: string; staff: User; reason: string | null }): Promise<ReplyResult> {
  const now = new Date();
  const doc = (await ModmailThreadModel.findOneAndUpdate(
    { threadId: o.threadId, guildId: o.guild.id, status: "open" },
    { $set: { status: "closed", closedAt: now, closedBy: o.staff.id, closeReason: o.reason?.slice(0, 512) ?? null, expiresAt: transcriptExpiry(now) } },
    { new: true },
  ).lean()) as (TicketDoc & { lines: TranscriptLine[] }) | null;
  if (!doc) return { ok: false, error: "This thread has no open ModMail conversation (it may already be closed)." };
  threadOwners.delete(o.threadId);
  const cfg = (await getGuildConfig(o.guild.id)).modmail;
  const user = await client.users.fetch(doc.userId).catch(() => null);
  if (user) {
    const embed = buildEmbedFromSpec(cfg?.closeMessage ?? DEFAULT_CLOSE, templateValues(o.guild, user));
    if (o.reason) embed.addFields({ name: "Reason", value: o.reason.slice(0, 1024) });
    await user.send({ embeds: [embed], allowedMentions: RELAY_MENTIONS }).catch(() => null);
  }
  const thread = await client.channels.fetch(o.threadId).catch(() => null);
  if (thread?.isThread()) {
    await thread.send({ content: `🔒 Closed by ${o.staff.tag}${o.reason ? `: ${o.reason.slice(0, 300)}` : ""}`, allowedMentions: RELAY_MENTIONS }).catch(() => null);
    await thread.setLocked(true).catch(() => null);
    await thread.setArchived(true).catch(() => null);
  }
  const lines = doc.lines ?? [];
  await sendGuildLog(client, o.guild.id, {
    color: 0x99aab5,
    title: "ModMail closed",
    description: [
      `**Member:** <@${doc.userId}> (\`${doc.userId}\`)`,
      `**Closed by:** <@${o.staff.id}>`,
      `**Messages:** ${lines.length}`,
      o.reason ? `**Reason:** ${o.reason.slice(0, 300)}` : null,
      `**Transcript:** ${siteUrl(`/dashboard/${o.guild.id}/modmail/${String(doc._id)}`)} (kept 90 days)`,
    ].filter(Boolean).join("\n"),
  }, "modActions");
  return { ok: true };
}

/**
 * MessageContent is already enabled, so staff may also answer by typing in the
 * thread with the configured prefix (e.g. "=thanks, looking into it"). Only
 * prefixed messages from staff are relayed, never ordinary thread chat.
 */
export async function relayPrefixedStaffMessage(client: Client, message: Message): Promise<void> {
  if (!message.guild || !message.member || message.author.bot) return;
  const owner = await threadOwner(message.channelId);
  if (!owner || owner.guildId !== message.guild.id) return;
  const cfg = (await getGuildConfig(message.guild.id)).modmail;
  if (!cfg?.enabled) return;
  const text = stripRelayPrefix(cfg, message.content ?? "");
  if (text === null) return;
  const staff = isModmailStaff(cfg, { roleIds: [...message.member.roles.cache.keys()], manageGuild: message.member.permissions.has(PermissionFlagsBits.ManageGuild) });
  if (!staff) return;
  const r = await staffReply(client, { guild: message.guild, threadId: message.channelId, staff: message.author, content: text, anonymous: cfg.anonymousByDefault, attachments: attachmentsOf(message) });
  await message.react(r.ok ? "📨" : "⚠️").catch(() => null);
  if (!r.ok) await message.reply({ content: r.error, allowedMentions: RELAY_MENTIONS }).catch(() => null);
}

export function _resetModmailLimitsForTests(): void { pending.clear(); threadOwners.clear(); }
