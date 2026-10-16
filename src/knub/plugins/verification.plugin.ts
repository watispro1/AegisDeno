import { definePlugin } from "../definePlugin";

export interface VerificationPluginConfig {
  requireVerifiedEmail: boolean;
}

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
        await interaction.deferReply({ ephemeral: true });

        const { processVerification } = await import("../../services/verificationService");
        const member = await interaction.guild.members.fetch(interaction.user.id);
        const result = await processVerification(interaction.guild, member);

        await interaction.editReply({ content: result.message });
      },
    },
  ],
});
