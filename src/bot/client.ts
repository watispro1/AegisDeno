import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  Events,
  ChatInputCommandInteraction,
  GuildMember,
  TextChannel,
  EmbedBuilder,
  ActivityType,
  PresenceUpdateStatus,
} from "discord.js";
import "../types/augmentation"; // Ensure augmentation is loaded
import { logger } from "../utils/logger";
import { commands } from "../commands/loader";
import { sendGuildLog } from "../services/logging";
import { processAutomod } from "../services/automodExecution";
import { getGuildConfig } from "../services/configuration";

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

  // ─── Slash Commands ────────────────────────────────────────────────────────
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) {
      logger.warn(`Unknown command: ${interaction.commandName}`);
      return;
    }

    // Guild-only guard
    if (command.guildOnly && !interaction.guildId) {
      await interaction.reply({ content: "❌ This command can only be used in a server.", ephemeral: true });
      return;
    }

    // User permission guard
    if (command.userPermissions && command.userPermissions.length > 0) {
      const missing = command.userPermissions.filter(p => !interaction.memberPermissions?.has(p));
      if (missing.length > 0) {
        await interaction.reply({
          content: `❌ You need the following permissions to use this command: ${missing.join(", ")}`,
          ephemeral: true,
        });
        return;
      }
    }

    // Bot permission guard
    if (command.botPermissions && command.botPermissions.length > 0) {
      const botMember = interaction.guild?.members.me;
      const missing = command.botPermissions.filter(p => !botMember?.permissions.has(p));
      if (missing.length > 0) {
        await interaction.reply({
          content: `❌ I need the following permissions to run this command: ${missing.join(", ")}`,
          ephemeral: true,
        });
        return;
      }
    }

    logger.debug(`Command: /${interaction.commandName} by ${interaction.user.tag}`);

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(`Error in /${interaction.commandName}:`, error);
      const errorMsg = { content: "❌ An error occurred while executing this command.", ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMsg).catch(() => null);
      } else {
        await interaction.reply(errorMsg).catch(() => null);
      }
    }
  });

  // ─── Automod ───────────────────────────────────────────────────────────────
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guildId) return;
    await processAutomod(client, message).catch(err =>
      logger.error("Automod error:", err)
    );
  });

  // ─── Message Delete Logging ────────────────────────────────────────────────
  client.on(Events.MessageDelete, async (message) => {
    if (!message.guildId || message.author?.bot) return;
    await sendGuildLog(client, message.guildId, {
      title: "🗑️ Message Deleted",
      color: 0xE74C3C,
      description: [
        `**Author:** ${message.author?.tag ?? "Unknown"} (<@${message.author?.id}>)`,
        `**Channel:** <#${message.channelId}>`,
        message.content ? `\n**Content:**\n\`\`\`\n${message.content.substring(0, 900)}\`\`\`` : "",
      ].join("\n"),
    });
  });

  // ─── Member Join ──────────────────────────────────────────────────────────
  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    // Log event
    await sendGuildLog(client, member.guild.id, {
      title: "📥 Member Joined",
      color: 0x57F287,
      description: `${member.user.tag} (<@${member.user.id}>) joined the server.`,
      thumbnail: { url: member.user.displayAvatarURL() },
      fields: [
        { name: "Account Created", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: "Member Count",    value: String(member.guild.memberCount), inline: true },
      ],
    });

    // Welcome message
    const config = await getGuildConfig(member.guild.id);
    if (config.welcomeEnabled && config.welcomeChannelId) {
      const channel = member.guild.channels.cache.get(config.welcomeChannelId) as TextChannel | undefined;
      if (channel) {
        const msg = config.welcomeMessage
          .replace(/{user}/g, `<@${member.user.id}>`)
          .replace(/{username}/g, member.user.username)
          .replace(/{server}/g, member.guild.name)
          .replace(/{member_count}/g, String(member.guild.memberCount));
        await channel.send(msg).catch(() => null);
      }
    }
  });

  // ─── Member Leave ─────────────────────────────────────────────────────────
  client.on(Events.GuildMemberRemove, async (member) => {
    await sendGuildLog(client, member.guild.id, {
      title: "📤 Member Left",
      color: 0xE67E22,
      description: `${member.user.tag} (<@${member.user.id}>) left the server.`,
      thumbnail: { url: member.user.displayAvatarURL() },
      fields: [
        { name: "Joined At", value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : "Unknown", inline: true },
      ],
    });
  });
}
