/**
 * AegisDB engine host with an optional HTTP listener.
 *
 * The engine (which locks the data directory and replays the WAL) is opened
 * first; that alone is what the bot needs, because the bot calls the engine in
 * process (see rustClient.ts) rather than over loopback HTTP. The HTTP
 * listener on 127.0.0.1 is only for outside tools: if its port is taken the
 * engine keeps running without it. A data directory locked by another live
 * process is an error (DirLockError) and leaves this process without AegisDB.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { AegisDbEngine } from "./engine";
import { handleAegisDbRequest } from "./routes";
import type { AegisDbConfig } from "./types";
import { isDevEnvironment } from "./auth";
import { logger } from "../../utils/logger";

/** "serving": engine open and HTTP listening. "embedded": engine open, no HTTP listener (port taken). */
export type AegisDbStartMode = "serving" | "embedded";

export class AegisDbServer {
  private server: http.Server | null = null;
  private engine: AegisDbEngine | null = null;
  private config: AegisDbConfig;
  private mode: AegisDbStartMode | null = null;

  constructor(config?: Partial<AegisDbConfig>) {
    this.config = {
      port: config?.port ?? Number(process.env.AEGIS_DB_PORT || 4000),
      secret: config?.secret ?? process.env.AEGIS_BACKEND_SECRET ?? "",
      dataPath: config?.dataPath ?? process.env.AEGIS_DB_PATH ?? "./data/aegis-db",
    };
  }

  /** The local engine, or null when not started. */
  getEngine(): AegisDbEngine | null {
    return this.engine;
  }

  getMode(): AegisDbStartMode | null {
    return this.mode;
  }

  isListening(): boolean {
    return this.mode === "serving";
  }

  /** The bound port (useful when started with port 0). */
  port(): number {
    const addr = this.server?.address() as AddressInfo | null | undefined;
    return addr?.port ?? this.config.port;
  }

  async start(): Promise<AegisDbStartMode> {
    if (this.mode) return this.mode;
    if (!this.config.secret && !isDevEnvironment()) {
      throw new Error("AEGIS_BACKEND_SECRET must be set outside development; AegisDB not started.");
    }

    this.engine = new AegisDbEngine(this.config.dataPath);

    const engine = this.engine;
    const server = http.createServer((req, res) => handleAegisDbRequest(req, res, engine, this.config));
    const bound = await new Promise<boolean>((resolve) => {
      const onError = (err: NodeJS.ErrnoException) => {
        server.off("listening", onListening);
        logger.warn(`AegisDB: HTTP listener not started on port ${this.config.port} (${err.code ?? err.message}); the engine still runs in process.`);
        resolve(false);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve(true);
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(this.config.port, "127.0.0.1");
    });

    if (bound) {
      this.server = server;
      server.on("error", (err) => logger.error("AegisDB HTTP server error:", err));
      this.mode = "serving";
      logger.info(`AegisDB (TypeScript engine) open; HTTP on http://127.0.0.1:${this.port()}`);
    } else {
      this.mode = "embedded";
    }
    return this.mode;
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections?.();
      });
    }
    this.engine?.close();
    this.engine = null;
    this.mode = null;
  }
}
