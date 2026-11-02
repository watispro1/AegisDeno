/** Server picker: / and /refresh. */
import type { Router } from "express";
import { logger } from "../../../utils/logger";
import { fetchUserGuilds } from "../discordOAuth";
import { guildInviteUrl, partitionGuilds } from "../permissions";
import { renderLanding, renderPicker } from "../views";
import { LAST_GUILD_COOKIE, type RouteKit, type Authed } from "./context";
import { isSnowflake } from "../permissions";
import { parseCookies } from "../security";

/** Re-fetch the user's guild list on the picker when it is older than this. */
const GUILD_LIST_MAX_AGE_MS = 10 * 60 * 1000;

export function registerPickerRoutes(router: Router, k: RouteKit): void {
  const { deps, now, fetchImpl, postLimit, pageLimit, form, send, loadSession, requireSession, requireCsrf, noticeParam } = k;

  /* ── Server picker ───────────────────────────────────────────────── */

  async function refreshGuilds(authed: Authed): Promise<boolean> {
    if (authed.session.tokenExpiresAt.getTime() <= now()) return false;
    try {
      const guilds = await fetchUserGuilds(authed.session.accessToken, fetchImpl);
      await deps.sessions.updateGuilds(authed.sessionId, guilds, new Date(now()));
      authed.session.guilds = guilds;
      authed.session.guildsFetchedAt = new Date(now());
      return true;
    } catch (err) {
      logger.warn(`Dashboard: guild list refresh failed: ${(err as Error)?.message ?? "unknown error"}`);
      return false;
    }
  }

  router.get("/", pageLimit, async (req, res, next) => {
    try {
      const authed = await loadSession(req);
      if (!authed) return send(res, renderLanding(deps.site, null));
      if (now() - authed.session.guildsFetchedAt.getTime() > GUILD_LIST_MAX_AGE_MS) await refreshGuilds(authed);
      const { manageable, invitable } = partitionGuilds(authed.session.guilds, (id) => deps.bot.hasGuild(id));
      send(res, renderPicker(
        deps.site,
        authed.viewer,
        manageable,
        invitable.map(guild => ({ guild, inviteUrl: guildInviteUrl(deps.site.inviteUrl, guild.id) })),
        noticeParam(req),
        (() => { const id = parseCookies(req.headers.cookie)[LAST_GUILD_COOKIE]; return id && isSnowflake(id) ? id : null; })(),
      ));
    } catch (err) {
      next(err);
    }
  });

  router.post("/refresh", postLimit, form, requireSession, requireCsrf, async (_req, res, next) => {
    try {
      const ok = await refreshGuilds(res.locals.dash as Authed);
      res.redirect(303, `/dashboard?notice=${ok ? "refreshed" : "refresh-failed"}`);
    } catch (err) {
      next(err);
    }
  });
}
