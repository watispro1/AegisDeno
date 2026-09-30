import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { Command } from "../types/discord";
import { logger } from "../utils/logger";

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

export const commands = new Map<string, Command>();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isCommand(value: unknown): value is Command {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<Command>;

  return Boolean(
    candidate.data &&
      typeof candidate.data === "object" &&
      "name" in candidate.data &&
      typeof candidate.execute === "function",
  );
}

async function importCommand(filePath: string): Promise<Command | null> {
  const module = await import(pathToFileURL(filePath).href);
  const candidate = module.command ?? module.default;

  return isCommand(candidate) ? candidate : null;
}

export async function loadCommands(): Promise<void> {
  commands.clear();

  for (const category of COMMAND_CATEGORIES) {
    const directory = path.join(__dirname, category);

    if (!fs.existsSync(directory)) {
      logger.warn(`Command directory not found: ${category}`);
      continue;
    }

    const files = fs
      .readdirSync(directory)
      .filter((file) => /\.(?:js|mjs|cjs|ts)$/.test(file))
      .sort();

    for (const file of files) {
      const filePath = path.join(directory, file);

      try {
        const command = await importCommand(filePath);

        if (!command) {
          logger.warn(`Skipping invalid command module: ${category}/${file}`);
          continue;
        }

        if (commands.has(command.data.name)) {
          throw new Error(
            `Duplicate command name "/${command.data.name}"`,
          );
        }

        command.category = category;
        commands.set(command.data.name, command);

        logger.debug(
          `Loaded command: /${command.data.name} (${category})`,
        );
      } catch (error) {
        logger.error(
          `Failed to load ${category}/${file}:`,
          error,
        );
      }
    }
  }

  logger.info(`Loaded ${commands.size} commands.`);
}
