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
  /** Discord client permission gate from setDefaultMemberPermissions */
  declaredPermissions: string[];
  /** Runtime permission checks declared on the command object */
  enforcedPermissions: string[];
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

function readOptions(rawOptions: any[] | undefined): {
  options: OptionInfo[];
  groups: { name: string; description: string; subcommands: any[] }[];
  subs: any[];
} {
  const options: OptionInfo[] = [];
  const groups: { name: string; description: string; subcommands: any[] }[] = [];
  const subs: any[] = [];

  for (const opt of rawOptions ?? []) {
    if (opt.type === 2) {
      groups.push({
        name: opt.name,
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

function toOptionInfo(opt: any): OptionInfo {
  const info: OptionInfo = {
    name: opt.name,
    description: opt.description ?? "",
    required: Boolean(opt.required),
    type: OPTION_TYPES[opt.type] ?? "Any",
    choices: (opt.choices ?? []).map((c: any) => c.name),
  };

  const hint = TYPE_HINT[opt.type];
  if (hint) info.type = hint;

  if (typeof opt.min_value === "number") info.min = opt.min_value;
  if (typeof opt.max_value === "number") info.max = opt.max_value;

  return info;
}

function toSubcommandInfo(sub: any, group: string | null): SubcommandInfo {
  const path = group ? `${group} ${sub.name}` : sub.name;
  return {
    path,
    name: sub.name,
    group,
    description: sub.description ?? "",
    options: (sub.options ?? [])
      .filter((o: any) => o.type !== 1 && o.type !== 2)
      .map(toOptionInfo),
  };
}

function resolvePermissions(bitfield: unknown): string[] {
  if (bitfield === null || bitfield === undefined || bitfield === "0") return [];
  try {
    return [...new PermissionsBitField(bitfield as any)];
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

/** Build the full command catalog from the live command registry. */
export function buildCatalog(): CommandInfo[] {
  if (cache) return cache;

  const list: CommandInfo[] = [];

  for (const cmd of commands.values()) {
    const json: any = typeof cmd.data?.toJSON === "function" ? cmd.data.toJSON() : cmd.data;
    if (!json?.name) continue;

    const { options, groups, subs } = readOptions(json.options);

    const subcommands: SubcommandInfo[] = [
      ...subs.map(s => toSubcommandInfo(s, null)),
      ...groups.flatMap(g => g.subcommands.map(s => toSubcommandInfo(s, g.name))),
    ];

    const declared = resolvePermissions(json.default_member_permissions);
    const enforced = (cmd.userPermissions ?? []).flatMap(p => {
      try {
        return [...new PermissionsBitField(p as any)];
      } catch {
        return [];
      }
    });

    list.push({
      name: json.name,
      description: json.description ?? "",
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
  general:    { label: "General",    icon: "🌐", blurb: "Status, help, and bot information." },
  moderation: { label: "Moderation", icon: "🔨", blurb: "Enforce rules and punish violations." },
  config:     { label: "Config",     icon: "⚙️", blurb: "Review and change server settings." },
  logging:    { label: "Logging",    icon: "📋", blurb: "Route events to an audit channel." },
  automod:    { label: "Automod",    icon: "🛡️", blurb: "Filter content automatically." },
  welcome:    { label: "Welcome",    icon: "👋", blurb: "Greet new members on arrival." },
  community:  { label: "Community",  icon: "🗳️", blurb: "Polls, announcements, and suggestions." },
  automation: { label: "Automation", icon: "⏰", blurb: "Scheduled messages and reminders." },
  developer:  { label: "Developer",  icon: "🔧", blurb: "Diagnostics for bot operators." },
};

export function groupByCategory(list: CommandInfo[] = buildCatalog()): CategoryGroup[] {
  const known = COMMAND_CATEGORIES as readonly string[];
  const order = [...known].sort(
    (a, b) => known.indexOf(a) - known.indexOf(b)
  );

  return order
    .map(cat => {
      const meta = CATEGORY_META[cat] ?? { label: cat, icon: "•", blurb: "" };
      return {
        category: cat,
        label: meta.label,
        icon: meta.icon,
        blurb: meta.blurb,
        commands: list.filter(c => c.category === cat),
      };
    })
    .filter(g => g.commands.length > 0);
}

/** Every distinct permission Aegis needs, for the docs reference table. */
export function permissionMatrix(): {
  permission: string;
  flag: bigint;
  commands: string[];
}[] {
  const used = new Map<string, { flag: bigint; commands: string[] }>();

  const add = (flag: string, command: string) => {
    const bit = (PermissionFlagsBits as any)[flag] as bigint | undefined;
    if (bit === undefined) return;
    const key = normalisePermission(flag);
    const entry = used.get(key) ?? { flag: bit, commands: [] };
    entry.commands.push(command);
    used.set(key, entry);
  };

  for (const cmd of commands.values()) {
    for (const p of cmd.userPermissions ?? []) {
      try {
        for (const flag of new PermissionsBitField(p as any)) add(flag, `/${cmd.data.name}`);
      } catch {
        /* ignore unresolvable permissions */
      }
    }
  }

  return [...used.entries()]
    .map(([permission, v]) => ({ permission, flag: v.flag, commands: v.commands }))
    .sort((a, b) => a.permission.localeCompare(b.permission));
}

export function catalogStats() {
  const list = buildCatalog();
  return {
    commands: list.length,
    subcommands: list.reduce((acc, c) => acc + c.subcommands.length, 0),
    options: list.reduce(
      (acc, c) => acc + c.options.length + c.subcommands.reduce((s, sc) => s + sc.options.length, 0),
      0
    ),
    categories: groupByCategory(list).length,
    permissions: permissionMatrix().length,
  };
}
