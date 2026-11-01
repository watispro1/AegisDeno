/**
 * Worked examples for the /commands page.
 *
 * Hand-written examples are checked against the live command definitions
 * (command, subcommand, option names, required options and choice names) by
 * `checkExample()`; the page drops any that stop matching and the tests fail,
 * so the page never shows a command line that Discord would reject. Commands
 * without hand-written examples get one generated from their definition.
 */
import type { CommandInfo, OptionInfo, SubcommandInfo } from "./catalog";

export const CURATED_EXAMPLES: Record<string, string[]> = {
  ban: [
    "/ban user:@member reason:Raid account delete_messages:1",
    "/ban user:@member preset:Compromised Account / Raid Bot silent:true",
    "/ban user:@member reason:Cooling off duration:7d",
  ],
  kick: ["/kick user:@member reason:Alt account"],
  timeout: [
    "/timeout user:@member duration:1 hour reason:Arguing with staff",
    "/timeout user:@member duration:10 minutes preset:Excessive Spamming / Chat Flooding",
    "/timeout user:@member custom_duration:1d 12h reason:Repeated spam",
  ],
  warn: ["/warn user:@member reason:Spam in #general severity:Low"],
  unban: ["/unban user_id:123456789012345678 reason:Appeal approved"],
  warnings: ["/warnings user:@member", "/warnings user:@member ephemeral:false"],
  clearwarnings: ["/clearwarnings user:@member"],
  case: [
    "/case user user:@member",
    "/case view case_id:65f0c0ffee0000000000abcd",
    "/case edit case_id:65f0c0ffee0000000000abcd reason:Updated reason",
  ],
  infractions: ["/infractions user:@member"],
  modhistory: ["/modhistory user:@member filter:Bans"],
  nickname: ["/nickname user:@member name:Sam reason:Impersonation"],
  serverinfo: ["/serverinfo ephemeral:true"],
  note: ["/note add user:@member", "/note view user:@member", "/note delete id:65a1b2c3d4e5f60718293a4b"],
  escalation: [
    "/escalation add warnings:3 action:Timeout duration:60",
    "/escalation add warnings:5 action:Ban",
    "/escalation expiry days:30",
    "/escalation toggle enabled:true",
  ],
  purge: [
    "/purge amount:50 filter:Bot messages only",
    "/purge amount:200 filter:Messages with links user:@member",
  ],
  lock: [
    "/lock channel channel:#general duration_minutes:15 message:Back in 15 minutes",
    "/lock category category:Events duration_minutes:30",
    "/lock channel channel:#announcements duration:2d reason:Raid cleanup",
    "/lock unlock channel:#general",
  ],
  slowmode: ["/slowmode set duration:10 seconds", "/slowmode custom seconds:45 channel:#general"],
  trustscore: ["/trustscore user:@member"],
  modmail: [
    "/modmail setup channel:#modmail role:@Staff ping_staff:true",
    "/modmail reply message:Thanks, we're looking into it anonymous:true",
    "/modmail close reason:Resolved",
    "/modmail snippet add name:rules content:Please read #rules first.",
    "/modmail snippet use name:rules",
    "/modmail block user:@member",
  ],
  trust: ["/trust user user:@member", "/trust config enabled:true preset:balanced threshold:30"],
  appeal: [
    "/appeal submit code:AGS-K7X2",
    "/appeal list status:Pending",
    "/appeal review code:AGS-K7X2 decision:Approve note:Account secured",
  ],
  watchlist: [
    "/watchlist add user:@member duration:7 Days events:All Events reason:Alt of a banned user",
    "/watchlist add user:@member events:First Message of the Day + Voice Joins alert_channel:#mod-alerts",
    "/watchlist info user:@member",
  ],
  modreport: ["/modreport period:Last 24 Hours", "/modreport period:Last 7 Days ephemeral:false"],
  modstats: ["/modstats period:Last 30 days"],
  automod: [
    "/automod status",
    "/automod exempt addrole role:@Staff",
    "/automod words add word:free nitro",
    "/automod words action action:Delete and warn",
    "/automod mentions limit count:5",
    "/automod spam limit max:6 window:5",
  ],
  logging: ["/logging channel channel:#mod-log", "/logging test"],
  config: ["/config view", "/config logging channel:#mod-log enabled:true"],
  preset: ["/preset view type:Gaming Hub", "/preset apply type:Standard Community"],
  ticket: [
    "/ticket setup channel:#support staff_role:@Staff",
    "/ticket add user:@member",
    "/ticket close reason:Solved",
    "/ticket settings log_channel:#ticket-logs autoclose_hours:48",
  ],
  verify: [
    "/verify setup channel:#verify verified_role:@Member type:One-Click Button",
    "/verify setup channel:#verify verified_role:@Member type:CAPTCHA Verification kick_unverified_minutes:30",
    "/verify user target:@member",
  ],
  starboard: [
    "/starboard setup channel:#starboard",
    "/starboard threshold count:5",
    "/starboard ignore action:add channel:#staff",
  ],
  giveaway: [
    "/giveaway start prize:Nitro duration:24h winners:1 booster_multiplier:2",
    "/giveaway end message_id:https://discord.com/channels/123456789012345678/123456789012345679/123456789012345680",
    "/giveaway reroll message_id:123456789012345678",
  ],
  poll: [
    "/poll question:Next game night? option1:Friday option2:Saturday duration:24 Hours (1 Day) multiselect:true",
  ],
  suggest: ["/suggest setup channel:#suggestions", "/suggest approve id:5d0c8a1e-7b3f-4c2e-9a61-2f4b8e9d1c70 reason:Doing it"],
  welcome: ["/welcome channel channel:#welcome", "/welcome message", "/welcome preview"],
  rolepanel: [
    "/rolepanel create channel:#roles role1:@Events role2:@Updates",
    "/rolepanel create channel:#colors role1:@Red role2:@Blue style:Dropdown menu exclusive:true required_role:@Member",
  ],
  remindme: [
    "/remindme set reminder:Review appeals duration:2h",
    "/remindme set reminder:Stand-up notes duration:1d repeat:Daily",
  ],
  automation: [
    "/automation message in:1d channel:#announcements message:Event starts in an hour",
    "/automation repeat interval:7d channel:#general message:Weekly thread is up",
  ],
  autoresponder: [
    "/autoresponder add trigger:how do i verify response:Read the pinned message in {channel} match_type:Contains Keyword",
    "/autoresponder toggle id:ar-1a2b enabled:False",
    "/autoresponder list",
  ],
  announce: ["/announce channel:#announcements message:Server maintenance at 9pm title:Heads up ping:@here"],
  help: ["/help command:ban"],
  userinfo: ["/userinfo user:@member"],
};

export interface ParsedExample {
  command: string;
  path: string;
  options: [string, string][];
}

/** Split "/automod words add word:free nitro" into command, subcommand path and options. */
export function parseExample(example: string): ParsedExample | null {
  const m = example.trim().match(/^\/([\w-]+)((?:\s+[\w-]+)*?)((?:\s+[\w]+:.*)?)$/);
  if (!m) return null;
  const path = m[2].trim().split(/\s+/).filter(Boolean).join(" ");
  const options: [string, string][] = [];
  const rest = m[3].trim();
  if (rest) {
    for (const part of rest.split(/\s+(?=[a-z0-9_]+:)/)) {
      const i = part.indexOf(":");
      if (i <= 0) return null;
      options.push([part.slice(0, i), part.slice(i + 1).trim()]);
    }
  }
  return { command: m[1], path, options };
}

/** What a member types to pick a choice: the name without a leading emoji or a trailing "— explanation". */
export function choiceKeyword(name: string): string {
  return name
    .replace(/^[^\p{L}\p{N}@#]+/u, "")
    .split(" — ")[0]
    .trim();
}

function optionsFor(cmd: CommandInfo, path: string): { sub: SubcommandInfo | null; options: OptionInfo[] } | null {
  if (cmd.subcommands.length === 0) return path ? null : { sub: null, options: cmd.options };
  const sub = cmd.subcommands.find((s) => s.path === path);
  return sub ? { sub, options: sub.options } : null;
}

/** Null when the example matches the definitions, otherwise why it does not. */
export function checkExample(example: string, catalog: CommandInfo[]): string | null {
  const parsed = parseExample(example);
  if (!parsed) return "cannot parse";
  const cmd = catalog.find((c) => c.name === parsed.command);
  if (!cmd) return `no command /${parsed.command}`;
  const target = optionsFor(cmd, parsed.path);
  if (!target) return `no subcommand "${parsed.path}" on /${cmd.name}`;
  const given = new Map(parsed.options);
  if (given.size !== parsed.options.length) return "an option is repeated";
  for (const [name, value] of parsed.options) {
    const opt = target.options.find((o) => o.name === name);
    if (!opt) return `no option "${name}"`;
    if (!value) return `option "${name}" has no value`;
    if (opt.choices.length && !opt.choices.some((c) => c === value || choiceKeyword(c) === value)) {
      return `"${value}" is not a choice for ${name}`;
    }
    if (opt.maxLength !== undefined && value.length > opt.maxLength) return `"${name}" is too long`;
  }
  for (const opt of target.options) {
    if (opt.required && !given.has(opt.name)) return `missing required option "${opt.name}"`;
  }
  return null;
}

function sampleValue(o: OptionInfo): string {
  if (o.choices.length) return choiceKeyword(o.choices[0]);
  switch (o.type) {
    case "user": return "@member";
    case "user or role": return "@member";
    case "channel": return "#channel";
    case "role": return "@role";
    case "true / false": return "true";
    case "number": return String(o.min ?? 1);
    case "attachment": return "screenshot.png";
    default: return o.name.replace(/_/g, " ");
  }
}

/** One example per subcommand (or one for the command): every required option, filled in. */
export function generatedExamples(cmd: CommandInfo): string[] {
  const line = (path: string, options: OptionInfo[]) =>
    [`/${cmd.name}${path ? ` ${path}` : ""}`, ...options.filter((o) => o.required).map((o) => `${o.name}:${sampleValue(o)}`)].join(" ");
  return cmd.subcommands.length
    ? cmd.subcommands.slice(0, 4).map((s) => line(s.path, s.options))
    : [line("", cmd.options)];
}

/** The examples shown for a command: hand-written ones that still match, else generated ones. */
export function examplesFor(cmd: CommandInfo, catalog: CommandInfo[]): string[] {
  const curated = (CURATED_EXAMPLES[cmd.name] ?? []).filter((e) => checkExample(e, catalog) === null);
  return curated.length ? curated : generatedExamples(cmd);
}

/** Examples that belong to one subcommand (for the per-subcommand blocks). */
export function examplesForPath(examples: string[], cmdName: string, path: string): string[] {
  return examples.filter((e) => {
    const p = parseExample(e);
    return p !== null && p.command === cmdName && p.path === path;
  });
}
