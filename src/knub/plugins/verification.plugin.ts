import { definePlugin } from "../definePlugin";
import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

export interface VerificationPluginConfig {
  requireVerifiedEmail: boolean;
}

const CAPTCHA_MODAL_ID = "verify_captcha_modal";
const CAPTCHA_INPUT_ID = "verify_captcha_answer";

export const VerificationPlugin = definePlugin<VerificationPluginConfig>({
  name: "verification",
  description: "Server entry gatekeeper with button or captcha-based verification",
  version: "1.0.0",
  defaultConfig: {
    requireVerifiedEmail: false,
  },
  customIdHandlers: [
    {
      pattern: "verify_start",
      async handler(interaction) {
        if (!interaction.isButton() || !interaction.guild || !interaction.member) return;

        const { processVerification, getVerificationConfig, captchaStore } = await import("../../services/verificationService");
        const config = await getVerificationConfig(interaction.guild.id);

        // CAPTCHA mode: answer a small math problem in a modal before the role is granted.
        if (config?.enabled && config.type === "captcha") {
          const member = interaction.guild.members.cache.get(interaction.user.id);
          if (member?.roles.cache.has(config.verifiedRoleId)) {
            await interaction.reply({ content: "You are already verified!", flags: MessageFlags.Ephemeral });
            return;
          }

          const { generateMathCaptcha } = await import("../../services/verificationLogic");
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
          await interaction.editReply({ content: "❌ Unable to locate your member record in this server. Please rejoin or try again." });
          return;
        }
        const result = await processVerification(interaction.guild, member);

        await interaction.editReply({ content: result.message });
      },
    },
    {
      pattern: CAPTCHA_MODAL_ID,
      async handler(interaction) {
        if (!interaction.isModalSubmit() || !interaction.guild) return;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const { processVerification, captchaStore } = await import("../../services/verificationService");
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
          await interaction.editReply({ content: "❌ Unable to locate your member record in this server. Please rejoin or try again." });
          return;
        }
        const result = await processVerification(interaction.guild, member);
        await interaction.editReply({ content: result.message });
      },
    },
  ],
});
