import { PermissionsBitField, PermissionFlagsBits } from "discord.js";
import { commands, COMMAND_CATEGORIES, CommandCategory } from "../commands/loader";

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
  declaredPermissions: string[];
  enforcedPermissions: string[];
  subcommands: SubcommandInfo[];
  options: OptionInfo[];
}

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

interface RawCommandOption {
  type?: number;
  name?: string;
  description?: string;
  required?: boolean;
  choices?: Array<{ name?: string }>;
  min_value?: number;
  max_value?: number;
  options?: RawCommandOption[];
}

interface RawCommandJson {
  name?: string;
  description?: string;
  default_member_permissions?: string | null;
  options?: RawCommandOption[];
}

function isRawCommandJson(value: unknown): value is RawCommandJson {
  return typeof value === "object" && value !== null;
}

function readOptions(rawOptions: RawCommandOption[] | undefined): {
  options: OptionInfo[];
  groups: { name: string; description: string; subcommands: RawCommandOption[] }[];
  subs: RawCommandOption[];
} {
  const options: OptionInfo[] = [];
  const groups: { name: string; description: string; subcommands: RawCommandOption[] }[] = [];
  const subs: RawCommandOption[] = [];

  for (const opt of rawOptions ?? []) {
    if (opt.type === 2) {
      groups.push({
        name: opt.name ?? "",
        description: opt.description ?? "",
        subcommands: opt.options ?? [],
      });
    } else if (opt.type === 1) {
      subs.push(opt);
    } else {
      options.push(toOptionInfo(opt));
    }
  }

  return { options, groups, subs };
}

function toOptionInfo(opt: RawCommandOption): OptionInfo {
  const info: OptionInfo = {
    name: opt.name ?? "",
    description: opt.description ?? "",
    required: Boolean(opt.required),
    type: OPTION_TYPES[opt.type ?? 0] ?? "Any",
    choices: (opt.choices ?? [])
      .map((choice) => choice.name)
      .filter((name): name is string => typeof name === "string"),
  };

  const hint = TYPE_HINT[opt.type ?? 0];
  if (hint) info.type = hint;

  if (typeof opt.min_value === "number") info.min = opt.min_value;
  if (typeof opt.max_value === "number") info.max = opt.max_value;

  return info;
}

function toSubcommandInfo(sub: RawCommandOption, group: string | null): SubcommandInfo {
  const name = sub.name ?? "";
  const path = group ? `${group} ${name}` : name;

  return {
    path,
    name,
    group,
    description: sub.description ?? "",
    options: (sub.options ?? [])
      .filter((option) => option.type !== 1 && option.type !== 2)
      .map(toOptionInfo),
  };
}

function resolvePermissions(bitfield: unknown): string[] {
  if (bitfield === null || bitfield === undefined || bitfield === "0") return [];

  try {
    return [...new PermissionsBitField(bitfield as bigint | string)];
  } catch {
    return [];
  }
}

function permissionLabel(flag: string): string {
  return flag
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

function normalisePermission(flag: string): string {
  return permissionLabel(flag);
}

let cache: CommandInfo[] | null = null;
let index = new Map<string, CommandInfo>();

export function buildCatalog(): CommandInfo[] {
  if (cache) return cache;

  const list: CommandInfo[] = [];

  for (const cmd of commands.values()) {
    const jsonValue: unknown =
      typeof cmd.data?.toJSON === "function" ? cmd.data.toJSON() : cmd.data;

    if (!isRawCommandJson(jsonValue) || !jsonValue.name) continue;

    const { options, groups, subs } = readOptions(jsonValue.options);

    const subcommands: SubcommandInfo[] = [
      ...subs.map((sub) => toSubcommandInfo(sub, null)),
      ...groups.flatMap((group) =>
        group.subcommands.map((sub) => toSubcommandInfo(sub, group.name)),
      ),
    ];

    const declared = resolvePermissions(jsonValue.default_member_permissions);
    const enforced = (cmd.userPermissions ?? []).flatMap((permission) => {
      try {
        return [...new PermissionsBitField(permission)];
      } catch {
        return [];
      }
    });

    list.push({
      name: jsonValue.name,
      description: jsonValue.description ?? "",
      category: cmd.category ?? "general",
      guildOnly: Boolean(cmd.guildOnly),
      declaredPermissions: [...new Set(declared.map(normalisePermission))].sort(),
      enforcedPermissions: [...new Set(enforced.map(normalisePermission))].sort(),
      subcommands,
      options,
    });
  }

  list.sort((a, b) => a.name.localeCompare(b.name));

  cache = list;
  index = new Map(list.map((command) => [command.name, command]));
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
  general: { label: "General", icon: "🌐", blurb: "Status, help, and bot information." },
  moderation: { label: "Moderation", icon: "🔨", blurb: "Enforce rules and punish violations." },
  config: { label: "Config", icon: "⚙️", blurb: "Review and change server settings." },
  logging: { label: "Logging", icon: "📋", blurb: "Route events to an audit channel." },
  automod: { label: "Automod", icon: "🛡️", blurb: "Filter content automatically." },
  welcome: { label: "Welcome", icon: "👋", blurb: "Greet new members on arrival." },
  community: { label: "Community", icon: "🗳️", blurb: "Polls, announcements, and suggestions." },
  automation: { label: "Automation", icon: "⏰", blurb: "Scheduled messages and reminders." },
  developer: { label: "Developer", icon: "🔧", blurb: "Diagnostics for bot operators." },
};

export function groupByCategory(list: CommandInfo[] = buildCatalog()): CategoryGroup[] {
  const known = COMMAND_CATEGORIES as readonly string[];
  const order = [...known].sort((a, b) => known.indexOf(a) - known.indexOf(b));

  return order
    .map((category) => {
      const meta = CATEGORY_META[category] ?? { label: category, icon: "•", blurb: "" };
      return {
        category,
        label: meta.label,
        icon: meta.icon,
        blurb: meta.blurb,
        commands: list.filter((command) => command.category === category),
      };
    })
    .filter((group) => group.commands.length > 0);
}

export function permissionMatrix(): {
  permission: string;
  flag: bigint;
  commands: string[];
}[] {
  const used = new Map<string, { flag: bigint; commands: string[] }>();

  const add = (flag: string, command: string) => {
    const bit = PermissionFlagsBits[flag as keyof typeof PermissionFlagsBits];
    if (bit === undefined) return;

    const key = normalisePermission(flag);
    const entry = used.get(key) ?? { flag: bit, commands: [] };
    entry.commands.push(command);
    used.set(key, entry);
  };

  for (const cmd of commands.values()) {
    for (const permission of cmd.userPermissions ?? []) {
      try {
        for (const flag of new PermissionsBitField(permission)) {
          add(flag, `/${cmd.data.name}`);
        }
      } catch {
        /* ignore unresolvable permissions */
      }
    }
  }

  return [...used.entries()]
    .map(([permission, value]) => ({
      permission,
      flag: value.flag,
      commands: value.commands,
    }))
    .sort((a, b) => a.permission.localeCompare(b.permission));
}

export function catalogStats() {
  const list = buildCatalog();

  return {
    commands: list.length,
    subcommands: list.reduce((total, command) => total + command.subcommands.length, 0),
    options: list.reduce(
      (total, command) =>
        total +
        command.options.length +
        command.subcommands.reduce((subTotal, subcommand) => subTotal + subcommand.options.length, 0),
      0,
    ),
    categories: groupByCategory(list).length,
    permissions: permissionMatrix().length,
  };
}
