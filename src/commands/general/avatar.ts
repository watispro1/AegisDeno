import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type ImageExtension,
} from "discord.js";
import type { Command } from "../../types/discord";
import { avatarLinkLine } from "../../services/lookupFormat";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Show a member's avatar in full size, with download links.")
    .addUserOption(o => o.setName("user").setDescription("Whose avatar (defaults to you)").setRequired(false))
    .addBooleanOption(o => o.setName("server").setDescription("Show their server avatar instead of their main one, when they set one").setRequired(false)),
  guildOnly: true,
  cooldownMs: 2000,

  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser("user") ?? interaction.user;
    const wantServer = interaction.options.getBoolean("server") ?? false;
    const member = wantServer && interaction.guild
      ? await interaction.guild.members.fetch(user.id).catch(() => null)
      : null;

    const useServer = Boolean(member?.avatar);
    const hash = useServer ? member!.avatar : user.avatar;
    const animated = Boolean(hash?.startsWith("a_"));
    const urlFor = (extension: string) => useServer
      ? member!.displayAvatarURL({ extension: extension as ImageExtension, size: 4096, forceStatic: extension !== "gif" })
      : user.displayAvatarURL({ extension: extension as ImageExtension, size: 4096, forceStatic: extension !== "gif" });
    const main = useServer ? member!.displayAvatarURL({ size: 4096 }) : user.displayAvatarURL({ size: 4096 });

    const embed = new EmbedBuilder()
      .setColor(member?.displayColor || 0x5865F2)
      .setTitle(`${useServer ? "Server avatar" : "Avatar"} of ${user.username}`)
      .setImage(main)
      .setDescription(hash ? avatarLinkLine(urlFor, animated) : "They use Discord's default avatar.");
    if (wantServer && !useServer) embed.setFooter({ text: "No server avatar set, so this is their main avatar." });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Open full size").setURL(main),
    );
    await interaction.reply({ embeds: [embed], components: [row], allowedMentions: { parse: [] } });
  },
};

export default command;
