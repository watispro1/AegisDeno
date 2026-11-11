/** Manual verification from /verify: one member (user) or a pasted list of IDs (batch). */
import {
  ChatInputCommandInteraction,
  type Guild,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from "discord.js";
import { scopedModalId } from "../../../utils/modal";
import { getVerificationConfig } from "../../../services/verificationService";

/**
 * Why Aegis cannot hand out the verified role, as a message that says how to
 * fix it, or null when it can. Checked up front so a deleted role or one above
 * Aegis's own role gets a clear answer instead of every member "failing".
 */
export function verifiedRoleProblem(guild: Pick<Guild, "roles">, roleId: string): string | null {
  const role = guild.roles.cache.get(roleId);
  if (!role) return "❌ The verified role no longer exists. Pick a new one with `/verify setup`.";
  if (role.managed) return `❌ <@&${roleId}> is managed by an integration, so it can't be assigned. Pick another role with \`/verify setup\`.`;
  if (!role.editable) {
    return `❌ <@&${roleId}> is above my highest role (or I lack Manage Roles). Drag the Aegis role above it in Server Settings → Roles, then try again.`;
  }
  return null;
}

/** Split pasted text into unique Discord user IDs, capped at `max`. */
export function parseBatchIds(raw: string, max = 50): { ids: string[]; dropped: number } {
  const all = [...new Set(raw.match(/\d{17,20}/g) ?? [])];
  return { ids: all.slice(0, max), dropped: Math.max(0, all.length - max) };
}

export async function verifyUser(interaction: ChatInputCommandInteraction, guild: Guild, guildId: string): Promise<unknown> {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.reply({ content: "❌ You need `Manage Roles` to verify members manually.", flags: MessageFlags.Ephemeral });
  }

  const config = await getVerificationConfig(guildId);
  if (!config || !config.enabled || !config.verifiedRoleId) {
    return interaction.reply({ content: "❌ Verification is not enabled or configured.", flags: MessageFlags.Ephemeral });
  }

  const roleProblem = verifiedRoleProblem(guild, config.verifiedRoleId);
  if (roleProblem) return interaction.reply({ content: roleProblem, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

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

  const roleProblem = verifiedRoleProblem(guild, config.verifiedRoleId);
  if (roleProblem) return interaction.reply({ content: roleProblem, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

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
  const { ids, dropped } = parseBatchIds(rawIds);

  if (ids.length === 0) {
    await modalResponse.editReply("❌ No valid Discord IDs found in the input. Paste user IDs (17–20 digits) separated by spaces, commas or new lines.");
    return;
  }

  let success = 0;
  let failed = 0;
  let already = 0;

  // One gateway request for every ID instead of one REST call each; IDs that
  // aren't in the server are simply missing from the result.
  const found = await guild.members.fetch({ user: ids, time: 15_000 }).catch(() => null);
  const notFound = found ? ids.filter((id) => !found.has(id)).length : 0;
  failed += notFound;

  for (const id of ids) {
    const member = found ? found.get(id) : await guild.members.fetch(id).catch(() => null);
    if (!member) {
      if (!found) failed++;
      continue;
    }
    if (member.roles.cache.has(config.verifiedRoleId)) {
      already++;
      continue;
    }
    try {
      await member.roles.add(config.verifiedRoleId, `Batch verified by ${interaction.user.tag}`);
      success++;
    } catch {
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
  if (dropped > 0) resultEmbed.setFooter({ text: `${dropped} more ID(s) were left out: at most 50 per batch. Run it again for the rest.` });

  await modalResponse.editReply({ embeds: [resultEmbed] });
  return;
}
