import { PermissionsBitField, PermissionFlagsBits } from "discord.js";
import type { APIApplicationCommandOption } from "discord.js";
import { commands, COMMAND_CATEGORIES, type CommandCategory } from "../commands/loader";
import type { PermissionResolvable } from "discord.js";

export interface OptionInfo {
  name: string;
  description: string;
  required: boolean;
  type: string;
  choices: string[];
  min?: number;
  max?: number;
}

export interface SubcommandInfo {
  /** Full path, e.g. "automod words add" */
  path: string;
  name: string;
  group: string | null;
  description: string;
  options: OptionInfo[];
}

export interface CommandInfo {
  name: string;
  description: string;
  category: CommandCategory | string;
  guildOnly: boolean;
  /** Discord client permission gate from setDefaultMemberPermissions */
  declaredPermissions: string[];
  /** Runtime permission checks declared on the command object */
  enforcedPermissions: string[];
  /** Permissions the bot itself needs to run this command. */
  botPermissions: string[];
  subcommands: SubcommandInfo[];
  options: OptionInfo[];
}

/** Discord application command option type enum -> human label. */
const OPTION_TYPES: Record<number, string> = {
  1: "Subcommand",
  2: "Subcommand group",
  3: "Text",
  4: "Integer",
  5: "Boolean",
  6: "User",
  7: "Channel",
  8: "Role",
  9: "Mentionable",
  10: "Number",
  11: "Attachment",
  12: "Poll",
};

/** Short label for how a value is entered in the Discord client. */
const TYPE_HINT: Record<number, string> = {
  3: "text",
  4: "number",
  5: "true / false",
  6: "user",
  7: "channel",
  8: "role",
  9: "user or role",
  10: "number",
  11: "attachment",
};

const SUBCOMMAND = 1;
const SUBCOMMAND_GROUP = 2;

function isOption(value: APIApplicationCommandOption): boolean {
  return typeof value === "object" && value !== null && "name" in value;
}

function nameOf(opt: APIApplicationCommandOption): string {
  return isOption(opt) ? opt.name : "";
}

function optionsOf(opt: APIApplicationCommandOption): APIApplicationCommandOption[] {
  return isOption(opt) && "options" in opt && Array.isArray(opt.options) ? opt.options : [];
}

function descriptionOf(opt: APIApplicationCommandOption): string {
  return isOption(opt) && "description" in opt && typeof opt.description === "string"
    ? opt.description
    : "";
}

function requiredOf(opt: APIApplicationCommandOption): boolean {
  return isOption(opt) && "required" in opt && opt.required === true;
}

function typeOf(opt: APIApplicationCommandOption): number {
  return isOption(opt) && "type" in opt && typeof opt.type === "number" ? opt.type : 0;
}

interface ParsedOptions {
  /** Options that sit directly on the command. */
  options: OptionInfo[];
  /** Subcommands declared at the top level of the command. */
  subs: APIApplicationCommandOption[];
  /** Subcommand groups, each with their own subcommands. */
  groups: { name: string; description: string; subcommands: APIApplicationCommandOption[] }[];
}

function parseOptions(rawOptions: readonly APIApplicationCommandOption[] | undefined): ParsedOptions {
  const options: OptionInfo[] = [];
  const subs: APIApplicationCommandOption[] = [];
  const groups: ParsedOptions["groups"] = [];

  for (const opt of rawOptions ?? []) {
    const type = typeOf(opt);
    if (type === SUBCOMMAND_GROUP) {
      groups.push({
        name: nameOf(opt),
        description: descriptionOf(opt),
        subcommands: optionsOf(opt),
      });
    } else if (type === SUBCOMMAND) {
      subs.push(opt);
    } else {
      options.push(toOptionInfo(opt));
    }
  }

  return { options, groups, subs };
}

function toOptionInfo(opt: APIApplicationCommandOption): OptionInfo {
  const type = typeOf(opt);
  const raw = (opt ?? {}) as Partial<Record<"min_value" | "max_value", unknown>>;

  const choices =
    "choices" in opt && Array.isArray(opt.choices)
      ? opt.choices.map(c =>
          typeof c === "object" && c !== null && "name" in c ? String(c.name) : String(c)
        )
      : [];

  const info: OptionInfo = {
    name: nameOf(opt),
    description: descriptionOf(opt),
    required: requiredOf(opt),
    type: TYPE_HINT[type] ?? OPTION_TYPES[type] ?? "Any",
    choices,
  };

  if (typeof raw.min_value === "number") info.min = raw.min_value;
  if (typeof raw.max_value === "number") info.max = raw.max_value;

  return info;
}

function toSubcommandInfo(sub: APIApplicationCommandOption, group: string | null): SubcommandInfo {
  return {
    path: group ? `${group} ${nameOf(sub)}` : nameOf(sub),
    name: nameOf(sub),
    group,
    description: descriptionOf(sub),
    options: optionsOf(sub)
      .filter(o => typeOf(o) !== SUBCOMMAND && typeOf(o) !== SUBCOMMAND_GROUP)
      .map(toOptionInfo),
  };
}

function permissionLabels(bitfield: unknown): string[] {
  if (bitfield === null || bitfield === undefined || bitfield === "0") return [];
  try {
    return [...new PermissionsBitField(bitfield as PermissionResolvable)];
  } catch {
    return [];
  }
}

function permissionLabel(flag: string): string {
  return flag
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, c => c.toUpperCase());
}

function normalise(flags: string[]): string[] {
  return [...new Set(flags.map(permissionLabel))].sort();
}

function enforcedLabels(perms: readonly PermissionResolvable[] | undefined): string[] {
  const out: string[] = [];
  for (const p of perms ?? []) out.push(...permissionLabels(p));
  return normalise(out);
}

/**
 * Shape of a command's serialised builder payload. The builder union has no
 * single shared JSON return type, so this is the one documented cast boundary.
 */
interface CommandJson {
  name?: string;
  description?: string;
  default_member_permissions?: string | null;
  options?: APIApplicationCommandOption[];
}

let cache: CommandInfo[] | null = null;
let index = new Map<string, CommandInfo>();

/** Build the full command catalog from the live command registry. */
export function buildCatalog(): CommandInfo[] {
  if (cache) return cache;

  const list: CommandInfo[] = [];

  for (const cmd of commands.values()) {
    const builder = cmd.data as unknown as { toJSON?: () => unknown };
    const json: CommandJson =
      typeof builder?.toJSON === "function"
        ? (builder.toJSON() as CommandJson)
        : (cmd.data as unknown as CommandJson);

    const name = typeof json.name === "string" ? json.name : "";
    if (!name) continue;

    const { options, groups, subs } = parseOptions(json.options);

    const subcommands: SubcommandInfo[] = [
      ...subs.map(s => toSubcommandInfo(s, null)),
      ...groups.flatMap(g => g.subcommands.map(s => toSubcommandInfo(s, g.name))),
    ];

    list.push({
      name,
      description: typeof json.description === "string" ? json.description : "",
      category: cmd.category ?? "general",
      guildOnly: Boolean(cmd.guildOnly),
      declaredPermissions: normalise(permissionLabels(json.default_member_permissions)),
      enforcedPermissions: enforcedLabels(cmd.userPermissions),
      botPermissions: enforcedLabels(cmd.botPermissions),
      subcommands,
      options,
    });
  }

  list.sort((a, b) => a.name.localeCompare(b.name));

  cache = list;
  index = new Map(list.map(c => [c.name, c]));
  return list;
}

export function getCommand(name: string): CommandInfo | undefined {
  buildCatalog();
  return index.get(name);
}

export interface CategoryGroup {
  category: string;
  label: string;
  icon: string;
  blurb: string;
  commands: CommandInfo[];
}

const CATEGORY_META: Record<string, { label: string; icon: string; blurb: string }> = {
  general:    { label: "General",    icon: "\u{1F310}", blurb: "Status, help, and bot information." },
  moderation: { label: "Moderation", icon: "\u{1F528}", blurb: "Enforce rules and punish violations." },
  config:     { label: "Config",     icon: "⚙️", blurb: "Review and change server settings." },
  logging:    { label: "Logging",    icon: "\u{1F4CB}", blurb: "Route events to an audit channel." },
  automod:    { label: "Automod",    icon: "\u{1F6E1}️", blurb: "Filter content automatically." },
  welcome:    { label: "Welcome",    icon: "\u{1F44B}", blurb: "Greet new members on arrival." },
  community:  { label: "Community",  icon: "\u{1F5F3}️", blurb: "Polls, announcements, and suggestions." },
  automation: { label: "Automation", icon: "⏰", blurb: "Scheduled messages and reminders." },
  developer:  { label: "Developer",  icon: "\u{1F527}", blurb: "Diagnostics for bot operators." },
};

export function groupByCategory(list: CommandInfo[] = buildCatalog()): CategoryGroup[] {
  return COMMAND_CATEGORIES.map(cat => {
    const meta = CATEGORY_META[cat] ?? { label: cat, icon: "•", blurb: "" };
    return {
      category: cat,
      label: meta.label,
      icon: meta.icon,
      blurb: meta.blurb,
      commands: list.filter(c => c.category === cat),
    };
  }).filter(g => g.commands.length > 0);
}

/** Every distinct permission Aegis needs, for the docs reference table. */
export function permissionMatrix(): {
  permission: string;
  flag: bigint;
  commands: string[];
}[] {
  const used = new Map<string, { flag: bigint; commands: string[] }>();

  const add = (flag: string, command: string) => {
    const bit = (PermissionFlagsBits as unknown as Record<string, bigint | undefined>)[flag];
    if (bit === undefined) return;
    const key = permissionLabel(flag);
    const entry = used.get(key) ?? { flag: bit, commands: [] };
    entry.commands.push(command);
    used.set(key, entry);
  };

  for (const cmd of commands.values()) {
    for (const p of cmd.userPermissions ?? []) {
      for (const flag of permissionLabels(p)) add(flag, `/${cmd.data.name}`);
    }
  }

  return [...used.entries()]
    .map(([permission, v]) => ({ permission, flag: v.flag, commands: v.commands }))
    .sort((a, b) => a.permission.localeCompare(b.permission));
}

/**
 * Bitfield of every permission the bot needs at runtime, excluding
 * Administrator. Used to build the OAuth2 invite URL so the invite screen
 * asks for exactly what the command set requires.
 */
export function botPermissionBitfield(): bigint {
  let bits = 0n;

  for (const cmd of commands.values()) {
    for (const p of cmd.botPermissions ?? []) {
      try {
        bits |= new PermissionsBitField(p as PermissionResolvable).bitfield;
      } catch {
        /* ignore unresolvable permissions */
      }
    }
  }

  // Implicitly required to read and post in the channels Aegis is pointed at.
  bits |=
    PermissionFlagsBits.ViewChannel |
    PermissionFlagsBits.SendMessages |
    PermissionFlagsBits.ReadMessageHistory |
    PermissionFlagsBits.EmbedLinks;

  // Administrator must never be requested on the invite screen.
  bits &= ~PermissionFlagsBits.Administrator;

  return bits;
}

export function catalogStats(): {
  commands: number;
  subcommands: number;
  options: number;
  categories: number;
  permissions: number;
} {
  const list = buildCatalog();
  return {
    commands: list.length,
    subcommands: list.reduce((acc, c) => acc + c.subcommands.length, 0),
    options: list.reduce(
      (acc, c) =>
        acc +
        c.options.length +
        c.subcommands.reduce((s, sc) => s + sc.options.length, 0),
      0
    ),
    categories: groupByCategory(list).length,
    permissions: permissionMatrix().length,
  };
}
