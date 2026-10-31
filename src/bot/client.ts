import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  Events,
  GuildMember,
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
    if (message.author.bot || !message.guildId) return;

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

    // Welcome message and Auto-role
    const config = await getGuildConfig(member.guild.id);
    
    if (config.welcomeRoleId) {
      await member.roles.add(config.welcomeRoleId).catch(err => 
        logger.warn(`Failed to assign auto-role ${config.welcomeRoleId} to ${userTag} in ${member.guild.id}:`, err)
      );
    }

    if (config.welcomeEnabled && config.welcomeChannelId) {
      let channel = member.guild.channels.cache.get(config.welcomeChannelId) as TextChannel | undefined;
      if (!channel) {
        channel = (await member.guild.channels.fetch(config.welcomeChannelId).catch(() => null)) as TextChannel | null ?? undefined;
      }
      if (channel && isObfuscatedChannel(channel)) {
        logger.warn(`Welcome channel ${config.welcomeChannelId} in ${member.guild.id} is hidden from Aegis (no View Channel); skipping the welcome message.`);
      } else if (channel) {
        const msg = config.welcomeMessage
          .replace(/{user}/g, `<@${member.user.id}>`)
          .replace(/{username}/g, member.user.username)
          .replace(/{server}/g, member.guild.name)
          .replace(/{member_count}/g, String(member.guild.memberCount))
          .replace(/{count}/g, String(member.guild.memberCount));
        await channel.send(msg).catch(() => null);
      }
    }

    // Unverified auto-kick is persisted through the scheduler so it survives restarts.
    await scheduleUnverifiedKick(client, member).catch(err =>
      logger.warn(`Failed to schedule verification auto-kick for ${member.id} in ${member.guild.id}:`, err),
    );
  });

  // ─── Member Update (role changes for Ghost Watch) ─────────────────────────
  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
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
  });

  // ─── Guild Join / Discovery ────────────────────────────────────────────────
  client.on(Events.GuildCreate, (guild) => {
    logger.info(`🏰 Joined new guild: "${guild.name}" (${guild.id}) with ${guild.memberCount} members`);
  });
}
