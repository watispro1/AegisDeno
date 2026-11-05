/** Shared body of /deposit and /withdraw. */
import { MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import { economy } from "./economyService";
import { economyGate, NO_PINGS } from "./economyDiscord";
import { formatCoins } from "./economyLogic";
import { parseAmountOrAll } from "./economyRules";

export async function runBankCommand(interaction: ChatInputCommandInteraction, direction: "deposit" | "withdraw"): Promise<void> {
  const cfg = await economyGate(interaction);
  if (!cfg) return;
  const request = parseAmountOrAll(interaction.options.getString("amount", true));
  const svc = economy();
  const r = direction === "deposit"
    ? await svc.deposit(interaction.guildId!, interaction.user.id, request)
    : await svc.withdraw(interaction.guildId!, interaction.user.id, request);
  if (!r.ok) {
    const where = direction === "deposit" ? "wallet" : "bank";
    const msg = r.reason === "busy" ? "Your balance changed while that was running. Run it again."
      : r.reason === "invalid" ? "Amount must be a whole number, `all` or `half`."
      : r.reason === "empty" ? `Your ${where} is empty.`
      : r.reason === "insufficient" ? `You only have ${formatCoins(cfg, direction === "deposit" ? r.wallet : r.bank)} in your ${where}.`
      : r.reason === "bank_full" ? `Your bank is full (limit ${formatCoins(cfg, cfg.bankCap)}).`
      : "Your wallet is at the maximum.";
    await interaction.reply({ content: `❌ ${msg}`, flags: MessageFlags.Ephemeral });
    return;
  }
  const verb = direction === "deposit" ? "🏦 Deposited" : "👛 Withdrew";
  await interaction.reply({
    content: `${verb} **${formatCoins(cfg, r.amount)}**. Wallet: ${formatCoins(cfg, r.wallet)} · Bank: ${formatCoins(cfg, r.bank)}${cfg.bankCap > 0 ? ` / ${formatCoins(cfg, cfg.bankCap)}` : ""}.`,
    flags: MessageFlags.Ephemeral,
    allowedMentions: NO_PINGS,
  });
}
