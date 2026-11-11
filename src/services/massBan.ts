/**
 * /massban planning: which pasted IDs get banned and which are skipped, and
 * why. Pure, so the safety rules are unit-tested without Discord.
 *
 * Safety rules:
 * - at most MASS_BAN_MAX IDs per run (the rest are reported, never banned);
 * - never the moderator, Aegis itself or the server owner;
 * - a member in the server is banned only when both the moderator and Aegis
 *   outrank them (the same hierarchy rule as /ban);
 * - users who are not in the server can be banned by ID (raid accounts that
 *   already left), unless they are banned already.
 */
import { outranks } from "../permissions/hierarchy";

export const MASS_BAN_MAX = 50;
/** Discord user IDs are snowflakes of 17 to 20 digits. */
const ID_PATTERN = /\d{17,20}/g;

export interface ParsedIds {
  ids: string[];
  /** Unique IDs beyond the cap, left out of this run. */
  overCap: number;
  /** Repeated IDs that were dropped. */
  duplicates: number;
}

/** Unique IDs from pasted text (mentions, commas, spaces or new lines all work). */
export function parseUserIds(raw: string, max = MASS_BAN_MAX): ParsedIds {
  const found = String(raw ?? "").match(ID_PATTERN) ?? [];
  const unique = [...new Set(found)];
  return { ids: unique.slice(0, max), overCap: Math.max(0, unique.length - max), duplicates: found.length - unique.length };
}

export type SkipReason = "self" | "bot" | "owner" | "you_cannot" | "i_cannot" | "already_banned";

export const SKIP_LABELS: Record<SkipReason, string> = {
  self: "you",
  bot: "Aegis itself",
  owner: "the server owner",
  you_cannot: "role equal to or above yours",
  i_cannot: "role equal to or above mine",
  already_banned: "already banned",
};

export interface MassBanContext {
  actorId: string;
  botId: string;
  ownerId: string;
  /** Top role position of the moderator and of Aegis. */
  actorTop: number;
  botTop: number;
  /** Top role position of each ID that is a member of the server. */
  memberTops: ReadonlyMap<string, number>;
  /** IDs known to be banned already. */
  alreadyBanned: ReadonlySet<string>;
}

export interface MassBanPlan {
  ban: string[];
  skipped: Array<{ id: string; reason: SkipReason }>;
}

export function planMassBan(ids: readonly string[], ctx: MassBanContext): MassBanPlan {
  const plan: MassBanPlan = { ban: [], skipped: [] };
  for (const id of ids) {
    const skip = (reason: SkipReason) => plan.skipped.push({ id, reason });
    if (id === ctx.actorId) { skip("self"); continue; }
    if (id === ctx.botId) { skip("bot"); continue; }
    if (id === ctx.ownerId) { skip("owner"); continue; }
    const top = ctx.memberTops.get(id);
    if (top === undefined) {
      if (ctx.alreadyBanned.has(id)) skip("already_banned");
      else plan.ban.push(id);
      continue;
    }
    if (!outranks({ ownerId: ctx.ownerId, actorId: ctx.actorId, targetId: id, actorTopPosition: ctx.actorTop, targetTopPosition: top })) {
      skip("you_cannot");
      continue;
    }
    if (!outranks({ ownerId: ctx.ownerId, actorId: ctx.botId, targetId: id, actorTopPosition: ctx.botTop, targetTopPosition: top })) {
      skip("i_cannot");
      continue;
    }
    plan.ban.push(id);
  }
  return plan;
}

/** "3 skipped: 2 role equal to or above mine, 1 already banned" grouped by reason. */
export function summarizeSkips(skipped: MassBanPlan["skipped"]): string {
  if (!skipped.length) return "";
  const counts = new Map<SkipReason, number>();
  for (const s of skipped) counts.set(s.reason, (counts.get(s.reason) ?? 0) + 1);
  const parts = [...counts].map(([reason, n]) => `${n} ${SKIP_LABELS[reason]}`);
  return `${skipped.length} skipped: ${parts.join(", ")}`;
}

/** A compact, mention-free list of IDs for an embed, cut to fit `max` characters. */
export function idList(ids: readonly string[], max = 1000): string {
  const out: string[] = [];
  let used = 0;
  for (let i = 0; i < ids.length; i++) {
    const piece = `\`${ids[i]}\``;
    const rest = ids.length - i;
    if (used + piece.length + 1 > max - 20) {
      out.push(`… and ${rest} more`);
      break;
    }
    out.push(piece);
    used += piece.length + 1;
  }
  return out.join(" ") || "None";
}
