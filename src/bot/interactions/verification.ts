/**
 * Verification button and the CAPTCHA modal.
 *
 * customIds (unchanged): verify_start (button), verify_captcha_modal (modal) with input verify_captcha_answer
 */
import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { ComponentRoute } from "./router";
import { captchaStore, getVerificationConfig, processVerification } from "../../services/verificationService";
import { generateMathCaptcha } from "../../services/verificationLogic";

export const CAPTCHA_MODAL_ID = "verify_captcha_modal";
export const CAPTCHA_INPUT_ID = "verify_captcha_answer";

const MEMBER_NOT_FOUND = "❌ Unable to locate your member record in this server. Please rejoin or try again.";

export const verificationRoutes: ComponentRoute[] = [
  {
    name: "verify-start",
    match: "verify_start",
    async handle(interaction) {
      if (!interaction.isButton() || !interaction.guild || !interaction.member) return;
      const config = await getVerificationConfig(interaction.guild.id);

      // CAPTCHA mode: answer a small math problem in a modal before the role is granted.
      if (config?.enabled && config.type === "captcha") {
        const cached = interaction.guild.members.cache.get(interaction.user.id);
        if (cached?.roles.cache.has(config.verifiedRoleId)) {
          await interaction.reply({ content: "You are already verified!", flags: MessageFlags.Ephemeral });
          return;
        }

        const captcha = generateMathCaptcha();
        captchaStore.issue(interaction.guild.id, interaction.user.id, captcha.answer);

        const modal = new ModalBuilder()
          .setCustomId(CAPTCHA_MODAL_ID)
          .setTitle("Verification check")
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId(CAPTCHA_INPUT_ID)
                .setLabel(`What is ${captcha.question}?`)
                .setStyle(TextInputStyle.Short)
                .setMinLength(1)
                .setMaxLength(6)
                .setRequired(true)
                .setPlaceholder("Type the number"),
            ),
          );
        await interaction.showModal(modal);
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      if (!member) {
        await interaction.editReply({ content: MEMBER_NOT_FOUND });
        return;
      }
      const result = await processVerification(interaction.guild, member);
      await interaction.editReply({ content: result.message });
    },
  },
  {
    name: "verify-captcha",
    match: CAPTCHA_MODAL_ID,
    async handle(interaction) {
      if (!interaction.isModalSubmit() || !interaction.guild) return;
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const answer = interaction.fields.getTextInputValue(CAPTCHA_INPUT_ID);
      const outcome = captchaStore.check(interaction.guild.id, interaction.user.id, answer);

      if (outcome === "expired") {
        await interaction.editReply({ content: "⌛ That check expired. Press the verify button again for a new one." });
        return;
      }
      if (outcome === "wrong") {
        await interaction.editReply({ content: "❌ That answer is not right. Press the verify button to get a new question." });
        return;
      }
      if (outcome === "locked") {
        await interaction.editReply({ content: "❌ Too many wrong answers. Press the verify button to start again." });
        return;
      }

      const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      if (!member) {
        await interaction.editReply({ content: MEMBER_NOT_FOUND });
        return;
      }
      const result = await processVerification(interaction.guild, member);
      await interaction.editReply({ content: result.message });
    },
  },
];
