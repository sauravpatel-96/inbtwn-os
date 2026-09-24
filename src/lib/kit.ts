/**
 * Event Kit — equipment, reusable serveware and consumables.
 *
 * Operational only: no hire, no stock ledger, no finance effect.
 * Required quantities are derived (never stored for per-guest rules) so a
 * guest-count change recalculates automatically, while an explicit
 * quantity_override always wins.
 */
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type KitItemRow = Database["public"]["Tables"]["kit_items"]["Row"];
export type EventKitRow = Database["public"]["Tables"]["event_kit_items"]["Row"];
export type KitCategory = "equipment" | "serveware" | "consumable";
export type PurchaseStatus = "need_to_buy" | "have_enough" | "bought";

export const KIT_CATEGORIES: { value: KitCategory; label: string; plural: string }[] = [
  { value: "equipment", label: "Equipment", plural: "Equipment" },
  { value: "serveware", label: "Reusable serveware", plural: "Serveware" },
  { value: "consumable", label: "Consumable", plural: "Consumables" },
];
export const kitCategoryLabel = (c: string) => KIT_CATEGORIES.find((k) => k.value === c)?.label ?? c;
export const isReusable = (c: string) => c === "equipment" || c === "serveware";

export const PURCHASE_STATUSES: { value: PurchaseStatus; label: string }[] = [
  { value: "need_to_buy", label: "Need to buy" },
  { value: "have_enough", label: "Have enough" },
  { value: "bought", label: "Bought" },
];
export const purchaseLabel = (s: string) => PURCHASE_STATUSES.find((p) => p.value === s)?.label ?? s;

export type TemplateKey = "buffet" | "drop_off" | "table";
export const KIT_TEMPLATES: { key: TemplateKey; label: string; column: "template_buffet" | "template_drop_off" | "template_table" }[] = [
  { key: "buffet", label: "Buffet", column: "template_buffet" },
  { key: "drop_off", label: "Drop-off", column: "template_drop_off" },
  { key: "table", label: "Table / plated service", column: "template_table" },
];

/** Suggest a template from the event's service style (Buffet is the INBTWN default). */
export function suggestedTemplate(serviceStyle: string | null | undefined): TemplateKey {
  const s = (serviceStyle ?? "").toLowerCase();
  if (s.includes("drop")) return "drop_off";
  if (s.includes("plated") || s.includes("family") || s.includes("sharing")) return "table";
  return "buffet";
}

/** Whole physical items from a per-guest rule; tiny epsilon avoids float noise (1.1×20 = 22.000000000000004). */
export function perGuestQty(perGuest: number, guests: number): number {
  const raw = perGuest * guests;
  return Math.max(0, Math.ceil(raw - 1e-9));
}

export type KitLine = {
  row: EventKitRow;
  item: KitItemRow;
  category: KitCategory;
  reusable: boolean;
  required: number;
  /** calculated before any override */
  calculated: number;
  overridden: boolean;
  perGuestRule: boolean;
  owned: number | null;
  /** reusable shortage, or consumable required when Need to buy; 0 otherwise */
  toBuy: number;
  packed: number;
  packedComplete: boolean;
  returned: number | null;
  missing: number;
};

export function kitLine(row: EventKitRow, item: KitItemRow, guests: number): KitLine {
  const category = item.category as KitCategory;
  const reusable = isReusable(category);
  const perGuestRule = row.base_quantity == null && item.per_guest != null && Number(item.per_guest) > 0;
  const calculated =
    row.base_quantity != null ? row.base_quantity : perGuestRule ? perGuestQty(Number(item.per_guest), guests) : 0;
  const overridden = row.quantity_override != null;
  const required = overridden ? row.quantity_override! : calculated;
  const owned = reusable ? (item.owned_quantity ?? 0) : null;
  const toBuy = reusable
    ? Math.max(required - (owned ?? 0), 0)
    : row.purchase_status === "need_to_buy"
      ? required
      : 0;
  const packed = row.packed_quantity ?? 0;
  const returned = reusable ? row.returned_quantity : null;
  return {
    row,
    item,
    category,
    reusable,
    required,
    calculated,
    overridden,
    perGuestRule,
    owned,
    toBuy,
    packed,
    packedComplete: required > 0 ? packed >= required : packed > 0,
    returned,
    missing: reusable && packed > 0 && returned != null ? Math.max(packed - returned, 0) : 0,
  };
}

export function kitLines(rows: EventKitRow[], items: KitItemRow[], guests: number): KitLine[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const order: Record<string, number> = { equipment: 0, serveware: 1, consumable: 2 };
  return rows
    .filter((r) => byId.has(r.kit_item_id))
    .map((r) => kitLine(r, byId.get(r.kit_item_id)!, guests))
    .sort((a, b) => order[a.category]! - order[b.category]! || a.row.sort_order - b.row.sort_order || a.item.name.localeCompare(b.item.name));
}

export type KitSummary = {
  total: number;
  reusable: number;
  consumables: number;
  toBuy: number;
  packed: number;
  notPacked: number;
  reusablePacked: number;
  reusableTotal: number;
  returnPending: number;
  missing: number;
};

export function kitSummary(lines: KitLine[]): KitSummary {
  const reusable = lines.filter((l) => l.reusable);
  const active = lines.filter((l) => l.required > 0);
  return {
    total: lines.length,
    reusable: reusable.length,
    consumables: lines.length - reusable.length,
    toBuy: lines.filter((l) => l.toBuy > 0).length,
    packed: active.filter((l) => l.packedComplete).length,
    notPacked: active.filter((l) => !l.packedComplete).length,
    reusablePacked: reusable.filter((l) => l.required > 0 && l.packedComplete).length,
    reusableTotal: reusable.filter((l) => l.required > 0).length,
    returnPending: reusable.filter((l) => l.packed > 0 && l.returned == null).length,
    missing: reusable.reduce((s, l) => s + l.missing, 0),
  };
}

export const kitItemsQuery = queryOptions({
  queryKey: ["kit-items"],
  queryFn: async () => {
    const res = await supabase.from("kit_items").select("*").order("category").order("name");
    if (res.error) throw new Error(res.error.message);
    return res.data ?? [];
  },
});

export const eventKitQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["event-kit", eventId],
    queryFn: async () => {
      const res = await supabase
        .from("event_kit_items")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order")
        .order("created_at");
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
  });

/** Adds a template's items to an event, skipping anything already on the list (non-destructive). */
export async function applyTemplate(eventId: string, key: TemplateKey, items: KitItemRow[], existing: EventKitRow[]) {
  const t = KIT_TEMPLATES.find((x) => x.key === key)!;
  const have = new Set(existing.map((e) => e.kit_item_id));
  const rows = items
    .filter((i) => i.active && i[t.column] != null && !have.has(i.id))
    .map((i, idx) => {
      const q = i[t.column]!;
      // 0 = use per-guest rule when present
      const base = q === 0 && i.per_guest != null && Number(i.per_guest) > 0 ? null : q;
      return { event_id: eventId, kit_item_id: i.id, source: "template", base_quantity: base, sort_order: existing.length + idx + 1 };
    });
  if (!rows.length) return 0;
  const { error } = await supabase.from("event_kit_items").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}
