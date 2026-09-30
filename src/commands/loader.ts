import { Command } from "../types/discord";
import { logger } from "../utils/logger";
import path from "path";
import fs from "fs";

export const commands = new Map<string, Command>();

const COMMAND_DIRS = [
  "general",
  "moderation",
  "config",
  "logging",
  "automod",
  "welcome",
  "community",
  "automation",
  "developer",
];

export async function loadCommands(): Promise<void> {
  const commandsDir = path.join(__dirname, "..");  // src/commands is one up from src/commands/loader

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
        if (command && command.data?.name) {
          commands.set(command.data.name, command);
          logger.debug(`Loaded command: /${command.data.name}`);
        }
      } catch (error) {
        logger.error(`Failed to load ${dir}/${file}:`, error);
      }
    }
  }

  logger.info(`Loaded ${commands.size} commands.`);
}
