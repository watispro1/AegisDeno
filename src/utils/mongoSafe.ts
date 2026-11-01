/**
 * Guards for values that reach MongoDB queries from outside (dashboard forms,
 * query strings, slash-command text). A query value must be a plain string,
 * number or boolean: an object such as `{ "$ne": null }` would turn an
 * equality check into an operator (NoSQL injection).
 */

/**
 * True for a key Mongo would read as an operator or a dotted path, including
 * bracket forms such as `user[$ne]` that an extended parser would nest.
 */
export function isOperatorKey(key: string): boolean {
  return key.includes("$") || key.includes(".") || key.includes("\0");
}

/**
 * Whether a parsed input (query string, form body, JSON) contains any
 * operator-looking key at any depth, or nests deeper than `maxDepth`.
 */
export function hasOperatorKeys(value: unknown, maxDepth = 4): boolean {
  const walk = (v: unknown, depth: number): boolean => {
    if (v === null || typeof v !== "object") return false;
    if (depth > maxDepth) return true;
    if (Array.isArray(v)) return v.some((item) => walk(item, depth + 1));
    for (const [k, inner] of Object.entries(v as Record<string, unknown>)) {
      if (isOperatorKey(k) || walk(inner, depth + 1)) return true;
    }
    return false;
  };
  return walk(value, 0);
}

/**
 * The value as a query-safe string, or null when it is not a string (objects,
 * arrays, numbers smuggled through JSON) or is longer than `max`.
 */
export function safeQueryString(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  if (value.length === 0 || value.length > max || value.includes("\0")) return null;
  return value;
}

/** Escape a string for use inside a Mongo `$regex` so it matches literally. */
export function escapeRegex(text: string): string {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
