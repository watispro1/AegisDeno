/**
 * Stylesheet for the Aegis site, served from /assets/site.css.
 *
 * The look is deliberately plain: one paper-coloured background, one teal
 * accent, the system sans-serif for text and the system monospace for anything
 * you would type into Discord (IBM Plex is used if it is installed locally; no
 * web fonts are downloaded). Thin borders instead of shadows, 4px corners, no gradients,
 * no blur, no scroll animations. Light is the default; dark is opt-in via the
 * toggle in the header and is remembered in localStorage.
 */
import { cssBase } from "./base";
import { cssChrome } from "./chrome";
import { cssPages } from "./pages";
import { cssDashboard } from "./dashboard";
import { cssDashboardApp } from "./dashboardApp";
import { cssResponsive } from "./responsive";
import { cssStatus } from "./status";

/* The parts are concatenated in this order; the result is byte-for-byte the
   single stylesheet that used to live in theme.ts. */
export const styles =
  cssBase +
  cssChrome +
  cssPages +
  cssDashboard +
  cssDashboardApp +
  cssStatus +
  cssResponsive;
