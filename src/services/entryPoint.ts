/**
 * The Discord side of Aegis's entry points: the compact help card shown for a
 * bare @mention, `a!help` / `!help` / `aegis help`, help words or a first
 * message in DMs, and the one-time welcome posted when Aegis joins a server.
 * Rules live in entryPointLogic.ts.
 */
import mongoose from "mongoose";
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder,
  type Client, type Guild, type GuildBasedChannel, type GuildMember, type Message,
} from "discord.js";
import { JoinWelcomeModel } from "../database/extraModels";
import { isDuplicateKey } from "../database/modmailModels";
import { dashboardUrl, inviteUrl, siteUrl, supportServerUrl } from "../config/links";
import { footer } from "../utils/embedStyle";
import { TtlCache } from "../utils/ttlCache";
import { logger } from "../utils/logger";
import {
  DM_FIRST_SEEN_MS, ENTRY_HELP_COOLDOWN_MS, ENTRY_MENTIONS, KeyedCooldown, canPostHelp, canReplyTo,
  isGuildHelpTrigger, joinWelcomeEnabled, pickWelcomeChannel,
} from "./entryPointLogic";

/** Top areas with a few commands each. Kept short: /help has the full, permission-aware list. */
export const ENTRY_HELP_CATEGORIES: ReadonlyArray<{ name: string; commands: readonly string[] }> = [
  { name: "🔨 Moderation", commands: ["warn", "timeout", "ban", "case"] },
  { name: "🛡️ Safety", commands: ["automod", "incident", "trust"] },
  { name: "🗳️ Community", commands: ["poll", "giveaway", "suggest"] },
  { name: "🎫 Support", commands: ["ticket", "modmail"] },
  { name: "⚙️ Setup", commands: ["dashboard", "config", "diagnostics"] },
];

export const DM_STAFF_NOTE = "To contact a server's staff, DM me while ModMail is on in that server.";

export interface EntryHelpOptions {
  /** Shown in DMs: adds the ModMail note. */
  dm?: boolean;
  /** The member already has an open ModMail conversation (DM only). */
  hasOpenTicket?: boolean;
}

function linkButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setLabel("Commands").setStyle(ButtonStyle.Link).setURL(siteUrl("/commands")).setEmoji("📋"),
    new ButtonBuilder().setLabel("Dashboard").setStyle(ButtonStyle.Link).setURL(dashboardUrl()).setEmoji("🖥️"),
    new ButtonBuilder().setLabel("Support server").setStyle(ButtonStyle.Link).setURL(supportServerUrl()).setEmoji("💬"),
    new ButtonBuilder().setLabel("Invite").setStyle(ButtonStyle.Link).setURL(inviteUrl()).setEmoji("➕"),
  );
}

/** The compact help card: what Aegis is, where to start, and the main links. */
export function buildEntryHelp(o: EntryHelpOptions = {}): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("👋 Hi, I'm Aegis")
    .setDescription(
      "I use slash commands. Start with **/help** to see every command you can use.\n" +
      "Type `/` in the message box and pick Aegis to browse them.",
    )
    .addFields(ENTRY_HELP_CATEGORIES.map(c => ({ name: c.name, value: c.commands.map(n => `\`/${n}\``).join(" "), inline: true })))
    .setFooter(footer("New here? Run /dashboard or open the web dashboard to set things up"));
  if (o.dm) {
    const lines = [DM_STAFF_NOTE];
    if (o.hasOpenTicket) lines.push("You have a ModMail conversation open: anything else you send here goes to that server's staff.");
    embed.addFields({ name: "📨 Contacting staff", value: lines.join("\n"), inline: false });
  }
  return { embeds: [embed], components: [linkButtons()] };
}

/* ── Servers: @mention and typed help ───────────────────────────────── */

const channelCooldown = new KeyedCooldown(ENTRY_HELP_COOLDOWN_MS);

/**
 * Answers a bare @mention or a typed help phrase with the help card.
 * Returns true when the message was a help trigger (answered or skipped), so
 * the caller does not also run autoresponders on it. Fails silently when
 * Aegis can't post an embed in the channel, and answers each channel at most
 * once per 10 seconds.
 */
export async function handleGuildEntryHelp(client: Client, message: Message): Promise<boolean> {
  if (!message.inGuild() || message.author.bot) return false;
  const botId = client.user?.id;
  if (!botId) return false;
  const me = message.guild.members.me;
  if (!isGuildHelpTrigger(message.content, botId, me?.roles.botRole?.id ?? null)) return false;
  if (!me) return true;

  const perms = message.channel.permissionsFor(me)?.bitfield ?? null;
  if (!canPostHelp(perms, message.channel.isThread())) return true;
  if (!channelCooldown.take(message.channelId)) return true;

  const payload = { ...buildEntryHelp(), allowedMentions: ENTRY_MENTIONS };
  if (canReplyTo(perms)) {
    await message.reply({ ...payload, failIfNotExists: false }).catch(() => null);
  } else {
    await message.channel.send(payload).catch(() => null);
  }
  return true;
}

/* ── DMs ────────────────────────────────────────────────────────────── */

const dmSeen = new TtlCache<true>(DM_FIRST_SEEN_MS, 50_000);

/** True the first time a user DMs Aegis in a day; marks them as seen. */
export function firstDmFrom(userId: string): boolean {
  if (dmSeen.get(userId)) return false;
  dmSeen.set(userId, true);
  return true;
}

/** Replies to a DM with the help card and the ModMail note. Never pings. */
export async function sendDmHelp(message: Pick<Message, "reply" | "author">, o: { hasOpenTicket?: boolean } = {}): Promise<void> {
  dmSeen.set(message.author.id, true);
  await message.reply({ ...buildEntryHelp({ dm: true, hasOpenTicket: o.hasOpenTicket }), allowedMentions: ENTRY_MENTIONS }).catch(() => null);
}

/* ── Joining a server ───────────────────────────────────────────────── */

/** Records which servers were welcomed, so a re-add within 30 days stays quiet. */
export interface WelcomeStore {
  /** True when this call is the first to claim the guild; false when it was welcomed already. */
  claim(guildId: string): Promise<boolean>;
  /** Undo a claim whose message could not be sent. */
  release(guildId: string): Promise<void>;
}

export const mongoWelcomeStore: WelcomeStore = {
  async claim(guildId) {
    // Without a database connection, stay quiet rather than risk repeats.
    if (mongoose.connection.readyState !== 1) return false;
    try {
      await JoinWelcomeModel.create({ guildId });
      return true;
    } catch (err) {
      if (isDuplicateKey(err)) return false;
      throw err;
    }
  },
  async release(guildId) {
    await JoinWelcomeModel.deleteOne({ guildId });
  },
};

export function memoryWelcomeStore(): WelcomeStore & { claimed: Set<string> } {
  const claimed = new Set<string>();
  return {
    claimed,
    async claim(id) { if (claimed.has(id)) return false; claimed.add(id); return true; },
    async release(id) { claimed.delete(id); },
  };
}

export function buildJoinWelcome(): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("🛡️ Thanks for adding Aegis!")
    .setDescription(
      "Run **/help** to get started: it lists every command you can use here.\n" +
      "Admins can set up moderation, automod, logging and more from the dashboard.",
    )
    .setFooter(footer("You can also @mention me any time for a quick start"));
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setLabel("Dashboard").setStyle(ButtonStyle.Link).setURL(dashboardUrl()).setEmoji("🖥️"),
    new ButtonBuilder().setLabel("Commands").setStyle(ButtonStyle.Link).setURL(siteUrl("/commands")).setEmoji("📋"),
    new ButtonBuilder().setLabel("Support server").setStyle(ButtonStyle.Link).setURL(supportServerUrl()).setEmoji("💬"),
  );
  return { embeds: [embed], components: [row] };
}

function canSendIn(channel: GuildBasedChannel | null | undefined, me: GuildMember): boolean {
  if (!channel || channel.type !== ChannelType.GuildText) return false;
  return canPostHelp(channel.permissionsFor(me)?.bitfield ?? null, false);
}

export type JoinWelcomeResult = "sent" | "disabled" | "no-channel" | "already" | "failed";

/**
 * Posts one short, non-pinging welcome in the system channel (or the highest
 * text channel Aegis can post in). Skips silently without permission, when
 * turned off with `JOIN_WELCOME=off`, or when this server was welcomed in the
 * last 30 days.
 */
export async function sendJoinWelcome(guild: Guild, store: WelcomeStore = mongoWelcomeStore): Promise<JoinWelcomeResult> {
  if (!joinWelcomeEnabled()) return "disabled";
  const me = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
  if (!me) return "no-channel";

  const system = guild.systemChannel;
  const others = [...guild.channels.cache.values()]
    .filter(c => c.type === ChannelType.GuildText && c.id !== system?.id)
    .map(c => ({ id: c.id, canSend: canSendIn(c, me), position: "rawPosition" in c ? Number(c.rawPosition) : 0 }));
  const targetId = pickWelcomeChannel(system ? { id: system.id, canSend: canSendIn(system, me), position: -1 } : null, others);
  if (!targetId) return "no-channel";

  let claimed = false;
  try {
    claimed = await store.claim(guild.id);
  } catch (err) {
    logger.warn(`Join welcome: could not record ${guild.id}:`, err);
    return "failed";
  }
  if (!claimed) return "already";

  const channel = guild.channels.cache.get(targetId);
  if (!channel?.isTextBased() || !("send" in channel)) {
    await store.release(guild.id).catch(() => null);
    return "failed";
  }
  const sent = await channel.send({ ...buildJoinWelcome(), allowedMentions: ENTRY_MENTIONS }).catch(() => null);
  if (!sent) {
    await store.release(guild.id).catch(() => null);
    return "failed";
  }
  return "sent";
}

export function _resetEntryPointForTests(): void {
  channelCooldown.clear();
  dmSeen.clear();
}
