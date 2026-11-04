/**
 * Ranking and formatting for /starboard top and the dashboard's "Top posts"
 * list. Pure: the Mongo queries live in starboardTopQuery.ts.
 */

export const STARBOARD_TOP_PERIODS = ["week", "month", "all"] as const;
export type StarboardTopPeriod = (typeof STARBOARD_TOP_PERIODS)[number];

export const STARBOARD_TOP_LIMIT = 10;
export const STARBOARD_TOP_AUTHORS = 3;
/** Longest excerpt kept on an entry; display clips it further. */
export const STARBOARD_EXCERPT_STORE_MAX = 200;
export const STARBOARD_EXCERPT_SHOW_MAX = 90;

const DAY_MS = 86_400_000;
const PERIOD_DAYS: Record<Exclude<StarboardTopPeriod, "all">, number> = { week: 7, month: 30 };

export const PERIOD_LABELS: Record<StarboardTopPeriod, string> = {
  week: "past 7 days",
  month: "past 30 days",
  all: "all time",
};

/** One starboard entry as the top list needs it. */
export interface StarboardTopEntry {
  sourceChannelId: string;
  sourceMessageId: string;
  authorId: string;
  starboardMessageId: string;
  starboardChannelId?: string | null;
  starCount: number;
  excerpt?: string | null;
  createdAt: Date;
}

export interface StarboardTopAuthor {
  authorId: string;
  stars: number;
  posts: number;
}

export function isStarboardTopPeriod(value: unknown): value is StarboardTopPeriod {
  return typeof value === "string" && (STARBOARD_TOP_PERIODS as readonly string[]).includes(value);
}

/**
 * The earliest starboard date a period includes, or null for all time.
 * Periods count from when a post reached the starboard.
 */
export function periodStart(period: StarboardTopPeriod, now: Date = new Date()): Date | null {
  if (period === "all") return null;
  return new Date(now.getTime() - PERIOD_DAYS[period] * DAY_MS);
}

/** Whether an entry falls inside a period (the same rule the Mongo query uses). */
export function inPeriod(entry: Pick<StarboardTopEntry, "createdAt">, period: StarboardTopPeriod, now: Date = new Date()): boolean {
  const start = periodStart(period, now);
  return start === null || new Date(entry.createdAt).getTime() >= start.getTime();
}

/**
 * Most stars first; ties go to the post that reached the starboard first,
 * then to the lower message ID so the order never flips between calls.
 * Matches the Mongo sort { starCount: -1, createdAt: 1 }.
 */
export function compareTopEntries(a: StarboardTopEntry, b: StarboardTopEntry): number {
  if (b.starCount !== a.starCount) return b.starCount - a.starCount;
  const at = new Date(a.createdAt).getTime();
  const bt = new Date(b.createdAt).getTime();
  if (at !== bt) return at - bt;
  return a.sourceMessageId < b.sourceMessageId ? -1 : a.sourceMessageId > b.sourceMessageId ? 1 : 0;
}

/** Filter by period and author, rank, and keep the top `limit`. */
export function rankTopEntries<T extends StarboardTopEntry>(
  entries: readonly T[],
  opts: { period?: StarboardTopPeriod; authorId?: string | null; limit?: number; now?: Date } = {},
): T[] {
  const period = opts.period ?? "all";
  const limit = Math.max(1, Math.min(opts.limit ?? STARBOARD_TOP_LIMIT, 25));
  return entries
    .filter(e => inPeriod(e, period, opts.now) && (!opts.authorId || e.authorId === opts.authorId))
    .sort(compareTopEntries)
    .slice(0, limit);
}

/** Total stars per author, most first (ties: more posts, then lower ID). */
export function rankTopAuthors(entries: readonly StarboardTopEntry[], limit = STARBOARD_TOP_AUTHORS): StarboardTopAuthor[] {
  const totals = new Map<string, StarboardTopAuthor>();
  for (const e of entries) {
    const t = totals.get(e.authorId) ?? { authorId: e.authorId, stars: 0, posts: 0 };
    t.stars += Math.max(0, e.starCount);
    t.posts += 1;
    totals.set(e.authorId, t);
  }
  return [...totals.values()].sort(compareAuthors).slice(0, limit);
}

export function compareAuthors(a: StarboardTopAuthor, b: StarboardTopAuthor): number {
  if (b.stars !== a.stars) return b.stars - a.stars;
  if (b.posts !== a.posts) return b.posts - a.posts;
  return a.authorId < b.authorId ? -1 : a.authorId > b.authorId ? 1 : 0;
}

/** Plain one-line text for storing on an entry: whitespace collapsed, clipped. */
export function storedExcerpt(text: string | null | undefined, max = STARBOARD_EXCERPT_STORE_MAX): string {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  return clipText(flat, max);
}

export function clipText(text: string, max: number): string {
  const chars = [...text];
  return chars.length > max ? `${chars.slice(0, max - 1).join("").trimEnd()}…` : text;
}

/** Escape Discord markdown so an excerpt cannot add links, mentions styling or formatting. */
export function escapeDiscordText(text: string): string {
  return text.replace(/([\\`*_~|>[\]#<-])/g, "\\$1").replace(/@/g, "@\u200b");
}

export function messageUrl(guildId: string, channelId: string, messageId: string): string {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

/** The starboard post's link: the channel saved on the entry, else the current starboard channel. */
export function starboardPostUrl(guildId: string, entry: StarboardTopEntry, currentChannelId: string | null): string | null {
  const channelId = entry.starboardChannelId || currentChannelId;
  return channelId ? messageUrl(guildId, channelId, entry.starboardMessageId) : null;
}

/** One ranked line for the /starboard top embed. */
export function formatTopLine(
  entry: StarboardTopEntry,
  rank: number,
  o: { guildId: string; emoji: string; starboardChannelId: string | null },
): string {
  const links = [`[Original](${messageUrl(o.guildId, entry.sourceChannelId, entry.sourceMessageId)})`];
  const post = starboardPostUrl(o.guildId, entry, o.starboardChannelId);
  if (post) links.push(`[Starboard](${post})`);
  const head = `**${rank}.** ${o.emoji} **${entry.starCount}** · <@${entry.authorId}> · <#${entry.sourceChannelId}> · ${links.join(" · ")}`;
  const excerpt = storedExcerpt(entry.excerpt, STARBOARD_EXCERPT_SHOW_MAX);
  return excerpt ? `${head}\n> ${escapeDiscordText(excerpt)}` : `${head}\n> *no text*`;
}

/** "Top authors: @a (42 ⭐), @b (30 ⭐)", or null when there are none. */
export function formatTopAuthors(authors: readonly StarboardTopAuthor[], emoji: string): string | null {
  if (!authors.length) return null;
  return `**Top authors:** ${authors.map(a => `<@${a.authorId}> (${a.stars} ${emoji} · ${a.posts} post${a.posts === 1 ? "" : "s"})`).join(", ")}`;
}

/** The embed description: ranked lines plus the authors line, kept under Discord's 4096 limit. */
export function formatTopDescription(lines: readonly string[], authorsLine: string | null, max = 4096): string {
  const footer = authorsLine ? `\n\n${authorsLine}` : "";
  const out: string[] = [];
  let used = footer.length;
  for (const line of lines) {
    const add = (out.length ? 2 : 0) + line.length;
    if (used + add > max) break;
    out.push(line);
    used += add;
  }
  return `${out.join("\n\n")}${footer}`;
}

/** Title for the embed, e.g. "Top starred posts (past 7 days)". */
export function topTitle(period: StarboardTopPeriod, filtered: boolean): string {
  return `${filtered ? "Top starred posts by this member" : "Top starred posts"} (${PERIOD_LABELS[period]})`;
}
