/**
 * Permission views of the command set: which member permissions each command
 * checks, and the bot permissions the invite asks for (every command's
 * `botPermissions` and `featurePermissions`, plus the channel basics).
 */
import { PermissionsBitField, PermissionFlagsBits, type PermissionResolvable } from "discord.js";
import { commands } from "../commands/loader";
import { BOT_PERMISSION_WHY, IMPLICIT_BOT_PERMISSIONS } from "../permissions/botPermissionGuide";
import { permissionLabel } from "./catalog";

export function permissionMatrix(): {
  permission: string;
  flag: bigint;
  commands: string[];
}[] {
  const used = new Map<string, { flag: bigint; commands: string[] }>();

  const add = (flag: string, command: string) => {
    const bit = (PermissionFlagsBits as Record<string, bigint | undefined>)[flag];
    if (bit === undefined) return;

    const key = permissionLabel(flag);
    const entry = used.get(key) ?? { flag: bit, commands: [] };
    entry.commands.push(command);
    used.set(key, entry);
  };

  for (const cmd of commands.values()) {
    for (const permission of cmd.userPermissions ?? []) {
      try {
        for (const flag of new PermissionsBitField(permission as PermissionResolvable)) {
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

/**
 * Bitfield of every permission the bot needs at runtime, excluding
 * Administrator. Used to build the OAuth2 invite URL so the invite screen
 * asks for exactly what the command set requires.
 */
export function botPermissionBitfield(): bigint {
  let bits = 0n;

  for (const cmd of commands.values()) {
    for (const permission of [...(cmd.botPermissions ?? []), ...(cmd.featurePermissions ?? [])]) {
      try {
        bits |= new PermissionsBitField(permission as PermissionResolvable).bitfield;
      } catch {
        /* ignore unresolvable permissions */
      }
    }
  }

  // Implicitly required to read and post in the channels Aegis is pointed at.
  for (const flag of IMPLICIT_BOT_PERMISSIONS) bits |= flag;

  // Administrator must never be requested on the invite screen.
  bits &= ~PermissionFlagsBits.Administrator;

  return bits;
}

/**
 * Each permission in the invite bitfield, with the commands that declare it.
 * The implicit channel permissions have no commands listed.
 */
export function botPermissionRows(): { permission: string; commands: string[]; why: string }[] {
  const bits = botPermissionBitfield();
  const rows: { permission: string; commands: string[]; why: string }[] = [];
  for (const flag of new PermissionsBitField(bits).toArray()) {
    const bit = (PermissionFlagsBits as Record<string, bigint | undefined>)[flag];
    const users: string[] = [];
    for (const cmd of commands.values()) {
      const declared = new PermissionsBitField();
      for (const p of [...(cmd.botPermissions ?? []), ...(cmd.featurePermissions ?? [])]) {
        try { declared.add(p as PermissionResolvable); } catch { /* ignore unresolvable permissions */ }
      }
      if (bit !== undefined && declared.has(bit)) users.push(`/${cmd.data.name}`);
    }
    rows.push({ permission: permissionLabel(flag), commands: users.sort(), why: BOT_PERMISSION_WHY[flag] ?? "" });
  }
  return rows.sort((a, b) => a.permission.localeCompare(b.permission));
}
