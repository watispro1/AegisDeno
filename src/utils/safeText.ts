/**
 * Small helpers that keep bot output inside Discord's limits and stop user
 * text from breaking formatting. Pure; unit-tested.
 */

/** Discord limits used across commands. */
export const DISCORD_LIMITS = {
  content: 2000,
  embedTitle: 256,
  embedDescription: 4096,
  embedFieldName: 256,
  embedFieldValue: 1024,
  embedFooter: 2048,
  /** X-Audit-Log-Reason: 1–512 characters after URL encoding. */
  auditReason: 512,
} as const;

/** Cut `text` to at most `max` characters, ending with an ellipsis when it was cut. */
export function truncate(text: string, max: number): string {
  const s = String(text ?? "");
  if (s.length <= max) return s;
  if (max <= 1) return s.slice(0, Math.max(0, max));
  return `${s.slice(0, max - 1)}…`;
}

/**
 * An audit-log reason Discord will accept: at most 512 characters once
 * URL-encoded (non-ASCII characters count several times), never empty.
 */
export function auditReason(reason: string): string {
  let s = String(reason ?? "").replace(/[\r\n]+/g, " ").trim() || "No reason provided";
  if (encodeURIComponent(s).length <= DISCORD_LIMITS.auditReason) return s;
  // Trim code points until the encoded form fits, leaving room for the ellipsis (3 encoded bytes → 9 chars).
  const chars = Array.from(s);
  while (chars.length > 0 && encodeURIComponent(chars.join("") + "…").length > DISCORD_LIMITS.auditReason) {
    chars.pop();
  }
  s = chars.join("") + "…";
  return s;
}

/** Text safe to put inside a ``` code block: a run of three backticks would end it early. */
export function codeBlockSafe(text: string): string {
  return String(text ?? "").replace(/`{3,}/g, (m) => m.split("").join("\u200b"));
}

/** A fenced code block holding `text`, cut so the whole block fits in `max` characters. */
export function codeBlock(text: string, max: number = DISCORD_LIMITS.embedFieldValue): string {
  const body = truncate(codeBlockSafe(text), Math.max(1, max - 8));
  return `\`\`\`\n${body}\n\`\`\``;
}
