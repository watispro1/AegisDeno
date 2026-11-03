/** Pure helpers for /note: note IDs, who may delete a note, and the delete autocomplete. */
export const PAGE_SIZE = 4;

/** A note ID is a Mongo ObjectId: 24 hex characters. */
export function isNoteId(value: string): boolean {
  return /^[0-9a-f]{24}$/i.test(value);
}

export function canDeleteNote(authorId: string, actorId: string, actorHasManageGuild: boolean): boolean {
  return authorId === actorId || actorHasManageGuild;
}

/** Autocomplete choices for /note delete: "a1b2c3d4 · <@user> · text…", newest first, max 25. */
export function noteIdSuggestions(rows: Array<{ id: string; userId: string; note: string; createdAt: Date }>, typed: string): Array<{ name: string; value: string }> {
  const q = typed.trim().toLowerCase();
  return rows
    .filter(r => !q || r.id.toLowerCase().includes(q) || r.userId.includes(q) || r.note.toLowerCase().includes(q))
    .slice(0, 25)
    .map(r => {
      const label = `${r.id.slice(-8)} · user ${r.userId} · ${r.createdAt.toISOString().slice(0, 10)} · ${r.note.replace(/\s+/g, " ")}`;
      return { name: label.length > 100 ? `${label.slice(0, 99)}…` : label, value: r.id };
    });
}
