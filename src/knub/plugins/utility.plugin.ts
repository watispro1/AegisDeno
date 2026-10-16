import { definePlugin } from "../definePlugin";

export const GeneralPlugin = definePlugin({
  name: "general",
  description: "General server utility, diagnostics, help manuals, and personal tools",
  version: "1.0.0",
  defaultConfig: {},
});

export const ConfigPlugin = definePlugin({
  name: "config",
  description: "Guild configuration, custom prefixes, logging setup, and welcome automation",
  version: "1.0.0",
  defaultConfig: {},
});

export const AutoresponderPlugin = definePlugin({
  name: "autoresponder",
  description: "Automated trigger-and-response custom rules",
  version: "1.0.0",
  defaultConfig: {},
});
