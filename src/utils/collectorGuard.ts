/**
 * Runs a component-collector "collect" handler so a failure (an expired
 * interaction, a Discord API error, a database blip) is logged and answered
 * with a short ephemeral notice instead of becoming an unhandled promise
 * rejection that leaves the user with "This interaction failed".
 */
import { MessageFlags } from "discord.js";
import { logger } from "./logger";

export const COLLECT_FAILED = "⚠️ That didn't work: the request expired or Discord refused it. Run the command again.";

/** The bits of a component interaction the guard needs (kept structural for tests). */
export interface GuardableInteraction {
  deferred: boolean;
  replied: boolean;
  reply(o: { content: string; flags: number }): Promise<unknown>;
  followUp(o: { content: string; flags: number }): Promise<unknown>;
}

export async function guardCollect(label: string, i: GuardableInteraction, handler: () => Promise<unknown>): Promise<void> {
  try {
    await handler();
  } catch (err) {
    logger.warn(`Collector handler failed (${label}):`, err);
    try {
      if (i.deferred || i.replied) await i.followUp({ content: COLLECT_FAILED, flags: MessageFlags.Ephemeral });
      else await i.reply({ content: COLLECT_FAILED, flags: MessageFlags.Ephemeral });
    } catch {
      // The interaction token is gone; nothing more to say.
    }
  }
}
