/**
 * Entry points for people who have never used Aegis: a bare @mention, a few
 * typed "help" words, a first DM, and a one-time welcome when Aegis joins a
 * server. Pure rules only; the Discord side lives in entryPoint.ts.
 *
 * This is deliberately not a prefix-command system. Only the exact phrases
 * below are recognised, and they all answer with the same help card.
 */
import { PermissionFlagsBits } from "discord.js";

/** One help card per channel per 10 seconds, so a burst of pings gets one answer. */
export const ENTRY_HELP_COOLDOWN_MS = 10_000;
/** A server that removes and re-adds Aegis within this window is not welcomed again. */
export const WELCOME_REPEAT_DAYS = 30;
/** How long a DM sender counts as "seen" for the first-DM help card. */
export const DM_FIRST_SEEN_MS = 24 * 60 * 60 * 1000;

/** Never ping anyone, and never ping the author through the reply either. */
export const ENTRY_MENTIONS = { parse: [] as [], users: [] as [], roles: [] as [], repliedUser: false };

const TEXT_TRIGGERS = new Set(["a!help", "!help", "aegis help"]);
const DM_HELP_WORDS = new Set(["help", "/help", "!help", "a!help", "aegis help"]);
const DM_GREETINGS = new Set(["hi", "hello", "hey"]);

/** Lower-case, trimmed, inner whitespace collapsed ("  Aegis   HELP " → "aegis help"). */
export function normalizeTrigger(content: string | null | undefined): string {
  return (content ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function stripTrailingPunctuation(text: string): string {
  return text.replace(/[!?.]+$/, "");
}

/**
 * True when the whole message is a mention of the bot, optionally followed by
 * "help": `<@id>`, `<@!id>`, or the bot's managed role (`<@&roleId>`, which is
 * what Discord inserts when someone picks the "Aegis" role from the @ menu).
 */
export function isMentionHelp(content: string | null | undefined, botId: string, botRoleId?: string | null): boolean {
  const text = normalizeTrigger(content);
  if (!text || !/^\d{15,22}$/.test(botId)) return false;
  const ids = [`<@${botId}>`, `<@!${botId}>`];
  if (botRoleId && /^\d{15,22}$/.test(botRoleId)) ids.push(`<@&${botRoleId}>`);
  for (const id of ids) {
    if (!text.startsWith(id)) continue;
    const rest = stripTrailingPunctuation(text.slice(id.length).trim());
    return rest === "" || rest === "help";
  }
  return false;
}

/** `a!help`, `!help` or `aegis help` as the whole message (any case). */
export function isTextHelpTrigger(content: string | null | undefined): boolean {
  return TEXT_TRIGGERS.has(normalizeTrigger(content));
}

/** Anything in a server that should get the help card. */
export function isGuildHelpTrigger(content: string | null | undefined, botId: string, botRoleId?: string | null): boolean {
  return isMentionHelp(content, botId, botRoleId) || isTextHelpTrigger(content);
}

export type DmEntryKind = "help" | "greeting" | null;

/** Whether a DM is a request for help, a bare greeting, or neither. */
export function dmEntryKind(content: string | null | undefined): DmEntryKind {
  const text = normalizeTrigger(content);
  if (DM_HELP_WORDS.has(text)) return "help";
  if (DM_GREETINGS.has(stripTrailingPunctuation(text))) return "greeting";
  return null;
}

/**
 * Whether a DM gets the help card instead of going to ModMail. Explicit help
 * words always do. A bare "hi" does only when the member has no open ModMail
 * conversation: mid-conversation, "hi" is meant for the staff and is relayed.
 * A DM with attachments is never treated as a help request.
 */
export function shouldDmHelp(o: { content: string | null | undefined; hasAttachments: boolean; hasOpenTicket: boolean }): boolean {
  if (o.hasAttachments) return false;
  const kind = dmEntryKind(o.content);
  if (kind === "help") return true;
  return kind === "greeting" && !o.hasOpenTicket;
}

/** Can Aegis post the help card in this channel? Missing any of these → stay silent. */
export function canPostHelp(permissions: bigint | null | undefined, isThread: boolean): boolean {
  if (permissions == null) return false;
  const send = isThread ? PermissionFlagsBits.SendMessagesInThreads : PermissionFlagsBits.SendMessages;
  const needed = PermissionFlagsBits.ViewChannel | PermissionFlagsBits.EmbedLinks | send;
  return (permissions & needed) === needed;
}

/** A reply (message reference) also needs Read Message History; without it, post a plain message. */
export function canReplyTo(permissions: bigint | null | undefined): boolean {
  if (permissions == null) return false;
  return (permissions & PermissionFlagsBits.ReadMessageHistory) === PermissionFlagsBits.ReadMessageHistory;
}

/** Per-key cooldown: `take` returns true and starts the cooldown, or false while it is running. */
export class KeyedCooldown {
  private readonly until = new Map<string, number>();
  constructor(private readonly ms: number, private readonly maxKeys = 10_000) {}

  take(key: string, now = Date.now()): boolean {
    const expires = this.until.get(key);
    if (expires !== undefined && now < expires) return false;
    this.until.delete(key);
    this.until.set(key, now + this.ms);
    if (this.until.size > this.maxKeys) {
      // Keys are re-inserted on every take, so the first key is the oldest.
      const oldest = this.until.keys().next().value;
      if (oldest !== undefined) this.until.delete(oldest);
    }
    return true;
  }

  clear(): void {
    this.until.clear();
  }
}

export interface WelcomeChannelCandidate {
  id: string;
  /** Aegis can view the channel, send messages and embed links there. */
  canSend: boolean;
  /** Sort position in the channel list (lower is higher up). */
  position: number;
}

/**
 * Where the one-time welcome goes: the server's system channel when Aegis can
 * post there, otherwise the highest text channel it can post in, else nowhere.
 */
export function pickWelcomeChannel(system: WelcomeChannelCandidate | null, others: readonly WelcomeChannelCandidate[]): string | null {
  if (system?.canSend) return system.id;
  const usable = others.filter(c => c.canSend).sort((a, b) => a.position - b.position);
  return usable[0]?.id ?? null;
}

/** `JOIN_WELCOME=off` (or false/0/no) turns the join welcome off for self-hosters. */
export function joinWelcomeEnabled(value: string | undefined = process.env.JOIN_WELCOME): boolean {
  return !/^(off|false|0|no|disabled?)$/i.test((value ?? "").trim());
}
