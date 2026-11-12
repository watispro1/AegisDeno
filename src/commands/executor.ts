/**
 * Runs a slash command: guild-only, member-permission, bot-permission and
 * cooldown checks first, then the command, then cooldown rollback and timing.
 * Every failure ends in an ephemeral reply so the user never sees
 * "The application did not respond".
 */
import {
  MessageFlags,
  PermissionFlagsBits,
  PermissionsBitField,
  type ChatInputCommandInteraction,
  type CommandInteraction,
  type PermissionResolvable,
} from "discord.js";
import type { Command, ContextMenu } from "../types/discord";
import { describeCommandError, newErrorId } from "../utils/errorReport";
import { logger } from "../utils/logger";
import { docsUrl } from "../config/links";
import { permissionName } from "../utils/embedStyle";
import { startSlowCommandGuard, type SlowGuardInteraction } from "./slowGuard";

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
  [String(PermissionFlagsBits.SendMessagesInThreads)]: "Send Messages in Threads",
  [String(PermissionFlagsBits.CreatePrivateThreads)]:  "Create Private Threads",
  [String(PermissionFlagsBits.ManageThreads)]:        "Manage Threads",
};

/** Human names for permissions, e.g. "Ban Members, Manage Nicknames" (never a raw bit number). */
export function formatPermissions(permissions: readonly PermissionResolvable[]): string {
  return permissions
    .flatMap((p) => {
      const known = PERMISSION_NAMES[String(p)];
      if (known) return [known];
      try {
        return new PermissionsBitField(p).toArray().map(permissionName);
      } catch {
        return [String(p)];
      }
    })
    .join(", ");
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

async function replyError(interaction: CommandInteraction, content: string): Promise<void> {
  if (interaction.replied) {
    await interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => undefined);
  } else if (interaction.deferred) {
    // editReply keeps whatever visibility deferReply chose; it takes no ephemeral flag.
    await interaction.editReply({ content }).catch(() => undefined);
  } else {
    await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => undefined);
  }
}

/** The pre-check fields shared by slash commands and context menus. */
type Checked = Pick<Command, "guildOnly" | "userPermissions" | "botPermissions">;

/** How a command is named to the member: "/ban" or "User Info". */
function invocationLabel(interaction: CommandInteraction): string {
  return interaction.isChatInputCommand() ? `/${interaction.commandName}` : interaction.commandName;
}

/** The first failed pre-check as a user-facing message, or null when the command may run. */
function precheck(command: Checked, interaction: CommandInteraction): string | null {
  if (command.guildOnly && !interaction.guildId) {
    return "❌ This command can only be used in a server.";
  }

  if (command.userPermissions?.length) {
    const perms = interaction.memberPermissions;
    if (!perms) return "❌ Could not verify your server permissions.";
    const missing = command.userPermissions.filter((p) => !perms.has(p));
    if (missing.length) {
      logger.warn(
        `Permission denied: ${invocationLabel(interaction)} by ${interaction.user.tag} ` +
          `(${interaction.user.id}) in guild ${interaction.guildId ?? "DM"} — missing: ${formatPermissions(missing)}`,
      );
      return (
        `❌ You are missing the following permission(s): **${formatPermissions(missing)}**. ` +
        "Ask a server admin to add them to one of your roles (Server Settings → Roles), or to allow you in Server Settings → Integrations → Aegis. " +
        `What each one unlocks: ${docsUrl("permissions")}`
      );
    }
  }

  // In DMs there are no server permissions to check (Aegis can always embed there).
  if (command.botPermissions?.length && interaction.inGuild()) {
    const have = interaction.guild?.members.me?.permissions ?? interaction.appPermissions ?? null;
    if (!have) return "❌ I couldn't verify my permissions in this server.";
    const missing = command.botPermissions.filter((p) => !have.has(p));
    if (missing.length) {
      logger.warn(`Bot missing permissions for ${invocationLabel(interaction)} in guild ${interaction.guildId}: ${formatPermissions(missing)}`);
      return (
        `❌ I am missing the following permission(s): **${formatPermissions(missing)}**. ` +
        "Grant these to Aegis's role (Server Settings → Roles → Aegis) or in this channel's settings → Permissions, then run `/diagnostics` to confirm. " +
        `Permissions guide: ${docsUrl("permissions")}`
      );
    }
  }

  return null;
}

/** Cooldown message with the exact time left: "Please wait 4s before using /work again (in 4 seconds)". */
export function cooldownMessage(label: string, waitSeconds: number, now = Date.now()): string {
  const readyAt = Math.floor(now / 1000) + waitSeconds;
  const shown = label.startsWith("/") ? `\`${label}\`` : `**${label}**`;
  return `⌛ Please wait **${waitSeconds}s** before using ${shown} again (<t:${readyAt}:R>).`;
}

async function run(
  spec: Checked & Pick<Command, "cooldownMs">,
  interaction: CommandInteraction,
  body: () => Promise<unknown>,
): Promise<void> {
  const blocked = precheck(spec, interaction);
  if (blocked) {
    await replyError(interaction, blocked);
    return;
  }

  const label = invocationLabel(interaction);
  const cooldownMs = spec.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const cooldownKey = `${interaction.commandName}:${interaction.user.id}`;
  if (cooldownMs > 0) {
    const wait = cooldowns.reserve(cooldownKey, cooldownMs);
    if (wait !== null) {
      await replyError(interaction, cooldownMessage(label, wait));
      return;
    }
  }

  const startedAt = Date.now();
  // If the command has not answered in ~2.5s, defer for it so Discord does not
  // show "The application did not respond" while the work continues.
  const stopSlowGuard = startSlowCommandGuard(interaction as unknown as SlowGuardInteraction);
  try {
    await body();
    logger.debug(`${label} succeeded in ${Date.now() - startedAt}ms for ${interaction.user.tag}`);
  } catch (err) {
    // A failed run does not use up the cooldown.
    cooldowns.release(cooldownKey);
    const errorId = newErrorId();
    const report = describeCommandError(err, label, errorId);
    const where = `${label} by ${interaction.user.tag} (${interaction.user.id}) in guild ${interaction.guildId ?? "DM"} after ${Date.now() - startedAt}ms`;
    if (report.expected) logger.warn(`[${errorId}] Discord refused ${where}:`, err);
    else logger.error(`[${errorId}] Unhandled error in ${where}:`, err);
    if (!report.silent) await replyError(interaction, report.message);
  } finally {
    stopSlowGuard();
  }
}

export async function executeCommand(command: Command, interaction: ChatInputCommandInteraction): Promise<void> {
  await run(command, interaction, () => command.execute(interaction));
}

/** Runs a right-click (Apps) command with the same checks, cooldowns and error reporting as slash commands. */
export async function executeContextMenu(menu: ContextMenu, interaction: CommandInteraction): Promise<void> {
  await run(menu, interaction, () => menu.execute(interaction as Parameters<ContextMenu["execute"]>[0]));
}
