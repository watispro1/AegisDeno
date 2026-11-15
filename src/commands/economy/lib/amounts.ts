/**
 * Reading typed amounts ("1,500", "2.5k", "all", "half") and the autocomplete
 * suggestions for amount options. Pure, so they are tested directly.
 */
import { MAX_BALANCE, formatCoins, type EconomyConfig } from "../../../services/economyLogic";

export type AmountRequest = number | "all" | "half";

const SUFFIX: Record<string, number> = { k: 1_000, m: 1_000_000, b: 1_000_000_000 };

/**
 * A typed amount: a whole number (commas, spaces and underscores allowed),
 * a number with k/m/b ("2.5k" = 2,500), or all/max/everything/half.
 * Null when it can't be read or is outside 1..MAX_BALANCE.
 */
export function parseAmountInput(raw: string | null | undefined): AmountRequest | null {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "all" || v === "max" || v === "everything") return "all";
  if (v === "half" || v === "50%") return "half";
  if (v === "100%") return "all";
  const clean = v.replace(/[,_\s]/g, "");
  const m = /^(\d{1,13}(?:\.\d{1,3})?)([kmb])?$/.exec(clean);
  if (!m) return null;
  if (!m[2] && m[1].includes(".")) return null;
  const n = Math.round(Number(m[1]) * (m[2] ? SUFFIX[m[2]] : 1));
  if (!Number.isSafeInteger(n) || n < 1 || n > MAX_BALANCE) return null;
  return n;
}

/** A concrete number for a request against what is available (all → everything, half → floor(half), at least 1). */
export function resolveAmount(request: AmountRequest, available: number): number {
  if (request === "all") return Math.max(0, available);
  if (request === "half") return available > 0 ? Math.max(1, Math.floor(available / 2)) : 0;
  return request;
}

export interface Choice<V extends string | number> { name: string; value: V }

const n = (v: number) => v.toLocaleString("en-US");

/**
 * Suggestions for a text amount (/deposit, /withdraw): All and Half of what
 * is available, then whatever the member typed, read as a number.
 */
export function textAmountChoices(cfg: EconomyConfig, available: number, typed: string, where: string): Choice<string>[] {
  const out: Choice<string>[] = [];
  const parsed = typed.trim() ? parseAmountInput(typed) : null;
  if (typeof parsed === "number") {
    out.push({ name: parsed > available ? `${n(parsed)} (you only have ${n(available)} in your ${where})` : n(parsed), value: String(parsed) });
  }
  if (available > 0) {
    out.push({ name: `All: ${formatCoins(cfg, available)} (everything in your ${where})`, value: "all" });
    if (available > 1) out.push({ name: `Half: ${formatCoins(cfg, Math.floor(available / 2))}`, value: "half" });
  } else if (!out.length) {
    out.push({ name: `Your ${where} is empty`, value: "all" });
  }
  const q = typed.trim().toLowerCase();
  // Typing "a" or "h" narrows to All or Half.
  const filtered = q && typeof parsed !== "number" ? out.filter(c => c.value.startsWith(q) || c.name.toLowerCase().startsWith(q)) : out;
  return (filtered.length ? filtered : out).map(c => ({ name: c.name.slice(0, 100), value: c.value }));
}

/**
 * Suggestions for a whole-number option (/pay amount, /gamble bet): the
 * typed number, then All, Half and a Quarter of what is available, each
 * kept inside [min, max]. Values are numbers, as Discord expects for an
 * integer option.
 */
export function integerAmountChoices(cfg: EconomyConfig, opts: { available: number; min: number; max: number; typed: string; noun?: string }): Choice<number>[] {
  const { available, typed } = opts;
  const min = Math.max(1, opts.min);
  const max = Math.max(min, Math.min(opts.max, MAX_BALANCE));
  const out: Choice<number>[] = [];
  const seen = new Set<number>();
  const add = (value: number, name: string) => {
    if (!Number.isSafeInteger(value) || value < min || value > max || seen.has(value)) return;
    seen.add(value);
    out.push({ name: name.slice(0, 100), value });
  };
  const parsed = typed.trim() ? parseAmountInput(typed) : null;
  if (parsed !== null) {
    const v = resolveAmount(parsed, available);
    if (v > max) out.push({ name: `${n(max)} (the most allowed)`, value: max });
    else if (v < min) out.push({ name: `${n(min)} (the least allowed)`, value: min });
    else add(v, v > available ? `${n(v)} (you only have ${n(available)})` : n(v));
  }
  const capped = Math.min(available, max);
  if (capped >= min) {
    add(capped, `All: ${formatCoins(cfg, capped)}${capped < available ? " (the most allowed)" : ""}`);
    add(Math.floor(capped / 2), `Half: ${formatCoins(cfg, Math.floor(capped / 2))}`);
    add(Math.floor(capped / 4), `Quarter: ${formatCoins(cfg, Math.floor(capped / 4))}`);
    add(min, `Minimum: ${formatCoins(cfg, min)}`);
  }
  if (!out.length) {
    const noun = opts.noun ?? "coins";
    out.push({ name: `You need at least ${n(min)} ${noun} in your wallet`, value: min });
  }
  return out.slice(0, 25);
}

/** Suggestions for a count (buy or sell quantity): the typed number, then the most that works and a few round numbers. */
export function quantityChoices(most: number, typed: string, label: (q: number) => string, cap = 100): Choice<number>[] {
  const top = Math.max(0, Math.min(most, cap));
  const out: Choice<number>[] = [];
  const seen = new Set<number>();
  const add = (q: number) => {
    if (!Number.isSafeInteger(q) || q < 1 || q > cap || seen.has(q)) return;
    seen.add(q);
    out.push({ name: label(q).slice(0, 100), value: q });
  };
  const t = Number(typed.trim().replace(/[,_\s]/g, ""));
  if (typed.trim() && Number.isSafeInteger(t)) add(Math.min(Math.max(1, t), cap));
  if (top >= 1) {
    add(top);
    for (const q of [1, 2, 5, 10, 25, 50]) if (q <= top) add(q);
  } else {
    add(1);
  }
  return out.slice(0, 25);
}
