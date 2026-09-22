import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fmtProdQty } from "./production";
import type { ScaleResult } from "./recipe-calc";
import type { BaseUnit } from "./units";

export const PACKING_CATEGORIES = [
  { value: "equipment", label: "Equipment" },
  { value: "disposables", label: "Disposables" },
  { value: "other", label: "Other" },
] as const;

export type PackingCategory = (typeof PACKING_CATEGORIES)[number]["value"];

export function packingCategoryLabel(c: string): string {
  return PACKING_CATEGORIES.find((p) => p.value === c)?.label ?? "Other";
}

export type PackingItemRow = {
  id: string;
  event_id: string;
  name: string;
  quantity: number;
  category: string;
  sort_order: number;
};

/** Manual packing items for one event. */
export const packingItemsQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["event-packing-items", eventId],
    queryFn: async () => {
      const res = await supabase
        .from("event_packing_items")
        .select("id, event_id, name, quantity, category, sort_order")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (res.error) throw new Error(res.error.message);
      return (res.data ?? []) as PackingItemRow[];
    },
  });

/** Packed item keys for one event (covers generated food and manual items). */
export const packingChecksQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["event-packing-checks", eventId],
    queryFn: async () => {
      const res = await supabase
        .from("event_packing_checks")
        .select("item_key")
        .eq("event_id", eventId);
      if (res.error) throw new Error(res.error.message);
      return (res.data ?? []).map((r) => r.item_key);
    },
  });

export const manualKey = (id: string) => `manual:${id}`;

export type FoodPackLine = {
  /** Stable key so packed state survives production changes. */
  key: string;
  name: string;
  /** Formatted with the existing Production display formatter. */
  quantity: string;
};

/**
 * Derive the finished dishes that leave the kitchen from an already-calculated
 * Production result. One line per finished menu dish, using the full-precision
 * final production target. No quantities are recalculated here — Production
 * remains the single source of truth.
 */
export function foodLinesFromProduction(
  dishName: string,
  versionId: string,
  base: BaseUnit,
  result: ScaleResult,
): FoodPackLine[] {
  return [
    {
      key: `food:${versionId}`,
      name: dishName,
      quantity: fmtProdQty(result.required, result.baseUnit ?? base),
    },
  ];
}
