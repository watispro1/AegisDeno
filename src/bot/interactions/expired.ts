/**
 * Answer a component interaction that nothing handled, for example a button on
 * a message from before a restart or one whose collector has already ended.
 * Without this the member sees Discord's "This interaction failed" after three
 * seconds and has no idea that running the command again fixes it.
 */
import { MessageFlags } from "discord.js";

export const EXPIRED_COMPONENT_MESSAGE =
  "⌛ That button or menu isn't active for you any more. Run the command again to get a fresh one.";

/** The parts of a component interaction this fallback touches (structural for tests). */
export interface UnhandledComponent {
  replied: boolean;
  deferred: boolean;
  reply(options: { content: string; flags: number }): Promise<unknown>;
}

/**
 * Give an active collector a moment to take the interaction first. If nobody
 * acknowledged it, explain how to get fresh buttons. Returns true when the
 * fallback answered.
 */
export async function answerExpiredComponent(
  interaction: UnhandledComponent,
  waitMs = 2000,
  pollMs = 100,
): Promise<boolean> {
  for (let waited = 0; waited < waitMs; waited += pollMs) {
    if (interaction.replied || interaction.deferred) return false;
    await new Promise(resolve => setTimeout(resolve, pollMs));
  }
  if (interaction.replied || interaction.deferred) return false;

  try {
    await interaction.reply({ content: EXPIRED_COMPONENT_MESSAGE, flags: MessageFlags.Ephemeral });
    return true;
  } catch {
    // The three-second token ran out or Discord already answered it.
    return false;
  }
}
