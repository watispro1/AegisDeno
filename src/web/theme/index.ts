/**
 * Stylesheet for the Aegis site, served from /assets/site.css.
 *
 * The look is deliberately plain: one paper-coloured background, one teal
 * accent, the system sans-serif for text and the system monospace for anything
 * you would type into Discord (IBM Plex is used if it is installed locally; no
 * web fonts are downloaded). Thin borders instead of shadows, 4px corners, no gradients,
 * no blur, no scroll animations. Light is the default; Dark, Steel & Ink,
 * Glass (glass.ts and glassDashboard.ts: the one theme with blur and a
 * drifting background) and Aurora (beta, aurora.ts: a light theme on a still
 * dawn wash) are opt-in via the theme picker in the header (themes.ts) and
 * the choice is remembered in localStorage. The signed-in dashboard's app
 * shell, surfaces and overview are dashboardShell.ts, dashboardSurfaces.ts
 * and dashboardOverview.ts.
 */
import { cssBase } from "./base";
import { cssChrome } from "./chrome";
import { cssPages } from "./pages";
import { cssChangelog } from "./changelog";
import { cssSite } from "./site";
import { cssDashboard } from "./dashboard";
import { cssDashboardApp } from "./dashboardApp";
import { cssResponsive } from "./responsive";
import { cssStatus } from "./status";
import { cssDashboardExtras } from "./dashboardExtras";
import { cssDashboardCommunity } from "./dashboardCommunity";
import { cssDashboardRedesign } from "./dashboardRedesign";
import { cssDashboardModules } from "./dashboardModules";
import { cssDashboardModulePages } from "./dashboardModulePages";
import { cssDashboardTrustPages } from "./dashboardTrustPages";
import { cssDashboardCommunityPages } from "./dashboardCommunityPages";
import { cssThemeTokens, cssThemeSurfaces } from "./themes";
import { cssGlass } from "./glass";
import { cssGlassDashboard } from "./glassDashboard";
import { cssShowcase } from "./showcase";
import { cssDashboardRefresh } from "./dashboardRefresh";
import { cssSiteRefresh } from "./siteRefresh";
import { cssPremium } from "./premium";
import { cssDashboardShell } from "./dashboardShell";
import { cssDashboardSurfaces } from "./dashboardSurfaces";
import { cssDashboardOverview } from "./dashboardOverview";
import { cssAurora, cssAuroraTokens } from "./aurora";

/* Concatenated in this order; later rules override earlier ones. */
export const styles =
  cssBase +
  cssThemeTokens +
  cssAuroraTokens +
  cssChrome +
  cssPages +
  cssChangelog +
  cssSite +
  cssDashboard +
  cssDashboardApp +
  cssStatus +
  cssDashboardExtras +
  cssDashboardCommunity +
  cssDashboardRedesign +
  cssDashboardModules +
  cssDashboardModulePages +
  cssDashboardTrustPages +
  cssDashboardCommunityPages +
  cssShowcase +
  cssPremium +
  cssSiteRefresh +
  cssDashboardRefresh +
  cssDashboardShell +
  cssDashboardSurfaces +
  cssDashboardOverview +
  cssThemeSurfaces +
  cssGlass +
  cssGlassDashboard +
  cssAurora +
  cssResponsive;
