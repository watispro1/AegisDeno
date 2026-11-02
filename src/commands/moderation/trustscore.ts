/**
 * /trustscore — deprecated alias of /trust user, kept so existing habits and
 * docs links keep working. Replies with the same Trust Score v2 embed plus a
 * one-line note pointing at /trust user.
 */
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { Command } from "../../types/discord";
import { getGuildConfig } from "../../services/configuration";
import { normalizeTrustConfig } from "../../services/trustEngine";
import { replyWithTrust } from "./trust";

export const TRUSTSCORE_DEPRECATION_NOTE = "ℹ️ `/trustscore` is now `/trust user` — same score, every factor explained. This alias will be removed in a future version.";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("trustscore")
    .setDescription("(Deprecated: use /trust user) A member's explainable Trust Score.")
    .addUserOption(o => o.setName("user").setDescription("Member to evaluate (defaults to yourself)").setRequired(false))
    .addBooleanOption(o => o.setName("ephemeral").setDescription("Only show the response to you (default: true)").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  guildOnly: true,
  userPermissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const user = interaction.options.getUser("user") ?? interaction.user;
    const current = normalizeTrustConfig((await getGuildConfig(interaction.guildId!)).trust);
    await replyWithTrust(interaction, user, current, { ephemeral: interaction.options.getBoolean("ephemeral") ?? true, note: TRUSTSCORE_DEPRECATION_NOTE });
  },
};

export default command;
