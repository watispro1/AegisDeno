/**
 * Pure status helpers for /balance, /daily and /gamble: when a daily streak
 * breaks, what the next daily pays, and when a bet is big enough to ask first.
 */
import { dailyClaim, formatCoins, relativeTimestamp, type EconomyConfig } from "./economyLogic";
import type { LeaderboardRank } from "./economyStore";

/** When the current daily streak is lost if not claimed (two cooldowns after the last claim), or null when there is none to lose. */
export function streakDeadline(lastDaily: Date | null, streak: number, now: number, cfg: EconomyConfig): number | null {
  if (!lastDaily || streak < 1) return null;
  const deadline = lastDaily.getTime() + cfg.dailyCooldownHours * 3_600_000 * 2;
  return deadline > now ? deadline : null;
}

/** What the next /daily pays if claimed as soon as it's ready (streak kept). */
export function nextDailyAmount(lastDaily: Date | null, streak: number, now: number, cfg: EconomyConfig): number {
  const first = dailyClaim(lastDaily, streak, now, cfg);
  if (first.ok) return first.amount;
  const ready = dailyClaim(lastDaily, streak, first.retryAt, cfg);
  return ready.ok ? ready.amount : cfg.dailyAmount;
}

/** "🔥 4 days · keep it by <t:…:R>", "Lost: claim to start again", or "—". */
export function streakLine(lastDaily: Date | null, streak: number, now: number, cfg: EconomyConfig): string {
  if (streak < 1) return "—";
  const deadline = streakDeadline(lastDaily, streak, now, cfg);
  const days = `${streak} day${streak === 1 ? "" : "s"}`;
  if (deadline === null) return `~~${days}~~ ended: your next \`/daily\` starts a new one`;
  return `🔥 ${days} · claim ${relativeTimestamp(deadline)} at the latest to keep it`;
}

/** "#3 of 40 (wallet + bank)", or null when unranked. */
export function rankLine(rank: LeaderboardRank | null): string | null {
  return rank ? `#${rank.rank.toLocaleString("en-US")} of ${rank.total.toLocaleString("en-US")}` : null;
}

/**
 * A bet asks for confirmation when it is at least half the wallet and at
 * least the server's large-amount threshold (the one /pay uses). A
 * threshold of 0 means staff turned confirmations off.
 */
export function needsBetConfirmation(bet: number, wallet: number, cfg: EconomyConfig): boolean {
  if (cfg.payConfirmThreshold <= 0 || bet < cfg.payConfirmThreshold) return false;
  return bet * 2 >= wallet;
}

export function betPrompt(cfg: EconomyConfig, bet: number, wallet: number): string {
  const share = wallet > 0 ? Math.min(100, Math.round((bet / wallet) * 100)) : 100;
  return `Bet **${formatCoins(cfg, bet)}**? That's ${share}% of your wallet (${formatCoins(cfg, wallet)}).`;
}
