import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ScaleResult } from "./recipe-calc";
import { fmtQty, type BaseUnit } from "./units";

/** Default buffer percentage per recipe version (recipe-version safe). */
export const versionBuffersQuery = queryOptions({
  queryKey: ["recipe-version-buffers"],
  queryFn: async () => {
    const res = await supabase.from("recipe_versions").select("id, default_buffer_percentage");
    if (res.error) throw new Error(res.error.message);
    const map: Record<string, number> = {};
    for (const r of res.data ?? []) map[r.id] = Number(r.default_buffer_percentage ?? 0);
    return map;
  },
});

/** Display rounding only: count-based quantities round up to the next whole item. */
export function fmtProdQty(baseQty: number | null | undefined, base: BaseUnit): string {
  if (baseQty === null || baseQty === undefined || Number.isNaN(baseQty)) return "—";
  return fmtQty(base === "each" ? Math.ceil(baseQty) : baseQty, base);
}

export type TotalLine = {
  ingredientId: string;
  name: string;
  baseUnit: BaseUnit;
  usable: number;
  raw: number;
  hasYield: boolean;
};

/** Flatten a scale result tree into per-ingredient totals. */
export function collectIngredients(result: ScaleResult, into: Map<string, TotalLine> = new Map()) {
  for (const i of result.ingredients) {
    const prev = into.get(i.ingredientId);
    into.set(i.ingredientId, {
      ingredientId: i.ingredientId,
      name: i.name,
      baseUnit: i.baseUnit,
      usable: (prev?.usable ?? 0) + i.usable,
      raw: (prev?.raw ?? 0) + i.raw,
      hasYield: (prev?.hasYield ?? false) || i.yieldPct !== 100,
    });
  }
  for (const c of result.components) collectIngredients(c.result, into);
  return into;
}
