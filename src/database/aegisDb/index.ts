/**
 * AegisDB Backend Service (TypeScript native implementation).
 */
import { AegisDbServer } from "./server";
import type { AegisDbEngine } from "./engine";
import type { AegisDbConfig } from "./types";

export * from "./types";
export * from "./engine";
export * from "./server";

let defaultServer: AegisDbServer | null = null;

/**
 * Starts the embedded AegisDB once per process. Binds the port first and opens
 * the data directory only if the port was free; if another instance already
 * serves it, this process attaches over HTTP instead. Throws (and stays
 * stopped) when the secret is missing outside development or the data
 * directory is locked by another process.
 */
export async function startAegisBackend(config?: Partial<AegisDbConfig>): Promise<AegisDbServer> {
  if (!defaultServer) {
    const server = new AegisDbServer(config);
    await server.start();
    defaultServer = server;
  }
  return defaultServer;
}

export async function stopAegisBackend(): Promise<void> {
  if (defaultServer) {
    await defaultServer.stop();
    defaultServer = null;
  }
}

export function getAegisDbEngine(): AegisDbEngine | null {
  return defaultServer?.getEngine() ?? null;
}
