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

/** The external AegisDB the bot should use over HTTP, or "" to use the in-process engine. */
export function externalBackendUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.AEGIS_BACKEND_URL ?? "").trim();
}

/**
 * Opens the in-process AegisDB engine once per process (plus its optional HTTP
 * listener for outside tools). Skipped, returning null, when AEGIS_BACKEND_URL
 * points the bot at an external AegisDB and no explicit config is given.
 * Throws (and stays stopped) when the secret is missing outside development or
 * the data directory is locked by another process; the bot keeps running on
 * MongoDB either way.
 */
export async function startAegisBackend(config?: Partial<AegisDbConfig>): Promise<AegisDbServer | null> {
  if (!config && externalBackendUrl()) return null;
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
