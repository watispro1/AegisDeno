/** Checks for /shop edit options that contradict each other. Pure, for tests. */

export interface EditFlags {
  role: boolean; clearRole: boolean;
  stock: boolean; unlimited: boolean;
  perUser: boolean; noUserLimit: boolean;
  roleHours: boolean; permanentRole: boolean;
  /** How many options besides `item` were given. */
  changes: number;
}

/** A reason the edit can't run as given, or null. */
export function editConflict(f: EditFlags): string | null {
  if (f.changes === 0) return "Nothing to change. Pick at least one option besides the item.";
  if (f.role && f.clearRole) return "Pick either a new `role` or `clear_role`, not both.";
  if (f.stock && f.unlimited) return "Pick either a `stock` number or `unlimited`, not both.";
  if (f.perUser && f.noUserLimit) return "Pick either a `per_user_limit` or `no_user_limit`, not both.";
  if (f.roleHours && f.permanentRole) return "Pick either `role_hours` or `permanent_role`, not both.";
  return null;
}
