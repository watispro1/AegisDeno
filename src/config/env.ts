import * as dotenv from "dotenv";

dotenv.config();

export const BOT_OWNER_IDS = new Set(
  ["1320058519642177668", process.env.DISCORD_OWNER_ID?.trim()].filter(
    (id): id is string => Boolean(id),
  ),
);

export const config = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN || "",
  DISCORD_APPLICATION_ID: process.env.DISCORD_APPLICATION_ID || "",
  DISCORD_TEST_GUILD_ID: process.env.DISCORD_TEST_GUILD_ID || "",
  DATABASE_URL: process.env.DATABASE_URL || "./database.sqlite",
  BOT_ENV: process.env.BOT_ENV || "development",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  SUPPORT_SERVER_URL: process.env.SUPPORT_SERVER_URL || "",
  BOT_INVITE_URL: process.env.BOT_INVITE_URL || "",
};

export function validateEnv() {
  if (!config.DISCORD_TOKEN) {
    console.error("Configuration error: DISCORD_TOKEN is not configured.");
    process.exit(1);
  }
  if (!config.DISCORD_APPLICATION_ID) {
    console.error("Configuration error: DISCORD_APPLICATION_ID is not configured.");
    process.exit(1);
  }
}
