/** Panel forms: the ticket panel, the verification panel and role panel re-posts. */
import { MAX_KICK_UNVERIFIED_MINUTES } from "../../services/verificationLogic";
import { Errors, channel, field, finish, integer, optionalText, role, type FormBody, type Parsed, type ValidationContext } from "./formFields";

export const PANEL_TITLE_MAX = 100;
export const TICKET_PANEL_DESCRIPTION_MAX = 2000;
export const VERIFY_PANEL_DESCRIPTION_MAX = 2000;

export interface TicketPanelInput {
  channelId: string;
  staffRoleId: string | null;
  title: string | null;
  description: string | null;
}

export function parseTicketPanel(body: FormBody, ctx: ValidationContext): Parsed<TicketPanelInput> {
  const errors = new Errors();
  const channelId = channel(body, "channelId", ctx, errors, true, "channel") ?? "";
  const staffRoleId = role(body, "staffRoleId", ctx, errors, false, "staff role", { anyRole: true });
  const title = optionalText(body, "title", PANEL_TITLE_MAX, "title", errors);
  const description = optionalText(body, "description", TICKET_PANEL_DESCRIPTION_MAX, "description", errors);
  return finish(errors, { channelId, staffRoleId, title, description });
}

export interface VerificationPanelInput {
  channelId: string;
  verifiedRoleId: string;
  type: "button" | "captcha";
  kickUnverifiedMinutes: number;
  title: string | null;
  description: string | null;
}

export function parseVerificationPanel(body: FormBody, ctx: ValidationContext): Parsed<VerificationPanelInput> {
  const errors = new Errors();
  const channelId = channel(body, "channelId", ctx, errors, true, "channel") ?? "";
  const verifiedRoleId = role(body, "verifiedRoleId", ctx, errors, true, "verified role") ?? "";
  const typeRaw = field(body, "type");
  if (typeRaw !== "button" && typeRaw !== "captcha") errors.add("type", "Pick button or captcha.");
  const kickUnverifiedMinutes = integer(body, "kickUnverifiedMinutes", 0, MAX_KICK_UNVERIFIED_MINUTES, "Auto-kick delay", errors, { blank: 0 });
  const title = optionalText(body, "title", PANEL_TITLE_MAX, "title", errors);
  const description = optionalText(body, "description", VERIFY_PANEL_DESCRIPTION_MAX, "description", errors);
  return finish(errors, { channelId, verifiedRoleId, type: typeRaw === "captcha" ? "captcha" : "button", kickUnverifiedMinutes, title, description });
}

export function parseRolePanelRepost(body: FormBody, ctx: ValidationContext): Parsed<{ channelId: string }> {
  const errors = new Errors();
  const channelId = channel(body, "channelId", ctx, errors, true, "channel") ?? "";
  return finish(errors, { channelId });
}

/**
 * The first of a role panel's roles the viewer may not hand out (at or above
 * their highest role), or null. Re-posting
 * puts the panel's roles in front of a new audience, so it follows the same
 * rule as /rolepanel create.
 */
export function rolePanelBlockedRole(roleIds: readonly string[], ctx: ValidationContext): string | null {
  for (const id of roleIds) {
    const found = ctx.roles.get(id);
    if (found?.aboveViewer) return id;
  }
  return null;
}
