/**
 * Runs a slash command: guild-only, member-permission, bot-permission and
 * cooldown checks first, then the command, then cooldown rollback and timing.
 * Every failure ends in an ephemeral reply so the user never sees
 * "The application did not respond".
 */
import {
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type PermissionResolvable,
} from "discord.js";
import type { Command } from "../types/discord";
import { logger } from "../utils/logger";
import { docsUrl } from "../config/links";

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

export function formatPermissions(permissions: readonly PermissionResolvable[]): string {
  return permissions.map((p) => PERMISSION_NAMES[String(p)] ?? String(p)).join(", ");
}

/** Default per-user cooldown when a command does not set `cooldownMs`. */
export const DEFAULT_COOLDOWN_MS = 1500;
const COOLDOWN_SWEEP_INTERVAL_MS = 60_000;

/** Per-command, per-user cooldowns: `${command}:${userId}` → time the next use is allowed. */
export class CooldownTracker {
  private readonly until = new Map<string, number>();
  private lastSweep = 0;

  /** Reserve a use. Returns the seconds left to wait when still cooling down, else null. */
  reserve(key: string, cooldownMs: number, now = Date.now()): number | null {
    this.sweep(now);
    const expiresAt = this.until.get(key);
    if (expiresAt !== undefined && now < expiresAt) return Math.ceil((expiresAt - now) / 1000);
    // Reserve before running so concurrent interactions cannot all pass the check.
    this.until.set(key, now + cooldownMs);
    return null;
  }

  release(key: string): void {
    this.until.delete(key);
  }

  get size(): number {
    return this.until.size;
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < COOLDOWN_SWEEP_INTERVAL_MS) return;
    this.lastSweep = now;
    for (const [key, expiresAt] of this.until) {
      if (expiresAt <= now) this.until.delete(key);
    }
  }
}

const cooldowns = new CooldownTracker();

async function replyError(interaction: ChatInputCommandInteraction, content: string): Promise<void> {
  if (interaction.replied) {
    await interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => undefined);
  } else if (interaction.deferred) {
    // editReply keeps whatever visibility deferReply chose; it takes no ephemeral flag.
    await interaction.editReply({ content }).catch(() => undefined);
  } else {
    await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => undefined);
  }
}

/** The first failed pre-check as a user-facing message, or null when the command may run. */
function precheck(command: Command, interaction: ChatInputCommandInteraction): string | null {
  if (command.guildOnly && !interaction.guildId) {
    return "❌ This command can only be used in a server.";
  }

  if (command.userPermissions?.length) {
    const perms = interaction.memberPermissions;
    if (!perms) return "❌ Could not verify your server permissions.";
    const missing = command.userPermissions.filter((p) => !perms.has(p));
    if (missing.length) {
      logger.warn(
        `Permission denied: /${interaction.commandName} by ${interaction.user.tag} ` +
          `(${interaction.user.id}) in guild ${interaction.guildId ?? "DM"} — missing: ${formatPermissions(missing)}`,
      );
      return (
        `❌ You are missing the following permission(s): **${formatPermissions(missing)}**. ` +
        "Ask a server admin to add them to one of your roles (Server Settings → Roles), or to allow you in Server Settings → Integrations → Aegis. " +
        `What each one unlocks: ${docsUrl("permissions")}`
      );
    }
  }

  if (command.botPermissions?.length) {
    const me = interaction.guild?.members.me;
    if (!me) return "❌ I couldn't verify my permissions in this server.";
    const missing = command.botPermissions.filter((p) => !me.permissions.has(p));
    if (missing.length) {
      logger.warn(`Bot missing permissions for /${interaction.commandName} in guild ${interaction.guildId}: ${formatPermissions(missing)}`);
      return (
        `❌ I am missing the following permission(s): **${formatPermissions(missing)}**. ` +
        "Grant these to Aegis's role (Server Settings → Roles → Aegis) or in this channel's settings → Permissions, then run `/diagnostics` to confirm. " +
        `Permissions guide: ${docsUrl("permissions")}`
      );
    }
  }

  return null;
}

export async function executeCommand(command: Command, interaction: ChatInputCommandInteraction): Promise<void> {
  const blocked = precheck(command, interaction);
  if (blocked) {
    await replyError(interaction, blocked);
    return;
  }

  const cooldownMs = command.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const cooldownKey = `${interaction.commandName}:${interaction.user.id}`;
  if (cooldownMs > 0) {
    const wait = cooldowns.reserve(cooldownKey, cooldownMs);
    if (wait !== null) {
      await replyError(interaction, `⏳ Please wait **${wait}s** before using \`/${interaction.commandName}\` again.`);
      return;
    }
  }

  const startedAt = Date.now();
  try {
    await command.execute(interaction);
    logger.debug(`/${interaction.commandName} succeeded in ${Date.now() - startedAt}ms for ${interaction.user.tag}`);
  } catch (err) {
    // A failed run does not use up the cooldown.
    cooldowns.release(cooldownKey);
    logger.error(`Unhandled error in /${interaction.commandName} by ${interaction.user.tag} after ${Date.now() - startedAt}ms:`, err);
    await replyError(interaction, "❌ An unexpected error occurred while running this command. Please try again.");
  }
}
