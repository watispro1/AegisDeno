import { PermissionFlagsBits, type PermissionResolvable } from "discord.js";
import type { CommandContext, CommandFilter, CommandPostHook } from "./types";
import { logger } from "../utils/logger";

const PERMISSION_NAMES: Partial<Record<string, string>> = {
  [String(PermissionFlagsBits.Administrator)]:      "Administrator",
  [String(PermissionFlagsBits.BanMembers)]:         "Ban Members",
  [String(PermissionFlagsBits.KickMembers)]:        "Kick Members",
  [String(PermissionFlagsBits.ManageChannels)]:     "Manage Channels",
  [String(PermissionFlagsBits.ManageGuild)]:        "Manage Server",
  [String(PermissionFlagsBits.ManageMessages)]:     "Manage Messages",
  [String(PermissionFlagsBits.ManageRoles)]:        "Manage Roles",
  [String(PermissionFlagsBits.MentionEveryone)]:    "Mention @everyone",
  [String(PermissionFlagsBits.ModerateMembers)]:    "Moderate Members (Timeout)",
  [String(PermissionFlagsBits.MuteMembers)]:        "Mute Members",
  [String(PermissionFlagsBits.SendMessages)]:       "Send Messages",
  [String(PermissionFlagsBits.ViewChannel)]:        "View Channel",
  [String(PermissionFlagsBits.ViewAuditLog)]:       "View Audit Log",
  [String(PermissionFlagsBits.EmbedLinks)]:         "Embed Links",
  [String(PermissionFlagsBits.AttachFiles)]:        "Attach Files",
  [String(PermissionFlagsBits.ReadMessageHistory)]: "Read Message History",
};

export function formatPermissions(permissions: PermissionResolvable[]): string {
  return permissions
    .map((p) => PERMISSION_NAMES[String(p)] ?? String(p))
    .join(", ");
}

/** Pre-filter: Validates that guild-only commands are run within a Discord guild. */
export const guildOnlyFilter: CommandFilter = {
  name: "guildOnly",
  async execute(ctx: CommandContext) {
    if (ctx.command.guildOnly && !ctx.guildId) {
      return { ok: false, error: "❌ This command can only be used in a server." };
    }
    return { ok: true };
  },
};

/** Pre-filter: Validates that the executing member has the required Discord permissions. */
export const userPermissionsFilter: CommandFilter = {
  name: "userPermissions",
  async execute(ctx: CommandContext) {
    if (!ctx.command.userPermissions?.length) return { ok: true };

    if (!ctx.interaction.memberPermissions) {
      return { ok: false, error: "❌ Could not verify your server permissions." };
    }

    const missing = ctx.command.userPermissions.filter(
      (permission) => !ctx.interaction.memberPermissions!.has(permission),
    );

    if (missing.length > 0) {
      logger.warn(
        `Permission denied: /${ctx.interaction.commandName} by ${ctx.interaction.user.tag} ` +
          `(${ctx.userId}) in guild ${ctx.guildId ?? "DM"} — missing: ${formatPermissions(missing)}`,
      );
      return {
        ok: false,
        error: `❌ You are missing the following permission(s): **${formatPermissions(missing)}**.`,
      };
    }

    return { ok: true };
  },
};

/** Pre-filter: Validates that the bot has necessary permissions in the guild. */
export const botPermissionsFilter: CommandFilter = {
  name: "botPermissions",
  async execute(ctx: CommandContext) {
    if (!ctx.command.botPermissions?.length) return { ok: true };

    const botMember = ctx.interaction.guild?.members.me;
    if (!botMember) {
      return { ok: false, error: "❌ I couldn't verify my permissions in this server." };
    }

    const missing = ctx.command.botPermissions.filter(
      (permission) => !botMember.permissions.has(permission),
    );

    if (missing.length > 0) {
      logger.warn(
        `Bot missing permissions for /${ctx.interaction.commandName} in guild ${ctx.guildId}: ` +
          formatPermissions(missing),
      );
      return {
        ok: false,
        error:
          `❌ I am missing the following permission(s): **${formatPermissions(missing)}**. ` +
          `Please ask a server admin to grant these to my role.`,
      };
    }

    return { ok: true };
  },
};

/** Cooldown tracker: maps commandName:userId -> timestamp when next allowed. */
const cooldownCache = new Map<string, number>();
const COOLDOWN_SWEEP_INTERVAL_MS = 60_000;
let lastCooldownSweep = 0;

function sweepExpiredCooldowns(now: number): void {
  if (now - lastCooldownSweep < COOLDOWN_SWEEP_INTERVAL_MS) return;
  lastCooldownSweep = now;
  for (const [key, expiresAt] of cooldownCache) {
    if (expiresAt <= now) cooldownCache.delete(key);
  }
}

/** Pre-filter: Knub-style per-command user rate limiting */
export const cooldownFilter: CommandFilter = {
  name: "cooldown",
  async execute(ctx: CommandContext) {
    const cooldownMs = (ctx.command as any).cooldownMs ?? 1500;
    if (!cooldownMs || cooldownMs <= 0) return { ok: true };

    const key = `${ctx.interaction.commandName}:${ctx.userId}`;
    const now = Date.now();
    sweepExpiredCooldowns(now);
    const expiresAt = cooldownCache.get(key);

    if (expiresAt && now < expiresAt) {
      const waitSec = Math.ceil((expiresAt - now) / 1000);
      return {
        ok: false,
        error: `⏳ Please wait **${waitSec}s** before using \`/${ctx.interaction.commandName}\` again.`,
      };
    }

    // Reserve before command execution so concurrent interactions cannot all
    // pass the check before a post-hook gets a chance to update the cache.
    cooldownCache.set(key, now + cooldownMs);
    ctx.metadata.set("cooldownKey", key);
    return { ok: true };
  },
};

/** Post-hook: Rolls back a reservation when command execution fails. */
export const cooldownUpdateHook: CommandPostHook = {
  name: "cooldownUpdate",
  execute(ctx, { success }) {
    if (!success) {
      const key = ctx.metadata.get("cooldownKey");
      if (key) cooldownCache.delete(key);
    }
  },
};

/** Post-hook: Records execution latency telemetry */
export const telemetryHook: CommandPostHook = {
  name: "telemetry",
  execute(ctx, { success, error }) {
    const elapsed = Date.now() - ctx.startedAt;
    if (success) {
      logger.debug(
        `[Knub] /${ctx.interaction.commandName} succeeded in ${elapsed}ms for ${ctx.interaction.user.tag}`,
      );
    } else {
      logger.warn(
        `[Knub] /${ctx.interaction.commandName} failed after ${elapsed}ms for ${ctx.interaction.user.tag}:`,
        error,
      );
    }
  },
};
