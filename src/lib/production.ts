import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ScaleResult } from "./recipe-calc";
import type { BaseUnit } from "./units";

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

/**
 * Buffer % for a menu dish. Buffer is a production setting, so it follows the
 * recipe's CURRENT active version (the latest saved setting, including an
 * explicit 0%), even when the dish is pinned to an older version's ingredients.
 * Falls back to the pinned version, then 0 — never an assumed default.
 */
export function dishBuffer(
  item: { recipe_version_id: string | null; recipe?: { active_version_id: string | null } | null },
  buffers: Record<string, number> | undefined,
): number {
  const active = item.recipe?.active_version_id ?? null;
  if (active && buffers && active in buffers) return buffers[active];
  const pinned = item.recipe_version_id;
  if (pinned && buffers && pinned in buffers) return buffers[pinned];
  return 0;
}

function trim(n: number, decimalPlaces: number): string {
  if (decimalPlaces === 0) return String(Math.round(n));
  return n.toFixed(decimalPlaces).replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * Kitchen-friendly production display rounding only. The unrounded canonical
 * quantity remains in the calculation result and ingredient consolidation.
 */
export function fmtProdQty(baseQty: number | null | undefined, base: BaseUnit): string {
  if (baseQty === null || baseQty === undefined || Number.isNaN(baseQty)) return "—";
  // Strip float noise (e.g. 20 × 1.1 = 22.000000000000004) before rounding up.
  if (base === "each") return `${Math.ceil(Math.round(baseQty * 1e6) / 1e6)} each`;

  const absolute = Math.abs(baseQty);
  const step = absolute < 100 ? 1 : absolute < 1000 ? 5 : 50;
  const rounded = Math.round(baseQty / step) * step;
  if (Math.abs(rounded) >= 1000) {
    return `${trim(rounded / 1000, 2)} ${base === "g" ? "kg" : "L"}`;
  }
  return `${trim(rounded, 0)} ${base}`;
}

/** Split practical production formatting for the large MAKE readout. */
export function bigProdQty(baseQty: number, base: BaseUnit): { value: string; unit: string } {
  const formatted = fmtProdQty(baseQty, base);
  const splitAt = formatted.lastIndexOf(" ");
  return {
    value: formatted.slice(0, splitAt),
    unit: formatted.slice(splitAt + 1).toUpperCase(),
  };
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
