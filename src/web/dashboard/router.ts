/**
 * Express router for /dashboard. Mounted by server.ts; all dependencies are
 * injected so tests can run it with a fake bot, in-memory sessions and a
 * mocked Discord API.
 *
 * The shared guards and helpers live in routes/context.ts and each group of
 * pages registers itself from routes/*.ts, in the order below (the order
 * matters: fixed paths such as /login must come before /:guildId).
 */
import express, { type NextFunction, type Request, type Response, type Router } from "express";
import { logger } from "../../utils/logger";
import { renderNotConfigured, type Viewer } from "./views";
import { DATABASE_RETRY_AFTER_SECONDS, createRouteKit, isDatabaseUnavailable, type DashboardDeps } from "./routes/context";
import { registerAuthRoutes } from "./routes/auth";
import { registerPickerRoutes } from "./routes/picker";
import { registerCaseRoutes } from "./routes/cases";
import { registerAppealRoutes } from "./routes/appeals";
import { registerPanelRoutes } from "./routes/panels";
import { registerActivityRoutes } from "./routes/activity";
import { registerSettingsRoutes } from "./routes/settings";

export {
  CASES_PER_PAGE,
  APPEALS_PER_PAGE,
  AUDIT_PER_PAGE,
  DASHBOARD_FORM_LIMIT,
  AUTOMOD_FORM_LIMIT,
  type DashboardDeps,
} from "./routes/context";

export function createDashboardRouter(deps: DashboardDeps): Router {
  const router = express.Router();

  // Nothing under /dashboard may be cached or indexed: pages carry per-user data.
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("Vary", "Cookie, Accept-Encoding");
    next();
  });

  const cfg = deps.config;
  if (!cfg) {
    router.get(/.*/, (_req, res) => {
      res.status(200).type("html").send(renderNotConfigured(deps.site));
    });
    router.post(/.*/, (_req, res) => {
      res.status(503).type("html").send(renderNotConfigured(deps.site));
    });
    return router;
  }

  const kit = createRouteKit(deps, cfg);
  router.use(kit.migrateLegacyCookie);
  router.use(kit.rejectOperatorInput);
  registerAuthRoutes(router, kit);
  registerPickerRoutes(router, kit);
  registerCaseRoutes(router, kit);
  registerAppealRoutes(router, kit);
  registerPanelRoutes(router, kit);
  registerActivityRoutes(router, kit);
  registerSettingsRoutes(router, kit);

  const { fail } = kit;
  // Errors inside the dashboard get a plain page; details stay in the server log.
  router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = typeof (err as { status?: unknown })?.status === "number" ? (err as { status: number }).status : 500;
    if (status === 413) return fail(res, 413, "Form too large", "That form was larger than the dashboard accepts.");
    if (status === 400) return fail(res, 400, "Bad request", "The form could not be read. Reload the page and try again.");
    if (isDatabaseUnavailable(err)) {
      logger.warn(`Dashboard: database unavailable: ${err instanceof Error ? err.message : String(err)}`);
      res.setHeader("Retry-After", String(DATABASE_RETRY_AFTER_SECONDS));
      return fail(res, 503, "Database unavailable", "Aegis couldn't reach its database just now. Nothing was changed if you were saving. Try again in a minute.", (res.locals.dash as { viewer?: Viewer } | undefined)?.viewer);
    }
    logger.error("Dashboard error:", err instanceof Error ? err.message : err);
    fail(res, 500, "Something went wrong", "The dashboard hit an error. Nothing was changed if you were saving. Try again in a moment.");
  });

  return router;
}
