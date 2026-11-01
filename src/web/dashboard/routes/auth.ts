/** Sign-in: /login, /callback and /logout. */
import type { Router } from "express";
import { logger } from "../../../utils/logger";
import { authorizeUrl, exchangeCode, fetchUser, fetchUserGuilds, revokeToken } from "../discordOAuth";
import { SESSION_TTL_MS, STATE_TTL_MS, createOAuthState, parseCookies, randomToken, signSessionId, verifyOAuthState, verifySessionCookie } from "../security";
import { renderLanding } from "../views";
import { type RouteKit } from "./context";

export function registerAuthRoutes(router: Router, k: RouteKit): void {
  const { deps, cfg, now, fetchImpl, secret, authLimit, postLimit, form, send, cookie, names, clearLegacySession, loadSession, requireCsrf } = k;
  const STATE_COOKIE = names.state;
  const SESSION_COOKIE = names.session;

  /* ── Auth ─────────────────────────────────────────────────────────── */

  router.get("/login", authLimit, (_req, res) => {
    const { state, cookie: stateCookie } = createOAuthState(secret, now());
    res.append("Set-Cookie", cookie(STATE_COOKIE, stateCookie, STATE_TTL_MS));
    res.redirect(302, authorizeUrl(cfg, state));
  });

  router.get("/callback", authLimit, async (req, res, next) => {
    const clearState = cookie(STATE_COOKIE, "", 0);
    try {
      const cookies = parseCookies(req.headers.cookie);
      if (typeof req.query.error === "string") {
        res.append("Set-Cookie", clearState);
        return send(res, renderLanding(deps.site, "denied"), 400);
      }
      if (!verifyOAuthState(secret, cookies[STATE_COOKIE], req.query.state, now())) {
        res.append("Set-Cookie", clearState);
        return send(res, renderLanding(deps.site, "state"), 400);
      }
      const code = typeof req.query.code === "string" ? req.query.code : "";
      if (!code || code.length > 200) {
        res.append("Set-Cookie", clearState);
        return send(res, renderLanding(deps.site, "discord"), 400);
      }

      let token, user, guilds;
      try {
        token = await exchangeCode(cfg, code, fetchImpl);
        [user, guilds] = await Promise.all([fetchUser(token.accessToken, fetchImpl), fetchUserGuilds(token.accessToken, fetchImpl)]);
      } catch (err) {
        logger.warn(`Dashboard login failed: ${(err as Error)?.message ?? "unknown error"}`);
        res.append("Set-Cookie", clearState);
        return send(res, renderLanding(deps.site, "discord"), 502);
      }

      // Session rotation: whatever session this browser had (possibly one
      // planted by someone else) ends here; the new login gets a fresh ID.
      const previous = verifySessionCookie(secret, cookies[SESSION_COOKIE]);
      if (previous) await deps.sessions.destroy(previous).catch(() => undefined);

      const sessionId = randomToken(32);
      const at = now();
      await deps.sessions.create(sessionId, {
        userId: user.id,
        username: user.username,
        globalName: user.globalName,
        avatar: user.avatar ?? null,
        accessToken: token.accessToken,
        tokenExpiresAt: new Date(at + token.expiresInSeconds * 1000),
        guilds,
        guildsFetchedAt: new Date(at),
        createdAt: new Date(at),
        expiresAt: new Date(at + SESSION_TTL_MS),
      });
      logger.info(`Dashboard: user ${user.id} signed in`);
      res.append("Set-Cookie", [clearState, cookie(SESSION_COOKIE, signSessionId(secret, sessionId), SESSION_TTL_MS)]);
      if (cfg.secureCookies) res.append("Set-Cookie", clearLegacySession());
      res.redirect(302, "/dashboard");
    } catch (err) {
      next(err);
    }
  });

  router.post("/logout", postLimit, form, async (req, res, next) => {
    try {
      const authed = await loadSession(req);
      if (authed) {
        res.locals.dash = authed;
        let csrfOk = false;
        requireCsrf(req, res, () => { csrfOk = true; });
        if (!csrfOk) return;
        await deps.sessions.destroy(authed.sessionId);
        void revokeToken(cfg, authed.session.accessToken, fetchImpl);
      }
      res.append("Set-Cookie", cookie(SESSION_COOKIE, "", 0));
      if (cfg.secureCookies) res.append("Set-Cookie", clearLegacySession());
      res.redirect(303, "/dashboard");
    } catch (err) {
      next(err);
    }
  });
}
