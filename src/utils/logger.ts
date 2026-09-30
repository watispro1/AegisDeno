export function setupLogger() {
  // Logger is ready by default
}

const timestamp = () => new Date().toISOString();

export const logger = {
  info: (msg: string, ...args: unknown[]) =>
    console.log(`\x1b[36m[${timestamp()}]\x1b[0m \x1b[32m[INFO]\x1b[0m ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) =>
    console.warn(`\x1b[36m[${timestamp()}]\x1b[0m \x1b[33m[WARN]\x1b[0m ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) =>
    console.error(`\x1b[36m[${timestamp()}]\x1b[0m \x1b[31m[ERROR]\x1b[0m ${msg}`, ...args),
  debug: (msg: string, ...args: unknown[]) =>
    process.env.LOG_LEVEL === "debug"
      ? console.debug(`\x1b[36m[${timestamp()}]\x1b[0m \x1b[90m[DEBUG]\x1b[0m ${msg}`, ...args)
      : undefined,
};
