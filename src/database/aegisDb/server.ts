/**
 * HTTP server wrapper for AegisDB.
 */
import http from "node:http";
import { AegisDbEngine } from "./engine";
import { handleAegisDbRequest } from "./routes";
import type { AegisDbConfig } from "./types";
import { logger } from "../../utils/logger";

export class AegisDbServer {
  private server: http.Server | null = null;
  private engine: AegisDbEngine;
  private config: AegisDbConfig;
  private listening = false;

  constructor(config?: Partial<AegisDbConfig>) {
    this.config = {
      port: config?.port ?? Number(process.env.AEGIS_DB_PORT || 4000),
      secret: config?.secret ?? process.env.AEGIS_BACKEND_SECRET ?? "",
      dataPath: config?.dataPath ?? process.env.AEGIS_DB_PATH ?? "./data/aegis-db",
    };
    this.engine = new AegisDbEngine(this.config.dataPath);
  }

  getEngine(): AegisDbEngine {
    return this.engine;
  }

  isListening(): boolean {
    return this.listening;
  }

  async start(): Promise<void> {
    if (this.server) return;

    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        handleAegisDbRequest(req, res, this.engine, this.config);
      });

      this.server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          logger.info(`AegisDB: port ${this.config.port} already in use; attaching to existing instance.`);
          this.listening = true;
          resolve();
        } else {
          logger.error("AegisDB HTTP server error:", err);
          resolve();
        }
      });

      this.server.listen(this.config.port, "127.0.0.1", () => {
        this.listening = true;
        logger.info(`AegisDB (TypeScript engine) listening on http://127.0.0.1:${this.config.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    this.engine.close();
    if (this.server) {
      return new Promise((resolve) => {
        this.server?.close(() => {
          this.listening = false;
          this.server = null;
          resolve();
        });
      });
    }
  }
}
