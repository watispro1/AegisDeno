import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { Command } from "../../types/discord";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send a formatted announcement to a channel.")
    .addChannelOption(opt =>
      opt.setName("channel").setDescription("Channel to send the announcement to").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("message").setDescription("The announcement body text (use \\n for newlines)").setRequired(true).setMaxLength(2000)
    )
    .addStringOption(opt =>
      opt.setName("title").setDescription("Optional announcement title for embed header").setRequired(false).setMaxLength(256)
    )
    .addStringOption(opt =>
      opt
        .setName("ping")
        .setDescription("Optional notification ping")
        .setRequired(false)
        .addChoices(
          { name: "None", value: "none" },
          { name: "@everyone", value: "everyone" },
          { name: "@here", value: "here" }
        )
    ),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ManageMessages],
  botPermissions: [PermissionFlagsBits.SendMessages],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const channel = interaction.options.getChannel("channel", true);
    const messageText = interaction.options.getString("message", true).replace(/\\n/g, "\n");
    const title = interaction.options.getString("title");
    const pingChoice = interaction.options.getString("ping") ?? "none";

    if (!("send" in channel) || typeof channel.send !== "function") {
      return interaction.reply({ content: "❌ Please select a channel where messages can be sent.", ephemeral: true });
    }

    const me = interaction.guild?.members.me;
    if (me && "permissionsFor" in channel && typeof channel.permissionsFor === "function") {
      const perms = channel.permissionsFor(me);
      if (perms && !perms.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
        return interaction.reply({ content: "❌ I need View Channel and Send Messages permissions in that channel.", ephemeral: true });
      }
    }

    await interaction.deferReply({ ephemeral: true });

    let pingContent = "";
    if (pingChoice === "everyone") pingContent = "@everyone";
    if (pingChoice === "here") pingContent = "@here";

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle(title ?? "📢 Server Announcement")
      .setDescription(messageText)
      .setAuthor({ name: interaction.guild?.name ?? "Announcement", iconURL: interaction.guild?.iconURL() ?? undefined })
      .setFooter({ text: `Announced by ${interaction.user.tag}` })
      .setTimestamp();

    try {
      await channel.send({ content: pingContent || undefined, embeds: [embed] });
      await interaction.editReply(`✅ Announcement successfully sent to <#${channel.id}>.`);
    } catch {
      await interaction.editReply("❌ Failed to send announcement. Please verify my permissions in that channel.");
    }
  },
};

export default command;
