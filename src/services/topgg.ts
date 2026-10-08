import { Client } from "discord.js";
import { logger } from "../utils/logger";

const POST_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export function initTopGG(client: Client): void {
  const token = process.env.TOPGG_TOKEN;
  if (!token) {
    logger.info("Top.gg integration: TOPGG_TOKEN not set. Stats posting disabled.");
    return;
  }

  const postStats = async () => {
    if (!client.isReady() || !client.user) return;

    const guildCount = client.guilds.cache.size;
    const botId = client.user.id;

    try {
      const response = await fetch(`https://top.gg/api/bots/${botId}/stats`, {
        method: "POST",
        headers: {
          "Authorization": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          server_count: guildCount,
        }),
      });

      if (response.ok) {
        logger.info(`✅ Top.gg stats updated: ${guildCount} server(s).`);
      } else {
        const text = await response.text();
        logger.warn(`Top.gg stats update returned status ${response.status}: ${text}`);
      }
    } catch (err) {
      logger.error("Failed to post Top.gg stats:", err);
    }
  };

  // Post on startup after login
  postStats();

  // Periodically refresh stats
  const timer = setInterval(postStats, POST_INTERVAL_MS);
  timer.unref?.();
}
