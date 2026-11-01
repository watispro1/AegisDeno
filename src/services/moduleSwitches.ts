/**
 * Whole-module on/off switches set on the dashboard (tickets, giveaways,
 * scheduled messages, ban appeals). An off module refuses new use: no new
 * tickets, giveaways, scheduled messages or appeal submissions. Anything that
 * already exists keeps working, so switching a module off never loses data.
 */
import { getGuildConfig } from "./configuration";
import { normalizeModuleSwitches, type ModuleSwitchKey } from "./guildConfigNormalize";

export const MODULE_LABELS: Record<ModuleSwitchKey, string> = {
  tickets: "Tickets",
  giveaways: "Giveaways",
  scheduled: "Scheduled messages",
  appeals: "Ban appeals",
};

/** Fails open (true) when the config cannot be read, so a database blip never disables a module. */
export async function moduleEnabled(guildId: string | null | undefined, key: ModuleSwitchKey): Promise<boolean> {
  if (!guildId) return true;
  try {
    return normalizeModuleSwitches((await getGuildConfig(guildId)).modules)[key];
  } catch {
    return true;
  }
}

export function moduleOffMessage(key: ModuleSwitchKey): string {
  return `❌ ${MODULE_LABELS[key]} are switched off in this server. A server manager can turn them back on from the dashboard's Modules & backup page.`;
}
