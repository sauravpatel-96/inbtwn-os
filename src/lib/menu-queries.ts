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

/** Name shown for a menu dish: the linked recipe, else the imported dish name. */
export const menuDishName = (m: Pick<MenuItem, "recipe" | "dish_name">) =>
  m.recipe?.name ?? m.dish_name ?? "Dish";

export type AcceptedDish = { id: string; name: string; section: string; sort: number };

/** Dishes on the event's accepted quote (the issued snapshot). Read-only. */
export const acceptedQuoteDishesQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["accepted-quote-dishes", eventId],
    queryFn: async (): Promise<{ quoteNumber: string | null; dishes: AcceptedDish[] } | null> => {
      const q = await supabase
        .from("event_quotes")
        .select("*")
        .eq("event_id", eventId)
        .eq("status", "accepted")
        .maybeSingle();
      if (q.error) throw new Error(q.error.message);
      if (!q.data) return null;
      const [secs, items] = await Promise.all([
        supabase.from("event_quote_sections").select("id, name, sort_order").eq("quote_id", q.data.id),
        supabase.from("event_quote_items").select("id, name, section_id, sort_order, visible").eq("quote_id", q.data.id),
      ]);
      if (secs.error) throw new Error(secs.error.message);
      if (items.error) throw new Error(items.error.message);
      const secMap = new Map((secs.data ?? []).map((s) => [s.id, s]));
      const dishes = (items.data ?? [])
        .filter((i) => i.visible !== false && i.name.trim())
        .map((i) => {
          const s = secMap.get(i.section_id);
          return { id: i.id, name: i.name.trim(), section: s?.name ?? "", sort: (s?.sort_order ?? 0) * 1000 + i.sort_order };
        })
        .sort((a, b) => a.sort - b.sort);
      return { quoteNumber: q.data.quote_number ?? null, dishes };
    },
  });

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Copies accepted quote dishes onto the operational menu as unlinked dishes.
 * Never touches the quote. Idempotent: skips dishes already imported (by source
 * identity, backed by a unique index) or already on the menu under the same name.
 */
export async function importAcceptedDishes(eventId: string, dishes: AcceptedDish[], existing: MenuItem[]) {
  const sources = new Set(existing.map((m) => m.source_quote_item_id).filter(Boolean));
  const names = new Set(existing.map((m) => norm(menuDishName(m))));
  let sort = existing.length;
  const rows = [];
  for (const d of dishes) {
    if (sources.has(d.id) || names.has(norm(d.name))) continue;
    names.add(norm(d.name));
    rows.push({
      event_id: eventId,
      recipe_id: null,
      recipe_version_id: null,
      dish_name: d.name,
      source_quote_item_id: d.id,
      portion_size: "medium",
      quantity_per_guest: null,
      quantity_unit: "g" as const,
      sort_order: ++sort,
    });
  }
  if (!rows.length) return 0;
  const { error } = await supabase
    .from("event_menu_items")
    .insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}
