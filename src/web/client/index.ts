/**
 * Client script served from /assets/site.js. Plain ES5, no dependencies.
 * Everything here is progressive: the site reads fine with it disabled.
 */
import { jsCore } from "./core";
import { jsCommands } from "./commands";
import { jsWidgets } from "./widgets";

/* The parts are fragments of ONE IIFE (opened in core, closed in widgets) and
   share its scope; they are concatenated in this order and the result is
   byte-for-byte the single script that used to live in client.ts. */
export const clientScript =
  jsCore +
  jsCommands +
  jsWidgets;
