/**
 * Client script served from /assets/site.js. Plain ES5, no dependencies.
 * Everything here is progressive: the site reads fine with it disabled.
 */
import { jsCore } from "./core";
import { jsTheme } from "./theme";
import { jsCommands } from "./commands";
import { jsChangelog } from "./changelog";
import { jsSitePages } from "./sitePages";
import { jsWidgets } from "./widgets";

/* The parts are fragments of ONE IIFE (opened in core, closed in widgets) and
   share its scope, so the order below matters. */
export const clientScript =
  jsCore +
  jsTheme +
  jsCommands +
  jsChangelog +
  jsSitePages +
  jsWidgets;
