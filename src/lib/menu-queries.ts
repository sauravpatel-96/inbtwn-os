import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { BaseUnit } from "./units";

export type MenuItemRow = Database["public"]["Tables"]["event_menu_items"]["Row"];
export type PortionSize = "small" | "medium" | "large";

export const PORTION_SIZES: { value: PortionSize; label: string; factor: number }[] = [
  { value: "small", label: "Small", factor: 0.5 },
  { value: "medium", label: "Medium", factor: 0.75 },
  { value: "large", label: "Large", factor: 1 },
];

export const portionFactor = (size: PortionSize) =>
  PORTION_SIZES.find((p) => p.value === size)?.factor ?? 0.75;

export const portionLabel = (size: PortionSize) =>
  PORTION_SIZES.find((p) => p.value === size)?.label ?? size;

/** Per-guest quantity in canonical base units for a portion size. */
export function portionQuantity(standardPortion: number | null | undefined, size: PortionSize) {
  if (standardPortion === null || standardPortion === undefined) return null;
  return Number(standardPortion) * portionFactor(size);
}

/** Display rounding only — never used for storage or calculations. */
export function fmtPortion(qty: number | null | undefined, base: BaseUnit): string {
  if (qty === null || qty === undefined || Number.isNaN(qty)) return "—";
  if (base === "each") return `${Math.ceil(qty)} each`;
  return `${Math.round(qty)}${base}`;
}

export type MenuItem = MenuItemRow & {
  recipe: { id: string; name: string; category: string; active_version_id: string | null } | null;
};

export const menuItemsQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["event-menu", eventId],
    queryFn: async () => {
      const res = await supabase
        .from("event_menu_items")
        .select("*, recipe:recipes(id, name, category, active_version_id)")
        .eq("event_id", eventId)
        .order("sort_order")
        .order("created_at");
      if (res.error) throw new Error(res.error.message);
      return (res.data ?? []) as unknown as MenuItem[];
    },
  });
