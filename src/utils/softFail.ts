/**
 * Rejection handler for Discord writes whose failure should not stop the
 * caller (a DM, a welcome post, a relay). It logs what failed and why, then
 * resolves to null, so `.catch(softFail("..."))` replaces a bare
 * `.catch(() => null)` without changing control flow.
 */
import { logger } from "./logger";

/** Discord error codes that are routine and only logged at debug level. */
export const EXPECTED_DISCORD_CODES: ReadonlySet<number> = new Set([
  10003, // Unknown Channel
  10007, // Unknown Member
  10008, // Unknown Message
  10013, // Unknown User
  50007, // Cannot send messages to this user (DMs closed)
]);

export type SoftFailLevel = "debug" | "warn";

export function describeError(err: unknown): { code: number | null; text: string } {
  if (err && typeof err === "object") {
    const code = "code" in err && typeof (err as { code: unknown }).code === "number" ? (err as { code: number }).code : null;
    const message = "message" in err ? String((err as { message: unknown }).message) : String(err);
    return { code, text: code === null ? message : `${message} (code ${code})` };
  }
  return { code: null, text: String(err) };
}

export function softFail(context: string, level: SoftFailLevel = "warn"): (err: unknown) => null {
  return (err: unknown) => {
    const { code, text } = describeError(err);
    const routine = level === "debug" || (code !== null && EXPECTED_DISCORD_CODES.has(code));
    (routine ? logger.debug : logger.warn)(`${context} failed: ${text}`);
    return null;
  };
}
