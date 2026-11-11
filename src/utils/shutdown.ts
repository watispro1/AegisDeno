/**
 * Graceful shutdown: runs each step in order, once, with a hard deadline.
 *
 * Fly.io sends SIGINT/SIGTERM and kills the machine a few seconds later. Before
 * this helper a second signal started a second shutdown in parallel (closing
 * the database twice), a hung step (a stalled Mongo flush) kept the process
 * alive until it was killed, and the gateway stayed connected while the
 * database was already closed, so late events failed against a closed pool.
 *
 * Steps run sequentially so callers can order them (stop timers, disconnect
 * from Discord so no new events arrive, flush buffers, close the database).
 * A failing step is logged and the rest still run.
 */
export interface ShutdownStep {
  name: string;
  run(): unknown | Promise<unknown>;
}

export interface ShutdownOptions {
  steps: readonly ShutdownStep[];
  /** Hard deadline for all steps together; the process exits with code 1 after it. */
  timeoutMs?: number;
  exit?: (code: number) => void;
  log?: { info(msg: string): void; warn(msg: string, err?: unknown): void; error(msg: string, err?: unknown): void };
}

export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;

export type ShutdownResult = "clean" | "errors" | "timeout";

/**
 * Returns a `shutdown(signal)` function that is safe to call more than once:
 * later calls return the first call's promise instead of starting again.
 */
export function createShutdown(options: ShutdownOptions): (signal: string) => Promise<ShutdownResult> {
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const log = options.log ?? console;
  const timeoutMs = options.timeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;
  let running: Promise<ShutdownResult> | null = null;

  return (signal: string) => {
    if (running) {
      log.info(`received ${signal} while already shutting down; ignoring`);
      return running;
    }
    log.info(`received ${signal}, shutting down`);

    const work = (async (): Promise<ShutdownResult> => {
      let failed = false;
      for (const step of options.steps) {
        try {
          await step.run();
        } catch (err) {
          failed = true;
          log.warn(`shutdown step "${step.name}" failed:`, err);
        }
      }
      return failed ? "errors" : "clean";
    })();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<ShutdownResult>((resolve) => {
      timer = setTimeout(() => resolve("timeout"), timeoutMs);
      timer.unref?.();
    });

    running = Promise.race([work, deadline]).then((result) => {
      if (timer) clearTimeout(timer);
      if (result === "timeout") log.error(`shutdown did not finish within ${timeoutMs}ms; exiting anyway`);
      exit(result === "timeout" ? 1 : 0);
      return result;
    });
    return running;
  };
}
