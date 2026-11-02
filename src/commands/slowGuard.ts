/**
 * Safety net for commands that do slow I/O before answering.
 *
 * Discord gives an interaction three seconds to be acknowledged. Most commands
 * defer themselves, but a missed path or a slow database would leave the member
 * with "The application did not respond". Shortly before that deadline the
 * guard defers for the command and turns its later reply() into an edit of the
 * deferred response, so existing commands keep working unchanged.
 *
 * Ephemeral replies are kept private even though the placeholder was public:
 * the placeholder is deleted and the answer is sent as an ephemeral follow-up.
 */
import { MessageFlags } from "discord.js";

/** Defer just before Discord's three-second deadline, leaving time for the API call. */
export const SLOW_COMMAND_DEFER_MS = 2500;

type ReplyOptions = {
  content?: string;
  flags?: number;
  fetchReply?: boolean;
  withResponse?: boolean;
  [key: string]: unknown;
};

/** The parts of a chat-input interaction the guard touches (structural for tests). */
export interface SlowGuardInteraction {
  replied: boolean;
  deferred: boolean;
  deferReply?(options?: Record<string, unknown>): Promise<unknown>;
  reply(options: ReplyOptions): Promise<unknown>;
  editReply(options: Record<string, unknown>): Promise<unknown>;
  deleteReply?(): Promise<unknown>;
  followUp(options: ReplyOptions): Promise<unknown>;
}

/** True when a reply asks Discord to show it only to the member. */
export function isEphemeralReply(options: ReplyOptions | undefined): boolean {
  return ((options?.flags ?? 0) & MessageFlags.Ephemeral) === MessageFlags.Ephemeral;
}

/**
 * Install the guard and return a function that cancels the timer once the
 * command has finished. Safe to call on an interaction that already deferred.
 */
export function startSlowCommandGuard(interaction: SlowGuardInteraction, delayMs = SLOW_COMMAND_DEFER_MS): () => void {
  // A partial interaction (a test double, an older wrapper) cannot be deferred;
  // leave it alone rather than failing the command.
  if (typeof interaction.reply !== "function" || typeof interaction.deferReply !== "function") {
    return () => {};
  }

  const originalReply = interaction.reply.bind(interaction);
  const originalDefer = interaction.deferReply.bind(interaction);
  let commandAcknowledged = false;
  let autoDeferred = false;
  let deferPromise: Promise<void> | null = null;

  interaction.deferReply = async (options) => {
    commandAcknowledged = true;
    // The command caught up after our automatic defer; do not defer twice.
    if (deferPromise) await deferPromise;
    if (autoDeferred) return;
    return originalDefer(options);
  };

  interaction.reply = async (options) => {
    commandAcknowledged = true;
    if (deferPromise) await deferPromise;
    if (!autoDeferred) return originalReply(options);

    if (isEphemeralReply(options)) {
      // The placeholder is public, so remove it before answering privately.
      await interaction.deleteReply?.().catch(() => null);
      return interaction.followUp(options);
    }

    const { fetchReply, ...rest } = options;
    if (!fetchReply) return interaction.editReply(rest);
    const response = await interaction.editReply({ ...rest, withResponse: true });
    const message = (response as { resource?: { message?: unknown } } | null)?.resource?.message;
    return message ?? response;
  };

  const timer = setTimeout(() => {
    if (commandAcknowledged || interaction.replied || interaction.deferred) return;
    deferPromise = originalDefer()
      .then(() => { autoDeferred = true; })
      .catch(() => {
        // Another listener answered first; the command's own reply is next.
      });
  }, delayMs);
  timer.unref?.();

  return () => clearTimeout(timer);
}
