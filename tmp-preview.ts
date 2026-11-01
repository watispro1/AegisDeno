import { startWebServer } from "./src/web/server";
import { loadCommands } from "./src/commands/loader";
import type { Client } from "discord.js";

const fakeClient = {
  isReady: () => true,
  guilds: { cache: new Map([["g1", { memberCount: 1284 }]]) },
  ws: { ping: 42 },
  uptime: 3_723_000,
} as unknown as Client;

async function main() {
  process.env.PORT = process.env.PORT || "4399";
  await loadCommands();
  startWebServer(fakeClient);
}

main();
