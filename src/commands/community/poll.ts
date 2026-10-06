import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { Command } from "../../types/discord";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Create a native Discord poll.")
    .addStringOption(opt =>
      opt.setName("question").setDescription("The poll question").setRequired(true).setMaxLength(300)
    )
    .addIntegerOption(opt =>
      opt.setName("duration")
        .setDescription("How long the poll should run for")
        .setRequired(true)
        .addChoices(
          { name: "1 Hour", value: 1 },
          { name: "4 Hours", value: 4 },
          { name: "8 Hours", value: 8 },
          { name: "24 Hours (1 Day)", value: 24 },
          { name: "3 Days", value: 72 },
          { name: "7 Days (1 Week)", value: 168 }
        )
    )
    .addBooleanOption(opt =>
      opt.setName("multiselect")
        .setDescription("Allow users to vote for multiple options (default: false)")
        .setRequired(false)
    )
    .addStringOption(opt => opt.setName("option1").setDescription("Option 1").setRequired(true).setMaxLength(55))
    .addStringOption(opt => opt.setName("option2").setDescription("Option 2").setRequired(true).setMaxLength(55))
    .addStringOption(opt => opt.setName("option3").setDescription("Option 3").setRequired(false).setMaxLength(55))
    .addStringOption(opt => opt.setName("option4").setDescription("Option 4").setRequired(false).setMaxLength(55))
    .addStringOption(opt => opt.setName("option5").setDescription("Option 5").setRequired(false).setMaxLength(55))
    .addStringOption(opt => opt.setName("option6").setDescription("Option 6").setRequired(false).setMaxLength(55))
    .addStringOption(opt => opt.setName("option7").setDescription("Option 7").setRequired(false).setMaxLength(55))
    .addStringOption(opt => opt.setName("option8").setDescription("Option 8").setRequired(false).setMaxLength(55))
    .addStringOption(opt => opt.setName("option9").setDescription("Option 9").setRequired(false).setMaxLength(55))
    .addStringOption(opt => opt.setName("option10").setDescription("Option 10").setRequired(false).setMaxLength(55)),

  execute: async (interaction: ChatInputCommandInteraction) => {
    const question = interaction.options.getString("question", true);
    const durationHours = interaction.options.getInteger("duration", true);
    const multiselect = interaction.options.getBoolean("multiselect") ?? false;
    
    const options: string[] = [];
    for (let i = 1; i <= 10; i++) {
      const opt = interaction.options.getString(`option${i}`);
      if (opt) {
        options.push(opt.trim());
      }
    }

    if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) {
      await interaction.reply({ content: "❌ Poll options must be distinct.", ephemeral: true });
      return;
    }

    // Native polls are sent via interaction.reply with the `poll` payload
    await interaction.reply({
      poll: {
        question: { text: question },
        answers: options.map(opt => ({ text: opt })),
        allowMultiselect: multiselect,
        duration: durationHours,
      }
    });
  },

  botPermissions: [PermissionFlagsBits.SendMessages],
};
