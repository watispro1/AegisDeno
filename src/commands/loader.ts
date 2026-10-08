import fs from "node:fs";
import path from "node:path";

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
  "tickets",
  "verification",
  "autoresponder",
  "roles",
  "developer",
] as const;

export type CommandCategory = (typeof COMMAND_CATEGORIES)[number];

export const commands = new Map<string, Command>();

const COMMAND_DIR = __dirname;

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

export async function loadCommands(): Promise<void> {
  commands.clear();
  const seenCommandNames = new Set<string>();

  for (const category of COMMAND_CATEGORIES) {
    const directory = path.join(COMMAND_DIR, category);

    if (!fs.existsSync(directory)) {
      logger.warn(`Command directory not found: ${category}`);
      continue;
    }

    const files = fs
      .readdirSync(directory)
      .filter((file) => /\.(?:js|cjs|ts)$/.test(file))
      .sort();

    for (const file of files) {
      const filePath = path.join(directory, file);

      try {
        // The project compiles to CommonJS, so keep loading aligned with tsconfig.
        // tsx handles .ts files during development and Node handles compiled .js files.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const module = require(filePath) as Record<string, unknown>;
        const candidate = module.command ?? module.default;

        if (!isCommand(candidate)) {
          logger.warn(`Skipping invalid command module: ${category}/${file}`);
          continue;
        }

        const commandName = candidate.data.name;
        if (seenCommandNames.has(commandName)) {
          logger.warn(`Skipping duplicate command name "/${commandName}" from ${category}/${file}. A previous definition already won.`);
          continue;
        }

        seenCommandNames.add(commandName);
        candidate.category = category;
        commands.set(commandName, candidate);

        logger.debug(`Loaded command: /${commandName} (${category})`);
      } catch (error) {
        logger.error(`Failed to load ${category}/${file}:`, error);
      }
    }
  }

  logger.info(`Loaded ${commands.size} commands.`);
}
