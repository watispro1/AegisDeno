import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import { Command } from "../../types/discord";
import { isSendableChannel } from "../../utils/channels";
import { registerPoll, renderPollComponents, renderPollEmbed } from "../../services/polls";
import { logger } from "../../utils/logger";

// ─── Command ─────────────────────────────────────────────────────────────────

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Create a poll with live results; timed polls close on their own and post results.")
    .addStringOption(opt =>
      opt.setName("question").setDescription("The poll question").setRequired(true).setMaxLength(300)
    )
    .addStringOption(opt => opt.setName("option1").setDescription("Option 1").setRequired(true).setMaxLength(80))
    .addStringOption(opt => opt.setName("option2").setDescription("Option 2").setRequired(true).setMaxLength(80))
    .addStringOption(opt =>
      opt
        .setName("duration")
        .setDescription("Poll duration")
        .setRequired(false)
        .addChoices(
          { name: "10 Minutes",       value: "600" },
          { name: "30 Minutes",       value: "1800" },
          { name: "1 Hour",           value: "3600" },
          { name: "4 Hours",          value: "14400" },
          { name: "8 Hours",          value: "28800" },
          { name: "24 Hours (1 Day)", value: "86400" },
          { name: "3 Days",           value: "259200" },
          { name: "7 Days (1 Week)",  value: "604800" },
          { name: "No Limit",         value: "0" },
        )
    )
    .addStringOption(opt => opt.setName("option3").setDescription("Option 3").setRequired(false).setMaxLength(80))
    .addStringOption(opt => opt.setName("option4").setDescription("Option 4").setRequired(false).setMaxLength(80))
    .addStringOption(opt => opt.setName("option5").setDescription("Option 5").setRequired(false).setMaxLength(80))
    .addStringOption(opt => opt.setName("option6").setDescription("Option 6").setRequired(false).setMaxLength(80))
    .addStringOption(opt => opt.setName("option7").setDescription("Option 7").setRequired(false).setMaxLength(80))
    .addStringOption(opt => opt.setName("option8").setDescription("Option 8").setRequired(false).setMaxLength(80))
    .addStringOption(opt => opt.setName("option9").setDescription("Option 9").setRequired(false).setMaxLength(80))
    .addStringOption(opt => opt.setName("option10").setDescription("Option 10").setRequired(false).setMaxLength(80))
    .addBooleanOption(opt =>
      opt.setName("anonymous").setDescription("Hide who voted for what, including in the results (default: false)").setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName("multiselect").setDescription("Allow users to vote for multiple options (default: false)").setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName("image_url").setDescription("Optional image URL to attach to the poll embed").setMaxLength(512).setRequired(false)
    ),

  guildOnly: true,
  botPermissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const question    = interaction.options.getString("question", true);
    const durationSec = parseInt(interaction.options.getString("duration") ?? "3600", 10);
    const multiselect = interaction.options.getBoolean("multiselect") ?? false;
    const anonymous   = interaction.options.getBoolean("anonymous") ?? false;
    const imageUrl    = interaction.options.getString("image_url") ?? null;

    const options: string[] = [];
    for (let i = 1; i <= 10; i++) {
      const opt = interaction.options.getString(`option${i}`);
      if (opt?.trim()) options.push(opt.trim());
    }

    if (new Set(options.map(o => o.toLowerCase())).size !== options.length) {
      return interaction.reply({ content: "❌ Poll options must be distinct.", flags: MessageFlags.Ephemeral });
    }
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
      return interaction.reply({ content: "❌ `image_url` must start with http:// or https://.", flags: MessageFlags.Ephemeral });
    }

    const channel = interaction.channel;
    if (!channel || !isSendableChannel(channel)) {
      return interaction.reply({ content: "❌ I can't post a poll in this channel.", flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Fixed once at creation, so the published deadline never drifts.
    const endsAt = durationSec > 0 ? new Date(Date.now() + durationSec * 1000) : null;
    const draft = {
      guildId: interaction.guildId!,
      creatorId: interaction.user.id,
      creatorTag: interaction.user.tag,
      question,
      options,
      multiselect,
      anonymous,
      imageUrl,
      endsAt,
      votes: {},
      ended: false,
    };

    let message: Awaited<ReturnType<typeof channel.send>> | null = null;
    try {
      message = await channel.send({
        embeds: [renderPollEmbed(draft)],
        components: renderPollComponents(options.length, options),
      });
      await registerPoll(interaction.client, { ...draft, channelId: message.channelId, messageId: message.id });
      await interaction.editReply(
        endsAt
          ? `✅ Poll posted. It closes <t:${Math.floor(endsAt.getTime() / 1000)}:R> and the results will be posted automatically.`
          : "✅ Poll posted. Press **End Poll** when you want to close it and post the results.",
      );
    } catch (err) {
      logger.error(`Failed to create poll in guild ${interaction.guildId}`, err);
      // Don't leave a poll with dead buttons behind if it couldn't be saved.
      await message?.delete().catch(() => null);
      await interaction.editReply("❌ Failed to post the poll. Check that I can send messages and embeds here.");
    }
  },
};

export default command;
