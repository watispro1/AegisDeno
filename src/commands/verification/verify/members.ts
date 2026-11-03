/** Manual verification from /verify: one member (user) or a pasted list of IDs (batch). */
import { ChatInputCommandInteraction, type Guild, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } from "discord.js";
import { scopedModalId } from "../../../utils/modal";
import { getVerificationConfig } from "../../../services/verificationService";

export async function verifyUser(interaction: ChatInputCommandInteraction, guild: Guild, guildId: string): Promise<unknown> {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.reply({ content: "❌ You need `Manage Roles` to verify members manually.", flags: MessageFlags.Ephemeral });
  }

  const config = await getVerificationConfig(guildId);
  if (!config || !config.enabled || !config.verifiedRoleId) {
    return interaction.reply({ content: "❌ Verification is not enabled or configured.", flags: MessageFlags.Ephemeral });
  }

  const targetUser = interaction.options.getUser("target", true);
  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
  
  if (!targetMember) {
    return interaction.reply({ content: "❌ Member not found in the server.", flags: MessageFlags.Ephemeral });
  }

  if (targetMember.roles.cache.has(config.verifiedRoleId)) {
    return interaction.reply({ content: "⚠️ That member is already verified.", flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    await targetMember.roles.add(config.verifiedRoleId, `Manually verified by ${interaction.user.tag}`);
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle("✅ Manual Verification")
          .setDescription(`Manually verified <@${targetMember.id}> and assigned the <@&${config.verifiedRoleId}> role.`)
          .setTimestamp(),
      ],
    });
  } catch (e) {
    await interaction.editReply("❌ Failed to assign the verified role. Check my role hierarchy permissions.");
  }
  return;
}

export async function verifyBatch(interaction: ChatInputCommandInteraction, guild: Guild, guildId: string): Promise<unknown> {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.reply({ content: "❌ You need `Manage Roles` to verify members manually.", flags: MessageFlags.Ephemeral });
  }

  const config = await getVerificationConfig(guildId);
  if (!config || !config.enabled || !config.verifiedRoleId) {
    return interaction.reply({ content: "❌ Verification is not enabled or configured.", flags: MessageFlags.Ephemeral });
  }

  const modal = new ModalBuilder()
    .setCustomId(scopedModalId("verify_batch_modal", interaction.id))
    .setTitle("Batch Verify Members");

  const idsInput = new TextInputBuilder()
    .setCustomId("batch_ids")
    .setLabel("Discord User IDs (comma or space separated)")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setPlaceholder("e.g. 123456789012345678, 987654321098765432");

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(idsInput));
  await interaction.showModal(modal);

  const modalResponse = await interaction.awaitModalSubmit({
    time: 300_000,
    filter: (m) => m.user.id === interaction.user.id && m.customId === scopedModalId("verify_batch_modal", interaction.id),
  }).catch(() => null);

  if (!modalResponse) return;
  await modalResponse.deferReply({ flags: MessageFlags.Ephemeral });

  const rawIds = modalResponse.fields.getTextInputValue("batch_ids");
  const ids = [...new Set(rawIds.match(/\d{17,20}/g) || [])].slice(0, 50); // limit 50

  if (ids.length === 0) {
    await modalResponse.editReply("❌ No valid Discord IDs found in the input.");
    return;
  }

  let success = 0;
  let failed = 0;
  let already = 0;

  for (const id of ids) {
    try {
      const member = await guild.members.fetch(id).catch(() => null);
      if (!member) {
        failed++;
        continue;
      }
      if (member.roles.cache.has(config.verifiedRoleId)) {
        already++;
        continue;
      }
      await member.roles.add(config.verifiedRoleId, `Batch verified by ${interaction.user.tag}`);
      success++;
    } catch (e) {
      failed++;
    }
  }

  const resultEmbed = new EmbedBuilder()
    .setColor(success > 0 ? 0x57F287 : 0xED4245)
    .setTitle("✅ Batch Verification Complete")
    .addFields(
      { name: "Total Processed", value: `${ids.length}`, inline: true },
      { name: "Successfully Verified", value: `✅ ${success}`, inline: true },
      { name: "Already Verified", value: `⚠️ ${already}`, inline: true },
      { name: "Failed / Not Found", value: `❌ ${failed}`, inline: true },
    )
    .setTimestamp();

  await modalResponse.editReply({ embeds: [resultEmbed] });
  return;
}
