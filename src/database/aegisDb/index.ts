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

export async function startAegisBackend(config?: Partial<AegisDbConfig>): Promise<AegisDbServer> {
  if (!defaultServer) {
    defaultServer = new AegisDbServer(config);
    await defaultServer.start();
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
  return defaultServer ? defaultServer.getEngine() : null;
}
