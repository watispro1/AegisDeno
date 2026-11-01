/**
 * Custom IDs for modals that a command waits on with `awaitModalSubmit`.
 *
 * `awaitModalSubmit` listens to every modal submit the bot receives, not only
 * the one opened by that interaction. With a fixed custom ID, a user who
 * dismisses a modal and runs the command again has two waits listening for
 * the same ID: the next submit resolves both, the stale one acts on the
 * earlier invocation's options and acknowledges the submit first, and the
 * current one then fails with "already acknowledged". Suffixing the ID with
 * the opening interaction's ID keeps each wait to its own modal.
 */
export function scopedModalId(base: string, interactionId: string): string {
  return `${base}:${interactionId}`.slice(0, 100);
}
