/**
 * Pure text for the richer /serverinfo: boost progress, readable server
 * features, member breakdown, and the lines of the roles/emojis/stickers lists.
 */

/** Boosts Discord needs for each premium tier (tier 1, 2, 3). */
export const BOOST_TIERS = [2, 7, 14] as const;

/** Upload limit, emoji slots and audio quality per tier, as Discord documents them. */
export const TIER_PERKS: Record<number, { emojis: number; stickers: number; upload: string; bitrate: string }> = {
  0: { emojis: 50, stickers: 5, upload: "10 MB", bitrate: "96 kbps" },
  1: { emojis: 100, stickers: 15, upload: "10 MB", bitrate: "128 kbps" },
  2: { emojis: 150, stickers: 30, upload: "50 MB", bitrate: "256 kbps" },
  3: { emojis: 250, stickers: 60, upload: "100 MB", bitrate: "384 kbps" },
};

/** A 10-block progress bar, e.g. "▰▰▰▱▱▱▱▱▱▱". */
export function progressBar(done: number, total: number, width = 10): string {
  const ratio = total > 0 ? Math.min(1, Math.max(0, done / total)) : 1;
  const filled = Math.round(ratio * width);
  return "▰".repeat(filled) + "▱".repeat(width - filled);
}

/** "Level 1 · 4 boosts\n▰▰▱… 4/7 to Level 2" or "Level 3 · max level". */
export function boostProgress(tier: number, boosts: number): string {
  const count = Math.max(0, boosts);
  const head = `Level **${tier}** · **${count}** boost${count === 1 ? "" : "s"}`;
  if (tier >= 3) return `${head}\n${progressBar(1, 1)} max level`;
  const need = BOOST_TIERS[Math.max(0, tier)];
  return `${head}\n${progressBar(count, need)} ${Math.min(count, need)}/${need} to Level ${tier + 1}`;
}

const FEATURE_LABELS: Record<string, string> = {
  COMMUNITY: "Community",
  PARTNERED: "Partnered",
  VERIFIED: "Verified",
  DISCOVERABLE: "Discoverable",
  VANITY_URL: "Vanity URL",
  INVITE_SPLASH: "Invite splash",
  BANNER: "Banner",
  ANIMATED_BANNER: "Animated banner",
  ANIMATED_ICON: "Animated icon",
  NEWS: "Announcement channels",
  WELCOME_SCREEN_ENABLED: "Welcome screen",
  MEMBER_VERIFICATION_GATE_ENABLED: "Membership screening",
  PREVIEW_ENABLED: "Preview",
  ROLE_ICONS: "Role icons",
  AUTO_MODERATION: "AutoMod",
  ROLE_SUBSCRIPTIONS_ENABLED: "Server subscriptions",
  TICKETED_EVENTS_ENABLED: "Ticketed events",
  MONETIZATION_ENABLED: "Monetization",
  CREATOR_MONETIZABLE_PROVISIONAL: "Creator monetization",
  GUILD_ONBOARDING: "Onboarding",
  RAID_ALERTS_DISABLED: "Raid alerts off",
  INVITES_DISABLED: "Invites paused",
  SOUNDBOARD: "Soundboard",
};

/** Readable feature names, sorted, unknown ones title-cased. */
export function featureNames(features: readonly string[]): string[] {
  return [...new Set(features)]
    .map(f => FEATURE_LABELS[f] ?? f.toLowerCase().split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "))
    .sort((a, b) => a.localeCompare(b));
}

/** "**1,234** members · 1,200 humans · 34 bots" (breakdown only when every member is loaded). */
export function memberBreakdown(total: number, cached: { humans: number; bots: number } | null): string {
  const head = `**${total.toLocaleString("en-US")}** members`;
  if (!cached || cached.humans + cached.bots < total) return head;
  return `${head}\n${cached.humans.toLocaleString("en-US")} humans · ${cached.bots.toLocaleString("en-US")} bots`;
}

/** One role line for the paged roles list. */
export function roleListLine(role: { id: string; name: string; members: number; managed: boolean }, index: number): string {
  return `\`${String(index + 1).padStart(3, " ")}\` <@&${role.id}> · ${role.members.toLocaleString("en-US")} member${role.members === 1 ? "" : "s"}${role.managed ? " · managed" : ""}`;
}

/** One emoji line: the emoji itself, its :name: and whether it is animated or unavailable. */
export function emojiListLine(emoji: { id: string; name: string | null; animated: boolean | null; available?: boolean | null }): string {
  const name = emoji.name ?? "emoji";
  const render = `<${emoji.animated ? "a" : ""}:${name}:${emoji.id}>`;
  return `${render} \`:${name}:\`${emoji.animated ? " · animated" : ""}${emoji.available === false ? " · unavailable (boost lost)" : ""}`;
}

/** "Emojis 34/100 (12 animated) · Stickers 3/15". */
export function assetSlots(tier: number, emojis: { total: number; animated: number }, stickers: number): string {
  const perks = TIER_PERKS[Math.min(3, Math.max(0, tier))];
  return `Emojis **${emojis.total}**/${perks.emojis * 2} (${emojis.animated} animated) · Stickers **${stickers}**/${perks.stickers}`;
}
