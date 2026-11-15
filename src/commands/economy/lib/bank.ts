/**
 * /deposit and /withdraw: read the amount (numbers, 2.5k, all, half), move
 * it with the service's guarded bank move, and answer with the shared
 * embed showing wallet and bank afterwards. Amount autocomplete suggests
 * All and Half of what is actually there.
 */
import { MessageFlags, type AutocompleteInteraction, type ChatInputCommandInteraction } from "discord.js";
import { economy } from "../../../services/economyService";
import { economyGate, NO_PINGS } from "../../../services/economyDiscord";
import { formatCoins, type EconomyConfig } from "../../../services/economyLogic";
import { parseAmountInput, textAmountChoices } from "./amounts";
import { withMemberLock } from "./memberLock";
import { STILL_RUNNING, economyEmbed } from "./ui";

export type BankDirection = "deposit" | "withdraw";

type BankFailure = "busy" | "invalid" | "empty" | "insufficient" | "bank_full" | "wallet_full" | string;

/** The private message for a refused bank move. Pure, for tests. */
export function bankRefusalText(cfg: EconomyConfig, direction: BankDirection, reason: BankFailure, have: { wallet: number; bank: number }): string {
  const where = direction === "deposit" ? "wallet" : "bank";
  switch (reason) {
    case "busy": return "❌ Your balance changed while that was running. Run it again.";
    case "invalid": return "❌ I couldn't read that amount. Use a whole number (like `1500` or `2.5k`), `all` or `half`.";
    case "empty": return direction === "deposit"
      ? "❌ Your wallet is empty. Earn some with `/daily` or `/work` first."
      : "❌ Your bank is empty. Move coins in with `/deposit` first.";
    case "insufficient": return `❌ You only have ${formatCoins(cfg, direction === "deposit" ? have.wallet : have.bank)} in your ${where}. Try \`all\`.`;
    case "bank_full": return `❌ Your bank is full (limit ${formatCoins(cfg, cfg.bankCap)}).${have.bank < cfg.bankCap ? ` It has room for ${formatCoins(cfg, cfg.bankCap - have.bank)} more.` : ""}`;
    default: return "❌ Your wallet is at the maximum, so nothing was moved.";
  }
}

export async function runBank(interaction: ChatInputCommandInteraction, direction: BankDirection): Promise<void> {
  const cfg = await economyGate(interaction);
  if (!cfg) return;
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;
  const raw = interaction.options.getString("amount", true);
  const request = parseAmountInput(raw);
  const svc = economy();
  if (request === null) {
    const acct = await svc.balance(guildId, userId);
    await interaction.reply({ content: bankRefusalText(cfg, direction, "invalid", { wallet: acct.balance, bank: acct.bank }), flags: MessageFlags.Ephemeral });
    return;
  }
  const locked = await withMemberLock(guildId, userId, () => direction === "deposit"
    ? svc.deposit(guildId, userId, request)
    : svc.withdraw(guildId, userId, request));
  if (!locked.ok) {
    await interaction.reply({ content: STILL_RUNNING, flags: MessageFlags.Ephemeral });
    return;
  }
  const r = locked.value;
  if (!r.ok) {
    const have = "wallet" in r ? { wallet: r.wallet, bank: r.bank } : await svc.balance(guildId, userId).then(a => ({ wallet: a.balance, bank: a.bank }));
    await interaction.reply({ content: bankRefusalText(cfg, direction, r.reason, have), flags: MessageFlags.Ephemeral, allowedMentions: NO_PINGS });
    return;
  }
  const deposit = direction === "deposit";
  // "all" stops at the bank's limit (deposit) or the wallet's maximum (withdraw); say so when coins were left behind.
  const left = deposit ? r.wallet : r.bank;
  const capped = request === "all" && left > 0 ? (deposit ? " (as much as the bank had room for)" : " (as much as the wallet could hold)") : "";
  await interaction.reply({
    embeds: [economyEmbed(cfg, {
      tone: "ok",
      title: deposit ? "🏦 Deposited" : "👛 Withdrew",
      description: `Moved **${formatCoins(cfg, r.amount)}** ${deposit ? "into your bank" : "into your wallet"}${capped}.`,
      balance: { wallet: r.wallet, bank: r.bank, bankCap: cfg.bankCap },
      footer: deposit ? "Coins in the bank are safe from /rob and /crime fines." : null,
    })],
    flags: MessageFlags.Ephemeral,
    allowedMentions: NO_PINGS,
  });
}

/** Amount suggestions: All and Half of the wallet (deposit) or bank (withdraw), plus the typed number. */
export async function bankAutocomplete(interaction: AutocompleteInteraction, direction: BankDirection): Promise<void> {
  if (!interaction.guildId) return interaction.respond([]);
  const [cfg, acct] = await Promise.all([
    economy().config(interaction.guildId).catch(() => null),
    economy().balance(interaction.guildId, interaction.user.id).catch(() => null),
  ]);
  if (!cfg || !acct) return interaction.respond([]).catch(() => undefined);
  const room = direction === "deposit" && cfg.bankCap > 0 ? Math.max(0, cfg.bankCap - acct.bank) : Number.MAX_SAFE_INTEGER;
  const available = direction === "deposit" ? Math.min(acct.balance, room) : acct.bank;
  const choices = textAmountChoices(cfg, available, String(interaction.options.getFocused() ?? ""), direction === "deposit" ? "wallet" : "bank");
  await interaction.respond(choices).catch(() => undefined);
}
