/**
 * HTTP server wrapper for AegisDB.
 *
 * Start order matters: the port is bound first and the engine (which locks the
 * data directory and replays the WAL) is opened only once the port is ours. If
 * another process already owns the port, this process never touches the data
 * files and the bot talks to that instance over HTTP instead.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { AegisDbEngine } from "./engine";
import { handleAegisDbRequest } from "./routes";
import type { AegisDbConfig } from "./types";
import { isDevEnvironment } from "./auth";
import { logger } from "../../utils/logger";

export type AegisDbStartMode = "serving" | "attached";

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

  /** The local engine, or null when not serving (not started, or attached to another instance). */
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

    const server = http.createServer((req, res) => {
      if (!this.engine) {
        res.statusCode = 503;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "starting" }));
        return;
      }
      handleAegisDbRequest(req, res, this.engine, this.config);
    });

    const bound = await new Promise<boolean>((resolve, reject) => {
      const onError = (err: NodeJS.ErrnoException) => {
        server.off("listening", onListening);
        if (err.code === "EADDRINUSE") resolve(false);
        else reject(err);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve(true);
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(this.config.port, "127.0.0.1");
    });

    if (!bound) {
      logger.info(`AegisDB: port ${this.config.port} already in use; using that instance and leaving the data directory alone.`);
      this.mode = "attached";
      return this.mode;
    }

    this.server = server;
    server.on("error", (err) => logger.error("AegisDB HTTP server error:", err));
    try {
      this.engine = new AegisDbEngine(this.config.dataPath);
    } catch (err) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      this.server = null;
      throw err;
    }
    this.mode = "serving";
    logger.info(`AegisDB (TypeScript engine) listening on http://127.0.0.1:${this.port()}`);
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
