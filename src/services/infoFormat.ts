/** Pure text helpers for /serverinfo and /userinfo (tested without Discord). */

export const VERIFICATION_LEVELS: Record<number, string> = {
  0: "None (Unrestricted)",
  1: "Low (Verified Email)",
  2: "Medium (Registered > 5m)",
  3: "High (Member > 10m)",
  4: "Highest (Verified Phone)",
};

export const EXPLICIT_FILTER_LEVELS: Record<number, string> = {
  0: "Disabled",
  1: "Members Without Roles",
  2: "All Members",
};

const NOTIFICATION_LEVELS: Record<number, string> = { 0: "All messages", 1: "Only @mentions" };
const MFA_LEVELS: Record<number, string> = { 0: "Not required for moderators", 1: "Required for moderators (2FA)" };

/** The Security button's text, with labels instead of Discord's raw numbers. */
export function serverSecurityText(g: { name: string; verificationLevel: number; explicitContentFilter: number; defaultMessageNotifications: number; mfaLevel: number }): string {
  return [
    `🔒 **Security & Safety Overview for ${g.name}:**`,
    `- Verification level: **${VERIFICATION_LEVELS[g.verificationLevel] ?? `Level ${g.verificationLevel}`}**`,
    `- Explicit content filter: **${EXPLICIT_FILTER_LEVELS[g.explicitContentFilter] ?? `Level ${g.explicitContentFilter}`}**`,
    `- Default notifications: **${NOTIFICATION_LEVELS[g.defaultMessageNotifications] ?? `Level ${g.defaultMessageNotifications}`}**`,
    `- Moderation 2FA: **${MFA_LEVELS[g.mfaLevel] ?? `Level ${g.mfaLevel}`}**`,
  ].join("\n");
}

/**
 * Join names into one line that fits `max` characters, ending with
 * "+N more" when some had to be left out. Names are stripped of characters
 * that would break markdown or look like mentions.
 */
export function fitNames(names: readonly string[], max: number): string {
  const clean = names.map(n => n.replace(/[*_`~|>\\]/g, "").replace(/@/g, "@\u200b").trim() || "(unnamed)");
  const out: string[] = [];
  let used = 0;
  for (let i = 0; i < clean.length; i++) {
    const rest = clean.length - i;
    const suffix = rest > 1 ? ` +${rest - 1} more` : "";
    const add = (out.length ? 2 : 0) + clean[i].length;
    if (used + add + suffix.length > max) {
      return out.length ? `${out.join(", ")} +${rest} more` : `+${rest} more`;
    }
    out.push(clean[i]);
    used += add;
  }
  return out.join(", ") || "None";
}

/** "⏳ Timed out, ends <t:…:R>" while a timeout is running, else null. */
export function timeoutLine(until: number | null | undefined, now = Date.now()): string | null {
  if (!until || until <= now) return null;
  return `Timed out, ends <t:${Math.ceil(until / 1000)}:R>`;
}

/** Discord date plus relative time, e.g. "<t:…:D> (<t:…:R>)". */
export function dateAndAgo(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `<t:${s}:D> (<t:${s}:R>)`;
}
