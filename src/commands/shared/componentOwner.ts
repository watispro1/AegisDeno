/**
 * Buttons and menus on a command's reply belong to the person who ran it.
 * Collectors used to filter other people's presses out silently, which left
 * them with Discord's "This interaction failed". These helpers answer them
 * with a short private note instead.
 */
import { MessageFlags } from "discord.js";

/** The note shown to someone pressing a button on another member's reply. Pure. */
export function notYoursMessage(commandName: string): string {
  return `These buttons belong to whoever ran this. Run \`/${commandName}\` to get your own.`;
}

interface Pressable {
  user: { id: string };
  reply(options: { content: string; flags: MessageFlags.Ephemeral }): Promise<unknown>;
}

/**
 * True when `i` was pressed by `ownerId`. Otherwise answers privately and
 * returns false, so the caller can just `if (!(await ownsComponent(...))) return;`.
 */
export async function ownsComponent(i: Pressable, ownerId: string, commandName: string): Promise<boolean> {
  if (i.user.id === ownerId) return true;
  await i.reply({ content: notYoursMessage(commandName), flags: MessageFlags.Ephemeral }).catch(() => null);
  return false;
}
