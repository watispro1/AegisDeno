/** Form parsing for the dashboard's Economy page. Same rules as the slash commands (economyLogic.ts). */
import {
  MAX_BALANCE, applyEconomySettings, parseAmount, validateShopItem,
  type EconomyConfig, type ShopItemInput,
} from "../../services/economyLogic";
import type { AdjustAction } from "../../services/economyService";
import { ROLE_ABOVE_VIEWER_ERROR, checkbox, field, type FormBody, type Parsed, type ValidationContext } from "./validation";

const SNOWFLAKE = /^\d{17,20}$/;
export const ECONOMY_REASON_MAX = 200;

const SETTING_KEYS = ["currencyName", "currencyEmoji", "dailyAmount", "dailyStreakBonus", "dailyCooldownHours", "workMin", "workMax", "workCooldownMinutes", "payConfirmThreshold"] as const;

export function parseEconomySettings(body: FormBody, saved: EconomyConfig): Parsed<EconomyConfig> {
  const input: Record<string, string | boolean> = { enabled: checkbox(body, "enabled") };
  for (const key of SETTING_KEYS) input[key] = field(body, key);
  // Blank number fields are an error here (the form always shows the saved value).
  const errors: Record<string, string> = {};
  for (const key of SETTING_KEYS) if (input[key] === "") errors[key] = "This can't be blank.";
  const r = applyEconomySettings(saved, input);
  if (!r.ok) Object.assign(errors, r.errors);
  if (Object.keys(errors).length || !r.ok) return { ok: false, errors: errors as Record<string, string> };
  return { ok: true, value: r.value };
}

/**
 * A shop item from the form. A role must be one Aegis can assign and below
 * the viewer's highest role (owner exempt), never @everyone: the same rule as
 * /shop add, and as the role picker shows.
 */
export function parseShopItemForm(body: FormBody, ctx: ValidationContext, guildId: string): Parsed<ShopItemInput> {
  const errors: Record<string, string> = {};
  const roleRaw = field(body, "roleId");
  if (roleRaw) {
    const found = ctx.roles.get(roleRaw);
    if (roleRaw === guildId) errors.roleId = "@everyone can't be sold.";
    else if (!found) errors.roleId = "That role does not exist in this server. Pick one from the list.";
    else if (!found.assignable) errors.roleId = "Aegis can't hand out that role: it is at or above Aegis's highest role, or managed by an integration.";
    else if (found.aboveViewer) errors.roleId = ROLE_ABOVE_VIEWER_ERROR;
  }
  const v = validateShopItem({ name: field(body, "name"), description: field(body, "description"), price: field(body, "price"), roleId: roleRaw || null, stock: field(body, "stock") });
  if (!v.ok) Object.assign(errors, v.errors);
  if (Object.keys(errors).length || !v.ok) return { ok: false, errors };
  return { ok: true, value: v.value };
}

export interface AdjustInput { userId: string; action: AdjustAction; amount: number; reason: string | null }

export function parseAdjustForm(body: FormBody): Parsed<AdjustInput> {
  const errors: Record<string, string> = {};
  const userId = field(body, "userId");
  if (!SNOWFLAKE.test(userId)) errors.userId = "Enter the member's Discord user ID (17–20 digits).";
  const actionRaw = field(body, "action");
  const action = actionRaw === "give" || actionRaw === "take" || actionRaw === "reset" ? actionRaw : null;
  if (!action) errors.action = "Pick give, take or reset.";
  let amount = 0;
  if (action !== "reset") {
    const parsed = parseAmount(field(body, "amount"));
    if (parsed === null) errors.amount = `Amount must be a whole number from 1 to ${MAX_BALANCE.toLocaleString("en-US")}.`;
    else amount = parsed;
  }
  const reason = field(body, "reason").replace(/\s+/g, " ");
  if (reason.length > ECONOMY_REASON_MAX) errors.reason = `Reason: at most ${ECONOMY_REASON_MAX} characters.`;
  if (Object.keys(errors).length || !action) return { ok: false, errors };
  return { ok: true, value: { userId, action, amount, reason: reason || null } };
}
