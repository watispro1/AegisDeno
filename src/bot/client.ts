import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  Events,
  GuildMember,
  TextChannel,
  ActivityType,
  PresenceUpdateStatus,
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
} from "discord.js";
import "../types/augmentation"; // Ensure augmentation is loaded
import { logger } from "../utils/logger";
import { commands } from "../commands/loader";
import { executeCommand } from "../commands/executor";
import { sendGuildLog } from "../services/logging";
import { processAutomod, processAutomodEdit } from "../services/automodExecution";
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
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        logger.warn(`Unknown command: ${interaction.commandName}`);
        return;
      }
      await executeCommand(command, interaction);
    } else if (interaction.isButton()) {
      if (interaction.customId.startsWith("suggest_")) {
        const [, action, id] = interaction.customId.split("_");
        if (!id || !interaction.guildId) return;

        await interaction.deferUpdate().catch(() => null);

        // Dynamically import voteOnSuggestion to avoid circular dependencies in boot if any
        const { voteOnSuggestion } = await import("../services/suggestions");
        const suggestion = await voteOnSuggestion(interaction.guildId, id, interaction.user.id, action as "up" | "down");
        
        if (!suggestion) return;

        // Update the message embed and buttons
        const msg = interaction.message;
        const oldEmbed = msg.embeds[0];
        if (!oldEmbed) return;

        const newEmbed = EmbedBuilder.from(oldEmbed)
          .spliceFields(1, 1, { name: "Votes", value: `👍 ${suggestion.upvotes.length} | 👎 ${suggestion.downvotes.length}`, inline: true });

        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`suggest_up_${suggestion.id}`)
              .setLabel(`Upvote (${suggestion.upvotes.length})`)
              .setStyle(interaction.customId === `suggest_up_${id}` ? 3 : 3) // style 3 is Success
              .setEmoji("👍"),
            new ButtonBuilder()
              .setCustomId(`suggest_down_${suggestion.id}`)
              .setLabel(`Downvote (${suggestion.downvotes.length})`)
              .setStyle(interaction.customId === `suggest_down_${id}` ? 4 : 4) // style 4 is Danger
              .setEmoji("👎")
          );

        await msg.edit({ embeds: [newEmbed], components: [row] }).catch(() => null);
      }
    }
  });

  // ─── Automod (new messages) ───────────────────────────────────────────────
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guildId) return;
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
    await processAutomodEdit(client, msg).catch(err =>
      logger.error("Automod error (update):", err)
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

    // Welcome message and Auto-role
    const config = await getGuildConfig(member.guild.id);
    
    if (config.welcomeRoleId) {
      await member.roles.add(config.welcomeRoleId).catch(err => 
        logger.warn(`Failed to assign auto-role ${config.welcomeRoleId} to ${member.user.tag} in ${member.guild.id}:`, err)
      );
    }

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
