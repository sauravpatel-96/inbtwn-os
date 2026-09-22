import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ScaleResult } from "./recipe-calc";
import type { BaseUnit } from "./units";

export type ShoppingLine = {
  ingredientId: string;
  name: string;
  baseUnit: BaseUnit;
  /** Usable production requirement (full precision). */
  usable: number;
  /** Purchase requirement = usable / yield (full precision). */
  purchase: number;
  yieldPct: number;
  unitCost: number | null;
  /** purchase x unitCost, or null when no cost is recorded. */
  cost: number | null;
};

/**
 * Consolidate a scaled recipe tree into per-ingredient purchase requirements.
 * Purely derived from the existing production scaling result.
 */
export function collectPurchases(
  result: ScaleResult,
  into: Map<string, ShoppingLine> = new Map(),
): Map<string, ShoppingLine> {
  for (const i of result.ingredients) {
    const prev = into.get(i.ingredientId);
    const usable = (prev?.usable ?? 0) + i.usable;
    const purchase = (prev?.purchase ?? 0) + i.raw;
    into.set(i.ingredientId, {
      ingredientId: i.ingredientId,
      name: i.name,
      baseUnit: i.baseUnit,
      usable,
      purchase,
      yieldPct: i.yieldPct,
      unitCost: i.unitCost,
      cost: i.unitCost === null ? null : purchase * i.unitCost,
    });
  }
  for (const c of result.components) collectPurchases(c.result, into);
  return into;
}

function trim(n: number, dp: number): string {
  return n.toFixed(dp).replace(/\.?0+$/, "");
}

/**
 * Practical shopping display rounding only — never used in calculations.
 * <100g/ml: nearest 1 · 100g/ml–1kg/L: nearest 5 · >=1kg/L: nearest 0.05kg/L
 * "each": always rounded UP to the next whole item.
 */
export function fmtShopQty(baseQty: number | null | undefined, base: BaseUnit): string {
  if (baseQty === null || baseQty === undefined || Number.isNaN(baseQty)) return "—";
  if (base === "each") return `${Math.ceil(baseQty)} each`;

  const abs = Math.abs(baseQty);
  const step = abs < 100 ? 1 : abs < 1000 ? 5 : 50;
  const rounded = Math.round(baseQty / step) * step;
  if (Math.abs(rounded) >= 1000) return `${trim(rounded / 1000, 2)} ${base === "g" ? "kg" : "L"}`;
  return `${trim(rounded, 0)} ${base}`;
}

/** Ticked-off ingredients for one event. */
export const shoppingChecksQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["event-shopping-checks", eventId],
    queryFn: async () => {
      const res = await supabase
        .from("event_shopping_checks")
        .select("ingredient_id")
        .eq("event_id", eventId);
      if (res.error) throw new Error(res.error.message);
      return (res.data ?? []).map((r) => r.ingredient_id);
    },
  });
