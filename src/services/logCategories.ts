/** Categories that stay off until a server turns them on (busy servers would flood the log). */
const OPT_IN_CATEGORIES: ReadonlySet<string> = new Set(["voiceEvents"]);

/** Whether a category is on, given the saved toggles. Most default to on; opt-in ones default to off. */
export function isLogCategoryOn(cats: Record<string, boolean> | null | undefined, key: string): boolean {
  const saved = cats?.[key];
  return typeof saved === "boolean" ? saved : !OPT_IN_CATEGORIES.has(key);
}
