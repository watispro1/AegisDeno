/**
 * Per-channel permission checks for /diagnostics: every channel a module is
 * configured to post in, and the ModMail staff channel's thread permissions.
 * From 2026-11-16 Discord hides channels a bot lacks View Channel on, so a
 * missing View Channel turns into a channel Aegis can't see at all.
 */
import { ChannelType, PermissionFlagsBits, type Guild, type GuildMember } from "discord.js";
import type { GuildConfig } from "./configuration";
import { isObfuscatedChannel } from "../utils/channels";

export type PermissionCheck = ReadonlyArray<readonly [bigint, string]>;

/** What Aegis needs in any channel it posts embeds to. */
export const POSTING_PERMISSIONS: PermissionCheck = [
  [PermissionFlagsBits.ViewChannel, "View Channel"],
  [PermissionFlagsBits.SendMessages, "Send Messages"],
  [PermissionFlagsBits.EmbedLinks, "Embed Links"],
];

/** What ModMail needs in a text staff channel: it opens one private thread per conversation. */
export const MODMAIL_THREAD_PERMISSIONS: PermissionCheck = [
  [PermissionFlagsBits.CreatePrivateThreads, "Create Private Threads"],
  [PermissionFlagsBits.SendMessagesInThreads, "Send Messages in Threads"],
  [PermissionFlagsBits.ManageThreads, "Manage Threads"],
];

/** In a forum staff channel each conversation is a post instead. */
export const MODMAIL_FORUM_PERMISSIONS: PermissionCheck = [
  [PermissionFlagsBits.SendMessages, "Send Messages"],
  [PermissionFlagsBits.SendMessagesInThreads, "Send Messages in Threads"],
  [PermissionFlagsBits.ManageThreads, "Manage Threads"],
];

export function missingPermissions(has: (bit: bigint) => boolean, check: PermissionCheck): string[] {
  return check.filter(([bit]) => !has(bit)).map(([, name]) => name);
}

export interface ConfiguredChannel { id: string; labels: string[] }

const LOG_LABELS: Record<string, string> = {
  modActions: "mod action log", memberJoins: "join log", memberLeaves: "leave log", messageEdits: "edit log",
  messageDeletes: "delete log", roleChanges: "role log", channelEvents: "channel log",
};

/**
 * The channels modules are set to post in, each listed once with every use.
 * Only modules that are switched on count, so an old ID left in a disabled
 * module is not reported.
 */
export function configuredChannels(input: {
  guild: Pick<GuildConfig, "loggingEnabled" | "loggingChannelId" | "logChannels" | "welcomeEnabled" | "welcomeChannelId" | "goodbyeEnabled" | "goodbyeChannelId" | "suggestionsChannelId" | "digest">;
  starboard?: { enabled: boolean; channelId: string | null } | null;
  ticketLogChannelId?: string | null;
  verification?: { enabled: boolean; channelId: string | null } | null;
}): ConfiguredChannel[] {
  const out = new Map<string, string[]>();
  const add = (id: string | null | undefined, label: string) => {
    if (!id || !/^\d{17,20}$/.test(id)) return;
    const labels = out.get(id) ?? [];
    if (!labels.includes(label)) labels.push(label);
    out.set(id, labels);
  };
  const g = input.guild;
  if (g.loggingEnabled) {
    add(g.loggingChannelId, "log channel");
    for (const [key, id] of Object.entries(g.logChannels ?? {})) add(id, LOG_LABELS[key] ?? "log channel");
  }
  if (g.welcomeEnabled) add(g.welcomeChannelId, "welcome");
  if (g.goodbyeEnabled) add(g.goodbyeChannelId, "goodbye");
  add(g.suggestionsChannelId, "suggestions");
  if (g.digest?.enabled) add(g.digest.channelId, "staff digest");
  if (input.starboard?.enabled) add(input.starboard.channelId, "starboard");
  add(input.ticketLogChannelId, "ticket transcripts");
  if (input.verification?.enabled) add(input.verification.channelId, "verification panel");
  return [...out].map(([id, labels]) => ({ id, labels }));
}

export type AccessProblem =
  | { kind: "hidden" }
  | { kind: "deleted" }
  | { kind: "missing"; permissions: string[] };

/** One line for a channel with a problem, or null when Aegis has what it needs there. */
export function accessLine(channel: ConfiguredChannel, problem: AccessProblem | null): string | null {
  if (!problem) return null;
  const what = channel.labels.join(", ");
  switch (problem.kind) {
    case "hidden": return `⚠️ <#${channel.id}> (${what}): Aegis can't see it. Give Aegis **View Channel** there.`;
    case "deleted": return `⚠️ \`${channel.id}\` (${what}): deleted or not a channel any more. Pick a new one.`;
    case "missing": return `⚠️ <#${channel.id}> (${what}): missing ${problem.permissions.map(p => `**${p}**`).join(", ")}`;
  }
}

/** Joins lines into one embed field value, saying how many were left out when they don't fit. */
export function fitField(lines: string[], max = 1024): string {
  const out: string[] = [];
  let used = 0;
  for (let i = 0; i < lines.length; i++) {
    const left = lines.length - i - 1;
    const reserve = left ? `\n…and ${left} more`.length : 0;
    const sep = out.length ? 1 : 0;
    if (used + sep + lines[i].length + reserve > max) {
      out.push(`…and ${lines.length - i} more`);
      break;
    }
    out.push(lines[i]);
    used += sep + lines[i].length;
  }
  return out.join("\n");
}

async function resolve(guild: Guild, id: string) {
  return guild.channels.cache.get(id) ?? await guild.channels.fetch(id).catch(() => null);
}

/** Checks each configured channel for View Channel, Send Messages and Embed Links. */
export async function checkConfiguredChannels(guild: Guild, me: GuildMember, channels: ConfiguredChannel[]): Promise<string[]> {
  const lines: string[] = [];
  for (const c of channels) {
    const channel = await resolve(guild, c.id);
    let problem: AccessProblem | null = null;
    if (isObfuscatedChannel(channel)) problem = { kind: "hidden" };
    else if (!channel || !("permissionsFor" in channel)) problem = { kind: "deleted" };
    else {
      const perms = channel.permissionsFor(me);
      const missing = missingPermissions(bit => Boolean(perms?.has(bit)), POSTING_PERMISSIONS);
      if (missing.length) problem = { kind: "missing", permissions: missing };
    }
    const line = accessLine(c, problem);
    if (line) lines.push(line);
  }
  return lines;
}

/** The ModMail staff channel check: null when ModMail is not set up. */
export async function checkModmailChannel(guild: Guild, me: GuildMember, modmail: { enabled: boolean; channelId: string | null } | undefined): Promise<string | null> {
  if (!modmail?.enabled || !modmail.channelId) return null;
  const channel = await resolve(guild, modmail.channelId);
  if (isObfuscatedChannel(channel)) return `⚠️ Aegis can't see <#${modmail.channelId}>. Give Aegis **View Channel** there.`;
  if (!channel || !("permissionsFor" in channel)) return "⚠️ The ModMail staff channel was deleted. Pick a new one with `/modmail setup`.";
  const forum = channel.type === ChannelType.GuildForum;
  const perms = channel.permissionsFor(me);
  const has = (bit: bigint) => Boolean(perms?.has(bit));
  const missing = [
    ...missingPermissions(has, [POSTING_PERMISSIONS[0]]),
    ...missingPermissions(has, forum ? MODMAIL_FORUM_PERMISSIONS : MODMAIL_THREAD_PERMISSIONS),
  ];
  return missing.length
    ? `⚠️ <#${channel.id}> is missing ${missing.map(p => `**${p}**`).join(", ")}. New conversations can't open a ${forum ? "post" : "thread"} until these are given.`
    : `✅ <#${channel.id}>: Aegis can open and answer ${forum ? "posts" : "private threads"}.`;
}
