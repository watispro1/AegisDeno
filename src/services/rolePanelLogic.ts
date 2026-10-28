/**
 * Pure role-panel rules shared by the button and dropdown handlers.
 * Kept free of Discord/Mongo imports so they can be unit-tested directly.
 */

export type RolePanelStyle = "button" | "dropdown";
export type RolePanelMode = "multi" | "exclusive";

/** Custom-id prefix for dropdown panels. Must not start with `rolepanel_` (the button prefix). */
export const ROLE_PANEL_SELECT_PREFIX = "rolepanelsel_";

export function normalizePanelStyle(value: unknown): RolePanelStyle {
  return value === "dropdown" ? "dropdown" : "button";
}

export function normalizePanelMode(value: unknown): RolePanelMode {
  return value === "exclusive" ? "exclusive" : "multi";
}

export function rolePanelSelectCustomId(panelId: string): string {
  return `${ROLE_PANEL_SELECT_PREFIX}${panelId}`;
}

export function parseRolePanelSelectCustomId(customId: string): string | null {
  if (!customId.startsWith(ROLE_PANEL_SELECT_PREFIX)) return null;
  const id = customId.slice(ROLE_PANEL_SELECT_PREFIX.length);
  return id.length > 0 ? id : null;
}

export interface RoleChangePlan {
  add: string[];
  remove: string[];
}

/**
 * Work out which roles to add and remove when a member picks `picked` roles on a panel.
 *
 * - multi: each picked panel role is toggled (held → removed, not held → added).
 * - exclusive: only the first picked role counts. Picking a role you already hold removes it;
 *   picking a new one adds it and removes every other panel role you hold.
 *
 * Roles that are not part of the panel are ignored.
 */
export function planRoleChanges(
  heldRoleIds: Iterable<string>,
  panelRoleIds: readonly string[],
  picked: readonly string[],
  mode: RolePanelMode,
): RoleChangePlan {
  const held = new Set(heldRoleIds);
  const panel = new Set(panelRoleIds);
  const valid = [...new Set(picked.filter(id => panel.has(id)))];

  if (valid.length === 0) return { add: [], remove: [] };

  if (mode === "exclusive") {
    const choice = valid[0];
    if (held.has(choice)) return { add: [], remove: [choice] };
    const remove = panelRoleIds.filter(id => id !== choice && held.has(id));
    return { add: [choice], remove };
  }

  const add: string[] = [];
  const remove: string[] = [];
  for (const id of valid) {
    if (held.has(id)) remove.push(id);
    else add.push(id);
  }
  return { add, remove };
}

/** A panel with no required role is open to everyone; otherwise the member must hold it. */
export function meetsPanelRequirement(heldRoleIds: Iterable<string>, requiredRoleId: string | null | undefined): boolean {
  if (!requiredRoleId) return true;
  for (const id of heldRoleIds) if (id === requiredRoleId) return true;
  return false;
}
