/** Ticket settings, stored in the guild config (`tickets`). Split out of ticketService.ts. */
import { defaultGuildConfig, getGuildConfig, updateGuildConfig, type TicketSettings } from "./configuration";

export type { TicketSettings } from "./configuration";

/** Ticket settings live in the guild config (`tickets`). */
export async function getTicketSettings(guildId: string): Promise<TicketSettings> {
  return (await getGuildConfig(guildId).catch(() => defaultGuildConfig(guildId))).tickets;
}

export async function updateTicketSettings(guildId: string, patch: Partial<TicketSettings>): Promise<TicketSettings> {
  return (await updateGuildConfig(guildId, { tickets: patch })).tickets;
}
