import type { ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types/discord";
import { knubManager } from "../knub";

/**
 * Routes a slash command through the Knub command pipeline, which applies
 * common validation, permission checks, logging, and error handling.
 */
export async function executeCommand(
  command: Command,
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await knubManager.executeCommandPipeline(command, interaction);
}
