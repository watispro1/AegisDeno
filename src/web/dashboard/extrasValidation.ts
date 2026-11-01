/** Form parsing for the Incident, Members, Analytics and settings-transfer pages. Same rules as validation.ts. */
import { INCIDENT_MAX_MINUTES, MAX_GATE_TIMEOUT_MINUTES, MAX_SLOWMODE_SECONDS, normalizeIncidentConfig, type IncidentConfig, type IncidentOptions } from "../../services/incidentLogic";
import { MODULE_SWITCH_KEYS, type ModuleSwitches } from "../../services/guildConfigNormalize";
import { Errors, checkbox, field, fieldValues, finish, integer, type FormBody, type Parsed, type ValidationContext } from "./validation";
import { MEMBER_ACTIONS, type MemberAction, type MemberActionInput } from "./extras";

function channelList(body: FormBody, key: string, ctx: ValidationContext, errors: Errors, label: string): string[] {
  const ids = [...new Set(fieldValues(body, key))].slice(0, 50);
  const bad = ids.filter(id => !ctx.textChannelIds.has(id) || ctx.hiddenChannelIds?.has(id));
  if (bad.length) errors.add(key, `${bad.length} of the ${label} can't be used: Aegis can't see them, or they are not text channels. Untick them.`);
  return ids.filter(id => !bad.includes(id));
}

export function parseIncidentOptions(body: FormBody, ctx: ValidationContext, errors: Errors): IncidentOptions {
  const lockModeRaw = field(body, "lockMode");
  const lockMode = lockModeRaw === "public" || lockModeRaw === "selected" ? lockModeRaw : "none";
  const gateRaw = field(body, "joinGate");
  const joinGate = gateRaw === "kick" || gateRaw === "off" ? gateRaw : "timeout";
  const lockChannelIds = channelList(body, "lockChannelIds", ctx, errors, "channels to lock");
  if (lockMode === "selected" && !lockChannelIds.length && !errors.map.lockChannelIds) errors.add("lockChannelIds", "Pick at least one channel to lock, or choose another lock option.");
  return {
    durationMinutes: integer(body, "durationMinutes", 1, INCIDENT_MAX_MINUTES, "The duration", errors, { blank: 60 }),
    slowmodeSeconds: integer(body, "slowmodeSeconds", 0, MAX_SLOWMODE_SECONDS, "Slowmode", errors, { blank: 0 }),
    slowmodeChannelIds: channelList(body, "slowmodeChannelIds", ctx, errors, "slowmode channels"),
    lockMode,
    lockChannelIds,
    joinGate,
    minAccountAgeDays: integer(body, "minAccountAgeDays", 1, 365, "The account age", errors, { blank: 7 }),
    gateTimeoutMinutes: integer(body, "gateTimeoutMinutes", 1, MAX_GATE_TIMEOUT_MINUTES, "The timeout length", errors, { blank: 60 }),
    pauseInvites: checkbox(body, "pauseInvites"),
  };
}

export function parseIncidentStart(body: FormBody, ctx: ValidationContext): Parsed<{ options: IncidentOptions; reason: string }> {
  const errors = new Errors();
  const reason = field(body, "reason").slice(0, 300);
  const options = parseIncidentOptions(body, ctx, errors);
  return finish(errors, { options, reason });
}

export function parseIncidentSettings(body: FormBody, ctx: ValidationContext): Parsed<IncidentConfig> {
  const errors = new Errors();
  const defaults = parseIncidentOptions(body, ctx, errors);
  const config = normalizeIncidentConfig({
    autoTrigger: {
      enabled: checkbox(body, "autoEnabled"),
      joins: integer(body, "autoJoins", 3, 500, "Joins", errors, { blank: 10 }),
      seconds: integer(body, "autoSeconds", 5, 600, "Seconds", errors, { blank: 30 }),
    },
    defaults,
  });
  return finish(errors, config);
}

/** Timeout lengths offered on the member page, in minutes. */
export const TIMEOUT_CHOICES: ReadonlyArray<[number, string]> = [[5, "5 minutes"], [60, "1 hour"], [360, "6 hours"], [1440, "1 day"], [10080, "1 week"], [40320, "28 days"]];

export function parseMemberAction(body: FormBody): Parsed<MemberActionInput> {
  const errors = new Errors();
  const action = field(body, "action") as MemberAction;
  if (!MEMBER_ACTIONS.includes(action)) errors.add("action", "Pick an action.");
  const reason = field(body, "reason").trim();
  if (!reason) errors.add("reason", "Give a reason; it goes on the case and in the mod log.");
  else if (reason.length > 400) errors.add("reason", "Keep the reason under 400 characters.");
  const minutes = Number(field(body, "minutes") || "60");
  if (action === "timeout" && !TIMEOUT_CHOICES.some(([m]) => m === minutes)) errors.add("minutes", "Pick a timeout length from the list.");
  return finish(errors, { action, reason, minutes: action === "timeout" ? minutes : 0 });
}

export function parseModuleSwitches(body: FormBody): ModuleSwitches {
  return Object.fromEntries(MODULE_SWITCH_KEYS.map(k => [k, checkbox(body, `module_${k}`)])) as unknown as ModuleSwitches;
}

/** A search box value: trimmed, at most 64 characters, no control characters. */
export function searchQuery(query: Record<string, unknown>): string {
  const raw = typeof query.q === "string" ? query.q : "";
  return raw.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 64);
}
