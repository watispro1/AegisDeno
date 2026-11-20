import { inspect } from "node:util";

/**
 * The bot's logger.
 *
 * Two formats, picked by LOG_FORMAT:
 *   - pretty: coloured, human-readable lines (the default outside production)
 *   - json:   one JSON object per line, no ANSI codes (the default when
 *             NODE_ENV=production), for Fly's log shipping and grep/jq
 * LOG_FORMAT=json|pretty always wins over the NODE_ENV default.
 *
 * LOG_LEVEL (debug|info|warn|error, default info) drops lines below it.
 * Every line, in both formats, goes through redactSecrets().
 *
 * setupLogger() re-reads the settings; main() calls it once the environment
 * is loaded. Until then the settings come from process.env at import.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFormat = "pretty" | "json";

/** Extra structured fields for one line, e.g. `{ errorId }`. Become top-level keys in JSON. */
export type LogFields = Record<string, string | number | boolean | null | undefined>;

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Environment variables whose values must never appear in a log line. */
export const SECRET_ENV_KEYS = [
  "DISCORD_TOKEN",
  "DISCORD_CLIENT_SECRET",
  "DASHBOARD_SESSION_SECRET",
  "MONGO_URI",
  "TOPGG_TOKEN",
  "TOPGG_WEBHOOK_AUTH",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
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

export interface LoggerSettings {
  format: LogFormat;
  level: LogLevel;
}

/** LOG_FORMAT when set to json/pretty, else json in production and pretty elsewhere. */
export function resolveLogFormat(env: NodeJS.ProcessEnv = process.env): LogFormat {
  const v = env.LOG_FORMAT?.trim().toLowerCase();
  if (v === "json" || v === "pretty") return v;
  return env.NODE_ENV === "production" ? "json" : "pretty";
}

export function resolveLogLevel(env: NodeJS.ProcessEnv = process.env): LogLevel {
  const v = env.LOG_LEVEL?.trim().toLowerCase();
  return v === "debug" || v === "info" || v === "warn" || v === "error" ? v : "info";
}

let settings: LoggerSettings = { format: resolveLogFormat(), level: resolveLogLevel() };

/** Re-read LOG_FORMAT, LOG_LEVEL and NODE_ENV (call after .env is loaded). Returns the settings in force. */
export function setupLogger(env: NodeJS.ProcessEnv = process.env): LoggerSettings {
  settings = { format: resolveLogFormat(env), level: resolveLogLevel(env) };
  return settings;
}

export function loggerSettings(): LoggerSettings {
  return { ...settings };
}

function inspectArg(a: unknown): string {
  return typeof a === "string" ? a : inspect(a, { depth: 3, breakLength: Infinity });
}

function clean(args: unknown[]): unknown[] {
  return args.map((a) => (typeof a === "string" ? redactSecrets(a) : a === undefined || a === null || typeof a === "number" || typeof a === "boolean" ? a : redactSecrets(inspectArg(a))));
}

/**
 * One JSON log line (no trailing newline). The first Error among `args` goes
 * to `err` (name, message, stack, code); other args are appended to `msg`.
 * Everything is redacted.
 */
export function formatJsonLine(level: LogLevel, msg: string, args: unknown[], fields: LogFields = {}, now: Date = new Date(), env: NodeJS.ProcessEnv = process.env): string {
  const extra: string[] = [];
  let err: Record<string, unknown> | undefined;
  for (const a of args) {
    if (!err && a instanceof Error) {
      const code = (a as { code?: unknown }).code;
      err = {
        name: a.name,
        message: redactSecrets(a.message, env),
        ...(a.stack ? { stack: redactSecrets(a.stack, env) } : {}),
        ...(typeof code === "string" || typeof code === "number" ? { code } : {}),
      };
    } else if (a !== undefined) {
      extra.push(redactSecrets(inspectArg(a), env));
    }
  }
  const line: Record<string, unknown> = { time: now.toISOString(), level };
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && k !== "time" && k !== "level" && k !== "msg" && k !== "err") line[k] = typeof v === "string" ? redactSecrets(v, env) : v;
  }
  line.msg = redactSecrets([msg, ...extra].join(" ").trim(), env);
  if (err) line.err = err;
  return JSON.stringify(line);
}

const COLOR: Record<LogLevel, string> = { debug: "\x1b[90m", info: "\x1b[32m", warn: "\x1b[33m", error: "\x1b[31m" };
// The logger is the one place allowed to write to the console / stdio.
const SINK: Record<LogLevel, (...a: unknown[]) => void> = {
  debug: (...a) => console.debug(...a),
  info: (...a) => console.log(...a),
  warn: (...a) => console.warn(...a),
  error: (...a) => console.error(...a),
};

function write(level: LogLevel, fields: LogFields, msg: string, args: unknown[]): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[settings.level]) return;
  if (settings.format === "json") {
    const stream = level === "warn" || level === "error" ? process.stderr : process.stdout;
    stream.write(formatJsonLine(level, msg, args, fields) + "\n");
    return;
  }
  // Fields already in the message (e.g. "[AE-7KQ2XM] ...") are not repeated.
  const tag = Object.entries(fields).filter(([, v]) => v !== undefined && !msg.includes(String(v))).map(([k, v]) => `${k}=${v}`).join(" ");
  SINK[level](
    `\x1b[36m[${new Date().toISOString()}]\x1b[0m ${COLOR[level]}[${level.toUpperCase()}]\x1b[0m ${redactSecrets(msg)}${tag ? ` \x1b[90m(${redactSecrets(tag)})\x1b[0m` : ""}`,
    ...clean(args),
  );
}

export interface Logger {
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  debug(msg: string, ...args: unknown[]): void;
  /** A logger that adds `fields` (e.g. `{ errorId }`) to every line it writes. */
  child(fields: LogFields): Logger;
}

function makeLogger(fields: LogFields): Logger {
  return {
    info: (msg, ...args) => write("info", fields, msg, args),
    warn: (msg, ...args) => write("warn", fields, msg, args),
    error: (msg, ...args) => write("error", fields, msg, args),
    debug: (msg, ...args) => write("debug", fields, msg, args),
    child: (more) => makeLogger({ ...fields, ...more }),
  };
}

export const logger: Logger = makeLogger({});
