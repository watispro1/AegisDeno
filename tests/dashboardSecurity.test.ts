import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RateLimiter,
  STATE_TTL_MS,
  createOAuthState,
  csrfToken,
  hashSessionId,
  originAllowed,
  parseCookies,
  randomToken,
  safeEqual,
  serializeCookie,
  signSessionId,
  verifyCsrf,
  verifyOAuthState,
  verifySessionCookie,
} from "../src/web/dashboard/security";
import { readDashboardConfig, missingDashboardSettings, DEFAULT_REDIRECT_URI } from "../src/web/dashboard/config";

const SECRET = "a".repeat(64);
const OTHER = "b".repeat(64);

test("session cookie round-trips and rejects tampering", () => {
  const sid = randomToken();
  const cookie = signSessionId(SECRET, sid);
  assert.equal(verifySessionCookie(SECRET, cookie), sid);
  assert.equal(verifySessionCookie(OTHER, cookie), null, "different secret");
  assert.equal(verifySessionCookie(SECRET, cookie.slice(0, -2) + "xx"), null, "bad signature");
  assert.equal(verifySessionCookie(SECRET, `${randomToken()}.${cookie.split(".")[1]}`), null, "swapped ID");
  assert.equal(verifySessionCookie(SECRET, sid), null, "unsigned");
  assert.equal(verifySessionCookie(SECRET, ""), null);
  assert.equal(verifySessionCookie(SECRET, undefined), null);
  assert.equal(verifySessionCookie(SECRET, "x".repeat(500)), null, "oversized");
  assert.equal(verifySessionCookie(SECRET, `bad id!.${"a".repeat(43)}`), null, "bad charset");
});

test("session IDs are random and stored hashed", () => {
  const a = randomToken();
  const b = randomToken();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.match(hashSessionId(a), /^[0-9a-f]{64}$/);
  assert.notEqual(hashSessionId(a), a);
});

test("CSRF tokens are bound to the session and secret", () => {
  const sid = randomToken();
  const token = csrfToken(SECRET, sid);
  assert.ok(verifyCsrf(SECRET, sid, token));
  assert.ok(!verifyCsrf(SECRET, randomToken(), token), "other session");
  assert.ok(!verifyCsrf(OTHER, sid, token), "other secret");
  assert.ok(!verifyCsrf(SECRET, sid, ""), "empty");
  assert.ok(!verifyCsrf(SECRET, sid, undefined), "missing");
  assert.ok(!verifyCsrf(SECRET, sid, [token]), "array");
  assert.ok(!verifyCsrf(SECRET, sid, token + "x"), "altered");
});

test("Origin check accepts our origin or none, refuses others", () => {
  assert.ok(originAllowed(undefined, "https://aegisdeno.fly.dev"));
  assert.ok(originAllowed("https://aegisdeno.fly.dev", "https://aegisdeno.fly.dev"));
  assert.ok(!originAllowed("https://evil.example", "https://aegisdeno.fly.dev"));
  assert.ok(!originAllowed("null", "https://aegisdeno.fly.dev"));
});

test("OAuth state must match, be signed, and be fresh", () => {
  const now = 1_700_000_000_000;
  const { state, cookie } = createOAuthState(SECRET, now);
  assert.ok(verifyOAuthState(SECRET, cookie, state, now + 1000));
  assert.ok(!verifyOAuthState(SECRET, cookie, state + "x", now), "wrong state");
  assert.ok(!verifyOAuthState(SECRET, cookie, state, now + STATE_TTL_MS + 1), "expired");
  assert.ok(!verifyOAuthState(OTHER, cookie, state, now), "other secret");
  assert.ok(!verifyOAuthState(SECRET, undefined, state, now), "no cookie");
  assert.ok(!verifyOAuthState(SECRET, cookie, undefined, now), "no state");
  const [s, , sig] = cookie.split(".");
  assert.ok(!verifyOAuthState(SECRET, `${s}.${now + 10 * STATE_TTL_MS}.${sig}`, state, now + STATE_TTL_MS + 1), "extended expiry");
  const other = createOAuthState(SECRET, now);
  assert.ok(!verifyOAuthState(SECRET, other.cookie, state, now), "state from another login");
});

test("cookies serialise with HttpOnly, SameSite=Lax and Secure", () => {
  const c = serializeCookie("aegis_dash", "v.a/l", { maxAgeSeconds: 60, secure: true });
  assert.match(c, /^aegis_dash=v\.a%2Fl; /);
  for (const part of ["Path=/dashboard", "Max-Age=60", "HttpOnly", "SameSite=Lax", "Secure"]) assert.ok(c.includes(part), part);
  assert.ok(!serializeCookie("x", "y", { maxAgeSeconds: 0, secure: false }).includes("Secure"));
  assert.deepEqual(parseCookies("a=1; b=x%2Fy; a=2; bad; =z"), { a: "1", b: "x/y" });
  assert.deepEqual(parseCookies(undefined), {});
});

test("safeEqual compares exactly", () => {
  assert.ok(safeEqual("abc", "abc"));
  assert.ok(!safeEqual("abc", "abd"));
  assert.ok(!safeEqual("abc", "abcd"));
});

test("rate limiter allows the limit then blocks until the window resets", () => {
  const rl = new RateLimiter(3, 60_000);
  const t = 1_000_000;
  for (let i = 0; i < 3; i++) assert.ok(rl.hit("ip", t).allowed);
  const blocked = rl.hit("ip", t + 1000);
  assert.ok(!blocked.allowed);
  assert.equal(blocked.retryAfterSeconds, 59);
  assert.ok(rl.hit("other", t).allowed, "keys are independent");
  assert.ok(rl.hit("ip", t + 60_000).allowed, "new window");
});

test("dashboard config is off unless every required value is present", () => {
  const full = { DISCORD_APPLICATION_ID: "123", DISCORD_CLIENT_SECRET: "s", DASHBOARD_SESSION_SECRET: SECRET } as NodeJS.ProcessEnv;
  const cfg = readDashboardConfig(full);
  assert.ok(cfg);
  assert.equal(cfg.redirectUri, DEFAULT_REDIRECT_URI);
  assert.equal(cfg.origin, "https://aegisdeno.fly.dev");
  assert.equal(cfg.secureCookies, true);
  assert.deepEqual(missingDashboardSettings(full), []);

  assert.equal(readDashboardConfig({ ...full, DISCORD_CLIENT_SECRET: "" }), null);
  assert.equal(readDashboardConfig({ ...full, DASHBOARD_SESSION_SECRET: "short" }), null);
  assert.equal(readDashboardConfig({ ...full, DISCORD_APPLICATION_ID: undefined }), null);
  assert.equal(readDashboardConfig({ ...full, DASHBOARD_REDIRECT_URI: "not a url" }), null);
  assert.equal(readDashboardConfig({ ...full, DASHBOARD_REDIRECT_URI: "javascript:alert(1)" }), null);

  const local = readDashboardConfig({ ...full, DASHBOARD_REDIRECT_URI: "http://localhost:3000/dashboard/callback" });
  assert.equal(local?.secureCookies, false);
  assert.equal(local?.origin, "http://localhost:3000");

  const missing = missingDashboardSettings({});
  assert.ok(missing.includes("DISCORD_CLIENT_SECRET"));
  assert.ok(missing.some(m => m.startsWith("DASHBOARD_SESSION_SECRET")));
  assert.ok(!missing.join(" ").includes(SECRET));
});
