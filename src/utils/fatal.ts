/**
 * What the process does on an uncaught exception or unhandled rejection.
 *
 * Before, both were only logged and the bot kept running in whatever state the
 * throw left behind (a half-closed gateway, a timer that never re-arms, a
 * Mongo pool mid-reconnect). Now the error is logged, the exit code is set to 1
 * and the normal graceful shutdown runs, so Fly restarts a clean process and
 * the restart shows as a failure in its logs.
 *
 * Re-entry guarded: a second fatal error while that shutdown runs is logged
 * and does not start another one. The shutdown helper itself is also
 * idempotent, so a SIGTERM arriving during a crash shutdown is harmless.
 */
export type FatalKind = "uncaughtException" | "unhandledRejection";

export interface FatalHandlerOptions {
  shutdown: (reason: string) => Promise<unknown>;
  log: { error(msg: string, ...args: unknown[]): void };
  /** Defaults to setting process.exitCode. */
  setExitCode?: (code: number) => void;
}

export function createFatalHandler(options: FatalHandlerOptions): (kind: FatalKind, err: unknown) => void {
  const setExitCode = options.setExitCode ?? ((code: number) => { process.exitCode = code; });
  let handling = false;
  return (kind, err) => {
    if (handling) {
      options.log.error(`${kind} while already shutting down after a fatal error (not restarting shutdown):`, err);
      return;
    }
    handling = true;
    options.log.error(`${kind}; shutting down so the process restarts clean:`, err);
    setExitCode(1);
    void options.shutdown(kind).catch((shutdownErr) => options.log.error("shutdown after a fatal error failed:", shutdownErr));
  };
}

/**
 * The exit code a finished shutdown should use: 1 when a fatal error already
 * set process.exitCode, else what the shutdown itself reported.
 */
export function effectiveExitCode(shutdownCode: number, exitCode: number | string | null | undefined): number {
  const pending = Number(exitCode ?? 0) || 0;
  return shutdownCode !== 0 ? shutdownCode : pending;
}
