/**
 * Discord CDN image URLs for avatars and server icons. The CSP allows images
 * from https://cdn.discordapp.com only, and hashes are validated so nothing
 * user-controlled reaches the URL path.
 */
const HASH = /^(a_)?[0-9a-f]{32}$/;
const ID = /^\d{17,20}$/;

export function userAvatarUrl(userId: string, hash: string | null | undefined, size = 64): string | null {
  return hash && HASH.test(hash) && ID.test(userId) ? `https://cdn.discordapp.com/avatars/${userId}/${hash}.png?size=${size}` : null;
}

export function guildIconUrl(guildId: string, hash: string | null | undefined, size = 64): string | null {
  return hash && HASH.test(hash) && ID.test(guildId) ? `https://cdn.discordapp.com/icons/${guildId}/${hash}.png?size=${size}` : null;
}

/** True only for an https URL on Discord's CDN (what the CSP allows). */
export function isDiscordCdnUrl(url: unknown): url is string {
  return typeof url === "string" && /^https:\/\/cdn\.discordapp\.com\/[\w./?=&-]+$/.test(url);
}
