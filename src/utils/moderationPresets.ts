import { AutocompleteInteraction } from "discord.js";

export const MOD_REASON_PRESETS = [
  { name: "Spam — Flooding, repeat messaging, or unsolicited ads", value: "Spam" },
  { name: "NSFW — Inappropriate media or discussion", value: "NSFW" },
  { name: "Harassment — Insults, toxic behavior, or targeting members", value: "Harassment" },
  { name: "Rule Evasion — Attempting to circumvent staff actions or filters", value: "Rule Evasion" },
  { name: "Unauthorized Advertising — Server invites or self-promotion", value: "Unauthorized Advertising" },
];

export async function handleReasonAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused().trim().toLowerCase();
  const matches = MOD_REASON_PRESETS.filter(
    (p) => !focused || p.name.toLowerCase().includes(focused) || p.value.toLowerCase().includes(focused)
  );
  const results = matches.slice(0, 10).map((p) => ({ name: p.name, value: p.value }));
  if (focused && !MOD_REASON_PRESETS.some((p) => p.value.toLowerCase() === focused)) {
    results.unshift({ name: `Custom: "${focused.slice(0, 80)}"`, value: focused.slice(0, 100) });
  }
  await interaction.respond(results.slice(0, 25));
}

