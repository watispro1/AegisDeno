import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { Command } from "../../types/discord";

const NUMBER_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Create a simple poll.")
    .addStringOption(opt =>
      opt.setName("question").setDescription("The poll question").setRequired(true)
    )
    .addStringOption(opt => opt.setName("option1").setDescription("Option 1").setRequired(true))
    .addStringOption(opt => opt.setName("option2").setDescription("Option 2").setRequired(true))
    .addStringOption(opt => opt.setName("option3").setDescription("Option 3").setRequired(false))
    .addStringOption(opt => opt.setName("option4").setDescription("Option 4").setRequired(false))
    .addStringOption(opt => opt.setName("option5").setDescription("Option 5").setRequired(false)),

  execute: async (interaction: ChatInputCommandInteraction) => {
    const question = interaction.options.getString("question", true);
    
    const options: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const opt = interaction.options.getString(`option${i}`);
      if (opt) options.push(opt);
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle(`📊 Poll: ${question}`)
      .setDescription(options.map((opt, i) => `${NUMBER_EMOJIS[i]} ${opt}`).join("\n\n"))
      .setFooter({ text: `Poll created by ${interaction.user.tag}` })
      .setTimestamp();

    const message = await interaction.reply({ embeds: [embed], fetchReply: true });

    try {
      for (let i = 0; i < options.length; i++) {
        await message.react(NUMBER_EMOJIS[i]);
      }
    } catch {
      // Ignored if reaction fails
    }
  },
};
