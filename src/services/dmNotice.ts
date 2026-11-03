/** What a moderation result says about the notice DM to the member. */
export type DmOutcome = "sent" | "silent" | "failed";

export function dmOutcome(silent: boolean, delivered: boolean): DmOutcome {
  if (silent) return "silent";
  return delivered ? "sent" : "failed";
}

/** Field value for the "DM Sent" line on result embeds. */
export function dmSentLabel(outcome: DmOutcome): string {
  if (outcome === "sent") return "✅ Yes";
  if (outcome === "silent") return "❌ No (silent)";
  return "⚠️ No (DMs closed or blocked)";
}

/** Plain text for mod-log descriptions. */
export function dmSentText(outcome: DmOutcome): string {
  if (outcome === "sent") return "Yes";
  if (outcome === "silent") return "No (silent)";
  return "No (DMs closed or blocked)";
}
