import { applyLowTrustRole, purgeGuildTrustData } from "../services/trustService";
import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  Events,
  GuildMember,
  PartialGuildMember,
  Message,
  TextChannel,
  ActivityType,
  PresenceUpdateStatus,
} from "discord.js";
import "../types/augmentation"; // Ensure augmentation is loaded
import { logger } from "../utils/logger";
import { commands } from "../commands/loader";
import { executeCommand } from "../commands/executor";
import { sendGuildLog } from "../services/logging";
import { processAutomod, processAutomodEdit } from "../services/automodExecution";
import { processAutoResponders } from "../services/autoResponderService";
import { buildEmbedFromSpec, renderTemplate } from "../services/embedSpec";
import { getGuildConfig } from "../services/configuration";
import { scheduleUnverifiedKick } from "../services/verificationService";
import { componentRouter } from "./interactions";
import { registerStarboardEvents } from "./events/starboard";
import {
  watchlistOnJoin,
  watchlistOnLeave,
  watchlistOnMessage,
  watchlistOnMessageEdit,
  watchlistOnMessageDelete,
  watchlistOnRoleChange,
  watchlistOnVoiceJoin,
  startWatchlistSync,
} from "../services/watchlistService";
import { recordMemberMessage } from "../services/memberActivity";
import { touchTicketActivity } from "../services/ticketActivity";
import { isObfuscatedChannel } from "../utils/channels";
import { DEFAULT_ALLOWED_MENTIONS } from "./mentions";
import { isContentEdit } from "./eventFilters";
import { codeBlock } from "../utils/safeText";
import { incidentService, joinActionable } from "../services/incidentDiscord";
import { recordMemberFlow } from "../services/memberFlow";
import { handleModmailDM, relayPrefixedStaffMessage } from "../services/modmailService";
import { reconcileDigestTasks } from "../services/digestService";

/** Discord expects a presence update at least this often. */
const PRESENCE_REFRESH_MS = 5 * 60 * 1000;

export function createClient(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent,
      // Required for user.setPresence() to have any effect. Discord silently
      // drops presence updates from a connection missing this intent.
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildVoiceStates,
      // Starboard: without this intent Discord never sends reaction events.
      GatewayIntentBits.GuildMessageReactions,
      // ModMail: members DM Aegis. Not privileged; DM channels arrive as partials (Partials.Channel below).
      GatewayIntentBits.DirectMessages,
    ],
    // Message, Channel and Reaction partials deliver reactions on messages that
    // are not in the cache (anything sent before the bot last started).
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember],
    // Safe default for every message, reply and webhook: user mentions ping,
    // but @everyone, @here and role mentions inside user-supplied text never do.
    // Features that are meant to ping a role or everyone opt in per message.
    allowedMentions: DEFAULT_ALLOWED_MENTIONS,
  });

  // Attach commands collection to client for easy access
  client.commands = new Collection();
  for (const [name, command] of commands) {
    client.commands.set(name, command);
  }

  return client;
}

export function setupEvents(client: Client): void {
  registerStarboardEvents(client);

  // ─── Ready ────────────────────────────────────────────────────────────────
  client.once(Events.ClientReady, (c) => {
    logger.info(`✅ Logged in as \x1b[1m${c.user.tag}\x1b[0m (${c.user.id})`);
    logger.info(`📡 Serving ${c.guilds.cache.size} guild(s).`);

    applyPresence(c);
    startWatchlistSync();
    // Restores incidents that ended while the bot was down and resumes expiry checks.
    incidentService(c).boot().catch(err => logger.error("Incident Mode boot failed:", err));
    // After the scheduler has restored saved tasks, recreate any weekly digest task that went missing.
    setTimeout(() => {
      reconcileDigestTasks(c).then(n => { if (n) logger.info(`Staff digest: rescheduled ${n} guild(s).`); })
        .catch(err => logger.warn("Staff digest reconcile failed:", err));
    }, 30_000).unref?.();
  });

  // Discord drops a presence that is not refreshed, so re-send it periodically.
  // Without this the activity silently reverts to "Playing something" defaults.
  const presenceInterval = setInterval(() => {
    if (client.isReady()) applyPresence(client);
  }, PRESENCE_REFRESH_MS);
  presenceInterval.unref?.();

  // ─── Presence ──────────────────────────────────────────────────────────────
  function applyPresence(c: Client): void {
    if (!c.user) return;

    const guildCount = c.guilds.cache.size;
    const userCount = c.guilds.cache.reduce((acc, g) => acc + (g.memberCount ?? 0), 0);

    try {
      c.user.setPresence({
        activities: [
          {
            name: guildCount === 1 ? "1 server" : `${guildCount} servers`,
            type: ActivityType.Watching,
          },
          {
            name: userCount > 0 ? `${userCount.toLocaleString()} members` : "over your server",
            type: ActivityType.Listening,
          },
        ],
        status: PresenceUpdateStatus.Online,
      });
    } catch (err) {
      logger.warn("Could not set presence:", err);
    }
  }

  // ─── Interaction Deduplication Cache (60s sliding window) ───────────────────
  const processedInteractions = new Map<string, number>();
  const INTERACTION_CACHE_TTL_MS = 60_000;

  const dedupeSweepInterval = setInterval(() => {
    const now = Date.now();
    for (const [id, ts] of processedInteractions) {
      if (now - ts > INTERACTION_CACHE_TTL_MS) {
        processedInteractions.delete(id);
      }
    }
  }, 30_000);
  dedupeSweepInterval.unref?.();

  // ─── Slash Commands ────────────────────────────────────────────────────────
  client.on(Events.InteractionCreate, async (interaction) => {
    // Gateway retransmission guard
    if (processedInteractions.has(interaction.id)) {
      logger.debug(`Ignoring duplicate interaction delivery: ${interaction.id}`);
      return;
    }
    processedInteractions.set(interaction.id, Date.now());

    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command?.autocomplete) return;
      try {
        await command.autocomplete(interaction);
      } catch (error) {
        logger.warn(`Autocomplete failed for /${interaction.commandName}:`, error);
      }
    } else if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        logger.warn(`Unknown command: ${interaction.commandName}`);
        return;
      }
      await executeCommand(command, interaction);
    } else if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
      await componentRouter.dispatch(interaction);
    }
  });

  // ─── Automod & Autoresponder (new messages) ──────────────────────────────
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (!message.guildId) {
      // ModMail: a DM to Aegis. Errors never reach the member as a crash.
      await handleModmailDM(client, message).catch(err => logger.warn("ModMail DM error:", err));
      return;
    }

    // ModMail: a staff message in a ticket thread starting with the relay prefix.
    if (message.channel.isThread()) {
      await relayPrefixedStaffMessage(client, message).catch(err => logger.warn("ModMail relay error:", err));
    }

    // Activity, ticket and Ghost Watch bookkeeping run for every message.
    // Track message count / last active (debounced, no content) & first message of the day
    const isFirstToday = await recordMemberMessage(message.guildId, message.author.id).catch(() => false);

    // Ticket inactivity clock: at most one write per channel per minute.
    touchTicketActivity(message.guildId, message.channelId);

    watchlistOnMessage(client, message, isFirstToday).catch(err =>
      logger.warn("Watchlist message error:", err)
    );

    // Automod runs before the autoresponder. Previously a message that matched
    // an autoresponder trigger returned early and skipped automod (and Ghost
    // Watch), so a blocked word next to a trigger phrase went through.
    const removed = await processAutomod(client, message).catch(err => {
      logger.error("Automod error (create):", err);
      return false;
    });
    if (removed) return;

    await processAutoResponders(message).catch(err => {
      logger.error("Autoresponder error:", err);
      return false;
    });
  });

  // ─── Automod (edited messages) ────────────────────────────────────────────
  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    if (!newMessage.guildId) return;
    // Discord also sends an update when it attaches a link preview or the
    // message is pinned. Only a real content change counts as an edit; before
    // this, a link preview re-ran automod and sent a Ghost Watch "edited" alert.
    if (!isContentEdit(oldMessage, newMessage)) return;
    // Fetch partial to get full content
    const msg = newMessage.partial ? await newMessage.fetch().catch(() => null) : newMessage;
    if (!msg || msg.author?.bot) return;

    // Ghost Watch — alert watchers on message edit
    watchlistOnMessageEdit(client, msg).catch(err =>
      logger.warn("Watchlist edit error:", err)
    );

    await processAutomodEdit(client, msg).catch(err =>
      logger.error("Automod error (update):", err)
    );
  });

  // ─── Message Delete Logging ────────────────────────────────────────────────
  client.on(Events.MessageDelete, async (message) => {
    if (!message.guildId || message.author?.bot) return;

    // Ghost Watch — alert watchers on message delete
    if (message.author) {
      watchlistOnMessageDelete(client, message as Message).catch(err =>
        logger.warn("Watchlist delete error:", err)
      );
    }

    await sendGuildLog(client, message.guildId, {
      title: "🗑️ Message Deleted",
      color: 0xE74C3C,
      description: [
        `**Author:** ${message.author ? `${message.author.tag} (<@${message.author.id}>)` : "Unknown (message was not cached)"}`,
        `**Channel:** <#${message.channelId}>`,
        message.content ? `\n**Content:**\n${codeBlock(message.content, 920)}` : "",
      ].join("\n"),
    }, "messageDeletes");
  });

  // ─── Member Join ──────────────────────────────────────────────────────────
  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    recordMemberFlow(member.guild.id, "join").catch(() => undefined);
    // Incident Mode first: a gated join gets no welcome or auto-role, and the
    // join counts toward the optional join-burst auto-trigger.
    const gate = await incidentService(client).onMemberJoin(member.guild.id, {
      userId: member.id,
      tag: member.user?.tag ?? member.id,
      isBot: member.user?.bot === true,
      createdAt: member.user?.createdAt ?? new Date(),
      actionable: joinActionable(member, "timeout") || joinActionable(member, "kick"),
    }).catch((err) => {
      logger.warn(`Incident join check failed in ${member.guild.id}:`, err);
      return { act: "none" as const, why: "error" };
    });

    // Log event
    const userTag = member.user?.tag ?? "Unknown User";
    const avatarUrl = member.user?.displayAvatarURL?.();

    await sendGuildLog(client, member.guild.id, {
      title: "📥 Member Joined",
      color: 0x57F287,
      description: `${userTag} (<@${member.user.id}>) joined the server.`,
      thumbnail: avatarUrl ? { url: avatarUrl } : undefined,
      fields: [
        { name: "Account Created", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: "Member Count",    value: String(member.guild.memberCount), inline: true },
      ],
    }, "memberJoins");

    // Ghost Watch — notify watchers on join
    watchlistOnJoin(client, member).catch(err => logger.warn("Watchlist join error:", err));

    if (gate.act !== "none") return;

    // Opt-in Trust Score low-trust role (off unless configured with /trust config).
    applyLowTrustRole(member).catch(err => logger.warn(`Low-trust role check failed in ${member.guild.id}:`, err));

    // Welcome message and Auto-role
    const config = await getGuildConfig(member.guild.id);
    
    // Members still behind Discord's membership screening get the role once they pass it (see GuildMemberUpdate).
    if (config.welcomeRoleId && !member.pending) await assignWelcomeRole(member, config.welcomeRoleId);

    if (config.welcomeEnabled && config.welcomeChannelId) {
      let channel = member.guild.channels.cache.get(config.welcomeChannelId) as TextChannel | undefined;
      if (!channel) {
        channel = (await member.guild.channels.fetch(config.welcomeChannelId).catch(() => null)) as TextChannel | null ?? undefined;
      }
      if (channel && isObfuscatedChannel(channel)) {
        logger.warn(`Welcome channel ${config.welcomeChannelId} in ${member.guild.id} is hidden from Aegis (no View Channel); skipping the welcome message.`);
      } else if (channel) {
        const values = { user: `<@${member.user.id}>`, username: member.user.username, server: member.guild.name, memberCount: member.guild.memberCount };
        const content = renderTemplate(config.welcomeMessage, values).slice(0, 2000);
        const embeds = config.welcomeEmbed ? [buildEmbedFromSpec(config.welcomeEmbed, values)] : [];
        // Only the joining member may be pinged by a welcome; never roles or @everyone.
        await channel.send({ content: content || undefined, embeds, allowedMentions: { users: [member.user.id] } }).catch(() => null);
      }
    }

    // Unverified auto-kick is persisted through the scheduler so it survives restarts.
    await scheduleUnverifiedKick(client, member).catch(err =>
      logger.warn(`Failed to schedule verification auto-kick for ${member.id} in ${member.guild.id}:`, err),
    );
  });

  // ─── Member Update (role changes for Ghost Watch) ─────────────────────────
  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    if (oldMember.pending && !newMember.pending) {
      const roleId = (await getGuildConfig(newMember.guild.id).catch(() => null))?.welcomeRoleId;
      if (roleId) await assignWelcomeRole(newMember, roleId);
    }
    watchlistOnRoleChange(client, oldMember, newMember).catch(err =>
      logger.warn("Watchlist roleChange error:", err)
    );
  });

  // ─── Voice State Update (voice joins for Ghost Watch) ─────────────────────
  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    if (newState.member?.user.bot) return;
    if (!oldState.channelId && newState.channelId) {
      watchlistOnVoiceJoin(client, newState).catch(err =>
        logger.warn("Watchlist voice join error:", err)
      );
    }
  });

  // ─── Member Leave ─────────────────────────────────────────────────────────
  client.on(Events.GuildMemberRemove, async (member) => {
    recordMemberFlow(member.guild.id, "leave").catch(() => undefined);
    const user = member.user;
    const tag = user?.tag ?? "Unknown User";
    const id = member.id;
    const avatar = user?.displayAvatarURL?.();

    await sendGuildLog(client, member.guild.id, {
      title: "📤 Member Left",
      color: 0xE67E22,
      description: `${tag} (<@${id}>) left the server.`,
      thumbnail: avatar ? { url: avatar } : undefined,
      fields: [
        { name: "Joined At", value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : "Unknown", inline: true },
      ],
    }, "memberLeaves");

    // Ghost Watch — notify watchers on leave
    watchlistOnLeave(client, member).catch(err => logger.warn("Watchlist leave error:", err));

    // Goodbye message (off unless turned on in the dashboard). Never pings anyone.
    sendGoodbye(member).catch(err => logger.warn("Goodbye message error:", err));
  });

  // ─── Guild Join / Discovery ────────────────────────────────────────────────
  client.on(Events.GuildCreate, (guild) => {
    logger.info(`🏰 Joined new guild: "${guild.name}" (${guild.id}) with ${guild.memberCount} members`);
  });

  // Leaving a server drops the per-member activity counters kept for Trust Score.
  // Cases and warnings keep their own one-year TTL so a re-add keeps the record.
  client.on(Events.GuildDelete, (guild) => {
    if (!guild.available) return; // an outage, not a removal
    purgeGuildTrustData(guild.id)
      .then(n => logger.info(`Left guild ${guild.id}; removed ${n} activity record(s).`))
      .catch(err => logger.warn(`Trust data cleanup failed for ${guild.id}:`, err));
  });
}

/**
 * Gives a new member the welcome auto-role. Adding a role during membership
 * screening would skip the server's rules gate, so pending members wait; a
 * role above Aegis is skipped with a warning instead of an API error per join.
 */
async function assignWelcomeRole(member: GuildMember, roleId: string): Promise<void> {
  const role = member.guild.roles.cache.get(roleId);
  if (role && !role.editable) {
    logger.warn(`Auto-role ${roleId} in ${member.guild.id} is above Aegis's highest role (or managed); skipping it.`);
    return;
  }
  if (member.roles.cache.has(roleId)) return;
  await member.roles.add(roleId, "Welcome auto-role").catch(err =>
    logger.warn(`Failed to assign auto-role ${roleId} to ${member.user?.tag ?? member.id} in ${member.guild.id}:`, err),
  );
}

/** Posts the goodbye message for a member who left, if the server turned it on. */
async function sendGoodbye(member: GuildMember | PartialGuildMember): Promise<void> {
  const config = await getGuildConfig(member.guild.id);
  if (!config.goodbyeEnabled || !config.goodbyeChannelId) return;
  const channel = member.guild.channels.cache.get(config.goodbyeChannelId)
    ?? await member.guild.channels.fetch(config.goodbyeChannelId).catch(() => null);
  if (!channel || isObfuscatedChannel(channel)) {
    if (channel) logger.warn(`Goodbye channel ${config.goodbyeChannelId} in ${member.guild.id} is hidden from Aegis (no View Channel); skipping the goodbye message.`);
    return;
  }
  if (!channel.isTextBased() || !("send" in channel)) return;
  const name = member.user?.username ?? "A member";
  const values = { user: name, username: name, server: member.guild.name, memberCount: member.guild.memberCount };
  const content = renderTemplate(config.goodbyeMessage ?? "", values).slice(0, 2000);
  const embeds = config.goodbyeEmbed ? [buildEmbedFromSpec(config.goodbyeEmbed, values)] : [];
  if (!content && embeds.length === 0) return;
  await channel.send({ content: content || undefined, embeds, allowedMentions: { parse: [] } }).catch(() => null);
}
