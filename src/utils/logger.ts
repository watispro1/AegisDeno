import { inspect } from "node:util";

export function setupLogger() {
  // Logger is ready by default
}

const timestamp = () => new Date().toISOString();

/** Environment variables whose values must never appear in a log line. */
export const SECRET_ENV_KEYS = [
  "DISCORD_TOKEN",
  "DISCORD_CLIENT_SECRET",
  "DASHBOARD_SESSION_SECRET",
  "MONGO_URI",
  "TOPGG_TOKEN",
  "TOPGG_WEBHOOK_AUTH",
] as const;

const PATTERNS: Array<[RegExp, string]> = [
  // Credentials inside connection strings: mongodb+srv://user:pass@host
  [/\b([a-z][a-z0-9+.-]*:\/\/)[^\s:/@]+:[^\s@/]+@/gi, "$1[redacted]@"],
  // Discord bot tokens: <base64 id>.<timestamp>.<hmac>
  [/\b[MNO][A-Za-z\d_-]{23,27}\.[A-Za-z\d_-]{6}\.[A-Za-z\d_-]{27,40}\b/g, "[redacted-token]"],
  // Authorization headers
  [/\b(Bearer|Bot|Basic)\s+[A-Za-z0-9._~+/=-]{16,}/g, "$1 [redacted]"],
];

/**
 * Remove secrets from text bound for the log: configured secret values,
 * credentials in URLs, Discord tokens and Authorization header values.
 */
export function redactSecrets(text: string, env: NodeJS.ProcessEnv = process.env): string {
  let out = String(text);
  for (const key of SECRET_ENV_KEYS) {
    const value = env[key]?.trim();
    // Short values would redact ordinary words; real secrets are long.
    if (value && value.length >= 8) out = out.split(value).join(`[redacted:${key}]`);
  }
  for (const [re, replacement] of PATTERNS) out = out.replace(re, replacement);
  return out;
}

function clean(args: unknown[]): unknown[] {
  return args.map((a) => (typeof a === "string" ? redactSecrets(a) : a === undefined || a === null || typeof a === "number" || typeof a === "boolean" ? a : redactSecrets(inspect(a, { depth: 3, breakLength: Infinity }))));
}

export const logger = {
  info: (msg: string, ...args: unknown[]) =>
    console.log(`\x1b[36m[${timestamp()}]\x1b[0m \x1b[32m[INFO]\x1b[0m ${redactSecrets(msg)}`, ...clean(args)),
  warn: (msg: string, ...args: unknown[]) =>
    console.warn(`\x1b[36m[${timestamp()}]\x1b[0m \x1b[33m[WARN]\x1b[0m ${redactSecrets(msg)}`, ...clean(args)),
  error: (msg: string, ...args: unknown[]) =>
    console.error(`\x1b[36m[${timestamp()}]\x1b[0m \x1b[31m[ERROR]\x1b[0m ${redactSecrets(msg)}`, ...clean(args)),
  debug: (msg: string, ...args: unknown[]) =>
    process.env.LOG_LEVEL === "debug"
      ? console.debug(`\x1b[36m[${timestamp()}]\x1b[0m \x1b[90m[DEBUG]\x1b[0m ${redactSecrets(msg)}`, ...clean(args))
      : undefined,
};
