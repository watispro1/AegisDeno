/**
 * Pure helpers for slash-command autocomplete. Discord accepts at most 25
 * choices, each name and string value at most 100 characters.
 */

export const MAX_AUTOCOMPLETE_CHOICES = 25;
export const MAX_CHOICE_LENGTH = 100;

export interface AutocompleteItem {
  /** What the member sees in the list. */
  name: string;
  /** What the option receives. Must stay intact, so long values are skipped rather than cut. */
  value: string;
  /** Extra text that should match the query but is not shown. */
  keywords?: string;
}

/** Shorten to Discord's 100-character choice limit with an ellipsis. */
export function clipChoice(text: string, max = MAX_CHOICE_LENGTH): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Filter and order choices for what the member has typed so far: matches at
 * the start of the value or name first, then anywhere, keeping the input order
 * (e.g. newest first) within each group.
 */
export function rankChoices(items: AutocompleteItem[], query: string, limit = MAX_AUTOCOMPLETE_CHOICES): { name: string; value: string }[] {
  const q = query.trim().toLowerCase();
  const starts: AutocompleteItem[] = [];
  const contains: AutocompleteItem[] = [];

  for (const item of items) {
    if (!item.value || item.value.length > MAX_CHOICE_LENGTH) continue;
    if (!q) {
      starts.push(item);
      continue;
    }
    const value = item.value.toLowerCase();
    const name = item.name.toLowerCase();
    if (value.startsWith(q) || name.startsWith(q)) starts.push(item);
    else if (value.includes(q) || name.includes(q) || (item.keywords ?? "").toLowerCase().includes(q)) contains.push(item);
  }

  return [...starts, ...contains]
    .slice(0, Math.max(0, Math.min(limit, MAX_AUTOCOMPLETE_CHOICES)))
    .map((item) => ({ name: clipChoice(item.name || item.value), value: item.value }));
}

/** Short relative age for choice labels, e.g. "3d ago". Discord timestamps don't render in choices. */
export function shortAge(date: Date | string | number, now = Date.now()): string {
  const ms = Math.max(0, now - new Date(date).getTime());
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 60) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}
