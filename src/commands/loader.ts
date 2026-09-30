import { Command } from "../types/discord";
import { logger } from "../utils/logger";
import path from "path";
import fs from "fs";

export const commands = new Map<string, Command>();

export const COMMAND_CATEGORIES = [
  "general",
  "moderation",
  "config",
  "logging",
  "automod",
  "welcome",
  "community",
  "automation",
  "developer",
] as const;

export type CommandCategory = (typeof COMMAND_CATEGORIES)[number];

const COMMAND_DIRS: CommandCategory[] = [...COMMAND_CATEGORIES];

export async function loadCommands(): Promise<void> {
  for (const dir of COMMAND_DIRS) {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
      logger.warn(`Command directory not found: ${dir}`);
      continue;
    }

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith(".ts") || f.endsWith(".js"));
    for (const file of files) {
      try {
        const filePath = path.join(dirPath, file);
        // Use require for synchronous loading in CommonJS/tsx
        const mod = require(filePath);
        const command: Command = mod.command ?? mod.default;
        if (command?.data?.name) {
          command.category = dir;
          commands.set(command.data.name, command);
          logger.debug(`Loaded command: /${command.data.name} (${dir})`);
        }
      } catch (error) {
        logger.error(`Failed to load ${dir}/${file}:`, error);
      }
    }
  }

  logger.info(`Loaded ${commands.size} commands.`);
}
