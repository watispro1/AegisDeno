/** Welcome, goodbye and announcement template variables. No Discord imports, so pure modules can use it. */

/** Template variables the welcome/goodbye/announcement texts understand. */
export const TEMPLATE_VARIABLES: ReadonlyArray<[string, string]> = [
  ["{user}", "Mentions the member (@name)"],
  ["{username}", "The member's username, no ping"],
  ["{server}", "The server's name"],
  ["{memberCount}", "Members in the server now"],
  ["{member_count}", "Same as {memberCount}"],
  ["{count}", "Same as {memberCount}"],
  ["{memberOrdinal}", "The member count as a place, e.g. 1,204th"],
  ["{timeInServer}", "Goodbye only: how long they stayed, e.g. 3 months"],
];

export interface TemplateValues {
  user: string;
  username: string;
  server: string;
  memberCount: number | string;
  /** Goodbye messages: how long the member stayed. Shown as "a while" when unknown. */
  timeInServer?: string | null;
}

/** 1 → "1st", 22 → "22nd", 1204 → "1,204th". Non-numbers come back unchanged. */
export function ordinal(value: number | string): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(n) || n < 0) return String(value);
  const mod100 = n % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n.toLocaleString("en-US")}${suffix}`;
}

/** Replaces the variables in one pass, so a value containing "{server}" is never expanded again. */
export function renderTemplate(text: string, v: TemplateValues): string {
  return text.replace(/\{(user|username|server|memberCount|member_count|count|memberOrdinal|member_ordinal|timeInServer)\}/g, (_m, key: string) => {
    if (key === "user") return v.user;
    if (key === "username") return v.username;
    if (key === "server") return v.server;
    if (key === "memberOrdinal" || key === "member_ordinal") return ordinal(v.memberCount);
    if (key === "timeInServer") return v.timeInServer || "a while";
    return String(v.memberCount);
  });
}

/** How long someone stayed, in the largest whole unit: "3 months", "1 day", "under a minute". null when unknown. */
export function describeStay(joinedAtMs: number | null | undefined, nowMs = Date.now()): string | null {
  if (!joinedAtMs || !Number.isFinite(joinedAtMs) || joinedAtMs > nowMs) return null;
  const minutes = Math.floor((nowMs - joinedAtMs) / 60_000);
  const units: Array<[number, string]> = [[525_600, "year"], [43_200, "month"], [10_080, "week"], [1_440, "day"], [60, "hour"], [1, "minute"]];
  for (const [size, name] of units) {
    const n = Math.floor(minutes / size);
    if (n >= 1) return `${n} ${name}${n === 1 ? "" : "s"}`;
  }
  return "under a minute";
}
