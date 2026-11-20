/**
 * The bot's environment, declared in one place and checked once at startup.
 *
 * `validateEnv()` reads every variable in ENV_SCHEMA, collects *every* problem
 * (missing or malformed) and throws one EnvValidationError that lists them all,
 * so a bad deploy shows the whole list in one log line instead of failing one
 * variable per restart. It never exits the process: main()'s catch logs the
 * error and exits.
 *
 * Hand-rolled on purpose (no zod): the rules are few, and a schema library
 * would be a new runtime dependency for ~100 lines of checks.
 *
 * A `.env` file is loaded only outside production (NODE_ENV !== "production").
 * In production (the Docker image sets NODE_ENV=production) Fly secrets are the
 * only source, so a stray `.env` baked into an image can never override them.
 */
import * as dotenv from "dotenv";
import { missingStripeSettings, webCheckoutEnabled } from "./stripe";
import { MIN_SESSION_SECRET_LENGTH } from "../web/dashboard/config";

type Env = Record<string, string | undefined>;

/** Load `.env` into process.env unless NODE_ENV is production. Returns whether it was attempted. */
export function loadDotenv(env: Env = process.env): boolean {
  if (env.NODE_ENV === "production") return false;
  dotenv.config({ quiet: true });
  return true;
}

loadDotenv();

/**
 * Used only when neither BOT_OWNER_IDS nor DISCORD_OWNER_ID is set, so an
 * existing deploy keeps its owner after upgrading. Documented in .env.example
 * and DEPLOYMENT.md; set BOT_OWNER_IDS to replace it.
 */
export const DEFAULT_BOT_OWNER_ID = "1320058519642177668";

const SNOWFLAKE = /^\d{17,20}$/;

function clean(v: string | undefined): string {
  return (v ?? "").trim();
}

function splitList(v: string | undefined): string[] {
  return clean(v).split(",").map(s => s.trim()).filter(Boolean);
}

/**
 * Bot owner IDs (who may run /developer and /sync): BOT_OWNER_IDS (comma list)
 * plus the legacy single DISCORD_OWNER_ID. When both are empty, DEFAULT_BOT_OWNER_ID.
 * Entries that are not Discord IDs are ignored here; validateEnv() reports them.
 */
export function parseOwnerIds(env: Env = process.env): Set<string> {
  const ids = [...splitList(env.BOT_OWNER_IDS), clean(env.DISCORD_OWNER_ID)].filter(id => SNOWFLAKE.test(id));
  return new Set(ids.length ? ids : [DEFAULT_BOT_OWNER_ID]);
}

export const BOT_OWNER_IDS: ReadonlySet<string> = parseOwnerIds();

function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** True when BOT_ENV (else NODE_ENV) says development or test; same rule AegisDB uses. */
function isDev(env: Env): boolean {
  const mode = env.BOT_ENV || env.NODE_ENV || "";
  return mode === "development" || mode === "test";
}

/** The web dashboard is opted into by setting its OAuth client secret. */
export function dashboardEnabled(env: Env): boolean {
  return Boolean(clean(env.DISCORD_CLIENT_SECRET));
}

/**
 * Premium sales through Stripe are on only when web checkout is switched on in
 * code (WEB_CHECKOUT_ENABLED, false today: Premium is sold only through Discord)
 * and a checkout setting is present. Then a partial set is a misconfiguration.
 * With web checkout off, leftover STRIPE_* secrets are never fatal: they only
 * keep earlier Stripe subscribers' webhook and billing portal working.
 */
export function stripeSalesEnabled(env: Env, checkoutOn: boolean = webCheckoutEnabled()): boolean {
  if (!checkoutOn) return false;
  return Boolean(clean(env.STRIPE_SECRET_KEY) || clean(env.STRIPE_PUBLISHABLE_KEY) || clean(env.STRIPE_PRICE_ID));
}

export interface EnvRule {
  name: string;
  /** Who needs it, shown in the error. */
  description: string;
  /** Required always (true) or only when this returns true. Omit for optional. */
  required?: true | ((env: Env) => boolean);
  /** Return an error string for a present value that is invalid. */
  check?: (value: string, env: Env) => string | null;
}

const oneOf = (...allowed: string[]) => (v: string) =>
  allowed.includes(v.toLowerCase()) ? null : `must be one of ${allowed.join(", ")}`;

/** Every variable the bot validates at startup. Optional ones are checked only when set. */
export const ENV_SCHEMA: readonly EnvRule[] = [
  { name: "DISCORD_TOKEN", description: "bot token", required: true },
  { name: "DISCORD_APPLICATION_ID", description: "application (client) ID", required: true, check: v => (SNOWFLAKE.test(v) ? null : "must be a Discord ID") },
  { name: "MONGO_URI", description: "MongoDB connection string", required: true, check: v => (/^mongodb(\+srv)?:\/\//.test(v) ? null : "must start with mongodb:// or mongodb+srv://") },
  {
    name: "AEGIS_BACKEND_SECRET",
    description: "AegisDB shared secret (required outside development; AegisDB refuses to start without it)",
    required: env => !isDev(env),
  },
  {
    name: "DASHBOARD_SESSION_SECRET",
    description: "dashboard session secret (required when DISCORD_CLIENT_SECRET turns the dashboard on)",
    required: dashboardEnabled,
    check: v => (v.length >= MIN_SESSION_SECRET_LENGTH ? null : `must be at least ${MIN_SESSION_SECRET_LENGTH} characters`),
  },
  { name: "DASHBOARD_REDIRECT_URI", description: "dashboard OAuth redirect", check: v => (isHttpUrl(v) ? null : "must be an http(s) URL") },
  {
    name: "SITE_URL",
    description: "public site origin (required when Stripe premium sales are on, for checkout return URLs)",
    required: env => stripeSalesEnabled(env),
    check: v => (isHttpUrl(v) ? null : "must be an http(s) URL"),
  },
  { name: "DISCORD_PREMIUM_SKU_ID", description: "Discord premium SKU", check: v => (SNOWFLAKE.test(v) ? null : "must be a Discord SKU ID") },
  { name: "DISCORD_TEST_GUILD_ID", description: "test guild", check: v => (SNOWFLAKE.test(v) ? null : "must be a Discord ID") },
  { name: "BOT_OWNER_IDS", description: "bot owner IDs", check: v => (splitList(v).every(id => SNOWFLAKE.test(id)) ? null : "must be a comma-separated list of Discord IDs") },
  { name: "DISCORD_OWNER_ID", description: "legacy single bot owner ID", check: v => (SNOWFLAKE.test(v) ? null : "must be a Discord ID") },
  { name: "PORT", description: "web server port", check: v => (/^\d+$/.test(v) && Number(v) > 0 && Number(v) < 65536 ? null : "must be a port number") },
  { name: "LOG_LEVEL", description: "log level", check: oneOf("debug", "info", "warn", "error") },
  { name: "LOG_FORMAT", description: "log format", check: oneOf("json", "pretty") },
];

export class EnvValidationError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid environment (${problems.length} problem${problems.length === 1 ? "" : "s"}): ${problems.join("; ")}`);
    this.name = "EnvValidationError";
  }
}

/** Every problem with `env`, as "NAME (reason)" strings. Never includes values. */
export function envProblems(env: Env = process.env, schema: readonly EnvRule[] = ENV_SCHEMA): string[] {
  const problems: string[] = [];
  for (const rule of schema) {
    const value = clean(env[rule.name]);
    const required = rule.required === true || (typeof rule.required === "function" && rule.required(env));
    if (!value) {
      if (required) problems.push(`${rule.name} (missing: ${rule.description})`);
      continue;
    }
    const err = rule.check?.(value, env);
    if (err) problems.push(`${rule.name} (${err})`);
  }
  // Stripe: the four values must be complete and consistent once sales are on.
  if (stripeSalesEnabled(env)) {
    problems.push(...missingStripeSettings(env).map(p => `${p} [Stripe premium sales are on]`));
    const sk = clean(env.STRIPE_SECRET_KEY);
    const pk = clean(env.STRIPE_PUBLISHABLE_KEY);
    if (sk && pk && sk.startsWith("sk_live_") !== pk.startsWith("pk_live_")) {
      problems.push("STRIPE_PUBLISHABLE_KEY (live/test mode does not match STRIPE_SECRET_KEY)");
    }
  }
  return problems;
}

export interface BotEnv {
  DISCORD_TOKEN: string;
  DISCORD_APPLICATION_ID: string;
  DISCORD_TEST_GUILD_ID: string;
  MONGO_URI: string;
  BOT_ENV: string;
  BOT_OWNER_IDS: ReadonlySet<string>;
  dashboardEnabled: boolean;
  stripeSalesEnabled: boolean;
}

/** Validate the environment; throws EnvValidationError listing every problem. */
export function validateEnv(env: Env = process.env): BotEnv {
  const problems = envProblems(env);
  if (problems.length) throw new EnvValidationError(problems);
  return {
    DISCORD_TOKEN: clean(env.DISCORD_TOKEN),
    DISCORD_APPLICATION_ID: clean(env.DISCORD_APPLICATION_ID),
    DISCORD_TEST_GUILD_ID: clean(env.DISCORD_TEST_GUILD_ID),
    MONGO_URI: clean(env.MONGO_URI),
    BOT_ENV: clean(env.BOT_ENV) || "development",
    BOT_OWNER_IDS: parseOwnerIds(env),
    dashboardEnabled: dashboardEnabled(env),
    stripeSalesEnabled: stripeSalesEnabled(env),
  };
}
