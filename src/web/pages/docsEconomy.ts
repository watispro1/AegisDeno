/** The Economy section of /docs, with the defaults table read from the live settings so it can't drift. */
import { DEFAULT_ECONOMY_CONFIG, ECONOMY_LIMITS, type EconomyNumberKey } from "../../services/economyLogic";
import { COINFLIP_RETURN_PERCENT } from "../../services/economyRules";
import { cmdBlock } from "./shared";
import { docHeading } from "./docsData";

/** [setting key, label, what it does] for the defaults table. */
export const ECONOMY_DOC_ROWS: Array<[EconomyNumberKey, string, string]> = [
  ["dailyAmount", "Daily amount", "Coins from /daily."],
  ["dailyStreakBonus", "Streak bonus", "Extra coins per day in a row."],
  ["dailyStreakCapDays", "Streak bonus days", "The bonus stops growing after this many days (0 = no bonus)."],
  ["dailyCooldownHours", "Daily cooldown (hours)", "Claim again within two cooldowns to keep the streak."],
  ["weeklyAmount", "Weekly amount", "Coins from /weekly, once every 7 days (0 = off)."],
  ["workMin", "Work minimum", "Least coins from /work."],
  ["workMax", "Work maximum", "Most coins from /work."],
  ["workCooldownMinutes", "Work cooldown (minutes)", ""],
  ["bankCap", "Bank limit", "Most coins one member can keep in the bank (0 = no limit)."],
  ["payConfirmThreshold", "Pay confirmation", "/pay asks to confirm at or above this (0 = never)."],
  ["payMinMemberHours", "Hours before paying", "Time in the server before a member can send coins."],
  ["payDailyLimit", "Daily sending limit", "Per member, resets 00:00 UTC (0 = no limit)."],
  ["payTaxPercent", "Pay tax (%)", "Removed from each payment."],
  ["shopSellPercent", "Sell-back rate (%)", "What /shop sell pays, as a share of the price (0 = off)."],
  ["crimeSuccessPercent", "Crime success (%)", ""],
  ["crimeMin", "Crime minimum", "Least coins from a successful /crime."],
  ["crimeMax", "Crime maximum", "Most coins from a successful /crime."],
  ["crimeFine", "Crime fine", "Never more than the wallet holds."],
  ["crimeCooldownMinutes", "Crime cooldown (minutes)", ""],
  ["gambleMinBet", "Minimum bet", ""],
  ["gambleMaxBet", "Maximum bet", ""],
  ["gambleDailyLossCap", "Daily loss limit", "Net losses per member per UTC day (0 = no limit)."],
  ["gambleCooldownSeconds", "Seconds between bets", ""],
];

const n = (v: number) => v.toLocaleString("en-US");

export function economyDefaultsTable(): string {
  const rows = ECONOMY_DOC_ROWS.map(([key, label, note]) =>
    `<tr><td>${label}</td><td>${n(DEFAULT_ECONOMY_CONFIG[key])}</td><td>${n(ECONOMY_LIMITS[key][0])} to ${n(ECONOMY_LIMITS[key][1])}</td><td>${note}</td></tr>`).join("\n            ");
  return `<div class="table-wrap">
        <table>
          <caption class="visually-hidden">Economy settings, defaults and limits</caption>
          <thead><tr><th>Setting</th><th>Default</th><th>Allowed</th><th>Notes</th></tr></thead>
          <tbody>
            <tr><td>Crime</td><td>on</td><td>on or off</td><td><code>/economy risk crime:</code></td></tr>
            <tr><td>Gambling</td><td>off</td><td>on or off</td><td><code>/economy risk gambling:</code></td></tr>
            ${rows}
          </tbody>
        </table>
      </div>`;
}

export function economyDocsSection(): string {
  return `${docHeading("economy", "Economy", 3)}
      ${cmdBlock(`/economy toggle enabled:true
/economy config currency_name:gems currency_emoji:💎 daily_amount:150 weekly_amount:500
/economy risk gambling:true max_bet:1000 daily_loss_cap:5000
/balance
/daily
/weekly
/work
/crime
/deposit amount:all
/withdraw amount:500
/pay user:@Member amount:250
/gamble coinflip bet:100 call:Heads
/gamble slots bet:50
/leaderboard sort:Wallet
/shop add name:VIP pass price:5000 role:@VIP role_hours:168 use_to_grant:true per_user_limit:1
/shop buy item:(pick from the list)
/use item:VIP pass
/shop sell item:(pick from your inventory)
/inventory
/economy give user:@Member amount:500 reason:Event winner`)}
      <p>The economy is per server and <strong>off until a server manager turns it on</strong> with <code>/economy toggle</code> or on the dashboard's Economy page. <code>/daily</code> pays once per cooldown (24 hours by default) with a streak bonus; claiming again within two cooldowns keeps the streak, and the bonus grows for 7 days by default. <code>/weekly</code> pays once every 7 days. <code>/work</code> pays a random amount once an hour, and <code>/crime</code> pays more but fails half the time by default, with a fine that is never more than your wallet holds. Cooldowns are stored in the database, so a restart never resets them, and <code>/balance</code> shows when each one is ready.</p>
      <p>Coins sit in a <strong>wallet</strong> or a <strong>bank</strong>: <code>/deposit</code> and <code>/withdraw</code> take a number, <code>all</code> or <code>half</code>, and bank coins are safe from crime fines. The leaderboard ranks by wallet plus bank, or by wallet or bank alone. <code>/pay</code> refuses yourself and bots, asks you to confirm large amounts, needs the sender to have been in the server for 24 hours by default, and has a daily sending limit and an optional tax (removed from circulation). Every transfer is in the transaction log.</p>
      <p><strong>Gambling is off until a server manager turns it on</strong> with <code>/economy risk gambling:true</code>. Coinflip pays ${COINFLIP_RETURN_PERCENT / 100}× the bet on a right call (a 2% house edge); slots return about 96.4% of bets over time (a 3.6% house edge); <code>/gamble info</code> shows the paytable. Bets have a minimum, a maximum, a few seconds' cooldown and a daily loss limit per member, all checked in the same database update that takes the bet. Outcomes use a cryptographic random number generator.</p>
      <p>Shop items can be collectibles or hand out a role, for good or for a set number of hours (Aegis takes timed roles back like <code>/temprole</code>). A role item can be given on purchase or kept in the inventory until the member runs <code>/use</code>. The role must be below Aegis's highest role and below your own (the server owner is exempt), and Aegis checks again when the role is given, refunding the coins or returning the item if it can't be. Items can have limited stock and a per-member purchase limit; <code>/shop sell</code> buys items back at 50% of the price by default (not roles already given on purchase).</p>
      <p>Balances are whole coins, never negative, and capped at one trillion; every change is a single atomic database update with its checks in the query, so two commands at once cannot spend the same coins twice or pass a limit. <code>/economy give</code>, <code>take</code> and <code>reset</code> (wallet and bank) are posted to the mod log. The leaderboard never pings anyone. Transactions are kept for 90 days.</p>
      ${economyDefaultsTable()}`;
}
