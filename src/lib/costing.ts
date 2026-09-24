/**
 * Recipe & ingredient costing.
 *
 * Three separate concepts — never mixed:
 *  A. Ingredient usage cost   — proportional cost of what is consumed (recipe-calc via current_unit_cost).
 *  B. Purchase cost from scratch — whole packs needed to cover a shopping requirement.
 *  C. Actual food purchases  — money actually spent shopping for an event.
 *
 * `ingredients.current_unit_cost` (per canonical base unit, purchased/raw) is kept in
 * sync by the database from the preferred purchase option's latest price, so the
 * existing scaling engine remains the single source of usage-cost truth.
 */
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ScaleResult } from "./recipe-calc";
import type { ShoppingLine } from "./shopping";
import { toBase, type BaseUnit, type DisplayUnit } from "./units";

export type CostStatus = "ok" | "no_price" | "no_preferred" | "unit_mismatch" | "invalid_yield" | "no_valid_option";

export const COST_STATUS_LABELS: Record<CostStatus, string> = {
  ok: "Costed",
  no_price: "No purchase price",
  no_preferred: "Preferred supplier not set",
  unit_mismatch: "Cost unavailable — unit mismatch",
  invalid_yield: "Missing/invalid usable yield",
  no_valid_option: "No active purchase option",
};

export const costReason = (s: string | null | undefined) =>
  COST_STATUS_LABELS[(s ?? "no_price") as CostStatus] ?? "No purchase price";

export type Supplier = {
  id: string;
  name: string;
  active: boolean;
  notes: string | null;
  delivery_available: boolean;
  preference_notes: string | null;
};

export type PriceRow = { id: string; pack_price: number; effective_date: string; notes: string | null; created_at: string };

export type PurchaseOption = {
  id: string;
  ingredient_id: string;
  supplier_id: string;
  pack_quantity: number;
  pack_unit: DisplayUnit;
  is_preferred: boolean;
  active: boolean;
  notes: string | null;
  is_test: boolean;
  supplier: { id: string; name: string } | null;
  prices: PriceRow[];
};

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export const suppliersQuery = queryOptions({
  queryKey: ["suppliers"],
  queryFn: async () =>
    unwrap(await supabase.from("suppliers").select("*").order("name")) as unknown as Supplier[],
});

const OPTION_SELECT =
  "id, ingredient_id, supplier_id, pack_quantity, pack_unit, is_preferred, active, notes, is_test, supplier:suppliers(id, name), prices:ingredient_purchase_prices(id, pack_price, effective_date, notes, created_at)";

function normalise(rows: unknown[]): PurchaseOption[] {
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    ...(r as unknown as PurchaseOption),
    pack_quantity: Number(r["pack_quantity"]),
    prices: ((r["prices"] as PriceRow[] | null) ?? [])
      .map((p) => ({ ...p, pack_price: Number(p.pack_price) }))
      .sort((a, b) => (a.effective_date === b.effective_date ? b.created_at.localeCompare(a.created_at) : b.effective_date.localeCompare(a.effective_date))),
  }));
}

export const purchaseOptionsQuery = (ingredientId: string) =>
  queryOptions({
    queryKey: ["purchase-options", ingredientId],
    queryFn: async () =>
      normalise(
        unwrap(
          await supabase.from("ingredient_purchase_options").select(OPTION_SELECT).eq("ingredient_id", ingredientId).order("created_at"),
        ) as unknown[],
      ),
  });

export const allPurchaseOptionsQuery = queryOptions({
  queryKey: ["purchase-options", "all"],
  queryFn: async () =>
    normalise(unwrap(await supabase.from("ingredient_purchase_options").select(OPTION_SELECT)) as unknown[]),
});

/** Cost status per ingredient, as resolved by the database. */
export const ingredientCostStatusQuery = queryOptions({
  queryKey: ["ingredients", "cost-status"],
  queryFn: async () => {
    const rows = unwrap(
      await supabase.from("ingredients").select("id, name, cost_status, cost_option_id"),
    ) as { id: string; name: string; cost_status: string | null; cost_option_id: string | null }[];
    return Object.fromEntries(rows.map((r) => [r.id, r]));
  },
});

export type FoodPurchase = {
  id: string;
  event_id: string;
  supplier_id: string | null;
  purchase_date: string;
  amount: number;
  notes: string | null;
  is_test: boolean;
  supplier: { name: string } | null;
};

export const foodPurchasesQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["food-purchases", eventId],
    queryFn: async () =>
      (
        unwrap(
          await supabase
            .from("event_food_purchases")
            .select("*, supplier:suppliers(name)")
            .eq("event_id", eventId)
            .order("purchase_date"),
        ) as unknown as FoodPurchase[]
      ).map((r) => ({ ...r, amount: Number(r.amount) })),
  });

/* ---------- Calculations ---------- */

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Latest applicable price (effective on/before today; otherwise the earliest future one). */
export function latestPrice(option: PurchaseOption): PriceRow | null {
  const t = todayISO();
  return option.prices.find((p) => p.effective_date <= t) ?? [...option.prices].reverse()[0] ?? null;
}

export function packBase(option: PurchaseOption): number {
  return toBase(option.pack_quantity, option.pack_unit);
}

export function packBaseUnit(option: PurchaseOption): BaseUnit {
  return option.pack_unit === "kg" ? "g" : option.pack_unit === "L" ? "ml" : (option.pack_unit as BaseUnit);
}

/** Purchase unit cost per canonical base unit, or null on unit mismatch / no price. */
export function optionUnitCost(option: PurchaseOption, ingredientBase: BaseUnit): number | null {
  const p = latestPrice(option);
  if (!p || packBaseUnit(option) !== ingredientBase) return null;
  return p.pack_price / packBase(option);
}

/** Mirrors the database resolution: preferred → single priced option → none. */
export function resolveOption(options: PurchaseOption[]): PurchaseOption | null {
  const active = options.filter((o) => o.active);
  const pref = active.find((o) => o.is_preferred);
  if (pref) return pref;
  const priced = active.filter((o) => o.prices.length > 0);
  return priced.length === 1 ? (priced[0] ?? null) : null;
}

export type MissingIngredient = { id: string; name: string; reason: string };

export type CostSummaryResult = {
  known: number;
  complete: boolean;
  ingredientCount: number;
  costedCount: number;
  missing: MissingIngredient[];
};

/** Distinct ingredient roll-up through components (each line counted once in cost via scaleVersion). */
export function summariseCost(
  results: ScaleResult[],
  status: Record<string, { cost_status: string | null }> | undefined,
): CostSummaryResult {
  const seen = new Map<string, { name: string; costed: boolean }>();
  const walk = (r: ScaleResult) => {
    for (const i of r.ingredients) {
      const prev = seen.get(i.ingredientId);
      seen.set(i.ingredientId, { name: i.name, costed: (prev?.costed ?? true) && i.cost !== null });
    }
    for (const c of r.components) walk(c.result);
  };
  for (const r of results) walk(r);
  const missing: MissingIngredient[] = [];
  for (const [id, v] of seen) {
    if (!v.costed) {
      const s = status?.[id]?.cost_status;
      missing.push({ id, name: v.name, reason: costReason(s === "ok" ? "no_price" : s) });
    }
  }
  missing.sort((a, b) => a.name.localeCompare(b.name));
  return {
    known: results.reduce((s, r) => s + r.cost, 0),
    complete: missing.length === 0 && seen.size > 0,
    ingredientCount: seen.size,
    costedCount: seen.size - missing.length,
    missing,
  };
}

export type PackLine = {
  ingredientId: string;
  name: string;
  packs: number;
  packLabel: string;
  supplier: string;
  cost: number;
  usageCost: number | null;
};

/** B. Purchase cost from scratch: whole packs from the resolved purchase option. */
export function purchaseFromScratch(lines: ShoppingLine[], options: PurchaseOption[]) {
  const byIng = new Map<string, PurchaseOption[]>();
  for (const o of options) byIng.set(o.ingredient_id, [...(byIng.get(o.ingredient_id) ?? []), o]);
  const priced: PackLine[] = [];
  const unavailable: { ingredientId: string; name: string }[] = [];
  for (const l of lines) {
    const opt = resolveOption(byIng.get(l.ingredientId) ?? []);
    const price = opt ? latestPrice(opt) : null;
    if (!opt || !price || packBaseUnit(opt) !== l.baseUnit || !(packBase(opt) > 0)) {
      unavailable.push({ ingredientId: l.ingredientId, name: l.name });
      continue;
    }
    const packs = Math.ceil(l.purchase / packBase(opt) - 1e-9);
    priced.push({
      ingredientId: l.ingredientId,
      name: l.name,
      packs,
      packLabel: `${opt.pack_quantity} ${opt.pack_unit}`,
      supplier: opt.supplier?.name ?? "Supplier",
      cost: packs * price.pack_price,
      usageCost: l.cost,
    });
  }
  return { priced, unavailable, total: priced.reduce((s, p) => s + p.cost, 0), complete: unavailable.length === 0 };
}

export const pct1 = (n: number) => `${n.toFixed(1)}%`;
