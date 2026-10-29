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
} from "../services/watchlistService";
import { TicketModel } from "../database/mongo";
import { recordMemberMessage } from "../services/memberActivity";

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
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
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

    // 1. Autoresponder check
    const responded = await processAutoResponders(message).catch(err => {
      logger.error("Autoresponder error:", err);
      return false;
    });
    if (responded) return;

    // 2. Ghost Watch — alert watchers on message
    // Track message count / last active (debounced, no content) & first message of the day
    const isFirstToday = await recordMemberMessage(message.guildId, message.author.id).catch(() => false);

    TicketModel.updateOne(
      { guildId: message.guildId, channelId: message.channelId, status: "open" },
      { $set: { lastActivityAt: new Date() } }
    ).catch(() => null);

    watchlistOnMessage(client, message, isFirstToday).catch(err =>
      logger.warn("Watchlist message error:", err)
    );

    // 3. Automod check
    await processAutomod(client, message).catch(err =>
      logger.error("Automod error (create):", err)
    );
  });

  // ─── Automod (edited messages) ────────────────────────────────────────────
  client.on(Events.MessageUpdate, async (_old, newMessage) => {
    if (!newMessage.guildId) return;
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
        `**Author:** ${message.author?.tag ?? "Unknown"} (<@${message.author?.id}>)`,
        `**Channel:** <#${message.channelId}>`,
        message.content ? `\n**Content:**\n\`\`\`\n${message.content.substring(0, 900)}\`\`\`` : "",
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
      if (channel) {
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
