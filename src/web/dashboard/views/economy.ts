/** Economy page (/:guildId/economy): switch, settings, shop editor, leaderboard, transactions and balance adjustments. No inline styles or scripts. */
import { escapeHtml as esc, type SiteConfig } from "../../pages";
import type { RoleOption } from "../botView";
import { MAX_BALANCE, SHOP_LIMITS, formatCoins, type EconomyConfig, type ShopItem } from "../../../services/economyLogic";
import type { LeaderboardRow, Transaction, TransactionType } from "../../../services/economyStore";
import { economyValues, settingsSection } from "./economySettings";
import { EFFECT_LABELS, EFFECT_LIMITS, effectSummary } from "../../../services/economyProgress";

export { economyValues };
import { type GuildContext, copyId, csrfField, emptyState, notice, person, relTime } from "./layout";
import { Form, type FormState, type Values } from "./form";
import { actionButton, errorSummary, modulePage, pagerNav, tableFilter } from "./parts";

export const ECONOMY_LEADERBOARD_PAGE = 25;
export const ECONOMY_TX_LIMIT = 25;

export function itemValues(i: ShopItem | null): Values {
  return i
    ? {
      name: i.name, description: i.description, price: String(i.price), roleId: i.roleId ?? "", stock: i.stock === null ? "" : String(i.stock),
      perUserLimit: i.perUserLimit === null ? "" : String(i.perUserLimit), roleDurationHours: i.roleDurationHours === null ? "" : String(i.roleDurationHours), useToGrant: i.useToGrant,
      effect: i.effect ?? "", effectHours: i.effectHours === null ? "" : String(i.effectHours), effectPercent: i.effectPercent === null ? "" : String(i.effectPercent),
    }
    : { name: "", description: "", price: "", roleId: "", stock: "", perUserLimit: "", roleDurationHours: "", useToGrant: false, effect: "", effectHours: "", effectPercent: "" };
}

const TX_LABELS: Record<TransactionType, string> = {
  daily: "Daily", weekly: "Weekly", work: "Work", crime: "Crime", crime_fine: "Crime fine", deposit: "Deposit", withdraw: "Withdrawal",
  gamble: "Gamble", pay_in: "Received", pay_out: "Sent", buy: "Bought", sell: "Sold", use: "Used", refund: "Refund",
  admin_give: "Staff gave", admin_take: "Staff took", admin_reset: "Staff reset",
  rob: "Robbed someone", robbed: "Was robbed", rob_fine: "Rob fine", interest: "Interest",
};

/**
 * Roles a shop item may give: only ones Aegis can assign and that sit below
 * the viewer's highest role. The item's saved role stays listed (marked) so
 * an edit never silently drops it; validation still refuses it.
 */
export function shopRoleOptions(roles: RoleOption[], current = ""): Array<{ value: string; label: string; disabled?: boolean }> {
  const opts: Array<{ value: string; label: string; disabled?: boolean }> = [{ value: "", label: "No role" }];
  for (const r of roles) {
    const ok = r.assignable && !r.aboveViewer && !r.dangerous;
    if (ok) opts.push({ value: r.id, label: `@${r.name}` });
    else if (r.id === current) opts.push({ value: r.id, label: `@${r.name} (can't be sold: ${r.dangerous ? "has staff permissions" : "above Aegis or you"})`, disabled: true });
  }
  return opts;
}

export interface EconomyPageState { form: "settings" | "add" | "adjust" | `edit:${string}`; state: FormState }

export interface EconomyPageData {
  config: EconomyConfig;
  items: ShopItem[];
  leaderboard: { rows: LeaderboardRow[]; total: number; page: number };
  transactions: Transaction[];
  roles: RoleOption[];
  noticeCode: string | null;
  pageState?: EconomyPageState;
}

function itemFields(f: Form, roles: RoleOption[]): string {
  return `<div class="field-row two">
        ${f.text("name", "Name", SHOP_LIMITS.name, undefined, " required")}
        ${f.number("price", "Price", 1, MAX_BALANCE, undefined, " required")}
      </div>
      ${f.text("description", "Description (optional)", SHOP_LIMITS.description)}
      <div class="field-row two">
        ${f.select("roleId", "Role to give (optional)", shopRoleOptions(roles, f.str("roleId")), "Only roles below Aegis's highest role and yours are listed.")}
        ${f.number("stock", "Stock (blank = unlimited)", 0, SHOP_LIMITS.maxStock)}
      </div>
      <div class="field-row two">
        ${f.number("perUserLimit", "Per-member limit (blank = none)", 1, SHOP_LIMITS.maxPerUser, "Counts every unit a member has bought, even ones used or sold.")}
        ${f.number("roleDurationHours", "Role lasts (hours, blank = permanent)", 1, SHOP_LIMITS.maxRoleHours, "Aegis takes the role back after this long.")}
      </div>
      ${f.checkbox("useToGrant", "Give the role on /use", "The item goes to the inventory and the member picks when to use it. Without a role or effect the item is a collectible.")}
      <div class="field-row two">
        ${f.select("effect", "Effect on /use (optional, not with a role)", [
          { value: "", label: "No effect" },
          { value: "rob_shield", label: EFFECT_LABELS.rob_shield },
          { value: "work_boost", label: EFFECT_LABELS.work_boost },
        ], "A rob shield stops /rob against the member; a work boost raises /work pay. Used up on /use.")}
        ${f.number("effectHours", "Effect lasts (hours)", 1, EFFECT_LIMITS.maxHours, "Required for effect items.")}
      </div>
      ${f.number("effectPercent", "Work boost (%)", 1, EFFECT_LIMITS.maxPercent, "Work boosts only: extra /work pay while it runs. Boosts don't stack.")}`;
}

function shopTable(ctx: GuildContext, d: EconomyPageData, base: string): string {
  if (!d.items.length) return emptyState("The shop is empty.", "Add an item below, or with <code class=\"inline\">/shop add</code>.");
  const roleName = (id: string | null) => (id ? `@${esc(d.roles.find(r => r.id === id)?.name ?? id)}` : "—");
  const editing = d.pageState?.form.startsWith("edit:") ? d.pageState.form.slice(5) : null;
  return `${tableFilter("eco-shop", "Filter items")}<div class="table-wrap"><table class="case-table" id="eco-shop"><caption class="visually-hidden">Shop items</caption>
    <thead><tr><th scope="col">Item</th><th scope="col">Price</th><th scope="col">Role</th><th scope="col">Stock</th><th scope="col">Limit</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>
    <tbody>${d.items.map(i => {
      const open = editing === i.id;
      const f = new Form(open && d.pageState ? d.pageState.state : { values: itemValues(i), errors: {} }, `eco-e${i.id.slice(-6)}-`);
      return `<tr>
      <td data-label="Item"><strong>${esc(i.name)}</strong>${i.description ? `<br><span class="faint">${esc(i.description)}</span>` : ""}</td>
      <td data-label="Price">${esc(formatCoins(d.config, i.price))}</td>
      <td data-label="Role">${i.effect ? esc(effectSummary(i.effect, i.effectHours ?? 0, i.effectPercent)) : `${roleName(i.roleId)}${i.roleId && i.roleDurationHours ? ` · ${i.roleDurationHours}h` : ""}${i.roleId && i.useToGrant ? " · on /use" : ""}`}</td>
      <td data-label="Stock">${i.stock === null ? "Unlimited" : i.stock === 0 ? "Sold out" : i.stock.toLocaleString("en-US")}</td>
      <td data-label="Limit">${i.perUserLimit === null ? "—" : `${i.perUserLimit} each`}</td>
      <td><details class="row-edit"${open ? " open" : ""}><summary class="btn sm ghost">Edit</summary>
        ${open ? errorSummary(d.pageState!.state.errors, `f-eco-e${i.id.slice(-6)}-`) : ""}
        <form class="dash-form" method="post" action="${base}/shop/${esc(i.id)}/edit" novalidate>${csrfField(ctx.viewer)}
          ${itemFields(f, d.roles)}
          <button class="btn sm" type="submit" data-save-button>Save item</button>
        </form></details>
        ${actionButton(`${base}/shop/${i.id}/remove`, ctx.viewer.csrf, "Remove", { danger: true, confirm: `Remove ${i.name} from the shop? Members who bought it keep it.` })}</td></tr>`;
    }).join("")}</tbody></table></div>`;
}

function leaderboardTable(ctx: GuildContext, d: EconomyPageData, base: string): string {
  const lb = d.leaderboard;
  if (!lb.rows.length) return emptyState("Nobody has coins yet.", "Members earn them with <code class=\"inline\">/daily</code> and <code class=\"inline\">/work</code>.");
  const pages = Math.max(1, Math.ceil(lb.total / ECONOMY_LEADERBOARD_PAGE));
  const start = (lb.page - 1) * ECONOMY_LEADERBOARD_PAGE;
  return `<div class="table-wrap"><table class="case-table" id="eco-lb"><caption class="visually-hidden">Leaderboard</caption>
    <thead><tr><th scope="col">Rank</th><th scope="col">Member</th><th scope="col">Wallet</th><th scope="col">Bank</th><th scope="col">Total</th></tr></thead>
    <tbody>${lb.rows.map((r, i) => `<tr><td data-label="Rank">${start + i + 1}</td>
      <td data-label="Member"><a href="/dashboard/${esc(ctx.guild.id)}/members/${esc(r.userId)}">${person(ctx, r.userId)}</a> ${copyId(r.userId)}</td>
      <td data-label="Wallet">${esc(formatCoins(d.config, r.balance))}</td>
      <td data-label="Bank">${esc(formatCoins(d.config, r.bank))}</td>
      <td data-label="Total">${esc(formatCoins(d.config, r.total))}</td></tr>`).join("")}</tbody></table></div>
    ${pagerNav(base, p => `?page=${p}#eco-lb-h`, lb.page, pages, lb.total, "member")}`;
}

function transactionsTable(ctx: GuildContext, d: EconomyPageData): string {
  if (!d.transactions.length) return emptyState("No transactions yet.", "Claims, payments, purchases and staff changes show up here for 90 days.");
  return `${tableFilter("eco-tx", "Filter transactions")}<div class="table-wrap"><table class="case-table" id="eco-tx"><caption class="visually-hidden">Recent transactions</caption>
    <thead><tr><th scope="col">When</th><th scope="col">Member</th><th scope="col">Type</th><th scope="col">Amount</th><th scope="col">Balance after</th><th scope="col">Details</th></tr></thead>
    <tbody>${d.transactions.map(t => `<tr><td data-label="When">${relTime(t.createdAt)}</td>
      <td data-label="Member">${person(ctx, t.userId)}</td>
      <td data-label="Type">${esc(TX_LABELS[t.type] ?? t.type)}</td>
      <td data-label="Amount">${t.amount > 0 ? "+" : ""}${t.amount.toLocaleString("en-US")}</td>
      <td data-label="Balance after">${t.balanceAfter.toLocaleString("en-US")}</td>
      <td data-label="Details">${[t.otherUserId ? `${t.type === "pay_in" ? "from" : "to"} ${person(ctx, t.otherUserId)}` : "", t.actorId ? `by ${person(ctx, t.actorId)}` : "", t.note ? esc(t.note) : ""].filter(Boolean).join(" · ") || "—"}</td></tr>`).join("")}</tbody></table></div>`;
}

export function renderEconomy(cfg: SiteConfig, ctx: GuildContext, d: EconomyPageData): string {
  const base = `/dashboard/${esc(ctx.guild.id)}/economy`;
  const c = d.config;
  const ps = d.pageState;
  const settings = new Form(ps?.form === "settings" ? ps.state : { values: economyValues(c), errors: {} }, "eco-");
  const add = new Form(ps?.form === "add" ? ps.state : { values: itemValues(null), errors: {} }, "eco-a-");
  const adjust = new Form(ps?.form === "adjust" ? ps.state : { values: { userId: "", action: "give", amount: "", reason: "" }, errors: {} }, "eco-j-");
  return modulePage(cfg, ctx, {
    active: "economy",
    title: "Economy",
    lead: "Opt-in server coins: <code class=\"inline\">/daily</code>, <code class=\"inline\">/weekly</code>, <code class=\"inline\">/work</code>, <code class=\"inline\">/crime</code>, a bank, <code class=\"inline\">/pay</code>, optional gambling, a shop and a leaderboard. Same as <code class=\"inline\">/economy</code> and <code class=\"inline\">/shop</code>.",
    path: base,
    body: `${notice(d.noticeCode)}
  <dl class="stat-grid">
    <div class="stat"><dt>Status</dt><dd>${c.enabled ? "On" : "Off"}</dd></div>
    <div class="stat"><dt>Members with coins</dt><dd>${d.leaderboard.total.toLocaleString("en-US")}</dd></div>
    <div class="stat"><dt>Shop items</dt><dd>${d.items.length}</dd></div>
  </dl>
  <section class="panel-card" aria-labelledby="eco-switch-h"><h2 id="eco-switch-h">Economy is ${c.enabled ? "on" : "off"}</h2>
    <p class="faint">${c.enabled ? "Members can use the economy commands." : "Members can't use the economy commands. Balances and the shop are kept while it's off."}</p>
    ${actionButton(`${base}/toggle`, ctx.viewer.csrf, c.enabled ? "Turn the economy off" : "Turn the economy on", { ghost: false, danger: c.enabled, fields: { enabled: c.enabled ? "off" : "on" }, ...(c.enabled ? { confirm: "Turn the economy off? Members won't be able to use it until you turn it back on. Nothing is deleted." } : {}) })}
  </section>
  ${settingsSection(ctx, base, settings, ps?.form === "settings" ? ps.state.errors : {})}
  <section class="panel-card" aria-labelledby="eco-shop-h"><h2 id="eco-shop-h">Shop</h2>
    ${shopTable(ctx, d, base)}
    <h3>Add an item</h3>
    ${errorSummary(ps?.form === "add" ? ps.state.errors : {}, "f-eco-a-")}
    <form class="dash-form" method="post" action="${base}/shop/add" novalidate>${csrfField(ctx.viewer)}
      ${itemFields(add, d.roles)}
      <button class="btn" type="submit" data-save-button>Add item</button>
    </form>
  </section>
  <section class="panel-card" aria-labelledby="eco-lb-h"><h2 id="eco-lb-h">Leaderboard</h2>${leaderboardTable(ctx, d, base)}</section>
  <section class="panel-card" aria-labelledby="eco-adj-h"><h2 id="eco-adj-h">Adjust a balance</h2>
    <p class="faint">Give and take change the wallet; reset clears the wallet and the bank. Recorded in the transactions below, the dashboard's Activity log and your mod log channel.</p>
    ${errorSummary(ps?.form === "adjust" ? ps.state.errors : {}, "f-eco-j-")}
    <form class="dash-form" method="post" action="${base}/adjust" novalidate data-confirm="Change this member's balance? It is logged.">${csrfField(ctx.viewer)}
      <div class="field-row two">
        ${adjust.text("userId", "Member's user ID", 20, undefined, ' inputmode="numeric" pattern="\\d{17,20}" spellcheck="false"')}
        ${adjust.select("action", "Action", [{ value: "give", label: "Give coins" }, { value: "take", label: "Take coins" }, { value: "reset", label: "Reset to 0" }])}
      </div>
      <div class="field-row two">
        ${adjust.number("amount", "Amount (not needed for reset)", 1, MAX_BALANCE)}
        ${adjust.text("reason", "Reason (optional)", 200)}
      </div>
      <button class="btn" type="submit" data-save-button>Apply</button>
    </form>
  </section>
  <section class="panel-card" aria-labelledby="eco-tx-h"><h2 id="eco-tx-h">Recent transactions</h2>${transactionsTable(ctx, d)}</section>`,
  });
}

/** Balance card on a member's page. */
export function economyCard(guildId: string, config: EconomyConfig, balance: number, streak: number, bank = 0): string {
  return `<section class="panel-card" aria-labelledby="eco-card-h"><h2 id="eco-card-h">Economy</h2>
    <dl class="stat-grid"><div class="stat"><dt>Wallet</dt><dd>${esc(formatCoins(config, balance))}</dd></div>
    <div class="stat"><dt>Bank</dt><dd>${esc(formatCoins(config, bank))}</dd></div>
    <div class="stat"><dt>Daily streak</dt><dd>${streak}</dd></div></dl>
    <p class="faint">${config.enabled ? "" : "The economy is off in this server. "}<a href="/dashboard/${esc(guildId)}/economy">Economy page</a></p></section>`;
}
